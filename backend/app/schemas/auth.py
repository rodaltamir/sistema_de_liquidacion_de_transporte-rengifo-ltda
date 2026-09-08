from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = "user"

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    password: str
    role: str = "user"

class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
