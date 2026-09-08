from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class UnidadBase(BaseModel):
    placa: str
    marca: Optional[str] = None
    modelo_ano: Optional[str] = None
    color: Optional[str] = None
    tipo_unidad: Optional[str] = "Cisterna Combustible"
    capacidad_litros: Optional[float] = 34000.0
    capacidad_m3: Optional[float] = 34.0
    num_compartimentos: Optional[int] = 4

    conductor_nombre: Optional[str] = None
    conductor_ci: Optional[str] = None
    conductor_telefono: Optional[str] = None
    conductor_licencia: Optional[str] = None

    propietario_nombre: Optional[str] = None
    propietario_ci: Optional[str] = None
    propietario_telefono: Optional[str] = None

    soat_numero: Optional[str] = None
    soat_vencimiento: Optional[date] = None
    b_sisa: Optional[str] = None
    cert_calibracion_senasac: Optional[str] = None
    inspeccion_tecnica: Optional[str] = None
    estado: Optional[str] = "Activo"
    notas: Optional[str] = None

class UnidadCreate(UnidadBase):
    pass

class UnidadUpdate(BaseModel):
    placa: Optional[str] = None
    marca: Optional[str] = None
    modelo_ano: Optional[str] = None
    color: Optional[str] = None
    tipo_unidad: Optional[str] = None
    capacidad_litros: Optional[float] = None
    capacidad_m3: Optional[float] = None
    num_compartimentos: Optional[int] = None

    conductor_nombre: Optional[str] = None
    conductor_ci: Optional[str] = None
    conductor_telefono: Optional[str] = None
    conductor_licencia: Optional[str] = None

    propietario_nombre: Optional[str] = None
    propietario_ci: Optional[str] = None
    propietario_telefono: Optional[str] = None

    soat_numero: Optional[str] = None
    soat_vencimiento: Optional[date] = None
    b_sisa: Optional[str] = None
    cert_calibracion_senasac: Optional[str] = None
    inspeccion_tecnica: Optional[str] = None
    estado: Optional[str] = None
    notas: Optional[str] = None

class UnidadResponse(UnidadBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
