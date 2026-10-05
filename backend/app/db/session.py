from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Engine para esquemas públicos
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)

# Sesión local para esquema público
SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)

def resolve_actual_schema(schema_name: str) -> str:
    clean = schema_name.strip().lower()
    from app.models.public import Empresa
    db = SessionLocal()
    try:
        emp = db.query(Empresa).filter(
            (Empresa.schema_name.ilike(clean)) |
            (Empresa.schema_name.ilike(f"empresa_{clean}")) |
            (Empresa.schema_name.ilike(clean.replace("empresa_", "", 1))),
            Empresa.is_active == True
        ).first()
        if emp and emp.schema_name:
            return emp.schema_name
    except Exception:
        pass
    finally:
        db.close()
    return clean

def get_tenant_session(schema_name: str):
    """
    Crea una sesión apuntando específicamente al esquema de una empresa de transporte.
    Usa schema_translate_map para traducir el esquema comodín 'tenant' al esquema real de la empresa.
    """
    actual_schema = resolve_actual_schema(schema_name)
    connectable = engine.execution_options(
        schema_translate_map={"tenant": actual_schema}
    )
    TenantSession = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=connectable)
    return TenantSession()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
