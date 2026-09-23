import json
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from typing import List, Optional
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Liquidacion, Viaje, ParametroLiquidacion, UnidadTransporte
from app.schemas.liquidacion import LiquidacionCreate, LiquidacionResponse, LiquidacionDetalleResponse
from app.schemas.viaje import ViajeResponse
from app.services.calculation_engine import calculate_liquidacion_resumen
from app.services.excel_export import export_liquidacion_placa_excel
from app.services.pdf_export import export_liquidacion_placa_pdf

router = APIRouter(prefix="/tenants/{schema_name}/liquidaciones", tags=["Liquidaciones de Fletes"])

@router.get("/", response_model=List[LiquidacionResponse])
def list_liquidaciones(
    schema_name: str,
    periodo_mes: Optional[str] = None,
    placa: Optional[str] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Liquidacion)
        if periodo_mes:
            query = query.filter(Liquidacion.periodo_mes == periodo_mes)
        if placa:
            query = query.filter(Liquidacion.placa == placa.upper().strip())
        return query.order_by(Liquidacion.created_at.desc()).all()
    finally:
        session.close()

@router.post("/", response_model=LiquidacionResponse)
def generate_liquidacion(
    schema_name: str,
    liq_in: LiquidacionCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        placa_clean = liq_in.placa.upper().strip()
        periodo = liq_in.periodo_mes.strip()

        # Obtener los viajes correspondientes
        viajes = session.query(Viaje).filter(
            Viaje.placa == placa_clean,
            Viaje.periodo_mes == periodo
        ).order_by(Viaje.fecha_carga.asc()).all()

        if not viajes:
            raise HTTPException(
                status_code=400,
                detail=f"No se encontraron viajes para la placa {placa_clean} en el periodo {periodo}"
            )

        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()

        # Overrides si se enviaron valores manuales
        overrides = {}
        if liq_in.desc_comision_usd_m3_bs is not None:
            overrides["desc_comision_usd_m3_bs"] = liq_in.desc_comision_usd_m3_bs
        if liq_in.desc_comision_7pct_bs is not None:
            overrides["desc_comision_7pct_bs"] = liq_in.desc_comision_7pct_bs
        if liq_in.desc_comision_ypfb_bolgart_7pct_bs is not None:
            overrides["desc_comision_ypfb_bolgart_7pct_bs"] = liq_in.desc_comision_ypfb_bolgart_7pct_bs
        if liq_in.desc_comision_3pct_bs is not None:
            overrides["desc_comision_3pct_bs"] = liq_in.desc_comision_3pct_bs
        if liq_in.desc_hojas_ruta_bs is not None:
            overrides["desc_hojas_ruta_bs"] = liq_in.desc_hojas_ruta_bs
        if liq_in.desc_gps_bs is not None:
            overrides["desc_gps_bs"] = liq_in.desc_gps_bs
        if liq_in.desc_anticipos_otros_bs is not None:
            overrides["desc_anticipos_otros_bs"] = liq_in.desc_anticipos_otros_bs
        if liq_in.desc_otros_ajustes_bs is not None:
            overrides["desc_otros_ajustes_bs"] = liq_in.desc_otros_ajustes_bs

        # Calcular resumen operativo y deducciones
        resumen = calculate_liquidacion_resumen(viajes, params, overrides)

        # Generar código correlativo
        codigo = f"LIQ-{periodo}-{placa_clean}"
        
        # Guardar snapshot de firmas vigentes
        firmas_dict = {
            "realizado_por": getattr(params, "firma_realizado_por", "JAQUELINE LOVERA TIÑINI"),
            "revisado_por": getattr(params, "firma_revisado_por", "JOSE LOVERA TIÑINI / GERENTE GENERAL"),
            "autorizado_por": getattr(params, "firma_autorizado_por", "DIRECTORIO"),
            "cancelado_por": getattr(params, "firma_cancelado_por", "TOMASA TIÑINI MITA / APOYO")
        }

        # Verificar si ya existe una liquidación para esa placa y mes
        liq = session.query(Liquidacion).filter(
            Liquidacion.periodo_mes == periodo,
            Liquidacion.placa == placa_clean
        ).first()

        fecha_emision = liq_in.fecha_emision or date.today()

        if not liq:
            liq = Liquidacion(
                codigo=codigo,
                periodo_mes=periodo,
                placa=placa_clean,
                fecha_emision=fecha_emision,
                **resumen,
                firmas_json=json.dumps(firmas_dict),
                estado="Generada",
                notas=liq_in.notas
            )
            session.add(liq)
            session.commit()
            session.refresh(liq)
        else:
            # Actualizar existente
            for k, v in resumen.items():
                setattr(liq, k, v)
            liq.fecha_emision = fecha_emision
            liq.firmas_json = json.dumps(firmas_dict)
            liq.notas = liq_in.notas or liq.notas
            session.commit()
            session.refresh(liq)

        # Asociar los viajes a esta liquidación
        for v in viajes:
            v.liquidacion_id = liq.id
            v.estado = "Liquidado"
        session.commit()
        session.refresh(liq)

        return liq

    finally:
        session.close()

@router.get("/{id}", response_model=LiquidacionDetalleResponse)
def get_liquidacion_detalle(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        liq = session.query(Liquidacion).filter(Liquidacion.id == id).first()
        if not liq:
            raise HTTPException(status_code=404, detail="Liquidación no encontrada")

        viajes = session.query(Viaje).filter(Viaje.liquidacion_id == id).order_by(Viaje.fecha_carga.asc()).all()
        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        firmas = {}
        if liq.firmas_json:
            try:
                firmas = json.loads(liq.firmas_json)
            except Exception:
                pass
        if not firmas:
            firmas = {
                "realizado_por": getattr(params, "firma_realizado_por", "JAQUELINE LOVERA TIÑINI"),
                "revisado_por": getattr(params, "firma_revisado_por", "JOSE LOVERA TIÑINI / GERENTE GENERAL"),
                "autorizado_por": getattr(params, "firma_autorizado_por", "DIRECTORIO"),
                "cancelado_por": getattr(params, "firma_cancelado_por", "TOMASA TIÑINI MITA / APOYO")
            }

        empresa_dict = {
            "name": empresa.name,
            "nit": empresa.nit,
            "direccion": empresa.direccion,
            "representante_legal": empresa.representante_legal,
            "logo_base64": empresa.logo_base64
        }

        viajes_res = [ViajeResponse.model_validate(v) for v in viajes]

        resp = LiquidacionDetalleResponse(
            id=liq.id,
            codigo=liq.codigo,
            periodo_mes=liq.periodo_mes,
            placa=liq.placa,
            fecha_emision=liq.fecha_emision,
            total_viajes=liq.total_viajes,
            total_volumen_origen_litros=liq.total_volumen_origen_litros,
            total_volumen_recepcionado_litros=liq.total_volumen_recepcionado_litros,
            total_merma_real_litros=liq.total_merma_real_litros,
            total_merma_excedente_litros=liq.total_merma_excedente_litros,
            flete_total_bruto_bs=liq.flete_total_bruto_bs,
            desc_merma_bs=liq.desc_merma_bs,
            desc_comision_usd_m3_bs=liq.desc_comision_usd_m3_bs,
            desc_comision_7pct_bs=liq.desc_comision_7pct_bs,
            desc_comision_ypfb_bolgart_7pct_bs=liq.desc_comision_ypfb_bolgart_7pct_bs,
            desc_comision_3pct_bs=liq.desc_comision_3pct_bs,
            desc_hojas_ruta_bs=liq.desc_hojas_ruta_bs,
            desc_gps_bs=liq.desc_gps_bs,
            desc_anticipos_otros_bs=liq.desc_anticipos_otros_bs,
            desc_otros_ajustes_bs=liq.desc_otros_ajustes_bs,
            total_descuentos_bs=liq.total_descuentos_bs,
            liquido_pagable_bs=liq.liquido_pagable_bs,
            firmas_json=liq.firmas_json,
            estado=liq.estado,
            notas=liq.notas,
            created_at=liq.created_at,
            viajes=viajes_res,
            empresa=empresa_dict,
            firmas=firmas
        )
        return resp

    finally:
        session.close()

@router.get("/{id}/export/excel")
def export_liquidacion_excel(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        liq = session.query(Liquidacion).filter(Liquidacion.id == id).first()
        if not liq:
            raise HTTPException(status_code=404, detail="Liquidación no encontrada")

        viajes = session.query(Viaje).filter(Viaje.liquidacion_id == id).order_by(Viaje.fecha_carga.asc()).all()
        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        empresa_dict = {
            "name": empresa.name,
            "nit": empresa.nit,
            "logo_base64": empresa.logo_base64
        }

        excel_buffer = export_liquidacion_placa_excel(liq, viajes, empresa_dict, params)
        filename = f"Liquidacion_{liq.placa}_{liq.periodo_mes}.xlsx"

        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    finally:
        session.close()

@router.get("/{id}/export/pdf")
def export_liquidacion_pdf(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        liq = session.query(Liquidacion).filter(Liquidacion.id == id).first()
        if not liq:
            raise HTTPException(status_code=404, detail="Liquidación no encontrada")

        viajes = session.query(Viaje).filter(Viaje.liquidacion_id == id).order_by(Viaje.fecha_carga.asc()).all()
        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        empresa_dict = {
            "name": empresa.name,
            "nit": empresa.nit,
            "logo_base64": empresa.logo_base64
        }

        pdf_buffer = export_liquidacion_placa_pdf(liq, viajes, empresa_dict, params)
        filename = f"Liquidacion_{liq.placa}_{liq.periodo_mes}.pdf"

        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    finally:
        session.close()

@router.delete("/{id}")
def delete_liquidacion(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        liq = session.query(Liquidacion).filter(Liquidacion.id == id).first()
        if not liq:
            raise HTTPException(status_code=404, detail="Liquidación no encontrada")

        # Desvincular viajes
        viajes = session.query(Viaje).filter(Viaje.liquidacion_id == id).all()
        for v in viajes:
            v.liquidacion_id = None
            v.estado = "Pendiente"

        session.delete(liq)
        session.commit()
        return {"message": "Liquidación eliminada y viajes liberados a estado Pendiente"}
    finally:
        session.close()
