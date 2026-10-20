import re
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from app.db.session import get_db, engine, get_tenant_session
from app.db.base_class import Base
from app.models.public import Empresa, Asociacion
from app.models.tenant import ParametroLiquidacion
from app.schemas.empresa import EmpresaCreate, EmpresaUpdate, EmpresaResponse
from app.api.deps import require_admin, require_current_user
from app.services.excel_importer import (
    get_excel_sheets,
    parse_excel_viajes_data,
    execute_import_viajes,
    execute_import_asociacion_multi_empresa
)

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
            tipo_empresa=emp.tipo_empresa or "Sociedad",
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
        tipo_empresa=emp_in.tipo_empresa or "Sociedad",
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
        tipo_empresa=empresa.tipo_empresa or "Sociedad",
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

def extract_suggested_company_name(filename: str) -> str:
    clean = re.sub(r'\.(xlsx|xlsm|xltx|xls)$', '', filename, flags=re.IGNORECASE)
    clean = re.sub(r'(?i)\b(ventas|importacion|importación|plantilla|viajes|liquidacion|liquidaciones|datos|reporte)\b', '', clean)
    clean = re.sub(r'[\-_]+', ' ', clean).strip()
    clean = re.sub(r'\s+', ' ', clean)
    if len(clean) >= 3:
        return clean.upper()
    return "EMPRESA DE TRANSPORTE"

