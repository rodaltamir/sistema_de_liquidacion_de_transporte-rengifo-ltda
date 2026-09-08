from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import UnidadTransporte
from app.schemas.unidad import UnidadCreate, UnidadUpdate, UnidadResponse

router = APIRouter(prefix="/tenants/{schema_name}/unidades", tags=["Flota de Transporte"])

@router.get("/", response_model=List[UnidadResponse])
def list_unidades(
    schema_name: str,
    search: Optional[str] = None,
    estado: Optional[str] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(UnidadTransporte)
        if estado:
            query = query.filter(UnidadTransporte.estado == estado)
        if search:
            s = f"%{search}%"
            query = query.filter(
                (UnidadTransporte.placa.ilike(s)) |
                (UnidadTransporte.conductor_nombre.ilike(s)) |
                (UnidadTransporte.marca.ilike(s))
            )
        return query.order_by(UnidadTransporte.placa).all()
    finally:
        session.close()

@router.post("/", response_model=UnidadResponse)
def create_unidad(
    schema_name: str,
    unidad_in: UnidadCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        existing = session.query(UnidadTransporte).filter(UnidadTransporte.placa == unidad_in.placa.upper().strip()).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Ya existe una unidad con la placa {unidad_in.placa}")

        unidad = UnidadTransporte(
            placa=unidad_in.placa.upper().strip(),
            marca=unidad_in.marca,
            modelo_ano=unidad_in.modelo_ano,
            color=unidad_in.color,
            tipo_unidad=unidad_in.tipo_unidad or "Cisterna Combustible",
            capacidad_litros=unidad_in.capacidad_litros or 34000.0,
            capacidad_m3=unidad_in.capacidad_m3 or 34.0,
            num_compartimentos=unidad_in.num_compartimentos or 4,
            conductor_nombre=unidad_in.conductor_nombre,
            conductor_ci=unidad_in.conductor_ci,
            conductor_telefono=unidad_in.conductor_telefono,
            conductor_licencia=unidad_in.conductor_licencia,
            propietario_nombre=unidad_in.propietario_nombre,
            propietario_ci=unidad_in.propietario_ci,
            propietario_telefono=unidad_in.propietario_telefono,
            soat_numero=unidad_in.soat_numero,
            soat_vencimiento=unidad_in.soat_vencimiento,
            b_sisa=unidad_in.b_sisa,
            cert_calibracion_senasac=unidad_in.cert_calibracion_senasac,
            inspeccion_tecnica=unidad_in.inspeccion_tecnica,
            estado=unidad_in.estado or "Activo",
            notas=unidad_in.notas
        )
        session.add(unidad)
        session.commit()
        session.refresh(unidad)
        return unidad
    finally:
        session.close()

@router.get("/{id}", response_model=UnidadResponse)
def get_unidad(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        unidad = session.query(UnidadTransporte).filter(UnidadTransporte.id == id).first()
        if not unidad:
            raise HTTPException(status_code=404, detail="Unidad no encontrada")
        return unidad
    finally:
        session.close()

@router.put("/{id}", response_model=UnidadResponse)
def update_unidad(
    schema_name: str,
    id: int,
    unidad_in: UnidadUpdate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        unidad = session.query(UnidadTransporte).filter(UnidadTransporte.id == id).first()
        if not unidad:
            raise HTTPException(status_code=404, detail="Unidad no encontrada")

        update_data = unidad_in.model_dump(exclude_unset=True)
        if "placa" in update_data and update_data["placa"]:
            update_data["placa"] = update_data["placa"].upper().strip()

        for field, val in update_data.items():
            setattr(unidad, field, val)

        session.commit()
        session.refresh(unidad)
        return unidad
    finally:
        session.close()

@router.delete("/{id}")
def delete_unidad(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        unidad = session.query(UnidadTransporte).filter(UnidadTransporte.id == id).first()
        if not unidad:
            raise HTTPException(status_code=404, detail="Unidad no encontrada")
        
        session.delete(unidad)
        session.commit()
        return {"message": f"Unidad {unidad.placa} eliminada"}
    finally:
        session.close()
