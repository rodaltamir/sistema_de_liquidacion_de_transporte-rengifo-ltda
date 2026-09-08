from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import engine
from app.db.base_class import Base
from app.models.public import User, Asociacion, Empresa
from app.api import (
    auth,
    asociaciones,
    empresas,
    dashboard,
    unidades,
    viajes,
    liquidaciones,
    parametros
)

# Inicializar tablas del esquema público
public_tables = [User.__table__, Asociacion.__table__, Empresa.__table__]
Base.metadata.create_all(bind=engine, tables=public_tables)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Sistema Multi-tenant de Liquidación de Pagos para Empresas de Transporte y Asociaciones",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc"
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(asociaciones.router, prefix=settings.API_V1_STR)
app.include_router(empresas.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(unidades.router, prefix=settings.API_V1_STR)
app.include_router(viajes.router, prefix=settings.API_V1_STR)
app.include_router(liquidaciones.router, prefix=settings.API_V1_STR)
app.include_router(parametros.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "Bienvenido a la API del Sistema de Liquidación de Empresas de Transporte y Asociaciones",
        "docs": f"{settings.API_V1_STR}/docs",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}
