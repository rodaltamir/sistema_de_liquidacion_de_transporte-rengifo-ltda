from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UnidadApoyoBase(BaseModel):
    placa: str
    conductor_nombre: Optional[str] = None
    conductor_telefono: Optional[str] = None
    conductor_ci: Optional[str] = None
    capacidad_litros: Optional[float] = 34000.0
    capacidad_m3: Optional[float] = 34.0
    num_compartimentos: Optional[int] = 4
    estado: Optional[str] = "Disponible"  # "Disponible", "En Ruta", "Mantenimiento", "Inactivo"
    notas: Optional[str] = None

class UnidadApoyoCreate(UnidadApoyoBase):
    pass

class UnidadApoyoUpdate(BaseModel):
    placa: Optional[str] = None
    conductor_nombre: Optional[str] = None
    conductor_telefono: Optional[str] = None
    conductor_ci: Optional[str] = None
    capacidad_litros: Optional[float] = None
    capacidad_m3: Optional[float] = None
    num_compartimentos: Optional[int] = None
    estado: Optional[str] = None
    notas: Optional[str] = None

class UnidadApoyoResponse(UnidadApoyoBase):
    id: int
    empresa_apoyo_id: int
    empresa_apoyo_nombre: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EmpresaApoyoBase(BaseModel):
    nombre: str
    representante: Optional[str] = None
    telefono: Optional[str] = None
    ci_nit: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None
    is_active: Optional[bool] = True

class EmpresaApoyoCreate(EmpresaApoyoBase):
    pass

class EmpresaApoyoUpdate(BaseModel):
    nombre: Optional[str] = None
    representante: Optional[str] = None
    telefono: Optional[str] = None
    ci_nit: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None
    is_active: Optional[bool] = None

class EmpresaApoyoResponse(EmpresaApoyoBase):
    id: int
    created_at: datetime
    unidades: List[UnidadApoyoResponse] = []
    total_unidades: int = 0

    class Config:
        from_attributes = True

class ApoyoStats(BaseModel):
    total_empresas: int
    total_unidades: int
    unidades_disponibles: int
    unidades_en_ruta: int
