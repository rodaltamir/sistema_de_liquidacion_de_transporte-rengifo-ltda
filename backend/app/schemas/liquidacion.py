from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from app.schemas.viaje import ViajeResponse

class LiquidacionCreate(BaseModel):
    periodo_mes: str  # YYYY-MM ej "2023-03", o "ANUAL-2023", "2023-S1", etc.
    placa: str        # ej "4412-DPC"
    tipo_periodo: Optional[str] = "mes" # "mes", "semestral", "anual", "personalizado"
    anio: Optional[int] = None
    semestre: Optional[int] = None
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    fecha_emision: Optional[date] = None
    notas: Optional[str] = None
    # Filtrado por Facturas
    nro_factura: Optional[str] = None
    factura_desde: Optional[str] = None
    factura_hasta: Optional[str] = None
    facturas: Optional[List[str]] = None
    # Deducciones opcionales personalizadas (si se desea modificar los valores estándar)
    desc_merma_bs: Optional[float] = None
    desc_comision_usd_m3_bs: Optional[float] = None
    desc_comision_7pct_bs: Optional[float] = None
    desc_comision_ypfb_bolgart_7pct_bs: Optional[float] = None
    desc_comision_3pct_bs: Optional[float] = None
    desc_hojas_ruta_bs: Optional[float] = None
    desc_gps_bs: Optional[float] = None
    desc_anticipos_otros_bs: Optional[float] = None
    desc_otros_ajustes_bs: Optional[float] = None

class LiquidacionResponse(BaseModel):
    id: int
    codigo: str
    periodo_mes: str
    placa: str
    fecha_emision: date
    
    total_viajes: int
    total_volumen_origen_litros: float
    total_volumen_recepcionado_litros: float
    total_merma_real_litros: float
    total_merma_excedente_litros: float
    flete_total_bruto_bs: float

    # Descuentos idénticos a Hoja 3 del PDF
    desc_merma_bs: float
    desc_comision_usd_m3_bs: float
    desc_comision_7pct_bs: float
    desc_comision_ypfb_bolgart_7pct_bs: float
    desc_comision_3pct_bs: float
    desc_hojas_ruta_bs: float
    desc_gps_bs: float
    desc_anticipos_otros_bs: float
    desc_otros_ajustes_bs: float

    total_descuentos_bs: float
    liquido_pagable_bs: float

    firmas_json: Optional[str] = None
    estado: str
    notas: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LiquidacionDetalleResponse(LiquidacionResponse):
    viajes: List[ViajeResponse] = []
    empresa: Optional[Dict[str, Any]] = None
    firmas: Optional[Dict[str, str]] = None

class ResumenPlacaItem(BaseModel):
    placa: str
    tipo_flota: str  # "Propia" | "Apoyo" | "Externa"
    conductor_nombre: Optional[str] = None
    viajes_count: int
    volumen_origen_litros: float
    volumen_recepcionado_litros: float
    volumen_facturado_litros: float
    flete_total_bruto_bs: float
    desc_merma_bs: float
    total_descuentos_bs: float
    liquido_pagable_bs: float
    estado: str  # "Liquidada" | "Pendiente de Generar"
    liquidacion_id: Optional[int] = None
    codigo: Optional[str] = None
    fecha_emision: Optional[date] = None
    facturas: List[str] = []
    fecha_min: Optional[date] = None
    fecha_max: Optional[date] = None
    # Aliases de compatibilidad directa con UI
    total_viajes: Optional[int] = None
    volumen_cargado_litros: Optional[float] = None
    total_deducciones_bs: Optional[float] = None
    tipo_unidad: Optional[str] = None
    estado_liquidacion: Optional[str] = None
    liquidacion_codigo: Optional[str] = None

class ResumenFlotaPeriodoResponse(BaseModel):
    placas: List[ResumenPlacaItem]
    total_placas: int
    total_viajes: int
    total_volumen_litros: float
    total_flete_bruto_bs: float
    total_descuentos_bs: float
    total_liquido_pagable_bs: float
    placas_liquidadas: int
    placas_pendientes: int
    periodo_label: str
    display_label: str

class LiquidacionBatchCreate(BaseModel):
    tipo_periodo: Optional[str] = "mes"
    periodo_mes: Optional[str] = None
    anio: Optional[int] = None
    semestre: Optional[int] = None
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    fecha_emision: Optional[date] = None
    nro_factura: Optional[str] = None
    factura_desde: Optional[str] = None
    factura_hasta: Optional[str] = None
    facturas: Optional[List[str]] = None

class LiquidacionBatchResponse(BaseModel):
    message: str
    total_placas: int
    total_viajes: int
    placas_procesadas: List[str]
    total_flete_bruto_bs: float
    total_descuentos_bs: float
    total_liquido_pagable_bs: float
    periodo_label: str

