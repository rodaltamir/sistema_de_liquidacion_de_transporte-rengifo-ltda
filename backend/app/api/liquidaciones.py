import json
import re
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from typing import List, Optional
from sqlalchemy import func, or_, cast, Integer, Numeric
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Liquidacion, Viaje, ParametroLiquidacion, UnidadTransporte, UnidadApoyo
from app.schemas.liquidacion import (
    LiquidacionCreate,
    LiquidacionResponse,
    LiquidacionDetalleResponse,
    ResumenPlacaItem,
    ResumenFlotaPeriodoResponse,
    LiquidacionBatchCreate,
    LiquidacionBatchResponse
)
from app.schemas.viaje import ViajeResponse
from app.services.calculation_engine import calculate_liquidacion_resumen
from app.services.excel_export import export_liquidacion_placa_excel, export_resumen_flota_excel
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
    fecha_hasta: Optional[date] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = None
):
    """
    Resuelve los viajes y etiquetas de periodo para cualquier tipo de consolidación:
    - Factura(s): Factura única, rango de facturas correlativas, o lista de facturas
    - Anual: Todos los viajes del año seleccionado
    - Semestral: Todos los viajes del 1er (ene-jun) o 2do (jul-dic) semestre
    - Personalizado: Todos los viajes dentro del rango fecha_desde a fecha_hasta
    - Mensual: Todos los viajes del mes específico (YYYY-MM)
    Si placa_clean es '__TODAS__', 'TODAS' o vacía, resuelve para todas las placas.
    """
    p_clean = (placa_clean or "").upper().strip()
    is_todas = not p_clean or p_clean in ["TODAS", "__TODAS__", "ALL", "TODAS LAS PLACAS", "CONSOLIDADO"]
    target_placa_code = "TODAS" if is_todas else p_clean

    query_viajes = session.query(Viaje)
    if not is_todas:
        query_viajes = query_viajes.filter(Viaje.placa == p_clean)

    # 0. Modo Factura (Factura única, rango sucesivo o lista de facturas)
    is_factura_mode = (
        tipo_periodo == "factura" or
        bool(nro_factura) or
        bool(factura_desde) or
        bool(facturas) or
        (periodo_mes and (periodo_mes.startswith("FAC-") or periodo_mes.startswith("FACS-")))
    )

    if is_factura_mode:
        # Si se pasó codificado en periodo_mes, decodificarlo
        if not nro_factura and not factura_desde and not facturas and periodo_mes:
            if periodo_mes.startswith("FAC-"):
                val = periodo_mes.replace("FAC-", "")
                if "_" in val:
                    parts = val.split("_")
                    factura_desde = parts[0]
                    factura_hasta = parts[1]
                else:
                    nro_factura = val
            elif periodo_mes.startswith("FACS-"):
                val = periodo_mes.replace("FACS-", "")
                if "_" in val:
                    parts = val.split("_")
                    factura_desde = parts[0]
                    factura_hasta = parts[1]
                else:
                    facturas = [val]

        if facturas and len(facturas) > 0:
            clean_facs = [str(f).strip() for f in facturas if f and str(f).strip()]
            query_viajes = query_viajes.filter(Viaje.nro_factura.in_(clean_facs))
            if len(clean_facs) == 1:
                periodo_label = f"FAC-{clean_facs[0]}"
                codigo_periodo = f"LIQ-FAC-{clean_facs[0]}-{target_placa_code}"
                display_label = f"Factura N° {clean_facs[0]}"
            else:
                periodo_label = f"FACS-{clean_facs[0]}_{clean_facs[-1]}"
                codigo_periodo = f"LIQ-FACS-{clean_facs[0]}_{clean_facs[-1]}-{target_placa_code}"
                display_label = f"Facturas ({len(clean_facs)} sel: {clean_facs[0]}..{clean_facs[-1]})"
        elif factura_desde and factura_hasta:
            d_s = str(factura_desde).strip()
            h_s = str(factura_hasta).strip()
            d_digits = re.sub(r'[^0-9]', '', d_s)
            h_digits = re.sub(r'[^0-9]', '', h_s)
            if d_digits and h_digits:
                d_val = min(int(d_digits), int(h_digits))
                h_val = max(int(d_digits), int(h_digits))
                num_col = cast(func.nullif(func.regexp_replace(Viaje.nro_factura, r'[^0-9]', '', 'g'), ''), Numeric)
                query_viajes = query_viajes.filter(num_col.between(d_val, h_val))
                display_label = f"Facturas N° {d_val} al {h_val}"
            else:
                query_viajes = query_viajes.filter(Viaje.nro_factura.between(d_s, h_s))
                display_label = f"Facturas {d_s} al {h_s}"
            periodo_label = f"FAC-{d_s}_{h_s}"
            codigo_periodo = f"LIQ-FAC-{d_s}_{h_s}-{target_placa_code}"
        elif nro_factura or factura_desde:
            target_fac = str(nro_factura or factura_desde).strip()
            query_viajes = query_viajes.filter(
                or_(
                    func.trim(Viaje.nro_factura) == target_fac,
                    Viaje.nro_factura.ilike(f"%{target_fac}%")
                )
            )
            periodo_label = f"FAC-{target_fac}"
            codigo_periodo = f"LIQ-FAC-{target_fac}-{target_placa_code}"
            display_label = f"Factura N° {target_fac}"
        else:
            query_viajes = query_viajes.filter(
                Viaje.nro_factura.isnot(None),
                func.trim(Viaje.nro_factura) != ""
            )
            periodo_label = "FAC-TODAS"
            codigo_periodo = f"LIQ-FAC-TODAS-{target_placa_code}"
            display_label = "Todas las Facturas"

        if is_todas:
            display_label += " (Todas las Placas)"

    # 1. Modo Anual
    elif tipo_periodo == "anual" or (anio and not semestre and not fecha_desde and (not periodo_mes or periodo_mes.startswith("ANUAL-") or len(periodo_mes) == 4)):
        target_year = anio or (int(periodo_mes.replace("ANUAL-", "")) if periodo_mes and (periodo_mes.startswith("ANUAL-") or len(periodo_mes) == 4) else date.today().year)
        query_viajes = query_viajes.filter(
            or_(
                Viaje.periodo_mes.startswith(f"{target_year}-"),
                func.extract('year', Viaje.fecha_carga) == target_year
            )
        )
        periodo_label = f"ANUAL-{target_year}"
        codigo_periodo = f"LIQ-ANUAL-{target_year}-{target_placa_code}"
        display_label = f"Gestión {target_year} (Todas las Placas)" if is_todas else f"Gestión {target_year} (Anual)"

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
        codigo_periodo = f"LIQ-SEM-{target_year}-S{sem_num}-{target_placa_code}"
        display_label = f"{'1er' if sem_num == 1 else '2do'} Semestre {target_year} (Todas las Placas)" if is_todas else f"{'1er' if sem_num == 1 else '2do'} Semestre {target_year}"

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
        codigo_periodo = f"LIQ-RANGO-{d_str}_{h_str}-{target_placa_code}"
        display_label = f"Del {d_str} al {h_str} (Todas las Placas)" if is_todas else f"Del {d_str} al {h_str}"

    # 4. Modo Mensual (por defecto)
    else:
        target_period = periodo_mes or date.today().strftime("%Y-%m")
        query_viajes = query_viajes.filter(Viaje.periodo_mes == target_period)
        periodo_label = target_period
        codigo_periodo = f"LIQ-{target_period}-{target_placa_code}"
        display_label = f"{target_period} (Todas las Placas)" if is_todas else target_period

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
    tipo_periodo: Optional[str] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = Query(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Liquidacion)
        if nro_factura:
            query = query.filter(
                or_(
                    Liquidacion.periodo_mes.contains(nro_factura),
                    Liquidacion.codigo.contains(nro_factura)
                )
            )
        elif factura_desde and factura_hasta:
            query = query.filter(
                or_(
                    Liquidacion.periodo_mes == f"FAC-{factura_desde}_{factura_hasta}",
                    Liquidacion.codigo.contains(f"FAC-{factura_desde}_{factura_hasta}")
                )
            )
        elif facturas and len(facturas) > 0:
            query = query.filter(
                or_(*[
                    or_(
                        Liquidacion.periodo_mes.contains(f),
                        Liquidacion.codigo.contains(f)
                    )
                    for f in facturas if f
                ])
            )
        elif periodo_mes:
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
            p_upper = placa.upper().strip()
            if p_upper not in ["TODAS", "__TODAS__", "ALL", "TODAS LAS PLACAS", "CONSOLIDADO"]:
                query = query.filter(Liquidacion.placa == p_upper)
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
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = Query(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Retorna la planilla oficial consolidada (Hojas 2 y 3) para cualquier periodo o factura (Factura única, Rango de facturas, Anual, Semestral, Personalizado o Mensual).
    Si ya fue guardada en base de datos la retorna. Si no, calcula dinámicamente en tiempo real
    todos los fletes, mermas, deducciones y líquido pagable basándose en los viajes del periodo o facturas.
    Si placa es '__TODAS__' o 'TODAS', consolida todos los camiones de la flota.
    """
    session = get_tenant_session(schema_name)
    try:
        placa_clean = (placa or "").upper().strip()
        is_todas = not placa_clean or placa_clean in ["TODAS", "__TODAS__", "ALL", "TODAS LAS PLACAS", "CONSOLIDADO"]
        target_placa = "TODAS" if is_todas else placa_clean

        viajes, periodo_label, codigo_periodo, display_label = resolve_period_and_trips(
            session=session,
            placa_clean=target_placa,
            periodo_mes=periodo_mes,
            tipo_periodo=tipo_periodo,
            anio=anio,
            semestre=semestre,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            nro_factura=nro_factura,
            factura_desde=factura_desde,
            factura_hasta=factura_hasta,
            facturas=facturas
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
        if is_todas:
            liq_saved = session.query(Liquidacion).filter(
                or_(
                    Liquidacion.codigo == codigo_periodo,
                    (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == "TODAS")
                )
            ).first()
        else:
            liq_saved = session.query(Liquidacion).filter(
                or_(
                    Liquidacion.codigo == codigo_periodo,
                    (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == target_placa)
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
            return LiquidacionDetalleResponse(
                id=0,
                codigo=codigo_periodo,
                periodo_mes=periodo_label,
                placa=target_placa,
                fecha_emision=date.today(),
                total_viajes=0,
                total_volumen_origen_litros=0.0,
                total_volumen_recepcionado_litros=0.0,
                total_merma_real_litros=0.0,
                total_merma_excedente_litros=0.0,
                flete_total_bruto_bs=0.0,
                desc_merma_bs=0.0,
                desc_comision_usd_m3_bs=0.0,
                desc_comision_7pct_bs=0.0,
                desc_comision_ypfb_bolgart_7pct_bs=0.0,
                desc_comision_3pct_bs=0.0,
                desc_hojas_ruta_bs=0.0,
                desc_gps_bs=0.0,
                desc_anticipos_otros_bs=0.0,
                desc_otros_ajustes_bs=0.0,
                total_descuentos_bs=0.0,
                liquido_pagable_bs=0.0,
                firmas_json=json.dumps(firmas_default),
                estado="Sin Despachos",
                notas=f"No se encontraron viajes registrados para {target_placa} en {display_label}",
                created_at=datetime.now(),
                viajes=[],
                empresa=empresa_dict,
                firmas=firmas_default
            )

        # Si no existe guardada en DB pero hay viajes, calcular en vivo el cuadro oficial
        resumen = calculate_liquidacion_resumen(viajes, params)
        return LiquidacionDetalleResponse(
            id=0,
            codigo=codigo_periodo,
            periodo_mes=periodo_label,
            placa=target_placa,
            fecha_emision=date.today(),
            **resumen,
            firmas_json=json.dumps(firmas_default),
            estado="Consolidado General (En vivo)" if is_todas else "Calculada (Pendiente de Guardar)",
            notas=f"Consolidado general de la flota para {display_label}" if is_todas else f"Consolidado calculado automáticamente para {display_label}",
            created_at=datetime.now(),
            viajes=viajes_res,
            empresa=empresa_dict,
            firmas=firmas_default
        )
    finally:
        session.close()

@router.get("/resumen-placas", response_model=ResumenFlotaPeriodoResponse)
def get_resumen_placas(
    schema_name: str,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = Query(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Retorna la tabla resumen por cisterna para validación previa o posterior a la liquidación:
    - Lista de placas con viajes en el período o por facturas
    - Tipo de flota (Propia vs Apoyo)
    - Conteo de viajes, volúmenes, flete bruto, descuentos y líquido pagable
    - Estado (Liquidada vs Pendiente de Generar)
    - Totales generales de la flota
    """
    session = get_tenant_session(schema_name)
    try:
        viajes_todos, periodo_label, _, display_label = resolve_period_and_trips(
            session=session,
            placa_clean="TODAS",
            periodo_mes=periodo_mes,
            tipo_periodo=tipo_periodo,
            anio=anio,
            semestre=semestre,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            nro_factura=nro_factura,
            factura_desde=factura_desde,
            factura_hasta=factura_hasta,
            facturas=facturas
        )

        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        # Identificar tipos de unidades
        propias = {u.placa.upper().strip() for u in session.query(UnidadTransporte).all() if u.placa}
        apoyo = {u.placa.upper().strip() for u in session.query(UnidadApoyo).all() if u.placa}

        # Liquidaciones ya guardadas en DB para este periodo
        liqs_db = session.query(Liquidacion).filter(
            or_(
                Liquidacion.periodo_mes == periodo_label,
                Liquidacion.codigo.contains(periodo_label)
            )
        ).all()
        db_by_placa = {l.placa.upper().strip(): l for l in liqs_db if l.placa}

        trips_by_placa = {}
        for v in viajes_todos:
            p = (v.placa or "DESCONOCIDA").upper().strip()
            if p not in trips_by_placa:
                trips_by_placa[p] = []
            trips_by_placa[p].append(v)

        items: List[ResumenPlacaItem] = []
        tot_vol = 0.0
        tot_flete = 0.0
        tot_desc = 0.0
        tot_liquido = 0.0
        placas_liq = 0
        placas_pend = 0

        for p_placa, p_viajes in sorted(trips_by_placa.items(), key=lambda x: x[0]):
            v_orig = sum(float(v.volumen_origen_litros or 0) for v in p_viajes)
            v_rec = sum(float(v.volumen_recepcionado_litros or 0) for v in p_viajes)
            v_fact = sum(
                (float(v.volumen_facturado) if float(v.volumen_facturado or 0) > 1000 else float(v.volumen_facturado or 0) * 1000)
                if getattr(v, "volumen_facturado", None) and float(v.volumen_facturado) > 0
                else float(v.volumen_recepcionado_litros or 0)
                for v in p_viajes
            )
            tot_vol += v_rec

            if p_placa in propias:
                t_flota = "Propia"
            elif p_placa in apoyo:
                t_flota = "Apoyo"
            else:
                t_flota = "Externa"

            saved_liq = db_by_placa.get(p_placa)
            if saved_liq:
                placas_liq += 1
                f_bruto = float(saved_liq.flete_total_bruto_bs or 0)
                d_merma = float(saved_liq.desc_merma_bs or 0)
                t_desc = float(saved_liq.total_descuentos_bs or 0)
                l_pagable = float(saved_liq.liquido_pagable_bs or 0)
                estado = "Liquidada"
                liq_id = saved_liq.id
                codigo = saved_liq.codigo
                fecha_em = saved_liq.fecha_emision
            else:
                placas_pend += 1
                p_res = calculate_liquidacion_resumen(p_viajes, params)
                f_bruto = p_res["flete_total_bruto_bs"]
                d_merma = p_res["desc_merma_bs"]
                t_desc = p_res["total_descuentos_bs"]
                l_pagable = p_res["liquido_pagable_bs"]
                estado = "Pendiente de Generar"
                liq_id = None
                codigo = None
                fecha_em = None

            tot_flete += f_bruto
            tot_desc += t_desc
            tot_liquido += l_pagable

            p_facs = sorted(list({str(v.nro_factura).strip() for v in p_viajes if v.nro_factura and str(v.nro_factura).strip()}))
            f_min = min([v.fecha_carga for v in p_viajes if v.fecha_carga], default=None)
            f_max = max([v.fecha_descarga for v in p_viajes if v.fecha_descarga] or [v.fecha_carga for v in p_viajes if v.fecha_carga], default=None)

            items.append(ResumenPlacaItem(
                placa=p_placa,
                tipo_flota=t_flota,
                viajes_count=len(p_viajes),
                total_viajes=len(p_viajes),
                volumen_origen_litros=round(v_orig, 2),
                volumen_cargado_litros=round(v_orig, 2),
                volumen_recepcionado_litros=round(v_rec, 2),
                volumen_facturado_litros=round(v_fact, 2),
                flete_total_bruto_bs=round(f_bruto, 2),
                desc_merma_bs=round(d_merma, 2),
                total_descuentos_bs=round(t_desc, 2),
                total_deducciones_bs=round(t_desc, 2),
                liquido_pagable_bs=round(l_pagable, 2),
                estado=estado,
                estado_liquidacion="liquidada" if estado == "Liquidada" else "pendiente",
                liquidacion_id=liq_id,
                codigo=codigo,
                liquidacion_codigo=codigo,
                tipo_unidad="propia" if t_flota == "Propia" else "apoyo",
                fecha_emision=fecha_em,
                facturas=p_facs,
                fecha_min=f_min,
                fecha_max=f_max
            ))

        return ResumenFlotaPeriodoResponse(
            placas=items,
            total_placas=len(trips_by_placa),
            total_viajes=len(viajes_todos),
            total_volumen_litros=round(tot_vol, 2),
            total_flete_bruto_bs=round(tot_flete, 2),
            total_descuentos_bs=round(tot_desc, 2),
            total_liquido_pagable_bs=round(tot_liquido, 2),
            placas_liquidadas=placas_liq,
            placas_pendientes=placas_pend,
            periodo_label=periodo_label,
            display_label=display_label
        )
    finally:
        session.close()

@router.post("/batch", response_model=LiquidacionBatchResponse)
def generate_liquidaciones_batch(
    schema_name: str,
    batch_in: LiquidacionBatchCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Genera y guarda en lote las liquidaciones oficiales individuales de todas las cisternas
    con viajes registrados en el período, vincula sus despachos y actualiza el consolidado general.
    """
    session = get_tenant_session(schema_name)
    try:
        viajes_todos, periodo_label, codigo_consolidado, display_label = resolve_period_and_trips(
            session=session,
            placa_clean="TODAS",
            periodo_mes=batch_in.periodo_mes,
            tipo_periodo=batch_in.tipo_periodo,
            anio=batch_in.anio,
            semestre=batch_in.semestre,
            fecha_desde=batch_in.fecha_desde,
            fecha_hasta=batch_in.fecha_hasta,
            nro_factura=batch_in.nro_factura,
            factura_desde=batch_in.factura_desde,
            factura_hasta=batch_in.factura_hasta,
            facturas=batch_in.facturas
        )

        if not viajes_todos:
            raise HTTPException(
                status_code=400,
                detail=f"No se encontraron despachos registrados para la flota en el período {display_label}."
            )

        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()
        fecha_emision = batch_in.fecha_emision or date.today()

        firmas_dict = {
            "realizado_por": getattr(params, "firma_realizado_por", "JAQUELINE LOVERA TIÑINI"),
            "revisado_por": getattr(params, "firma_revisado_por", "JOSE LOVERA TIÑINI / GERENTE GENERAL"),
            "autorizado_por": getattr(params, "firma_autorizado_por", "DIRECTORIO"),
            "cancelado_por": getattr(params, "firma_cancelado_por", "TOMASA TIÑINI MITA / APOYO")
        }

        # Agrupar viajes por placa
        trips_by_placa = {}
        for v in viajes_todos:
            p = (v.placa or "DESCONOCIDA").upper().strip()
            if p not in trips_by_placa:
                trips_by_placa[p] = []
            trips_by_placa[p].append(v)

        placas_procesadas = sorted(list(trips_by_placa.keys()))
        tot_flete = 0.0
        tot_desc = 0.0
        tot_liq = 0.0

        for p_placa in placas_procesadas:
            p_viajes = trips_by_placa[p_placa]
            p_codigo = f"LIQ-{periodo_label}-{p_placa}"
            p_resumen = calculate_liquidacion_resumen(p_viajes, params)

            tot_flete += p_resumen["flete_total_bruto_bs"]
            tot_desc += p_resumen["total_descuentos_bs"]
            tot_liq += p_resumen["liquido_pagable_bs"]

            liq = session.query(Liquidacion).filter(
                or_(
                    Liquidacion.codigo == p_codigo,
                    (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == p_placa)
                )
            ).first()

            if not liq:
                liq = Liquidacion(
                    codigo=p_codigo,
                    periodo_mes=periodo_label,
                    placa=p_placa,
                    fecha_emision=fecha_emision,
                    firmas_json=json.dumps(firmas_dict),
                    estado="Generada",
                    notas=f"Generada en lote para {display_label}",
                    **p_resumen
                )
                session.add(liq)
                session.flush()
            else:
                liq.fecha_emision = fecha_emision
                liq.estado = "Generada"
                for k, val in p_resumen.items():
                    setattr(liq, k, val)
                session.flush()

            for v in p_viajes:
                v.liquidacion_id = liq.id
                v.estado = "Liquidado"

        # Actualizar o crear también el registro consolidado "TODAS"
        resumen_consolidado = calculate_liquidacion_resumen(viajes_todos, params)
        liq_todas = session.query(Liquidacion).filter(
            or_(
                Liquidacion.codigo == codigo_consolidado,
                (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == "TODAS")
            )
        ).first()

        if not liq_todas:
            liq_todas = Liquidacion(
                codigo=codigo_consolidado,
                periodo_mes=periodo_label,
                placa="TODAS",
                fecha_emision=fecha_emision,
                firmas_json=json.dumps(firmas_dict),
                estado="Consolidado General",
                notas=f"Consolidado general de la flota para {display_label}",
                **resumen_consolidado
            )
            session.add(liq_todas)
        else:
            liq_todas.fecha_emision = fecha_emision
            liq_todas.estado = "Consolidado General"
            for k, val in resumen_consolidado.items():
                setattr(liq_todas, k, val)

        session.commit()

        return LiquidacionBatchResponse(
            message=f"Se procesaron exitosamente las liquidaciones para {len(placas_procesadas)} cisternas ({len(viajes_todos)} despachos).",
            total_placas=len(placas_procesadas),
            total_viajes=len(viajes_todos),
            placas_procesadas=placas_procesadas,
            total_flete_bruto_bs=round(tot_flete, 2),
            total_descuentos_bs=round(tot_desc, 2),
            total_liquido_pagable_bs=round(tot_liq, 2),
            periodo_label=periodo_label
        )
    finally:
        session.close()

@router.get("/export/resumen-excel")
def export_resumen_flota_periodo_excel(
    schema_name: str,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = Query(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        resumen_data = get_resumen_placas(
            schema_name=schema_name,
            tipo_periodo=tipo_periodo,
            periodo_mes=periodo_mes,
            anio=anio,
            semestre=semestre,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            nro_factura=nro_factura,
            factura_desde=factura_desde,
            factura_hasta=factura_hasta,
            facturas=facturas,
            empresa=empresa
        )
        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()
        empresa_dict = {
            "name": empresa.name,
            "nit": empresa.nit,
            "logo_base64": empresa.logo_base64
        }
        excel_buffer = export_resumen_flota_excel(
            empresa=empresa_dict,
            periodo_label=resumen_data.periodo_label,
            display_label=resumen_data.display_label,
            placas_data=resumen_data.placas,
            params=params
        )
        safe_label = resumen_data.periodo_label.replace("/", "-").replace(" ", "_")
        filename = f"Resumen_Flota_{safe_label}.xlsx"
        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
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
        placa_clean = (liq_in.placa or "").upper().strip()
        is_todas = not placa_clean or placa_clean in ["TODAS", "__TODAS__", "ALL", "TODAS LAS PLACAS", "CONSOLIDADO"]
        target_placa = "TODAS" if is_todas else placa_clean

        viajes, periodo_label, codigo_periodo, display_label = resolve_period_and_trips(
            session=session,
            placa_clean=target_placa,
            periodo_mes=liq_in.periodo_mes,
            tipo_periodo=liq_in.tipo_periodo,
            anio=liq_in.anio,
            semestre=liq_in.semestre,
            fecha_desde=liq_in.fecha_desde,
            fecha_hasta=liq_in.fecha_hasta,
            nro_factura=liq_in.nro_factura,
            factura_desde=liq_in.factura_desde,
            factura_hasta=liq_in.factura_hasta,
            facturas=liq_in.facturas
        )

        if not viajes:
            raise HTTPException(
                status_code=400,
                detail=f"No se encontraron viajes para {target_placa} en el periodo {display_label}"
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
        if is_todas:
            liq = session.query(Liquidacion).filter(
                or_(
                    Liquidacion.codigo == codigo_periodo,
                    (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == "TODAS")
                )
            ).first()
        else:
            liq = session.query(Liquidacion).filter(
                or_(
                    Liquidacion.codigo == codigo_periodo,
                    (Liquidacion.periodo_mes == periodo_label) & (Liquidacion.placa == target_placa)
                )
            ).first()

        fecha_emision = liq_in.fecha_emision or date.today()

        if not liq:
            liq = Liquidacion(
                codigo=codigo_periodo,
                periodo_mes=periodo_label,
                placa=target_placa,
                fecha_emision=fecha_emision,
                **resumen,
                firmas_json=json.dumps(firmas_dict),
                estado="Consolidado General" if is_todas else "Generada",
                notas=liq_in.notas or (f"Consolidado general {display_label}" if is_todas else f"Planilla oficial {display_label}")
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

        # Asociar los viajes a esta liquidación (si no es TODAS o si no tienen liq_id)
        for v in viajes:
            if not is_todas or v.liquidacion_id is None:
                v.liquidacion_id = liq.id
                v.estado = "Liquidado"
        session.commit()
        session.refresh(liq)

        return liq

    finally:
        session.close()

@router.get("/facturas-disponibles")
def get_facturas_disponibles(
    schema_name: str,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Retorna la lista de todas las facturas registradas en los despachos,
    con conteo de viajes, flete acumulado, volumen y fechas mín/máx,
    ordenadas naturalmente de forma correlativa descendente.
    """
    session = get_tenant_session(schema_name)
    try:
        num_clean = cast(func.nullif(func.regexp_replace(Viaje.nro_factura, r'[^0-9]', '', 'g'), ''), Numeric)
        
        rows = session.query(
            Viaje.nro_factura,
            func.count(Viaje.id).label("total_viajes"),
            func.coalesce(func.sum(Viaje.flete_total_bs), 0.0).label("flete_total"),
            func.coalesce(func.sum(Viaje.volumen_recepcionado_litros), 0.0).label("volumen_total"),
            func.min(Viaje.fecha_carga).label("fecha_min"),
            func.max(Viaje.fecha_carga).label("fecha_max"),
            func.max(Viaje.fecha_factura).label("fecha_factura")
        ).filter(
            Viaje.nro_factura.isnot(None),
            func.trim(Viaje.nro_factura) != ""
        ).group_by(
            Viaje.nro_factura
        ).order_by(
            num_clean.desc().nulls_last(),
            Viaje.nro_factura.desc()
        ).all()

        result = []
        for r in rows:
            result.append({
                "nro_factura": str(r[0]).strip(),
                "total_viajes": int(r[1]),
                "flete_total": round(float(r[2] or 0), 2),
                "volumen_total": round(float(r[3] or 0), 2),
                "fecha_min": r[4].strftime("%Y-%m-%d") if r[4] else None,
                "fecha_max": r[5].strftime("%Y-%m-%d") if r[5] else None,
                "fecha_factura": r[6].strftime("%Y-%m-%d") if r[6] else None,
            })
        return result
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
def export_liquidacion_excel(
    schema_name: str,
    id: int,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    placa: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = Query(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        if id > 0:
            liq = session.query(Liquidacion).filter(Liquidacion.id == id).first()
            if not liq:
                raise HTTPException(status_code=404, detail="Liquidación no encontrada")

            viajes = session.query(Viaje).filter(Viaje.liquidacion_id == id).order_by(Viaje.fecha_carga.asc()).all()
            if not viajes:
                viajes = resolve_period_and_trips(session, liq.placa, liq.periodo_mes)[0]
        else:
            target_p = placa or "TODAS"
            viajes, periodo_label, codigo_periodo, display_label = resolve_period_and_trips(
                session=session,
                placa_clean=target_p,
                periodo_mes=periodo_mes,
                tipo_periodo=tipo_periodo,
                anio=anio,
                semestre=semestre,
                fecha_desde=fecha_desde,
                fecha_hasta=fecha_hasta,
                nro_factura=nro_factura,
                factura_desde=factura_desde,
                factura_hasta=factura_hasta,
                facturas=facturas
            )
            if not viajes:
                raise HTTPException(status_code=400, detail="No se encontraron viajes para exportar en este período")

            params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()
            resumen = calculate_liquidacion_resumen(viajes, params)

            class DummyLiq:
                pass
            liq = DummyLiq()
            liq.id = 0
            liq.codigo = codigo_periodo
            liq.periodo_mes = periodo_label
            liq.placa = "TODAS" if target_p in ["TODAS", "__TODAS__", "ALL", "TODAS LAS PLACAS", "CONSOLIDADO"] else target_p
            liq.fecha_emision = date.today()
            liq.firmas_json = None
            for k, val in resumen.items():
                setattr(liq, k, val)

        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        empresa_dict = {
            "name": empresa.name,
            "nit": empresa.nit,
            "logo_base64": empresa.logo_base64
        }

        excel_buffer = export_liquidacion_placa_excel(liq, viajes, empresa_dict, params)
        safe_placa = str(liq.placa).replace(" ", "_")
        safe_periodo = str(liq.periodo_mes).replace("/", "-").replace(" ", "_")
        filename = f"Liquidacion_{safe_placa}_{safe_periodo}.xlsx"

        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    finally:
        session.close()

@router.get("/{id}/export/pdf")
def export_liquidacion_pdf(
    schema_name: str,
    id: int,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    placa: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = Query(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        if id > 0:
            liq = session.query(Liquidacion).filter(Liquidacion.id == id).first()
            if not liq:
                raise HTTPException(status_code=404, detail="Liquidación no encontrada")

            viajes = session.query(Viaje).filter(Viaje.liquidacion_id == id).order_by(Viaje.fecha_carga.asc()).all()
            if not viajes:
                viajes = resolve_period_and_trips(session, liq.placa, liq.periodo_mes)[0]
        else:
            target_p = placa or "TODAS"
            viajes, periodo_label, codigo_periodo, display_label = resolve_period_and_trips(
                session=session,
                placa_clean=target_p,
                periodo_mes=periodo_mes,
                tipo_periodo=tipo_periodo,
                anio=anio,
                semestre=semestre,
                fecha_desde=fecha_desde,
                fecha_hasta=fecha_hasta,
                nro_factura=nro_factura,
                factura_desde=factura_desde,
                factura_hasta=factura_hasta,
                facturas=facturas
            )
            if not viajes:
                raise HTTPException(status_code=400, detail="No se encontraron viajes para exportar en este período")

            params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()
            resumen = calculate_liquidacion_resumen(viajes, params)

            class DummyLiq:
                pass
            liq = DummyLiq()
            liq.id = 0
            liq.codigo = codigo_periodo
            liq.periodo_mes = periodo_label
            liq.placa = "TODAS" if target_p in ["TODAS", "__TODAS__", "ALL", "TODAS LAS PLACAS", "CONSOLIDADO"] else target_p
            liq.fecha_emision = date.today()
            liq.firmas_json = None
            for k, val in resumen.items():
                setattr(liq, k, val)

        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

        empresa_dict = {
            "name": empresa.name,
            "nit": empresa.nit,
            "logo_base64": empresa.logo_base64
        }

        pdf_buffer = export_liquidacion_placa_pdf(liq, viajes, empresa_dict, params)
        safe_placa = str(liq.placa).replace(" ", "_")
        safe_periodo = str(liq.periodo_mes).replace("/", "-").replace(" ", "_")
        filename = f"Liquidacion_{safe_placa}_{safe_periodo}.pdf"

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
