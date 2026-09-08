from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.session import get_db, get_tenant_session
from app.core.config import settings
from app.models.public import User, Empresa

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[User]:
    if not token:
        # Permitir modo desarrollo o fallback temporal si es necesario
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None

    user = db.query(User).filter(User.username == username).first()
    return user

def require_current_user(current_user: Optional[User] = Depends(get_current_user)) -> User:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado o token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

def require_admin(current_user: User = Depends(require_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de Administrador para realizar esta acción"
        )
    return current_user

def verify_tenant_exists(schema_name: str, db: Session = Depends(get_db)) -> Empresa:
    empresa = db.query(Empresa).filter(Empresa.schema_name == schema_name, Empresa.is_active == True).first()
    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Empresa de transporte con esquema '{schema_name}' no encontrada"
        )
    return empresa
