from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class User(Base):
    """
    Tabla pública de Usuarios con roles de Administrador o Usuario operador.
    """
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="admin")  # "admin" | "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Asociacion(Base):
    """
    Tabla pública de Asociaciones de Transporte (ej. ASOC. ANDINA ASOCIADOS).
    Agrupa a múltiples empresas de transporte y consolida liquidaciones periódicas.
    """
    __tablename__ = "asociaciones"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sigla = Column(String(100), nullable=True)
    nit = Column(String(50), nullable=True)
    representante_legal = Column(String(200), nullable=True)
    direccion = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    logo_base64 = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    empresas = relationship("Empresa", back_populates="asociacion", cascade="all, delete-orphan")

class Empresa(Base):
    """
    Tabla pública que registra todas las Empresas de Transporte (Tenants).
    Pueden pertenecer a una Asociación o trabajar de forma Independiente (asociacion_id es opcional/nullable).
    Cada empresa tiene su propio esquema PostgreSQL dedicado (schema_name).
    """
    __tablename__ = "empresas"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # Razón Social
    schema_name = Column(String(100), unique=True, index=True, nullable=False)  # Esquema PostgreSQL
    nit = Column(String(50), nullable=True)
    
    # Asociación a la que pertenece (opcional / nullable para empresas independientes)
    asociacion_id = Column(Integer, ForeignKey("public.asociaciones.id", ondelete="SET NULL"), nullable=True)
    
    representante_legal = Column(String(200), nullable=True)
    direccion = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    
    icon = Column(String(50), default="Truck")
    logo_base64 = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asociacion = relationship("Asociacion", back_populates="empresas")
