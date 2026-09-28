import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from app.db.session import get_db, engine, get_tenant_session
from app.db.base_class import Base
from app.models.public import Empresa, Asociacion
from app.models.tenant import ParametroLiquidacion
from app.schemas.empresa import EmpresaCreate, EmpresaUpdate, EmpresaResponse
from app.api.deps import require_admin, require_current_user

router = APIRouter(prefix="/empresas", tags=["Empresas de Transporte"])

def sanitize_schema_name(name: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', name).strip('_').lower()
    return f"empresa_{slug[:30]}"

def init_tenant_schema(schema_name: str):
    """
    Crea el esquema en PostgreSQL y las tablas tenant-specific con sus valores por defecto.
    """
    with engine.connect() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
        conn.commit()

    # Traducir 'tenant' al esquema específico para crear las tablas
    connectable = engine.execution_options(
        schema_translate_map={"tenant": schema_name}
    )
    from app.models.tenant import UnidadTransporte, ParametroLiquidacion, Viaje, Liquidacion, Empleado
    tenant_tables = [
        UnidadTransporte.__table__,
        ParametroLiquidacion.__table__,
        Viaje.__table__,
        Liquidacion.__table__,
        Empleado.__table__
    ]
    Base.metadata.create_all(bind=connectable, tables=tenant_tables)

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

@router.get("/", response_model=List[EmpresaResponse])
def list_empresas(
    asociacion_id: Optional[int] = None,
    independientes: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Empresa).filter(Empresa.is_active == True)
    
    if independientes:
        query = query.filter(Empresa.asociacion_id == None)
    elif asociacion_id is not None:
        query = query.filter(Empresa.asociacion_id == asociacion_id)
        
    empresas = query.all()
    
    result = []
    for emp in empresas:
        emp_resp = EmpresaResponse(
            id=emp.id,
            name=emp.name,
            schema_name=emp.schema_name,
            nit=emp.nit,
            asociacion_id=emp.asociacion_id,
            representante_legal=emp.representante_legal,
            direccion=emp.direccion,
            telefono=emp.telefono,
            email=emp.email,
            icon=emp.icon or "Truck",
            logo_base64=emp.logo_base64,
            is_active=emp.is_active,
            created_at=emp.created_at,
            asociacion_name=emp.asociacion.name if emp.asociacion else None
        )
        result.append(emp_resp)
        
    return result

@router.post("/", response_model=EmpresaResponse)
def create_empresa(emp_in: EmpresaCreate, db: Session = Depends(get_db)):
    base_schema = sanitize_schema_name(emp_in.name)
    schema_name = base_schema
    counter = 1
    while db.query(Empresa).filter(Empresa.schema_name == schema_name).first():
        schema_name = f"{base_schema}_{counter}"
        counter += 1

    empresa = Empresa(
        name=emp_in.name,
        schema_name=schema_name,
        nit=emp_in.nit,
        asociacion_id=emp_in.asociacion_id,
        representante_legal=emp_in.representante_legal,
        direccion=emp_in.direccion,
        telefono=emp_in.telefono,
        email=emp_in.email,
        icon=emp_in.icon or "Truck",
        logo_base64=emp_in.logo_base64
    )
    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    # Inicializar esquema y tablas
    init_tenant_schema(schema_name)

    return EmpresaResponse(
        id=empresa.id,
        name=empresa.name,
        schema_name=empresa.schema_name,
        nit=empresa.nit,
        asociacion_id=empresa.asociacion_id,
        representante_legal=empresa.representante_legal,
        direccion=empresa.direccion,
        telefono=empresa.telefono,
        email=empresa.email,
        icon=empresa.icon,
        logo_base64=empresa.logo_base64,
        is_active=empresa.is_active,
        created_at=empresa.created_at,
        asociacion_name=empresa.asociacion.name if empresa.asociacion else None
    )

@router.get("/resumen-global")
def get_resumen_global(db: Session = Depends(get_db)):
    """
    Retorna métricas consolidadas del sistema para el mini dashboard principal:
    total empresas, asociaciones, camiones/flota, viajes, volumen y fletes.
    """
    empresas = db.query(Empresa).filter(Empresa.is_active == True).all()
    asociaciones = db.query(Asociacion).filter(Asociacion.is_active == True).all()

    total_empresas = len(empresas)
    total_asociaciones = len(asociaciones)
    empresas_independientes = len([e for e in empresas if e.asociacion_id is None])
    empresas_asociadas = len([e for e in empresas if e.asociacion_id is not None])

    total_camiones = 0
    total_viajes = 0
    total_volumen_litros = 0.0
    total_fletes_bs = 0.0
    total_liquidaciones = 0

    from app.models.tenant import UnidadTransporte, Viaje, Liquidacion

    for emp in empresas:
        try:
            t_session = get_tenant_session(emp.schema_name)
            try:
                total_camiones += t_session.query(UnidadTransporte).count()
                viajes = t_session.query(Viaje).all()
                total_viajes += len(viajes)
                for v in viajes:
                    total_volumen_litros += (v.volumen_recepcionado_litros or 0.0)
                    total_fletes_bs += (v.flete_total_bs or 0.0)
                total_liquidaciones += t_session.query(Liquidacion).count()
            finally:
                t_session.close()
        except Exception:
            continue

    return {
        "total_empresas": total_empresas,
        "total_asociaciones": total_asociaciones,
        "empresas_independientes": empresas_independientes,
        "empresas_asociadas": empresas_asociadas,
        "total_camiones": total_camiones,
        "total_viajes": total_viajes,
        "total_volumen_litros": round(total_volumen_litros, 2),
        "total_volumen_m3": round(total_volumen_litros / 1000.0, 3),
        "total_fletes_bs": round(total_fletes_bs, 2),
        "total_liquidaciones": total_liquidaciones
    }

@router.get("/{schema_name}", response_model=EmpresaResponse)
def get_empresa(schema_name: str, db: Session = Depends(get_db)):
    emp = db.query(Empresa).filter(Empresa.schema_name == schema_name).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return EmpresaResponse(
        id=emp.id,
        name=emp.name,
        schema_name=emp.schema_name,
        nit=emp.nit,
        asociacion_id=emp.asociacion_id,
        representante_legal=emp.representante_legal,
        direccion=emp.direccion,
        telefono=emp.telefono,
        email=emp.email,
        icon=emp.icon,
        logo_base64=emp.logo_base64,
        is_active=emp.is_active,
        created_at=emp.created_at,
        asociacion_name=emp.asociacion.name if emp.asociacion else None
    )

@router.put("/{schema_name}", response_model=EmpresaResponse)
def update_empresa(schema_name: str, emp_in: EmpresaUpdate, db: Session = Depends(get_db)):
    emp = db.query(Empresa).filter(Empresa.schema_name == schema_name).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    update_data = emp_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(emp, field, val)

    db.commit()
    db.refresh(emp)

    return EmpresaResponse(
        id=emp.id,
        name=emp.name,
        schema_name=emp.schema_name,
        nit=emp.nit,
        asociacion_id=emp.asociacion_id,
        representante_legal=emp.representante_legal,
        direccion=emp.direccion,
        telefono=emp.telefono,
        email=emp.email,
        icon=emp.icon,
        logo_base64=emp.logo_base64,
        is_active=emp.is_active,
        created_at=emp.created_at,
        asociacion_name=emp.asociacion.name if emp.asociacion else None
    )

@router.delete("/{schema_name}")
def delete_empresa(schema_name: str, db: Session = Depends(get_db)):
    emp = db.query(Empresa).filter(Empresa.schema_name == schema_name).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    db.delete(emp)
    db.commit()

    # Opcionalmente eliminar el esquema
    try:
        with engine.connect() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
            conn.commit()
    except Exception as e:
        print(f"Advertencia al borrar esquema {schema_name}: {e}")

    return {"message": "Empresa y datos eliminados correctamente"}
