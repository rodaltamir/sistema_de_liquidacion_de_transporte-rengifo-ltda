from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, Optional
from datetime import datetime, date
from app.db.session import get_db, get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Viaje, UnidadTransporte, Liquidacion

router = APIRouter(prefix="/tenants/{schema_name}/dashboard", tags=["Dashboard de Empresa"])

@router.get("/")
def get_dashboard_metrics(
    schema_name: str,
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    empresa: Empresa = Depends(verify_tenant_exists),
    db: Session = Depends(get_db)
):
    session = get_tenant_session(schema_name)
    try:
        # Obtener todos los periodos disponibles con conteo
        periodos_query = session.query(
            Viaje.periodo_mes,
            func.count(Viaje.id).label("total_viajes")
        ).group_by(Viaje.periodo_mes).order_by(Viaje.periodo_mes.desc()).all()
        periodos_disponibles = [
            {"periodo_mes": p.periodo_mes, "total_viajes": p.total_viajes}
            for p in periodos_query if p.periodo_mes
        ]

        query_viajes = session.query(Viaje)
        query_liq = session.query(Liquidacion)
        label_periodo = ""

        if fecha_desde and fecha_hasta:
            query_viajes = query_viajes.filter(Viaje.fecha_carga.between(fecha_desde, fecha_hasta))
            desde_str = fecha_desde.strftime("%Y-%m")
            hasta_str = fecha_hasta.strftime("%Y-%m")
            query_liq = query_liq.filter(
                (Liquidacion.fecha_emision.between(fecha_desde, fecha_hasta)) |
                (Liquidacion.periodo_mes.between(desde_str, hasta_str))
            )
            label_periodo = f"{fecha_desde.strftime('%d/%m/%Y')} - {fecha_hasta.strftime('%d/%m/%Y')}"
        elif anio:
            query_viajes = query_viajes.filter(Viaje.periodo_mes.startswith(f"{anio}-"))
            query_liq = query_liq.filter(Liquidacion.periodo_mes.startswith(f"{anio}-"))
            label_periodo = f"Año {anio}"
        elif periodo_mes:
            query_viajes = query_viajes.filter(Viaje.periodo_mes == periodo_mes)
            query_liq = query_liq.filter(Liquidacion.periodo_mes == periodo_mes)
            label_periodo = periodo_mes
        else:
            # Por defecto mostrar consolidado anual (de los periodos con datos o el año actual)
            if periodos_disponibles:
                try:
                    target_year = int(periodos_disponibles[0]["periodo_mes"].split("-")[0])
                except Exception:
                    target_year = datetime.now().year
            else:
                target_year = datetime.now().year
            query_viajes = query_viajes.filter(Viaje.periodo_mes.startswith(f"{target_year}-"))
            query_liq = query_liq.filter(Liquidacion.periodo_mes.startswith(f"{target_year}-"))
            label_periodo = f"Gestión {target_year} (Anual)"

        viajes_mes = query_viajes.all()
        
        total_viajes = len(viajes_mes)
        total_volumen_origen = sum(v.volumen_origen_litros for v in viajes_mes)
        total_volumen_recepcionado = sum(v.volumen_recepcionado_litros for v in viajes_mes)
        total_flete_bruto = sum(v.flete_total_bs for v in viajes_mes)
        total_merma_real = sum(v.merma_real_litros for v in viajes_mes)
        total_merma_descontar = sum(v.merma_descontar_bs for v in viajes_mes)

        # Desglose por producto
        vol_por_producto = {}
        for v in viajes_mes:
            prod = v.producto or "OTROS"
            vol_por_producto[prod] = vol_por_producto.get(prod, 0.0) + v.volumen_recepcionado_litros

        # Unidades de transporte
        total_unidades = session.query(UnidadTransporte).count()
        unidades_activas = session.query(UnidadTransporte).filter(UnidadTransporte.estado == "Activo").count()

        # Liquidaciones del período filtrado
        liquidaciones = query_liq.all()
        total_liquidaciones = len(liquidaciones)
        total_liquido_pagable = sum(l.liquido_pagable_bs for l in liquidaciones)

        # Viajes recientes
        viajes_recientes = session.query(Viaje).order_by(Viaje.fecha_carga.desc()).limit(6).all()
        recientes_data = []
        for vr in viajes_recientes:
            recientes_data.append({
                "id": vr.id,
                "placa": vr.placa,
                "tramo": vr.tramo,
                "producto": vr.producto,
                "fecha_carga": str(vr.fecha_carga),
                "volumen_litros": vr.volumen_recepcionado_litros,
                "flete_bs": vr.flete_total_bs,
                "estado": vr.estado
            })

        return {
            "empresa": {
                "id": empresa.id,
                "name": empresa.name,
                "schema_name": empresa.schema_name,
                "nit": empresa.nit,
                "icon": empresa.icon,
                "logo_base64": empresa.logo_base64,
                "asociacion_id": empresa.asociacion_id
            },
            "periodo_activo": label_periodo or periodo_mes,
            "periodos_disponibles": periodos_disponibles,
            "kpis": {
                "total_viajes": total_viajes,
                "total_flete_bruto_bs": round(total_flete_bruto, 2),
                "total_volumen_m3": round(total_volumen_recepcionado / 1000.0, 3),
                "total_merma_litros": round(total_merma_real, 1),
                "total_merma_descontar_bs": round(total_merma_descontar, 2),
                "total_unidades": total_unidades,
                "unidades_activas": unidades_activas,
                "total_liquidaciones": total_liquidaciones,
                "total_liquido_pagable_bs": round(total_liquido_pagable, 2)
            },
            "distribucion_productos": vol_por_producto,
            "viajes_recientes": recientes_data
        }

    finally:
        session.close()
