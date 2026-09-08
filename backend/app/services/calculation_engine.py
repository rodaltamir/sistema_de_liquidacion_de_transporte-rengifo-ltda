from typing import Dict, Any, List
from app.models.tenant import ParametroLiquidacion

def get_tolerancia_pct(producto: str, params: ParametroLiquidacion) -> float:
    """
    Retorna el porcentaje de tolerancia contractual de merma según el producto.
    Basado en los estándares YPFB y regulaciones del sector hidrocarburos.
    """
    prod = producto.upper()
    if "GASOLINA" in prod:
        return params.merma_tolerancia_gasolina_pct  # 0.25%
    elif "DIESEL" in prod or "DO" in prod:
        return params.merma_tolerancia_diesel_pct    # 0.15%
    elif "IYA" in prod or "INSUMOS" in prod:
        return params.merma_tolerancia_iya_pct       # 0.20%
    elif "CRUDO" in prod:
        return params.merma_tolerancia_crudo_pct     # 0.15%
    return params.merma_tolerancia_diesel_pct

def get_precio_merma(producto: str, params: ParametroLiquidacion, override_precio: float = None) -> float:
    """
    Determina el precio unitario del litro de merma a descontar (en Bs).
    Si se proporciona un override en el viaje se respeta, sino se toma del panel de control.
    """
    if override_precio is not None and override_precio > 0:
        return override_precio
    
    prod = producto.upper()
    if params.precio_merma_general_bs and params.precio_merma_general_bs > 0:
        return params.precio_merma_general_bs  # ej. 7.45 Bs como en la Hoja 2 del PDF
    elif "GASOLINA" in prod:
        return params.precio_merma_gasolina_litro_bs
    else:
        return params.precio_merma_diesel_litro_bs

def calculate_viaje_values(
    volumen_origen_litros: float,
    volumen_recepcionado_litros: float,
    producto: str,
    tarifa_flete: float,
    tipo_tarifa: str,
    params: ParametroLiquidacion,
    precio_merma_litro_override: float = None
) -> Dict[str, float]:
    """
    Realiza el cálculo operativo exacto de un viaje / despacho:
    - Merma real (Litros)
    - Tolerancia (%)
    - Merma tolerable (Litros)
    - Merma excedente (Litros a descontar)
    - Descuento por merma (Bs)
    - Flete bruto a pagar (Bs)
    """
    # 1. Merma Real
    merma_real = round(volumen_origen_litros - volumen_recepcionado_litros, 1)
    
    # 2. Tolerancia
    tolerancia_pct = get_tolerancia_pct(producto, params)
    merma_tolerable = round(volumen_origen_litros * (tolerancia_pct / 100.0), 0)
    
    # 3. Merma Excedente
    if merma_real > merma_tolerable:
        merma_excedente = round(merma_real - merma_tolerable, 1)
    else:
        merma_excedente = 0.0

    # 4. Precio de Merma y Descuento
    precio_merma = get_precio_merma(producto, params, precio_merma_litro_override)
    merma_descontar_bs = round(merma_excedente * precio_merma, 2)

    # 5. Cálculo del Flete
    # Según tipo de tarifa:
    # BS_POR_M3: volumen_recepcionado (en m3) * tarifa
    # USD_POR_M3: volumen_recepcionado (en m3) * tarifa * tipo_cambio
    # BS_TOTAL_VIAJE: monto fijo
    volumen_m3 = volumen_recepcionado_litros / 1000.0
    tipo = (tipo_tarifa or "BS_POR_M3").upper()

    if tipo == "BS_POR_M3":
        flete_total_bs = round(volumen_m3 * tarifa_flete, 2)
    elif tipo == "USD_POR_M3":
        tipo_cambio = params.tipo_cambio_usd_bob or 6.96
        flete_total_bs = round(volumen_m3 * tarifa_flete * (tipo_cambio / 10.0), 2) # según escala
    elif tipo == "BS_POR_LITRO":
        flete_total_bs = round(volumen_recepcionado_litros * tarifa_flete, 2)
    else:
        flete_total_bs = round(tarifa_flete, 2)

    return {
        "merma_real_litros": merma_real,
        "tolerancia_pct": tolerancia_pct,
        "merma_tolerable_litros": merma_tolerable,
        "merma_excedente_litros": merma_excedente,
        "precio_merma_litro_bs": precio_merma,
        "merma_descontar_bs": merma_descontar_bs,
        "flete_total_bs": flete_total_bs
    }

def calculate_liquidacion_resumen(
    viajes: List[Any],
    params: ParametroLiquidacion,
    overrides: Dict[str, float] = None
) -> Dict[str, Any]:
    """
    Calcula el cuadro completo de liquidación y deducciones (Hojas 2 y 3 del PDF)
    para una unidad de transporte (placa) en un período mensual.
    """
    overrides = overrides or {}

    total_viajes = len(viajes)
    total_volumen_origen = sum(v.volumen_origen_litros for v in viajes)
    total_volumen_recepcionado = sum(v.volumen_recepcionado_litros for v in viajes)
    total_merma_real = sum(v.merma_real_litros for v in viajes)
    total_merma_excedente = sum(v.merma_excedente_litros for v in viajes)
    total_merma_descontar_bs = sum(v.merma_descontar_bs for v in viajes)
    flete_total_bruto = sum(v.flete_total_bs for v in viajes)

    volumen_total_m3 = total_volumen_recepcionado / 1000.0
    tipo_cambio = params.tipo_cambio_usd_bob or 6.96

    # 1. Descuento por Merma
    desc_merma = overrides.get("desc_merma_bs", round(total_merma_descontar_bs, 2))

    # 2. Descuento de Comisión 1 $us p/m3
    # 1 USD por cada m3 transportado convertido a Bs
    factor_comision_usd = overrides.get("desc_comision_usd_m3_bs")
    if factor_comision_usd is not None:
        desc_comision_usd = factor_comision_usd
    else:
        # En el PDF (Hoja 3): 134.205 m3 * 1 USD * 6.9724 = 935.73 Bs
        desc_comision_usd = round(volumen_total_m3 * (params.comision_usd_m3 or 1.0) * tipo_cambio, 2)

    # 3. Descuento de Comisión 7%
    desc_comision_7 = overrides.get(
        "desc_comision_7pct_bs",
        round(flete_total_bruto * ((params.comision_pct_1 or 7.0) / 100.0), 2)
    )

    # 4. Descuento YPFB BOL-GART 7% (Boleta de Garantía de Transporte)
    desc_bolgart_7 = overrides.get(
        "desc_comision_ypfb_bolgart_7pct_bs",
        round(flete_total_bruto * ((params.comision_ypfb_bolgart_pct or 7.0) / 100.0), 2)
    )

    # 5. Descuento de Comisión 3%
    desc_comision_3 = overrides.get(
        "desc_comision_3pct_bs",
        round(flete_total_bruto * ((params.comision_pct_2 or 3.0) / 100.0), 2)
    )

    # 6. Hojas de Ruta
    desc_hojas_ruta = overrides.get(
        "desc_hojas_ruta_bs",
        params.costo_hojas_de_ruta_bs or 240.00
    )

    # 7. GPS
    desc_gps = overrides.get(
        "desc_gps_bs",
        params.costo_gps_bs or 135.00
    )

    # 8. Anticipos y Otros
    desc_anticipos = overrides.get(
        "desc_anticipos_otros_bs",
        round(flete_total_bruto * ((params.anticipos_otros_pct or 0.0) / 100.0), 2)
    )

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
