from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional, Dict, Any
from app.db.session import get_db, get_tenant_session
from app.models.public import Asociacion, Empresa, User
from app.models.tenant import Viaje, UnidadTransporte
from app.schemas.asociacion import AsociacionCreate, AsociacionUpdate, AsociacionResponse
from app.api.deps import require_admin, require_current_user
from app.services.excel_export import export_liquidacion_asociacion_excel
from app.services.pdf_export import export_liquidacion_asociacion_pdf

router = APIRouter(prefix="/asociaciones", tags=["Asociaciones"])

@router.get("/", response_model=List[AsociacionResponse])
def list_asociaciones(db: Session = Depends(get_db)):
    asocs = db.query(Asociacion).filter(Asociacion.is_active == True).all()
    return asocs

@router.post("/", response_model=AsociacionResponse)
def create_asociacion(asoc_in: AsociacionCreate, db: Session = Depends(get_db)):
    asoc = Asociacion(
        name=asoc_in.name,
        sigla=asoc_in.sigla,
        nit=asoc_in.nit,
        representante_legal=asoc_in.representante_legal,
        direccion=asoc_in.direccion,
        telefono=asoc_in.telefono,
        email=asoc_in.email,
        logo_base64=asoc_in.logo_base64
    )
    db.add(asoc)
    db.commit()
    db.refresh(asoc)
    return asoc

@router.get("/{id}", response_model=AsociacionResponse)
def get_asociacion(id: int, db: Session = Depends(get_db)):
    asoc = db.query(Asociacion).filter(Asociacion.id == id).first()
    if not asoc:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    return asoc

@router.put("/{id}", response_model=AsociacionResponse)
def update_asociacion(id: int, asoc_in: AsociacionUpdate, db: Session = Depends(get_db)):
    asoc = db.query(Asociacion).filter(Asociacion.id == id).first()
    if not asoc:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    
    update_data = asoc_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(asoc, field, val)
        
    db.commit()
    db.refresh(asoc)
    return asoc

@router.delete("/{id}")
def delete_asociacion(id: int, db: Session = Depends(get_db)):
    asoc = db.query(Asociacion).filter(Asociacion.id == id).first()
    if not asoc:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    
    # Desasociar empresas para que queden como independientes
    for emp in asoc.empresas:
        emp.asociacion_id = None
    
    db.delete(asoc)
    db.commit()
    return {"message": "Asociación eliminada correctamente"}

def _filter_viajes_asociacion(
    query,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None
):
    """
    Filtra los viajes de cualquier empresa de la asociación según el tipo de periodo:
    - Anual: Todo el año seleccionado
    - Semestral: 1er (ene-jun) o 2do (jul-dic) semestre
    - Personalizado: Rango exacto entre fecha_desde y fecha_hasta
    - Histórico: Sin filtro de fecha
    - Mensual: Mes exacto (YYYY-MM)
    """
    # 1. Modo Anual
    if tipo_periodo == "anual" or (anio and not semestre and not fecha_desde):
        target_year = anio or (int(periodo_mes.replace("ANUAL-", "")) if periodo_mes and (periodo_mes.startswith("ANUAL-") or len(periodo_mes) == 4) else date.today().year)
        query = query.filter(
            or_(
                Viaje.periodo_mes.startswith(f"{target_year}-"),
                func.extract('year', Viaje.fecha_carga) == target_year
            )
        )
        display_label = f"Gestión {target_year} (Anual)"

    # 2. Modo Semestral
    elif tipo_periodo == "semestral" or semestre or (periodo_mes and ("-S1" in periodo_mes or "-S2" in periodo_mes)):
        target_year = anio or (fecha_desde.year if fecha_desde else (int(periodo_mes.split("-")[0]) if periodo_mes and "-" in periodo_mes else date.today().year))
        sem_num = semestre or (1 if (fecha_desde and fecha_desde.month <= 6) else (1 if (periodo_mes and "-S1" in periodo_mes) else (2 if (periodo_mes and "-S2" in periodo_mes) else 1)))
        meses_sem = [f"{target_year}-{str(m).zfill(2)}" for m in (range(1, 7) if sem_num == 1 else range(7, 13))]
        sem_start = date(target_year, 1 if sem_num == 1 else 7, 1)
        sem_end = date(target_year, 6 if sem_num == 1 else 12, 30 if sem_num == 1 else 31)
        query = query.filter(
            or_(
                Viaje.periodo_mes.in_(meses_sem),
                Viaje.fecha_carga.between(sem_start, sem_end)
            )
        )
        display_label = f"{'1er' if sem_num == 1 else '2do'} Semestre {target_year}"

    # 3. Modo Personalizado
    elif tipo_periodo == "personalizado" or (fecha_desde and fecha_hasta):
        query = query.filter(
            or_(
                Viaje.fecha_carga.between(fecha_desde, fecha_hasta),
                Viaje.fecha_descarga.between(fecha_desde, fecha_hasta)
            )
        )
        d_str = fecha_desde.strftime("%Y-%m-%d") if fecha_desde else ""
        h_str = fecha_hasta.strftime("%Y-%m-%d") if fecha_hasta else ""
        display_label = f"Del {d_str} al {h_str}"

    # 4. Modo Histórico / Todo
    elif tipo_periodo == "historico":
        display_label = "Histórico General"

    # 5. Modo Mensual (por defecto)
    else:
        target_m = periodo_mes or date.today().strftime("%Y-%m")
        query = query.filter(Viaje.periodo_mes == target_m)
        display_label = target_m

    return query, display_label