@router.post("/excel-info")
async def get_global_excel_info(
    file: UploadFile = File(...)
):
    if not file.filename.endswith(('.xlsx', '.xlsm', '.xltx')):
        raise HTTPException(status_code=400, detail="El archivo debe tener formato Excel (.xlsx)")
    contents = await file.read()
    try:
        sheets = get_excel_sheets(contents)
        suggested_name = extract_suggested_company_name(file.filename)
        return {
            "success": True,
            "filename": file.filename,
            "sheets": sheets,
            "default_sheet": "__ALL__" if len(sheets) > 1 else (sheets[0] if sheets else ""),
            "suggested_company_name": suggested_name
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {str(e)}")

@router.post("/preview-excel")
async def preview_global_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    target_schema: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xlsm', '.xltx')):
        raise HTTPException(status_code=400, detail="El archivo debe tener formato Excel (.xlsx)")
    contents = await file.read()
    
    session = None
    target_empresa_name = None
    if target_schema:
        clean_schema = target_schema.strip().lower()
        emp = db.query(Empresa).filter(Empresa.schema_name == clean_schema).first()
        if emp:
            target_empresa_name = emp.name
            try:
                session = get_tenant_session(clean_schema)
            except Exception:
                session = None

    try:
        preview_data = parse_excel_viajes_data(
            file_bytes=contents,
            sheet_name=sheet_name,
            session=session,
            db=db,
            asociacion_id=None,
            max_preview_records=None,
            target_empresa_name=target_empresa_name
        )
        suggested_name = extract_suggested_company_name(file.filename)
        preview_data["suggested_company_name"] = suggested_name
        return preview_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al analizar el archivo Excel: {str(e)}")
    finally:
        if session:
            session.close()

@router.post("/importar-con-empresa")
async def importar_con_empresa(
    mode: str = Form("create_new"),
    empresa_name: Optional[str] = Form(None),
    tipo_empresa: Optional[str] = Form("Sociedad"),
    nit: Optional[str] = Form(None),
    asociacion_id: Optional[int] = Form(None),
    nueva_asociacion_nombre: Optional[str] = Form(None),
    nueva_asociacion_sigla: Optional[str] = Form(None),
    target_schema: Optional[str] = Form(None),
    overwrite_duplicates: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    sheet_name: Optional[str] = Form(None),
    edited_records_json: Optional[str] = Form(None),
    entidades_clasificacion_json: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    ent_map = {}
    if entidades_clasificacion_json:
        try:
            ent_map = json.loads(entidades_clasificacion_json)
        except Exception:
            ent_map = {}

    # Modo Asociación (Multi-Empresa)
    if mode == "asociacion":
        records_to_import = []
        if edited_records_json:
            try:
                records_to_import = json.loads(edited_records_json)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Formato JSON de registros editados inválido: {str(e)}")
        elif file:
            if not file.filename.endswith(('.xlsx', '.xlsm', '.xltx')):
                raise HTTPException(status_code=400, detail="El archivo debe tener formato Excel (.xlsx)")
            contents = await file.read()
            parsed = parse_excel_viajes_data(
                file_bytes=contents,
                sheet_name=sheet_name,
                db=db,
                asociacion_id=asociacion_id,
                target_empresa_name=empresa_name
            )
            records_to_import = parsed["records"]
        else:
            raise HTTPException(status_code=400, detail="No se proporcionaron registros ni archivo Excel para importar.")

        if not records_to_import:
            raise HTTPException(status_code=400, detail="No hay registros válidos para importar.")

        return execute_import_asociacion_multi_empresa(
            records=records_to_import,
            db=db,
            asociacion_id=asociacion_id,
            nueva_asociacion_nombre=nueva_asociacion_nombre,
            nueva_asociacion_sigla=nueva_asociacion_sigla,
            overwrite_duplicates=overwrite_duplicates,
            entidades_clasificacion=ent_map,
            empresa_principal_nombre=empresa_name
        )

    if mode == "create_new":
        if not empresa_name or not empresa_name.strip():
            raise HTTPException(status_code=400, detail="Debe especificar el nombre de la nueva empresa.")
        name_clean = empresa_name.strip()
        base_schema = sanitize_schema_name(name_clean)
        schema_name = base_schema
        counter = 1
        while db.query(Empresa).filter(Empresa.schema_name == schema_name).first():
            schema_name = f"{base_schema}_{counter}"
            counter += 1

        final_asoc_id = asociacion_id
        if nueva_asociacion_nombre and nueva_asociacion_nombre.strip():
            asoc_name_clean = nueva_asociacion_nombre.strip()
            asoc = db.query(Asociacion).filter(Asociacion.name.ilike(asoc_name_clean)).first()
            if not asoc:
                asoc = Asociacion(
                    name=asoc_name_clean,
                    sigla=nueva_asociacion_sigla.strip().upper() if nueva_asociacion_sigla else None
                )
                db.add(asoc)
                db.commit()
                db.refresh(asoc)
            final_asoc_id = asoc.id

        nueva_empresa = Empresa(
            name=name_clean,
            schema_name=schema_name,
            nit=nit.strip() if nit else None,
            tipo_empresa=tipo_empresa or "Sociedad",
            asociacion_id=final_asoc_id if final_asoc_id else None,
            icon="Truck"
        )
        db.add(nueva_empresa)
        db.commit()
        db.refresh(nueva_empresa)

        # Inicializar esquema tenant
        init_tenant_schema(schema_name)
        target_empresa = nueva_empresa
    elif mode == "use_existing":
        if not target_schema:
            raise HTTPException(status_code=400, detail="Debe seleccionar una empresa de destino.")
        target_empresa = db.query(Empresa).filter(Empresa.schema_name == target_schema).first()
        if not target_empresa:
            raise HTTPException(status_code=404, detail="La empresa de destino seleccionada no existe.")
        schema_name = target_empresa.schema_name
    else:
        raise HTTPException(status_code=400, detail="Modo de importación inválido. Use 'create_new', 'use_existing' o 'asociacion'.")

    tenant_session = get_tenant_session(schema_name)
    try:
        records_to_import = []
        if edited_records_json:
            try:
                records_to_import = json.loads(edited_records_json)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Formato JSON de registros editados inválido: {str(e)}")
        elif file:
            if not file.filename.endswith(('.xlsx', '.xlsm', '.xltx')):
                raise HTTPException(status_code=400, detail="El archivo debe tener formato Excel (.xlsx)")
            contents = await file.read()
            parsed = parse_excel_viajes_data(
                file_bytes=contents,
                sheet_name=sheet_name,
                session=tenant_session,
                max_preview_records=None
            )
            records_to_import = parsed["records"]
        else:
            raise HTTPException(status_code=400, detail="No se proporcionaron registros ni archivo Excel para importar.")

        if not records_to_import:
            raise HTTPException(status_code=400, detail="No hay registros válidos para importar.")

        params = tenant_session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()
            tenant_session.add(params)
            tenant_session.commit()

        result = execute_import_viajes(
            records=records_to_import,
            session=tenant_session,
            params=params,
            overwrite_duplicates=overwrite_duplicates
        )

        return {
            "success": True,
            "target_schema": schema_name,
            "empresa_name": target_empresa.name,
            "empresa_id": target_empresa.id,
            "message": f"Se procesaron los despachos en {target_empresa.name} exitosamente.",
            **result
        }
    finally:
        tenant_session.close()

@router.get("/{schema_name}", response_model=EmpresaResponse)
def get_empresa(schema_name: str, db: Session = Depends(get_db)):
    clean_schema = schema_name.strip().lower()
    alt_with_prefix = f"empresa_{clean_schema}" if not clean_schema.startswith("empresa_") else clean_schema
    alt_without_prefix = clean_schema.replace("empresa_", "", 1)

    emp = db.query(Empresa).filter(
        (Empresa.schema_name.ilike(clean_schema)) | 
        (Empresa.schema_name.ilike(alt_with_prefix)) | 
        (Empresa.schema_name.ilike(alt_without_prefix))
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return EmpresaResponse(
        id=emp.id,
        name=emp.name,
        schema_name=emp.schema_name,
        nit=emp.nit,
        tipo_empresa=emp.tipo_empresa or "Sociedad",
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
    clean_schema = schema_name.strip().lower()
    alt_with_prefix = f"empresa_{clean_schema}" if not clean_schema.startswith("empresa_") else clean_schema
    alt_without_prefix = clean_schema.replace("empresa_", "", 1)

    emp = db.query(Empresa).filter(
        (Empresa.schema_name.ilike(clean_schema)) | 
        (Empresa.schema_name.ilike(alt_with_prefix)) | 
        (Empresa.schema_name.ilike(alt_without_prefix))
    ).first()
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
        tipo_empresa=emp.tipo_empresa or "Sociedad",
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
