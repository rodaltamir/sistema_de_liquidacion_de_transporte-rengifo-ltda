from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from sqlalchemy import text
from app.db.session import get_tenant_session, engine
from app.db.base_class import Base
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Cliente
from app.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteResponse

router = APIRouter(prefix="/tenants/{schema_name}/clientes", tags=["Clientes"])

def ensure_clientes_table(schema_name: str):
    """
    Garantiza que la tabla de clientes exista en el esquema del tenant.
    """
    connectable = engine.execution_options(schema_translate_map={"tenant": schema_name})
    Base.metadata.create_all(bind=connectable, tables=[Cliente.__table__])

@router.get("/", response_model=List[ClienteResponse])
def list_clientes(
    schema_name: str,
    search: Optional[str] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    ensure_clientes_table(schema_name)
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Cliente).filter(Cliente.is_active == True)
        
        # Si no hay clientes registrados, creamos YPFB por defecto
        if query.count() == 0 and not search:
            default_cli = Cliente(
                nombre="Y.P.F.B.",
                nit="1020269020",
                telefono="",
                direccion="La Paz, Bolivia",
                is_active=True
            )
            session.add(default_cli)
            session.commit()
            query = session.query(Cliente).filter(Cliente.is_active == True)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                (Cliente.nombre.ilike(s)) |
                (Cliente.nit.ilike(s)) |
                (Cliente.telefono.ilike(s))
            )

        return query.order_by(Cliente.nombre.asc()).all()
    finally:
        session.close()

@router.post("/", response_model=ClienteResponse)
def create_cliente(
    schema_name: str,
    cli_in: ClienteCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    ensure_clientes_table(schema_name)
    session = get_tenant_session(schema_name)
    try:
        nombre_clean = cli_in.nombre.strip()
        if not nombre_clean:
            raise HTTPException(status_code=400, detail="El nombre del cliente es obligatorio.")

        existing = session.query(Cliente).filter(
            Cliente.nombre.ilike(nombre_clean),
            Cliente.is_active == True
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Ya existe un cliente registrado con el nombre '{nombre_clean}'.")

        cliente = Cliente(
            nombre=nombre_clean,
            nit=cli_in.nit.strip() if cli_in.nit else None,
            telefono=cli_in.telefono.strip() if cli_in.telefono else None,
            direccion=cli_in.direccion.strip() if cli_in.direccion else None,
            is_active=True
        )
        session.add(cliente)
        session.commit()
        session.refresh(cliente)
        return cliente
    finally:
        session.close()

@router.get("/{id}", response_model=ClienteResponse)
def get_cliente(
    schema_name: str,
    id: int,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    ensure_clientes_table(schema_name)
    session = get_tenant_session(schema_name)
    try:
        cliente = session.query(Cliente).filter(Cliente.id == id).first()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        return cliente
    finally:
        session.close()

@router.put("/{id}", response_model=ClienteResponse)
def update_cliente(
    schema_name: str,
    id: int,
    cli_in: ClienteUpdate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    ensure_clientes_table(schema_name)
    session = get_tenant_session(schema_name)
    try:
        cliente = session.query(Cliente).filter(Cliente.id == id).first()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        update_data = cli_in.model_dump(exclude_unset=True)
        if "nombre" in update_data and update_data["nombre"]:
            update_data["nombre"] = update_data["nombre"].strip()

        for key, val in update_data.items():
            setattr(cliente, key, val)

        session.commit()
        session.refresh(cliente)
        return cliente
    finally:
        session.close()

@router.delete("/{id}")
def delete_cliente(
    schema_name: str,
    id: int,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    ensure_clientes_table(schema_name)
    session = get_tenant_session(schema_name)
    try:
        cliente = session.query(Cliente).filter(Cliente.id == id).first()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        cliente.is_active = False
        session.commit()
        return {"message": "Cliente eliminado correctamente"}
    finally:
        session.close()
