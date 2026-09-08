from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from app.schemas.viaje import ViajeResponse

class LiquidacionCreate(BaseModel):
    periodo_mes: str  # YYYY-MM ej "2023-03"
    placa: str        # ej "4412-DPC"
    fecha_emision: Optional[date] = None
    notas: Optional[str] = None
    # Deducciones opcionales personalizadas (si se desea modificar los valores estándar)
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

    class Config:
        from_attributes = True

class LiquidacionDetalleResponse(LiquidacionResponse):
    viajes: List[ViajeResponse] = []
    empresa: Optional[Dict[str, Any]] = None
    firmas: Optional[Dict[str, str]] = None
