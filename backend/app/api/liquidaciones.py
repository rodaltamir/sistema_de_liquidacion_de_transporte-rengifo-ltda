import json
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from typing import List, Optional
from sqlalchemy import func, or_
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

def resolve_period_and_trips(
    session,
    placa_clean: str,
    periodo_mes: Optional[str] = None,
    tipo_periodo: Optional[str] = "mes",
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None
):
    """
    Resuelve los viajes y etiquetas de periodo para cualquier tipo de consolidación:
    - Anual: Todos los viajes del año seleccionado
    - Semestral: Todos los viajes del 1er (ene-jun) o 2do (jul-dic) semestre
    - Personalizado: Todos los viajes dentro del rango fecha_desde a fecha_hasta
    - Mensual: Todos los viajes del mes específico (YYYY-MM)
    """
    query_viajes = session.query(Viaje).filter(Viaje.placa == placa_clean)

    # 1. Modo Anual
    if tipo_periodo == "anual" or (anio and not semestre and not fecha_desde and (not periodo_mes or periodo_mes.startswith("ANUAL-") or len(periodo_mes) == 4)):
        target_year = anio or (int(periodo_mes.replace("ANUAL-", "")) if periodo_mes and (periodo_mes.startswith("ANUAL-") or len(periodo_mes) == 4) else date.today().year)
        query_viajes = query_viajes.filter(
            or_(
                Viaje.periodo_mes.startswith(f"{target_year}-"),
                func.extract('year', Viaje.fecha_carga) == target_year
            )
        )
        periodo_label = f"ANUAL-{target_year}"
        codigo_periodo = f"LIQ-ANUAL-{target_year}-{placa_clean}"
        display_label = f"Gestión {target_year} (Anual)"

    # 2. Modo Semestral
    elif tipo_periodo == "semestral" or semestre or (periodo_mes and ("-S1" in periodo_mes or "-S2" in periodo_mes)):
        target_year = anio or (fecha_desde.year if fecha_desde else (int(periodo_mes.split("-")[0]) if periodo_mes and "-" in periodo_mes else date.today().year))
        sem_num = semestre or (1 if (fecha_desde and fecha_desde.month <= 6) else (1 if (periodo_mes and "-S1" in periodo_mes) else (2 if (periodo_mes and "-S2" in periodo_mes) else 1)))
        meses_sem = [f"{target_year}-{str(m).zfill(2)}" for m in (range(1, 7) if sem_num == 1 else range(7, 13))]
        sem_start = date(target_year, 1 if sem_num == 1 else 7, 1)
        sem_end = date(target_year, 6 if sem_num == 1 else 12, 30 if sem_num == 1 else 31)
        query_viajes = query_viajes.filter(
            or_(
                Viaje.periodo_mes.in_(meses_sem),
                Viaje.fecha_carga.between(sem_start, sem_end)
            )
        )
        periodo_label = f"{target_year}-S{sem_num}"
        codigo_periodo = f"LIQ-SEM-{target_year}-S{sem_num}-{placa_clean}"
        display_label = f"{'1er' if sem_num == 1 else '2do'} Semestre {target_year}"

    # 3. Modo Personalizado / Rango
    elif tipo_periodo == "personalizado" or (fecha_desde and fecha_hasta):
        query_viajes = query_viajes.filter(
            or_(
                Viaje.fecha_carga.between(fecha_desde, fecha_hasta),
                Viaje.fecha_descarga.between(fecha_desde, fecha_hasta)
            )
        )
        d_str = fecha_desde.strftime("%Y-%m-%d") if fecha_desde else ""
        h_str = fecha_hasta.strftime("%Y-%m-%d") if fecha_hasta else ""
        periodo_label = f"{d_str}_{h_str}"
        codigo_periodo = f"LIQ-RANGO-{d_str}_{h_str}-{placa_clean}"
        display_label = f"Del {d_str} al {h_str}"

    # 4. Modo Mensual (por defecto)
    else:
        target_period = periodo_mes or date.today().strftime("%Y-%m")
        query_viajes = query_viajes.filter(Viaje.periodo_mes == target_period)
        periodo_label = target_period
        codigo_periodo = f"LIQ-{target_period}-{placa_clean}"
        display_label = target_period

    viajes = query_viajes.order_by(Viaje.fecha_carga.asc()).all()
    return viajes, periodo_label, codigo_periodo, display_label

