from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EmpresaBase(BaseModel):
    name: str
    nit: Optional[str] = None
    asociacion_id: Optional[int] = None
    representante_legal: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    icon: Optional[str] = "Truck"
    logo_base64: Optional[str] = None

class EmpresaCreate(EmpresaBase):
    pass

class EmpresaUpdate(BaseModel):
    name: Optional[str] = None
    nit: Optional[str] = None
    asociacion_id: Optional[int] = None
    representante_legal: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    icon: Optional[str] = None
    logo_base64: Optional[str] = None
    is_active: Optional[bool] = None

class EmpresaResponse(EmpresaBase):
    id: int
    schema_name: str
    is_active: bool
    created_at: datetime
    asociacion_name: Optional[str] = None

    class Config:
        from_attributes = True
