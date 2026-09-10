from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.public import User
from app.schemas.auth import Token, UserLogin, UserCreate, UserResponse, UserUpdate
from app.api.deps import get_current_user, require_current_user, require_admin
from typing import List

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas (usuario o contraseña)"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario está desactivado"
        )
    
    access_token = create_access_token(subject=user.username, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(require_current_user)):
    return current_user

@router.get("/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).all()

@router.post("/users", response_model=UserResponse)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    existing = db.query(User).filter((User.username == user_in.username) | (User.email == user_in.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario o correo ya existe")
    
    user = User(
        name=user_in.name,
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{id}", response_model=UserResponse)
def update_user(id: int, user_in: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user_in.name is not None:
        user.name = user_in.name
    if user_in.email is not None:
        existing = db.query(User).filter(User.email == user_in.email, User.id != id).first()
        if existing:
            raise HTTPException(status_code=400, detail="El correo ya está en uso")
        user.email = user_in.email
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)
        
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{id}")
def delete_user(id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if admin.id == id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta de administrador")
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()
    return {"message": "Usuario eliminado correctamente"}