@router.get("/", response_model=List[LiquidacionResponse])
def list_liquidaciones(
    schema_name: str,
    periodo_mes: Optional[str] = None,
    placa: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Liquidacion)
        if periodo_mes:
            query = query.filter(Liquidacion.periodo_mes == periodo_mes)
        elif anio and semestre:
            sem_tag = f"{anio}-S{semestre}"
            query = query.filter(
                or_(
                    Liquidacion.periodo_mes == sem_tag,
                    Liquidacion.codigo.contains(f"SEM-{anio}-S{semestre}")
                )
            )
        elif anio:
            query = query.filter(
                or_(
                    Liquidacion.periodo_mes.startswith(f"{anio}-"),
                    Liquidacion.periodo_mes == f"ANUAL-{anio}",
                    Liquidacion.periodo_mes == str(anio),
                    func.extract('year', Liquidacion.fecha_emision) == anio
                )
            )
        elif fecha_desde and fecha_hasta:
            desde_str = fecha_desde.strftime("%Y-%m")
            hasta_str = fecha_hasta.strftime("%Y-%m")
            query = query.filter(
                (Liquidacion.fecha_emision.between(fecha_desde, fecha_hasta)) |
                (Liquidacion.periodo_mes.between(desde_str, hasta_str))
            )
        if placa:
            query = query.filter(Liquidacion.placa == placa.upper().strip())
        return query.order_by(Liquidacion.periodo_mes.desc(), Liquidacion.created_at.desc()).all()
    finally:
        session.close()

