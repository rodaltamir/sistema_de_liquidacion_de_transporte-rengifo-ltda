import json
import calendar
from datetime import date
from typing import Dict, Any, List, Optional
from app.models.tenant import ParametroLiquidacion

def is_ypfb_client(client_name: Optional[str]) -> bool:
    """Determina si un viaje o despacho corresponde al cliente YPFB."""
    if not client_name:
        return False
    c = str(client_name).upper().strip()
    return "YPFB" in c or "Y.P.F.B" in c

def determine_trip_period(date_carga: Optional[date] = None, date_descarga: Optional[date] = None, date_factura: Optional[date] = None) -> str:
    """
    Determina el periodo mensual único (YYYY-MM) al que pertenece un viaje.
    En la contabilidad y operativa de fletes y transporte en Bolivia (Facturación YPFB / Libro de Ventas SIAT),
    la venta e ingreso se ancla al mes de emisión de su Factura (fecha_factura).
    En caso de no contar aún con factura, se ancla a la fecha de carga o descarga operativa.
    """
    if date_factura:
        return f"{date_factura.year}-{str(date_factura.month).zfill(2)}"
    if date_carga:
        return f"{date_carga.year}-{str(date_carga.month).zfill(2)}"
    if date_descarga:
        return f"{date_descarga.year}-{str(date_descarga.month).zfill(2)}"
    return date.today().strftime("%Y-%m")


def get_tolerancia_pct(producto: str, params: Optional[ParametroLiquidacion] = None) -> float:
    """
    Retorna el porcentaje de tolerancia contractual de merma según el producto.
    Basado en los estándares YPFB y regulaciones del sector hidrocarburos.
    """
    if not producto:
        return 0.0

    prod = producto.upper().strip()

    # 1. Tolerancia personalizada configurada para este producto específico en el catálogo
    if params and params.productos_json:
        try:
            items = json.loads(params.productos_json)
            for it in items:
                if isinstance(it, dict):
                    if it.get("nombre", "").upper().strip() == prod and it.get("tolerancia_pct") is not None:
                        return float(it["tolerancia_pct"])
        except Exception:
            pass

    # 2. Cargas secas conocidas sin merma
    if any(k in prod for k in ["SOYA", "GIRASOL", "ACERO", "PLANCHAS", "PLANCHA", "GRANEL"]):
        return 0.0
    elif "GASOLINA" in prod:
        return params.merma_tolerancia_gasolina_pct if (params and params.merma_tolerancia_gasolina_pct is not None) else 0.25
    elif "DIESEL" in prod or "DO" in prod or "DIÉSEL" in prod:
        return params.merma_tolerancia_diesel_pct if (params and params.merma_tolerancia_diesel_pct is not None) else 0.15
    elif "IYA" in prod or "INSUMOS" in prod or "ADITIVOS" in prod:
        return params.merma_tolerancia_iya_pct if (params and params.merma_tolerancia_iya_pct is not None) else 0.20
    elif "CRUDO" in prod:
        return params.merma_tolerancia_crudo_pct if (params and params.merma_tolerancia_crudo_pct is not None) else 0.15

    # 3. Tolerancia para Otros Productos configurada en parámetros
    if params and getattr(params, "merma_tolerancia_otro_pct", None) is not None:
        return float(params.merma_tolerancia_otro_pct)

    return 0.0

def get_precio_merma(producto: str, params: Optional[ParametroLiquidacion] = None, override_precio: float = None) -> float:
    """
    Determina el precio unitario del litro de merma a descontar (en Bs) estandarizado a 6 decimales.
    Si se proporciona un override en el viaje se respeta, sino se toma del panel de control.
    """
    if override_precio is not None and override_precio > 0:
        return round(float(override_precio), 6)
    
    prod = producto.upper() if producto else ""
    if params:
        if params.precio_merma_general_bs and params.precio_merma_general_bs > 0:
            return round(float(params.precio_merma_general_bs), 6)  # ej. 7.450000 Bs como en la Hoja 2 del PDF
        elif "GASOLINA" in prod and params.precio_merma_gasolina_litro_bs:
            return round(float(params.precio_merma_gasolina_litro_bs), 6)
        elif params.precio_merma_diesel_litro_bs:
            return round(float(params.precio_merma_diesel_litro_bs), 6)
    return 7.450000

