import sys
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.public import User, Asociacion, Empresa
from app.db.base_class import Base

def clean_database():
    """
    Elimina todos los datos demo y esquemas temporales para iniciar desde cero.
    Mantiene únicamente los usuarios del sistema.
    """
    db = SessionLocal()
    try:
        print("Limpiando datos existentes de la base de datos...")
        # Obtener todas las empresas registradas
        empresas = db.query(Empresa).all()
        schemas_to_drop = [e.schema_name for e in empresas]
        # Agregar los esquemas demo conocidos por si acaso
        for demo_schema in ["empresa_britanic", "empresa_trucks_drivers", "empresa_chaxmana"]:
            if demo_schema not in schemas_to_drop:
                schemas_to_drop.append(demo_schema)

        # Eliminar registros de empresas y asociaciones
        db.query(Empresa).delete()
        db.query(Asociacion).delete()
        db.commit()

        # Dropear cada esquema tenant
        with engine.connect() as conn:
            for s_name in schemas_to_drop:
                try:
                    conn.execute(text(f'DROP SCHEMA IF EXISTS "{s_name}" CASCADE'))
                    print(f"Esquema tenant '{s_name}' eliminado.")
                except Exception as ex:
                    print(f"Nota esquema {s_name}: {ex}")
            conn.commit()

        print("Base de datos limpiada con éxito. Lista para datos reales.")
    finally:
        db.close()

def seed():
    """
    Inicializa la estructura base del sistema (tablas públicas y usuarios esenciales).
    NO inserta datos demo falsos, permitiendo al usuario comenzar en blanco.
    """
    public_tables = [User.__table__, Asociacion.__table__, Empresa.__table__]
    Base.metadata.create_all(bind=engine, tables=public_tables)

    db = SessionLocal()
    try:
        print("Verificando usuarios iniciales del sistema...")

        # 1. Usuario Administrador
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                name="Administrador General",
                username="admin",
                email="admin@transporte.com",
                hashed_password=get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin)
            print("Usuario 'admin' inicializado (pass: admin123)")

        # 2. Usuario Operador
        operador = db.query(User).filter(User.username == "usuario").first()
        if not operador:
            operador = User(
                name="Operador de Liquidaciones",
                username="usuario",
                email="operador@transporte.com",
                hashed_password=get_password_hash("user123"),
                role="user"
            )
            db.add(operador)
            print("Usuario 'usuario' inicializado (pass: user123)")

        db.commit()
        print("Inicialización base completada con éxito. Sistema listo en blanco.")
    finally:
        db.close()

if __name__ == "__main__":
    if "--clean" in sys.argv or "-c" in sys.argv:
        clean_database()
    seed()
