from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AsociacionBase(BaseModel):
    name: str
    sigla: Optional[str] = None
    nit: Optional[str] = None
    representante_legal: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    logo_base64: Optional[str] = None

class AsociacionCreate(AsociacionBase):
    pass

class AsociacionUpdate(BaseModel):
    name: Optional[str] = None
    sigla: Optional[str] = None
    nit: Optional[str] = None
    representante_legal: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    logo_base64: Optional[str] = None
    is_active: Optional[bool] = None

class EmpresaSimple(BaseModel):
    id: int
    name: str
    schema_name: str
    nit: Optional[str] = None
    icon: Optional[str] = "Truck"
    logo_base64: Optional[str] = None

    class Config:
        from_attributes = True

class AsociacionResponse(AsociacionBase):
    id: int
    is_active: bool
    created_at: datetime
    empresas: List[EmpresaSimple] = []

    class Config:
        from_attributes = True
