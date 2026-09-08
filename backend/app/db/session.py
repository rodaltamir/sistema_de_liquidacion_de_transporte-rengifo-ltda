from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Engine para esquemas públicos
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)

# Sesión local para esquema público
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_tenant_session(schema_name: str):
    """
    Crea una sesión apuntando específicamente al esquema de una empresa de transporte.
    Usa schema_translate_map para traducir el esquema comodín 'tenant' al esquema real de la empresa.
    """
    connectable = engine.execution_options(
        schema_translate_map={"tenant": schema_name}
    )
    TenantSession = sessionmaker(autocommit=False, autoflush=False, bind=connectable)
    return TenantSession()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
