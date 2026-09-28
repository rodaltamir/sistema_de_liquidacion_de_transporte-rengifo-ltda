from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import EmpresaApoyo, UnidadApoyo
from app.schemas.apoyo import (
    EmpresaApoyoCreate,
    EmpresaApoyoUpdate,
    EmpresaApoyoResponse,
    UnidadApoyoCreate,
    UnidadApoyoUpdate,
    UnidadApoyoResponse,
    ApoyoStats
)

router = APIRouter(prefix="/tenants/{schema_name}/apoyo", tags=["Empresas y Flota de Apoyo"])


@router.get("/stats", response_model=ApoyoStats)
def get_apoyo_stats(schema_name: str, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        total_empresas = session.query(EmpresaApoyo).filter(EmpresaApoyo.is_active == True).count()
        total_unidades = session.query(UnidadApoyo).count()
        disponibles = session.query(UnidadApoyo).filter(UnidadApoyo.estado == "Disponible").count()
        en_ruta = session.query(UnidadApoyo).filter(UnidadApoyo.estado == "En Ruta").count()

        return ApoyoStats(
            total_empresas=total_empresas,
            total_unidades=total_unidades,
            unidades_disponibles=disponibles,
            unidades_en_ruta=en_ruta
        )
    finally:
        session.close()


@router.get("/", response_model=List[EmpresaApoyoResponse])
def list_empresas_apoyo(schema_name: str, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        empresas = session.query(EmpresaApoyo).filter(EmpresaApoyo.is_active == True).order_by(EmpresaApoyo.created_at.desc()).all()
        results = []
        for emp in empresas:
            unidades_resp = [
                UnidadApoyoResponse(
                    id=u.id,
                    empresa_apoyo_id=u.empresa_apoyo_id,
                    empresa_apoyo_nombre=emp.nombre,
                    placa=u.placa,
                    conductor_nombre=u.conductor_nombre,
                    conductor_telefono=u.conductor_telefono,
                    conductor_ci=u.conductor_ci,
                    capacidad_litros=u.capacidad_litros or 34000.0,
                    capacidad_m3=u.capacidad_m3 or 34.0,
                    num_compartimentos=u.num_compartimentos or 4,
                    estado=u.estado or "Disponible",
                    notas=u.notas,
                    created_at=u.created_at
                )
                for u in emp.unidades
            ]
            results.append(
                EmpresaApoyoResponse(
                    id=emp.id,
                    nombre=emp.nombre,
                    representante=emp.representante,
                    telefono=emp.telefono,
                    ci_nit=emp.ci_nit,
                    direccion=emp.direccion,
                    notas=emp.notas,
                    is_active=emp.is_active,
                    created_at=emp.created_at,
                    unidades=unidades_resp,
                    total_unidades=len(unidades_resp)
                )
            )
        return results
    finally:
        session.close()


@router.get("/unidades/todas", response_model=List[UnidadApoyoResponse])
def list_all_unidades_apoyo(schema_name: str, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        unidades = session.query(UnidadApoyo).join(EmpresaApoyo).filter(EmpresaApoyo.is_active == True).all()
        return [
            UnidadApoyoResponse(
                id=u.id,
                empresa_apoyo_id=u.empresa_apoyo_id,
                empresa_apoyo_nombre=u.empresa_apoyo.nombre if u.empresa_apoyo else "Apoyo",
                placa=u.placa,
                conductor_nombre=u.conductor_nombre,
                conductor_telefono=u.conductor_telefono,
                conductor_ci=u.conductor_ci,
                capacidad_litros=u.capacidad_litros or 34000.0,
                capacidad_m3=u.capacidad_m3 or 34.0,
                num_compartimentos=u.num_compartimentos or 4,
                estado=u.estado or "Disponible",
                notas=u.notas,
                created_at=u.created_at
            )
            for u in unidades
        ]
    finally:
        session.close()


@router.post("/", response_model=EmpresaApoyoResponse)
def create_empresa_apoyo(
    schema_name: str,
    emp_in: EmpresaApoyoCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        emp_apoyo = EmpresaApoyo(
            nombre=emp_in.nombre.strip(),
            representante=emp_in.representante.strip() if emp_in.representante else None,
            telefono=emp_in.telefono.strip() if emp_in.telefono else None,
            ci_nit=emp_in.ci_nit.strip() if emp_in.ci_nit else None,
            direccion=emp_in.direccion.strip() if emp_in.direccion else None,
            notas=emp_in.notas.strip() if emp_in.notas else None,
            is_active=True
        )
        session.add(emp_apoyo)
        session.commit()
        session.refresh(emp_apoyo)

        return EmpresaApoyoResponse(
            id=emp_apoyo.id,
            nombre=emp_apoyo.nombre,
            representante=emp_apoyo.representante,
            telefono=emp_apoyo.telefono,
            ci_nit=emp_apoyo.ci_nit,
            direccion=emp_apoyo.direccion,
            notas=emp_apoyo.notas,
            is_active=emp_apoyo.is_active,
            created_at=emp_apoyo.created_at,
            unidades=[],
            total_unidades=0
        )
    finally:
        session.close()


@router.get("/{apoyo_id}", response_model=EmpresaApoyoResponse)
def get_empresa_apoyo(
    schema_name: str,
    apoyo_id: int,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        emp = session.query(EmpresaApoyo).filter(EmpresaApoyo.id == apoyo_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa de apoyo no encontrada")

        unidades_resp = [
            UnidadApoyoResponse(
                id=u.id,
                empresa_apoyo_id=u.empresa_apoyo_id,
                empresa_apoyo_nombre=emp.nombre,
                placa=u.placa,
                conductor_nombre=u.conductor_nombre,
                conductor_telefono=u.conductor_telefono,
                conductor_ci=u.conductor_ci,
                capacidad_litros=u.capacidad_litros or 34000.0,
                capacidad_m3=u.capacidad_m3 or 34.0,
                num_compartimentos=u.num_compartimentos or 4,
                estado=u.estado or "Disponible",
                notas=u.notas,
                created_at=u.created_at
            )
            for u in emp.unidades
        ]

        return EmpresaApoyoResponse(
            id=emp.id,
            nombre=emp.nombre,
            representante=emp.representante,
            telefono=emp.telefono,
            ci_nit=emp.ci_nit,
            direccion=emp.direccion,
            notas=emp.notas,
            is_active=emp.is_active,
            created_at=emp.created_at,
            unidades=unidades_resp,
            total_unidades=len(unidades_resp)
        )
    finally:
        session.close()


@router.put("/{apoyo_id}", response_model=EmpresaApoyoResponse)
def update_empresa_apoyo(
    schema_name: str,
    apoyo_id: int,
    emp_in: EmpresaApoyoUpdate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        emp = session.query(EmpresaApoyo).filter(EmpresaApoyo.id == apoyo_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa de apoyo no encontrada")

        update_data = emp_in.model_dump(exclude_unset=True)
        for field, val in update_data.items():
            setattr(emp, field, val)

        session.commit()
        session.refresh(emp)

        unidades_resp = [
            UnidadApoyoResponse(
                id=u.id,
                empresa_apoyo_id=u.empresa_apoyo_id,
                empresa_apoyo_nombre=emp.nombre,
                placa=u.placa,
                conductor_nombre=u.conductor_nombre,
                conductor_telefono=u.conductor_telefono,
                conductor_ci=u.conductor_ci,
                capacidad_litros=u.capacidad_litros or 34000.0,
                capacidad_m3=u.capacidad_m3 or 34.0,
                num_compartimentos=u.num_compartimentos or 4,
                estado=u.estado or "Disponible",
                notas=u.notas,
                created_at=u.created_at
            )
            for u in emp.unidades
        ]

        return EmpresaApoyoResponse(
            id=emp.id,
            nombre=emp.nombre,
            representante=emp.representante,
            telefono=emp.telefono,
            ci_nit=emp.ci_nit,
            direccion=emp.direccion,
            notas=emp.notas,
            is_active=emp.is_active,
            created_at=emp.created_at,
            unidades=unidades_resp,
            total_unidades=len(unidades_resp)
        )
    finally:
        session.close()


@router.delete("/{apoyo_id}")
def delete_empresa_apoyo(
    schema_name: str,
    apoyo_id: int,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        emp = session.query(EmpresaApoyo).filter(EmpresaApoyo.id == apoyo_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa de apoyo no encontrada")
        session.delete(emp)
        session.commit()
        return {"message": "Empresa de apoyo y sus camiones eliminados correctamente"}
    finally:
        session.close()


@router.post("/{apoyo_id}/unidades", response_model=UnidadApoyoResponse)
def add_unidad_apoyo(
    schema_name: str,
    apoyo_id: int,
    unidad_in: UnidadApoyoCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        emp = session.query(EmpresaApoyo).filter(EmpresaApoyo.id == apoyo_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa de apoyo no encontrada")

        litros = unidad_in.capacidad_litros or 34000.0
        m3 = unidad_in.capacidad_m3 or (litros / 1000.0)

        unidad = UnidadApoyo(
            empresa_apoyo_id=apoyo_id,
            placa=unidad_in.placa.strip().upper(),
            conductor_nombre=unidad_in.conductor_nombre.strip() if unidad_in.conductor_nombre else None,
            conductor_telefono=unidad_in.conductor_telefono.strip() if unidad_in.conductor_telefono else None,
            conductor_ci=unidad_in.conductor_ci.strip() if unidad_in.conductor_ci else None,
            capacidad_litros=litros,
            capacidad_m3=m3,
            num_compartimentos=unidad_in.num_compartimentos or 4,
            estado=unidad_in.estado or "Disponible",
            notas=unidad_in.notas
        )
        session.add(unidad)
        session.commit()
        session.refresh(unidad)

        return UnidadApoyoResponse(
            id=unidad.id,
            empresa_apoyo_id=unidad.empresa_apoyo_id,
            empresa_apoyo_nombre=emp.nombre,
            placa=unidad.placa,
            conductor_nombre=unidad.conductor_nombre,
            conductor_telefono=unidad.conductor_telefono,
            conductor_ci=unidad.conductor_ci,
            capacidad_litros=unidad.capacidad_litros,
            capacidad_m3=unidad.capacidad_m3,
            num_compartimentos=unidad.num_compartimentos,
            estado=unidad.estado,
            notas=unidad.notas,
            created_at=unidad.created_at
        )
    finally:
        session.close()


@router.put("/unidades/{unidad_id}", response_model=UnidadApoyoResponse)
def update_unidad_apoyo(
    schema_name: str,
    unidad_id: int,
    unidad_in: UnidadApoyoUpdate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        unidad = session.query(UnidadApoyo).filter(UnidadApoyo.id == unidad_id).first()
        if not unidad:
            raise HTTPException(status_code=404, detail="Camión de apoyo no encontrado")

        update_data = unidad_in.model_dump(exclude_unset=True)
        if "placa" in update_data and update_data["placa"]:
            update_data["placa"] = update_data["placa"].strip().upper()

        for field, val in update_data.items():
            setattr(unidad, field, val)

        session.commit()
        session.refresh(unidad)

        return UnidadApoyoResponse(
            id=unidad.id,
            empresa_apoyo_id=unidad.empresa_apoyo_id,
            empresa_apoyo_nombre=unidad.empresa_apoyo.nombre if unidad.empresa_apoyo else "Apoyo",
            placa=unidad.placa,
            conductor_nombre=unidad.conductor_nombre,
            conductor_telefono=unidad.conductor_telefono,
            conductor_ci=unidad.conductor_ci,
            capacidad_litros=unidad.capacidad_litros,
            capacidad_m3=unidad.capacidad_m3,
            num_compartimentos=unidad.num_compartimentos,
            estado=unidad.estado,
            notas=unidad.notas,
            created_at=unidad.created_at
        )
    finally:
        session.close()


@router.delete("/unidades/{unidad_id}")
def delete_unidad_apoyo(
    schema_name: str,
    unidad_id: int,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        unidad = session.query(UnidadApoyo).filter(UnidadApoyo.id == unidad_id).first()
        if not unidad:
            raise HTTPException(status_code=404, detail="Camión de apoyo no encontrado")
        session.delete(unidad)
        session.commit()
        return {"message": "Camión de apoyo eliminado correctamente"}
    finally:
        session.close()
