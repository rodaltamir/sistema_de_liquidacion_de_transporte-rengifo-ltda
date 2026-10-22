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


def sanitize_schema_name(name: str) -> str:
    """Sanitiza el nombre de una empresa para usarlo como esquema PostgreSQL."""
    import re
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', str(name or "")).strip('_').lower()
    return f"empresa_{slug[:30]}"


def init_tenant_schema(schema_name: str):
    """
    Crea el esquema en PostgreSQL y las tablas tenant-specific con sus valores por defecto.
    """
    with engine.connect() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
        conn.commit()

    connectable = engine.execution_options(
        schema_translate_map={"tenant": schema_name}
    )
    from app.db.base_class import Base
    from app.models.tenant import UnidadTransporte, ParametroLiquidacion, Viaje, Liquidacion, Empleado, EmpresaApoyo, UnidadApoyo, Cliente
    tenant_tables = [
        UnidadTransporte.__table__,
        ParametroLiquidacion.__table__,
        Viaje.__table__,
        Liquidacion.__table__,
        Empleado.__table__,
        EmpresaApoyo.__table__,
        UnidadApoyo.__table__,
        Cliente.__table__
    ]
    Base.metadata.create_all(bind=connectable, tables=tenant_tables)
    from app.db.migrations import ensure_tenant_columns
    try:
        ensure_tenant_columns(schema_name)
    except Exception:
        pass

    # Crear configuración inicial por defecto
    tenant_session = get_tenant_session(schema_name)
    try:
        existing_params = tenant_session.query(ParametroLiquidacion).first()
        if not existing_params:
            default_params = ParametroLiquidacion()
            tenant_session.add(default_params)
            tenant_session.commit()
    finally:
        tenant_session.close()