def calculate_viaje_values(
    volumen_origen_litros: float,
    volumen_recepcionado_litros: float,
    producto: str,
    tarifa_flete: float,
    tipo_tarifa: str,
    params: ParametroLiquidacion,
    precio_merma_litro_override: float = None,
    volumen_facturado: float = None,
    total_descuentos_adicionales: float = 0.0,
    total_descuentos_mermas: float = 0.0,
    flete_total_override: float = None,
    cliente: Optional[str] = None
) -> Dict[str, float]:
    """
    Realiza el cálculo operativo exacto de un viaje / despacho:
    - Si el cliente es YPFB: calcula merma real, tolerancia permisible contractual,
      excedente a descontar y precio de merma.
    - Si es otro cliente (no YPFB): las mermas son 0.0 y no generan descuentos contractuales.
    - Volumen facturado (Litros y m³)
    - Total a pagar (Bs) = Volumen Facturado * Tarifa (o flete_total_override si proviene de factura oficial)
    """
    es_ypfb = is_ypfb_client(cliente) if cliente else True

    # 1. Merma Real y Tolerancia (Exclusivo YPFB)
    if es_ypfb:
        merma_real = round(volumen_origen_litros - volumen_recepcionado_litros, 1)
        tolerancia_pct = get_tolerancia_pct(producto, params)
        merma_tolerable = round(volumen_origen_litros * (tolerancia_pct / 100.0), 0)
        if merma_real > merma_tolerable:
            merma_excedente = round(merma_real - merma_tolerable, 1)
        else:
            merma_excedente = 0.0
        precio_merma = get_precio_merma(producto, params, precio_merma_litro_override)
        merma_descontar_bs = round(merma_excedente * precio_merma, 2)
    else:
        merma_real = 0.0
        tolerancia_pct = 0.0
        merma_tolerable = 0.0
        merma_excedente = 0.0
        precio_merma = 0.0
        merma_descontar_bs = 0.0

    # 2. Volumen Facturado y Cálculo del Total a Pagar
    # Regla: La unidad de medida de Volumen Facturado en BD es en LITROS (Lt)
    vol_fact_litros = 0.0
    if volumen_facturado is not None:
        val_f = float(volumen_facturado)
        if val_f > 0:
            vol_fact_litros = round(val_f, 1)
    elif volumen_recepcionado_litros > 0:
        vol_fact_litros = round(volumen_recepcionado_litros, 1)
    elif volumen_origen_litros > 0:
        vol_fact_litros = round(volumen_origen_litros, 1)

    vol_fact_m3 = round(vol_fact_litros / 1000.0, 4)

    tipo = (tipo_tarifa or "BS_POR_M3").upper()

    if flete_total_override is not None and float(flete_total_override) > 0:
        flete_total_bs = round(float(flete_total_override), 2)
    elif tipo == "USD_POR_M3":
        tipo_cambio = params.tipo_cambio_usd_bob or 6.96
        flete_total_bs = round(vol_fact_m3 * tarifa_flete * (tipo_cambio / 10.0), 2)
    elif tipo == "BS_TOTAL_VIAJE":
        flete_total_bs = round(tarifa_flete, 2)
    else:
        # BS_POR_M3: (Volumen Facturado en Lt / 1000) * Tarifa = Total a Pagar (Bs)
        flete_total_bs = round(vol_fact_m3 * tarifa_flete, 2)

    total_descuentos_bs = round(merma_descontar_bs + float(total_descuentos_adicionales or 0.0) + float(total_descuentos_mermas or 0.0), 2)
    liquido_pagable_bs = round(flete_total_bs - total_descuentos_bs, 2)

    return {
        "merma_real_litros": merma_real,
        "tolerancia_pct": tolerancia_pct,
        "merma_tolerable_litros": merma_tolerable,
        "merma_excedente_litros": merma_excedente,
        "precio_merma_litro_bs": round(precio_merma, 6),
        "merma_descontar_bs": merma_descontar_bs,
        "volumen_facturado": vol_fact_litros,
        "volumen_facturado_m3": vol_fact_m3,
        "flete_total_bs": flete_total_bs,
        "total_descuentos_bs": total_descuentos_bs,
        "liquido_pagable_bs": liquido_pagable_bs
    }

