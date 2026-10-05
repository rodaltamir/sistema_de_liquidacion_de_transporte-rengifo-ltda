from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ClienteBase(BaseModel):
    nombre: str
    nit: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    is_active: Optional[bool] = True

class ClienteCreate(ClienteBase):
    pass

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    nit: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    is_active: Optional[bool] = None

class ClienteResponse(ClienteBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