@router.get("/{id}/resumen")
def get_asociacion_resumen(
    id: int,
    tipo_periodo: Optional[str] = None,
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Retorna métricas consolidadas para el mini-dashboard de la asociación:
    total empresas afiliadas, total camiones, total viajes, volumen total, flete total y mermas.
    Soporta filtros de periodo (anual, semestral, mensual, personalizado, historico).
    """
    asoc = db.query(Asociacion).filter(Asociacion.id == id).first()
    if not asoc:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    
    empresas = db.query(Empresa).filter(Empresa.asociacion_id == id, Empresa.is_active == True).all()
    
    total_camiones = 0
    total_viajes = 0
    total_volumen_litros = 0.0
    total_fletes_bs = 0.0
    total_mermas_bs = 0.0
    
    for emp in empresas:
        try:
            t_session = get_tenant_session(emp.schema_name)
            try:
                total_camiones += t_session.query(UnidadTransporte).count()
                viajes_q = t_session.query(Viaje)
                if tipo_periodo or periodo_mes or anio or semestre or (fecha_desde and fecha_hasta):
                    viajes_q, _ = _filter_viajes_asociacion(
                        query=viajes_q,
                        tipo_periodo=tipo_periodo,
                        periodo_mes=periodo_mes,
                        anio=anio,
                        semestre=semestre,
                        fecha_desde=fecha_desde,
                        fecha_hasta=fecha_hasta
                    )
                viajes = viajes_q.all()
                total_viajes += len(viajes)
                for v in viajes:
                    total_volumen_litros += (v.volumen_recepcionado_litros or 0.0)
                    total_fletes_bs += (v.flete_total_bs or 0.0)
                    total_mermas_bs += (v.merma_descontar_bs or 0.0)
            finally:
                t_session.close()
        except Exception:
            continue
            
    return {
        "asociacion_id": asoc.id,
        "asociacion_name": asoc.name,
        "sigla": asoc.sigla,
        "total_empresas": len(empresas),
        "total_camiones": total_camiones,
        "total_viajes": total_viajes,
        "total_volumen_litros": round(total_volumen_litros, 2),
        "total_volumen_m3": round(total_volumen_litros / 1000.0, 3),
        "total_fletes_bs": round(total_fletes_bs, 2),
        "total_mermas_bs": round(total_mermas_bs, 2)
    }

def _get_asociacion_liquidacion_data(
    asoc_id: int,
    db: Session,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None
) -> Dict[str, Any]:
    asoc = db.query(Asociacion).filter(Asociacion.id == asoc_id).first()
    if not asoc:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    
    empresas = db.query(Empresa).filter(Empresa.asociacion_id == asoc_id, Empresa.is_active == True).all()

    grupos_empresa = []
    total_despachado = 0.0
    total_recepcionado = 0.0
    total_merma_real = 0.0
    total_merma_descontar_bs = 0.0
    total_volumen_m3 = 0.0
    total_importe_facturar_bs = 0.0
    periodo_display_global = periodo_mes or "Periodo General"

    for emp in empresas:
        try:
            t_session = get_tenant_session(emp.schema_name)
            viajes_query = t_session.query(Viaje)
            viajes_query, periodo_display_global = _filter_viajes_asociacion(
                query=viajes_query,
                tipo_periodo=tipo_periodo,
                periodo_mes=periodo_mes,
                anio=anio,
                semestre=semestre,
                fecha_desde=fecha_desde,
                fecha_hasta=fecha_hasta
            )
            viajes_db = viajes_query.order_by(Viaje.producto, Viaje.fecha_carga).all()
            
            viajes_list = []
            sub_desp = 0.0
            sub_rec = 0.0
            sub_mreal = 0.0
            sub_mdesc = 0.0
            sub_m3 = 0.0
            sub_imp = 0.0

            for v in viajes_db:
                v_dict = {
                    "id": v.id,
                    "lote_codigo": v.lote_codigo or "-",
                    "mic_dta": v.mic_dta or "-",
                    "tramo": v.tramo,
                    "producto": v.producto,
                    "placa": v.placa,
                    "fecha_carga": str(v.fecha_carga),
                    "fecha_descarga": str(v.fecha_descarga),
                    "volumen_origen_litros": v.volumen_origen_litros,
                    "volumen_recepcionado_litros": v.volumen_recepcionado_litros,
                    "merma_real_litros": v.merma_real_litros,
                    "merma_excedente_litros": v.merma_excedente_litros,
                    "precio_merma_litro_bs": v.precio_merma_litro_bs,
                    "merma_descontar_bs": v.merma_descontar_bs,
                    "volumen_facturar_m3": round(v.volumen_recepcionado_litros / 1000.0, 3),
                    "tarifa_flete": v.tarifa_flete,
                    "flete_total_bs": v.flete_total_bs
                }
                viajes_list.append(v_dict)

                sub_desp += v.volumen_origen_litros
                sub_rec += v.volumen_recepcionado_litros
                sub_mreal += v.merma_real_litros
                sub_mdesc += v.merma_descontar_bs
                sub_m3 += (v.volumen_recepcionado_litros / 1000.0)
                sub_imp += v.flete_total_bs

            t_session.close()

            grupos_empresa.append({
                "empresa_id": emp.id,
                "empresa_name": emp.name,
                "schema_name": emp.schema_name,
                "viajes": viajes_list,
                "subtotal_despachado": round(sub_desp, 2),
                "subtotal_recepcionado": round(sub_rec, 2),
                "subtotal_merma_real": round(sub_mreal, 1),
                "subtotal_merma_descontar_bs": round(sub_mdesc, 2),
                "subtotal_volumen_m3": round(sub_m3, 3),
                "subtotal_importe_bs": round(sub_imp, 2)
            })

            total_despachado += sub_desp
            total_recepcionado += sub_rec
            total_merma_real += sub_mreal
            total_merma_descontar_bs += sub_mdesc
            total_volumen_m3 += sub_m3
            total_importe_facturar_bs += sub_imp

        except Exception:
            continue

    return {
        "asociacion": {
            "id": asoc.id,
            "name": asoc.name,
            "sigla": asoc.sigla,
            "nit": asoc.nit,
            "representante_legal": asoc.representante_legal
        },
        "periodo_mes": periodo_display_global,
        "grupos_empresa": grupos_empresa,
        "totales_generales": {
            "volumen_despachado_litros": round(total_despachado, 2),
            "volumen_recepcionado_litros": round(total_recepcionado, 2),
            "merma_real_litros": round(total_merma_real, 1),
            "merma_descontar_facturar_bs": round(total_merma_descontar_bs, 2),
            "volumen_facturar_m3": round(total_volumen_m3, 3),
            "importe_facturar_bs": round(total_importe_facturar_bs, 2)
        }
    }

@router.get("/{id}/liquidacion-general")
def get_liquidacion_general(
    id: int,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db)
):
    return _get_asociacion_liquidacion_data(
        asoc_id=id,
        db=db,
        tipo_periodo=tipo_periodo,
        periodo_mes=periodo_mes,
        anio=anio,
        semestre=semestre,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )

@router.get("/{id}/export/excel")
def export_asociacion_excel(
    id: int,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db)
):
    data = _get_asociacion_liquidacion_data(
        asoc_id=id,
        db=db,
        tipo_periodo=tipo_periodo,
        periodo_mes=periodo_mes,
        anio=anio,
        semestre=semestre,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )
    asoc_name = data["asociacion"]["name"]
    grupos = data["grupos_empresa"]
    periodo_label = data["periodo_mes"]

    excel_buffer = export_liquidacion_asociacion_excel(asoc_name, periodo_label, grupos)
    safe_periodo = str(periodo_label).replace(" ", "_").replace("/", "_")
    filename = f"Liquidacion_{asoc_name.replace(' ', '_')}_{safe_periodo}.xlsx"

    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/{id}/export/pdf")
def export_asociacion_pdf(
    id: int,
    tipo_periodo: Optional[str] = "mes",
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    semestre: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db)
):
    data = _get_asociacion_liquidacion_data(
        asoc_id=id,
        db=db,
        tipo_periodo=tipo_periodo,
        periodo_mes=periodo_mes,
        anio=anio,
        semestre=semestre,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )
    asoc_name = data["asociacion"]["name"]
    grupos = data["grupos_empresa"]
    periodo_label = data["periodo_mes"]

    pdf_buffer = export_liquidacion_asociacion_pdf(asoc_name, periodo_label, grupos)
    safe_periodo = str(periodo_label).replace(" ", "_").replace("/", "_")
    filename = f"Liquidacion_{asoc_name.replace(' ', '_')}_{safe_periodo}.pdf"

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
