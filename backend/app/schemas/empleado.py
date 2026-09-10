from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class EmpleadoBase(BaseModel):
    nombres: str
    apellidos: str
    ci: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    cargo: Optional[str] = "Chofer / Conductor"
    licencia_conducir: Optional[str] = None
    categoria_licencia: Optional[str] = None
    vencimiento_licencia: Optional[date] = None
    fecha_ingreso: Optional[date] = None
    salario_base: Optional[float] = 0.0
    estado: Optional[str] = "Activo"
    unidad_asignada_placa: Optional[str] = None
    direccion: Optional[str] = None
    contacto_emergencia: Optional[str] = None
    notas: Optional[str] = None

class EmpleadoCreate(EmpleadoBase):
    pass

class EmpleadoUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    ci: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    cargo: Optional[str] = None
    licencia_conducir: Optional[str] = None
    categoria_licencia: Optional[str] = None
    vencimiento_licencia: Optional[date] = None
    fecha_ingreso: Optional[date] = None
    salario_base: Optional[float] = None
    estado: Optional[str] = None
    unidad_asignada_placa: Optional[str] = None
    direccion: Optional[str] = None
    contacto_emergencia: Optional[str] = None
    notas: Optional[str] = None

class EmpleadoResponse(EmpleadoBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
