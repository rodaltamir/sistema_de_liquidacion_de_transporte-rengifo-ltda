from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Empleado
from app.schemas.empleado import EmpleadoCreate, EmpleadoUpdate, EmpleadoResponse

router = APIRouter(prefix="/tenants/{schema_name}/empleados", tags=["Personal y Choferes"])

@router.get("/", response_model=List[EmpleadoResponse])
def list_empleados(
    schema_name: str,
    search: Optional[str] = None,
    cargo: Optional[str] = None,
    estado: Optional[str] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Empleado)
        if cargo and cargo != "Todos":
            query = query.filter(Empleado.cargo == cargo)
        if estado and estado != "Todos":
            query = query.filter(Empleado.estado == estado)
        if search:
            s = f"%{search}%"
            query = query.filter(
                (Empleado.nombres.ilike(s)) |
                (Empleado.apellidos.ilike(s)) |
                (Empleado.ci.ilike(s)) |
                (Empleado.licencia_conducir.ilike(s)) |
                (Empleado.unidad_asignada_placa.ilike(s))
            )
        return query.order_by(Empleado.apellidos, Empleado.nombres).all()
    finally:
        session.close()

@router.post("/", response_model=EmpleadoResponse)
def create_empleado(
    schema_name: str,
    emp_in: EmpleadoCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        existing = session.query(Empleado).filter(Empleado.ci == emp_in.ci.strip()).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Ya existe un empleado registrado con el CI {emp_in.ci}")

        empleado = Empleado(
            nombres=emp_in.nombres.strip(),
            apellidos=emp_in.apellidos.strip(),
            ci=emp_in.ci.strip(),
            telefono=emp_in.telefono,
            email=emp_in.email,
            cargo=emp_in.cargo or "Chofer / Conductor",
            licencia_conducir=emp_in.licencia_conducir,
            categoria_licencia=emp_in.categoria_licencia,
            vencimiento_licencia=emp_in.vencimiento_licencia,
            fecha_ingreso=emp_in.fecha_ingreso,
            salario_base=emp_in.salario_base or 0.0,
            estado=emp_in.estado or "Activo",
            unidad_asignada_placa=emp_in.unidad_asignada_placa.upper().strip() if emp_in.unidad_asignada_placa else None,
            direccion=emp_in.direccion,
            contacto_emergencia=emp_in.contacto_emergencia,
            notas=emp_in.notas
        )
        session.add(empleado)
        session.commit()
        session.refresh(empleado)
        return empleado
    finally:
        session.close()

@router.get("/{id}", response_model=EmpleadoResponse)
def get_empleado(
    schema_name: str,
    id: int,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        empleado = session.query(Empleado).filter(Empleado.id == id).first()
        if not empleado:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        return empleado
    finally:
        session.close()

@router.put("/{id}", response_model=EmpleadoResponse)
def update_empleado(
    schema_name: str,
    id: int,
    emp_in: EmpleadoUpdate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        empleado = session.query(Empleado).filter(Empleado.id == id).first()
        if not empleado:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")

        update_data = emp_in.model_dump(exclude_unset=True)
        if "unidad_asignada_placa" in update_data and update_data["unidad_asignada_placa"]:
            update_data["unidad_asignada_placa"] = update_data["unidad_asignada_placa"].upper().strip()

        for field, value in update_data.items():
            setattr(empleado, field, value)

        session.commit()
        session.refresh(empleado)
        return empleado
    finally:
        session.close()

@router.delete("/{id}")
def delete_empleado(
    schema_name: str,
    id: int,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        empleado = session.query(Empleado).filter(Empleado.id == id).first()
        if not empleado:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")

        session.delete(empleado)
        session.commit()
        return {"message": f"Empleado {empleado.nombres} {empleado.apellidos} eliminado correctamente"}
    finally:
        session.close()
