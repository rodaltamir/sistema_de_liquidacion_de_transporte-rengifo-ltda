from pydantic import BaseModel
from typing import Optional, List, Union, Any
from datetime import date, datetime

class ItemDescuento(BaseModel):
    concepto: str
    monto: float

class ViajeBase(BaseModel):
    mic_dta: Optional[str] = None
    lote_codigo: Optional[str] = None
    unidad_id: Optional[int] = None
    placa: str
    tramo: str
    cliente: Optional[str] = "YPFB"
    producto: str = "GASOLINA"
    fecha_carga: date
    fecha_descarga: date
    periodo_mes: str  # YYYY-MM ej "2023-03"

    # Facturación
    nro_factura: Optional[str] = None
    fecha_factura: Optional[date] = None

    # Volúmenes
    volumen_origen_litros: float
    volumen_recepcionado_litros: float
    volumen_facturado: Optional[float] = None

    # Descuentos dinámicos
    descuentos_adicionales: Optional[Union[List[ItemDescuento], List[dict], str]] = None
    descuentos_mermas: Optional[Union[List[ItemDescuento], List[dict], str]] = None
    total_descuentos_adicionales_bs: Optional[float] = 0.0
    total_descuentos_mermas_bs: Optional[float] = 0.0

    tarifa_flete: float
    tipo_tarifa: Optional[str] = "BS_POR_M3"  # BS_POR_M3 | USD_POR_M3 | BS_TOTAL_VIAJE
    precio_merma_litro_bs: Optional[float] = None
    observaciones: Optional[str] = None
    es_apoyo: Optional[bool] = False
    empresa_apoyo_id: Optional[int] = None
    empresa_apoyo_nombre: Optional[str] = None

class ViajeCreate(ViajeBase):
    pass

class ViajeUpdate(BaseModel):
    mic_dta: Optional[str] = None
    lote_codigo: Optional[str] = None
    unidad_id: Optional[int] = None
    placa: Optional[str] = None
    tramo: Optional[str] = None
    cliente: Optional[str] = None
    producto: Optional[str] = None
    fecha_carga: Optional[date] = None
    fecha_descarga: Optional[date] = None
    periodo_mes: Optional[str] = None

    nro_factura: Optional[str] = None
    fecha_factura: Optional[date] = None

    volumen_origen_litros: Optional[float] = None
    volumen_recepcionado_litros: Optional[float] = None
    volumen_facturado: Optional[float] = None

    descuentos_adicionales: Optional[Union[List[ItemDescuento], List[dict], str]] = None
    descuentos_mermas: Optional[Union[List[ItemDescuento], List[dict], str]] = None
    total_descuentos_adicionales_bs: Optional[float] = None
    total_descuentos_mermas_bs: Optional[float] = None

    tarifa_flete: Optional[float] = None
    tipo_tarifa: Optional[str] = None
    precio_merma_litro_bs: Optional[float] = None
    observaciones: Optional[str] = None
    estado: Optional[str] = None
    es_apoyo: Optional[bool] = None
    empresa_apoyo_id: Optional[int] = None
    empresa_apoyo_nombre: Optional[str] = None

class ViajeResponse(ViajeBase):
    id: int
    merma_real_litros: float
    tolerancia_pct: float
    merma_tolerable_litros: float
    merma_excedente_litros: float
    merma_descontar_bs: float
    flete_total_bs: float
    estado: str
    liquidacion_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ViajeCalculoPreview(BaseModel):
    merma_real_litros: float
    tolerancia_pct: float
    merma_tolerable_litros: float
    merma_excedente_litros: float
    precio_merma_litro_bs: float
    merma_descontar_bs: float
    volumen_facturado: float
    flete_total_bs: float