@router.get("/consolidada", response_model=LiquidacionDetalleResponse)
def get_liquidacion_consolidada(
    schema_name: str,
    placa: str,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Retorna la planilla oficial consolidada (Hojas 2 y 3) para cualquier periodo (Anual, Semestral, Personalizado o Mensual).
    Si ya fue guardada en base de datos la retorna. Si no, calcula dinámicamente en tiempo real
    todos los fletes, mermas, deducciones y líquido pagable basándose en los viajes del periodo.
    """
    session = get_tenant_session(schema_name)
    try:
        placa_clean = placa.upper().strip()
        viajes, periodo_label, codigo_periodo, display_label = resolve_period_and_trips(
            session=session,
            placa_clean=placa_clean,
            periodo_mes=periodo_mes,
            tipo_periodo=tipo_periodo,
            anio=anio,
            semestre=semestre,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta
        )

        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        firmas_default = {
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

        # Verificar si ya existe una liquidación guardada en DB para este código o periodo exacto
        liq_saved = session.query(Liquidacion).filter(
            or_(
                Liquidacion.codigo == codigo_periodo,
                (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == placa_clean)
            )
        ).first()

        viajes_res = [ViajeResponse.model_validate(v) for v in viajes]

        if liq_saved:
            firmas = firmas_default
            if liq_saved.firmas_json:
                try:
                    firmas = json.loads(liq_saved.firmas_json)
                except Exception:
                    pass
            return LiquidacionDetalleResponse(
                id=liq_saved.id,
                codigo=liq_saved.codigo,
                periodo_mes=liq_saved.periodo_mes,
                placa=liq_saved.placa,
                fecha_emision=liq_saved.fecha_emision,
                total_viajes=len(viajes) if viajes else liq_saved.total_viajes,
                total_volumen_origen_litros=liq_saved.total_volumen_origen_litros,
                total_volumen_recepcionado_litros=liq_saved.total_volumen_recepcionado_litros,
                total_merma_real_litros=liq_saved.total_merma_real_litros,
                total_merma_excedente_litros=liq_saved.total_merma_excedente_litros,
                flete_total_bruto_bs=liq_saved.flete_total_bruto_bs,
                desc_merma_bs=liq_saved.desc_merma_bs,
                desc_comision_usd_m3_bs=liq_saved.desc_comision_usd_m3_bs,
                desc_comision_7pct_bs=liq_saved.desc_comision_7pct_bs,
                desc_comision_ypfb_bolgart_7pct_bs=liq_saved.desc_comision_ypfb_bolgart_7pct_bs,
                desc_comision_3pct_bs=liq_saved.desc_comision_3pct_bs,
                desc_hojas_ruta_bs=liq_saved.desc_hojas_ruta_bs,
                desc_gps_bs=liq_saved.desc_gps_bs,
                desc_anticipos_otros_bs=liq_saved.desc_anticipos_otros_bs,
                desc_otros_ajustes_bs=liq_saved.desc_otros_ajustes_bs,
                total_descuentos_bs=liq_saved.total_descuentos_bs,
                liquido_pagable_bs=liq_saved.liquido_pagable_bs,
                firmas_json=liq_saved.firmas_json,
                estado=liq_saved.estado,
                notas=liq_saved.notas,
                created_at=liq_saved.created_at,
                viajes=viajes_res,
                empresa=empresa_dict,
                firmas=firmas
            )

        if not viajes:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontraron viajes registrados para la cisterna {placa_clean} en {display_label}"
            )

        # Si no existe guardada en DB pero hay viajes, calcular en vivo el cuadro oficial
        resumen = calculate_liquidacion_resumen(viajes, params)
        return LiquidacionDetalleResponse(
            id=0,
            codigo=codigo_periodo,
            periodo_mes=periodo_label,
            placa=placa_clean,
            fecha_emision=date.today(),
            **resumen,
            firmas_json=json.dumps(firmas_default),
            estado="Calculada (Pendiente de Guardar)",
            notas=f"Consolidado calculado automáticamente para {display_label}",
            created_at=datetime.now(),
            viajes=viajes_res,
            empresa=empresa_dict,
            firmas=firmas_default
        )
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
        viajes, periodo_label, codigo_periodo, display_label = resolve_period_and_trips(
            session=session,
            placa_clean=placa_clean,
            periodo_mes=liq_in.periodo_mes,
            tipo_periodo=liq_in.tipo_periodo,
            anio=liq_in.anio,
            semestre=liq_in.semestre,
            fecha_desde=liq_in.fecha_desde,
            fecha_hasta=liq_in.fecha_hasta
        )

        if not viajes:
            raise HTTPException(
                status_code=400,
                detail=f"No se encontraron viajes para la placa {placa_clean} en el periodo {display_label}"
            )

        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        # Overrides si se enviaron valores manuales
        overrides = {}
        if liq_in.desc_merma_bs is not None:
            overrides["desc_merma_bs"] = liq_in.desc_merma_bs
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

        firmas_dict = {
            "realizado_por": getattr(params, "firma_realizado_por", "JAQUELINE LOVERA TIÑINI"),
            "revisado_por": getattr(params, "firma_revisado_por", "JOSE LOVERA TIÑINI / GERENTE GENERAL"),
            "autorizado_por": getattr(params, "firma_autorizado_por", "DIRECTORIO"),
            "cancelado_por": getattr(params, "firma_cancelado_por", "TOMASA TIÑINI MITA / APOYO")
        }

        # Verificar si ya existe una liquidación para ese código o período y placa
        liq = session.query(Liquidacion).filter(
            or_(
                Liquidacion.codigo == codigo_periodo,
                (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == placa_clean)
            )
        ).first()

        fecha_emision = liq_in.fecha_emision or date.today()

        if not liq:
            liq = Liquidacion(
                codigo=codigo_periodo,
                periodo_mes=periodo_label,
                placa=placa_clean,
                fecha_emision=fecha_emision,
                **resumen,
                firmas_json=json.dumps(firmas_dict),
                estado="Generada",
                notas=liq_in.notas or f"Planilla oficial {display_label}"
            )
            session.add(liq)
            session.commit()
            session.refresh(liq)
        else:
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
        if not viajes:
            viajes = resolve_period_and_trips(session, liq.placa, liq.periodo_mes)[0]
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
        if not viajes:
            viajes = resolve_period_and_trips(session, liq.placa, liq.periodo_mes)[0]
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
