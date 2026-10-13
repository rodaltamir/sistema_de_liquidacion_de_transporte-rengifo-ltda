from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.models.public import Empresa

def ensure_tenant_columns(schema_name: str):
    """
    Verifica y crea las columnas nuevas necesarias en la tabla viajes de un esquema tenant.
    Garantiza idempotencia y retrocompatibilidad total.
    """
    with engine.connect() as conn:
        conn.execute(text(f'ALTER TABLE "{schema_name}".viajes ADD COLUMN IF NOT EXISTS nro_factura VARCHAR(100);'))
        conn.execute(text(f'ALTER TABLE "{schema_name}".viajes ADD COLUMN IF NOT EXISTS fecha_factura DATE;'))
        conn.execute(text(f'ALTER TABLE "{schema_name}".viajes ADD COLUMN IF NOT EXISTS volumen_facturado DOUBLE PRECISION;'))
        conn.execute(text(f'ALTER TABLE "{schema_name}".viajes ADD COLUMN IF NOT EXISTS descuentos_adicionales TEXT DEFAULT \'[]\';'))
        conn.execute(text(f'ALTER TABLE "{schema_name}".viajes ADD COLUMN IF NOT EXISTS descuentos_mermas TEXT DEFAULT \'[]\';'))
        conn.execute(text(f'ALTER TABLE "{schema_name}".viajes ADD COLUMN IF NOT EXISTS total_descuentos_adicionales_bs DOUBLE PRECISION DEFAULT 0.0;'))
        conn.execute(text(f'ALTER TABLE "{schema_name}".viajes ADD COLUMN IF NOT EXISTS total_descuentos_mermas_bs DOUBLE PRECISION DEFAULT 0.0;'))
        conn.execute(text(f'UPDATE "{schema_name}".viajes SET volumen_facturado = ROUND((volumen_recepcionado_litros / 1000.0)::numeric, 3) WHERE volumen_facturado IS NULL;'))
        
        # Parámetros y catálogos de empresa (Productos y Tramos)
        conn.execute(text(f'ALTER TABLE "{schema_name}".parametros_liquidacion ADD COLUMN IF NOT EXISTS productos_json TEXT DEFAULT \'["GASOLINA", "DIESEL", "INSUMOS Y ADITIVOS"]\';'))
        conn.execute(text(f'ALTER TABLE "{schema_name}".parametros_liquidacion ADD COLUMN IF NOT EXISTS tramos_json TEXT DEFAULT \'["ARICA - TAMBO QUEMADO - LA PAZ", "IQUIQUE - PISIGA - ORURO", "MEJILLONES - OLLAGÜE - UYUNI"]\';'))
        conn.execute(text(f'UPDATE "{schema_name}".parametros_liquidacion SET productos_json = \'["GASOLINA", "DIESEL", "INSUMOS Y ADITIVOS"]\' WHERE productos_json IS NULL;'))
        conn.execute(text(f'UPDATE "{schema_name}".parametros_liquidacion SET tramos_json = \'["ARICA - TAMBO QUEMADO - LA PAZ", "IQUIQUE - PISIGA - ORURO", "MEJILLONES - OLLAGÜE - UYUNI"]\' WHERE tramos_json IS NULL;'))
        conn.commit()

def run_all_tenant_migrations():
    """
    Ejecuta las migraciones automáticas sobre todos los esquemas de empresas activas.
    """
    db = SessionLocal()
    try:
        empresas = db.query(Empresa).filter(Empresa.is_active == True).all()
        for emp in empresas:
            if emp.schema_name:
                try:
                    ensure_tenant_columns(emp.schema_name)
                except Exception as e:
                    print(f"Error migrando esquema {emp.schema_name}: {e}")
    finally:
        db.close()