def calculate_liquidacion_resumen(
    viajes: List[Any],
    params: ParametroLiquidacion,
    overrides: Dict[str, float] = None
) -> Dict[str, Any]:
    """
    Calcula el cuadro completo de liquidación y deducciones (Hojas 2 y 3 del PDF).
    REGLA CLAVE: Solo los viajes del cliente YPFB generan mermas y deducciones contractuales
    (Comisión 1 $us/m3, Comisión 7%, BOL-GART 7%, Comisión 3%, Hojas de Ruta, GPS).
    Los viajes de otros clientes no se ven afectados por estos descuentos (deducciones = 0).
    """
    overrides = overrides or {}

    total_viajes = len(viajes)
    total_volumen_origen = sum(float(getattr(v, "volumen_origen_litros", 0.0) or 0.0) for v in viajes)
    total_volumen_recepcionado = sum(float(getattr(v, "volumen_recepcionado_litros", 0.0) or 0.0) for v in viajes)
    flete_total_bruto = sum(float(getattr(v, "flete_total_bs", 0.0) or 0.0) for v in viajes)

    # Filtrar viajes que pertenecen a YPFB
    ypfb_viajes = [v for v in viajes if is_ypfb_client(getattr(v, "cliente", None))]
    has_ypfb = len(ypfb_viajes) > 0

    total_merma_real = sum(float(getattr(v, "merma_real_litros", 0.0) or 0.0) for v in ypfb_viajes)
    total_merma_excedente = sum(float(getattr(v, "merma_excedente_litros", 0.0) or 0.0) for v in ypfb_viajes)
    total_merma_descontar_bs = sum(float(getattr(v, "merma_descontar_bs", 0.0) or 0.0) for v in ypfb_viajes)

    tipo_cambio = params.tipo_cambio_usd_bob or 6.96

    # 1. Descuento por Merma (solo mermas YPFB)
    desc_merma = overrides.get("desc_merma_bs", round(total_merma_descontar_bs, 2))

    if has_ypfb:
        # 2. Descuento de Comisión 1 $us p/m3 (sobre volumen YPFB)
        factor_comision_usd = overrides.get("desc_comision_usd_m3_bs")
        if factor_comision_usd is not None:
            desc_comision_usd = factor_comision_usd
        else:
            calc_com_usd = 0.0
            for v in ypfb_viajes:
                v_m3 = (float(getattr(v, "volumen_facturado", None) or getattr(v, "volumen_recepcionado_litros", 0.0) or 0.0))
                if v_m3 > 1000:
                    v_m3 = v_m3 / 1000.0
                rate_usd = getattr(v, "comision_usd_m3", None)
                if rate_usd is None:
                    rate_usd = params.comision_usd_m3 if params.comision_usd_m3 is not None else 1.0
                tc = getattr(v, "tipo_cambio_bs", None)
                tc_val = float(tc) if tc is not None else tipo_cambio
                calc_com_usd += v_m3 * float(rate_usd) * tc_val
            desc_comision_usd = round(calc_com_usd, 2)

        # 3. Descuento de Comisión 7% (sobre flete de viajes YPFB)
        desc_comision_7 = overrides.get(
            "desc_comision_7pct_bs",
            round(sum(
                float(getattr(v, "flete_total_bs", 0.0) or 0.0) * (
                    float(getattr(v, "comision_pct_1", None) if getattr(v, "comision_pct_1", None) is not None else (params.comision_pct_1 if params.comision_pct_1 is not None else 7.0)) / 100.0
                )
                for v in ypfb_viajes
            ), 2)
        )

        # 4. Descuento YPFB BOL-GART 7% (sobre flete de viajes YPFB)
        desc_bolgart_7 = overrides.get(
            "desc_comision_ypfb_bolgart_7pct_bs",
            round(sum(
                float(getattr(v, "flete_total_bs", 0.0) or 0.0) * (
                    float(getattr(v, "comision_ypfb_bolgart_pct", None) if getattr(v, "comision_ypfb_bolgart_pct", None) is not None else (params.comision_ypfb_bolgart_pct if params.comision_ypfb_bolgart_pct is not None else 7.0)) / 100.0
                )
                for v in ypfb_viajes
            ), 2)
        )

        # 5. Descuento de Comisión 3% (sobre flete de viajes YPFB)
        desc_comision_3 = overrides.get(
            "desc_comision_3pct_bs",
            round(sum(
                float(getattr(v, "flete_total_bs", 0.0) or 0.0) * (
                    float(getattr(v, "comision_pct_2", None) if getattr(v, "comision_pct_2", None) is not None else (params.comision_pct_2 if params.comision_pct_2 is not None else 3.0)) / 100.0
                )
                for v in ypfb_viajes
            ), 2)
        )

        # 6. Hojas de Ruta (por defecto 0.00 Bs)
        desc_hojas_ruta = overrides.get(
            "desc_hojas_ruta_bs",
            max((float(getattr(v, "costo_hojas_de_ruta_bs", None) if getattr(v, "costo_hojas_de_ruta_bs", None) is not None else (params.costo_hojas_de_ruta_bs if params.costo_hojas_de_ruta_bs is not None else 0.00)) for v in ypfb_viajes), default=0.0)
        )

        # 7. GPS (por defecto 0.00 Bs)
        desc_gps = overrides.get(
            "desc_gps_bs",
            max((float(getattr(v, "costo_gps_bs", None) if getattr(v, "costo_gps_bs", None) is not None else (params.costo_gps_bs if params.costo_gps_bs is not None else 0.00)) for v in ypfb_viajes), default=0.0)
        )

        # 8. Anticipos y Otros (sobre flete de viajes YPFB)
        desc_anticipos = overrides.get(
            "desc_anticipos_otros_bs",
            round(sum(
                float(getattr(v, "flete_total_bs", 0.0) or 0.0) * (
                    float(getattr(v, "anticipos_otros_pct", None) if getattr(v, "anticipos_otros_pct", None) is not None else (params.anticipos_otros_pct if params.anticipos_otros_pct is not None else 0.0)) / 100.0
                )
                for v in ypfb_viajes
            ), 2)
        )
    else:
        # Sin viajes de YPFB: no aplican deducciones de hidrocarburos / YPFB
        desc_comision_usd = 0.0
        desc_comision_7 = 0.0
        desc_bolgart_7 = 0.0
        desc_comision_3 = 0.0
        desc_hojas_ruta = 0.0
        desc_gps = 0.0
        desc_anticipos = 0.0

    # 9. Otros Ajustes
    desc_otros = overrides.get("desc_otros_ajustes_bs", 0.0)

    # Total Descuento
    total_descuentos = round(
        desc_merma +
        desc_comision_usd +
        desc_comision_7 +
        desc_bolgart_7 +
        desc_comision_3 +
        desc_hojas_ruta +
        desc_gps +
        desc_anticipos +
        desc_otros,
        2
    )

    # Líquido Pagable
    liquido_pagable = round(flete_total_bruto - total_descuentos, 2)

    return {
        "total_viajes": total_viajes,
        "total_volumen_origen_litros": round(total_volumen_origen, 3),
        "total_volumen_recepcionado_litros": round(total_volumen_recepcionado, 3),
        "total_merma_real_litros": round(total_merma_real, 1),
        "total_merma_excedente_litros": round(total_merma_excedente, 1),
        "flete_total_bruto_bs": round(flete_total_bruto, 2),
        "desc_merma_bs": desc_merma,
        "desc_comision_usd_m3_bs": desc_comision_usd,
        "desc_comision_7pct_bs": desc_comision_7,
        "desc_comision_ypfb_bolgart_7pct_bs": desc_bolgart_7,
        "desc_comision_3pct_bs": desc_comision_3,
        "desc_hojas_ruta_bs": desc_hojas_ruta,
        "desc_gps_bs": desc_gps,
        "desc_anticipos_otros_bs": desc_anticipos,
        "desc_otros_ajustes_bs": desc_otros,
        "total_descuentos_bs": total_descuentos,
        "liquido_pagable_bs": liquido_pagable
    }
