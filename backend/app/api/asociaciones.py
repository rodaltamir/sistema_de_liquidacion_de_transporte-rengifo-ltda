from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.db.session import get_db, get_tenant_session
from app.models.public import Asociacion, Empresa, User
from app.models.tenant import Viaje
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

def _get_asociacion_liquidacion_data(asoc_id: int, periodo_mes: str, db: Session) -> Dict[str, Any]:
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

    for emp in empresas:
        try:
            t_session = get_tenant_session(emp.schema_name)
            viajes_query = t_session.query(Viaje)
            if periodo_mes:
                viajes_query = viajes_query.filter(Viaje.periodo_mes == periodo_mes)
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

        except Exception as e:
            # En caso de que un esquema no tenga aún viajes
            continue

    return {
        "asociacion": {
            "id": asoc.id,
            "name": asoc.name,
            "sigla": asoc.sigla,
            "nit": asoc.nit,
            "representante_legal": asoc.representante_legal
        },
        "periodo_mes": periodo_mes,
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
def get_liquidacion_general(id: int, periodo_mes: str = Query(..., description="Mes YYYY-MM ej 2025-10"), db: Session = Depends(get_db)):
    return _get_asociacion_liquidacion_data(id, periodo_mes, db)

@router.get("/{id}/export/excel")
def export_asociacion_excel(id: int, periodo_mes: str = Query(..., description="Mes YYYY-MM ej 2025-10"), db: Session = Depends(get_db)):
    data = _get_asociacion_liquidacion_data(id, periodo_mes, db)
    asoc_name = data["asociacion"]["name"]
    grupos = data["grupos_empresa"]

    excel_buffer = export_liquidacion_asociacion_excel(asoc_name, periodo_mes, grupos)
    filename = f"Liquidacion_{asoc_name.replace(' ', '_')}_{periodo_mes}.xlsx"

    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/{id}/export/pdf")
def export_asociacion_pdf(id: int, periodo_mes: str = Query(..., description="Mes YYYY-MM ej 2025-10"), db: Session = Depends(get_db)):
    data = _get_asociacion_liquidacion_data(id, periodo_mes, db)
    asoc_name = data["asociacion"]["name"]
    grupos = data["grupos_empresa"]

    pdf_buffer = export_liquidacion_asociacion_pdf(asoc_name, periodo_mes, grupos)
    filename = f"Liquidacion_{asoc_name.replace(' ', '_')}_{periodo_mes}.pdf"

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
