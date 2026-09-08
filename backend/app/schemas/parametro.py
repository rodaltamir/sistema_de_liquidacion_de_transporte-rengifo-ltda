from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ParametroBase(BaseModel):
    tipo_cambio_usd_bob: float = 6.96
    merma_tolerancia_diesel_pct: float = 0.15
    merma_tolerancia_gasolina_pct: float = 0.25
    merma_tolerancia_iya_pct: float = 0.20
    merma_tolerancia_crudo_pct: float = 0.15

    precio_merma_diesel_litro_bs: float = 3.72
    precio_merma_gasolina_litro_bs: float = 3.74
    precio_merma_general_bs: float = 7.45

    comision_usd_m3: float = 1.00
    comision_pct_1: float = 7.0
    comision_ypfb_bolgart_pct: float = 7.0
    comision_pct_2: float = 3.0
    costo_hojas_de_ruta_bs: float = 240.00
    costo_gps_bs: float = 135.00
    anticipos_otros_pct: float = 0.0

    firma_realizado_por: str = "JAQUELINE LOVERA TIÑINI"
    firma_revisado_por: str = "JOSE LOVERA TIÑINI / GERENTE GENERAL"
    firma_autorizado_por: str = "DIRECTORIO"
    firma_cancelado_por: str = "TOMASA TIÑINI MITA / APOYO"
    leyenda_legal: str = "Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación."

class ParametroUpdate(BaseModel):
    tipo_cambio_usd_bob: Optional[float] = None
    merma_tolerancia_diesel_pct: Optional[float] = None
    merma_tolerancia_gasolina_pct: Optional[float] = None
    merma_tolerancia_iya_pct: Optional[float] = None
    merma_tolerancia_crudo_pct: Optional[float] = None

    precio_merma_diesel_litro_bs: Optional[float] = None
    precio_merma_gasolina_litro_bs: Optional[float] = None
    precio_merma_general_bs: Optional[float] = None

    comision_usd_m3: Optional[float] = None
    comision_pct_1: Optional[float] = None
    comision_ypfb_bolgart_pct: Optional[float] = None
    comision_pct_2: Optional[float] = None
    costo_hojas_de_ruta_bs: Optional[float] = None
    costo_gps_bs: Optional[float] = None
    anticipos_otros_pct: Optional[float] = None

    firma_realizado_por: Optional[str] = None
    firma_revisado_por: Optional[str] = None
    firma_autorizado_por: Optional[str] = None
    firma_cancelado_por: Optional[str] = None
    leyenda_legal: Optional[str] = None

class ParametroResponse(ParametroBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
