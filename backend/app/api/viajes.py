from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Viaje, ParametroLiquidacion, UnidadTransporte
from app.schemas.viaje import ViajeCreate, ViajeUpdate, ViajeResponse, ViajeCalculoPreview
from app.services.calculation_engine import calculate_viaje_values

router = APIRouter(prefix="/tenants/{schema_name}/viajes", tags=["Viajes y Despachos"])

@router.get("/", response_model=List[ViajeResponse])
def list_viajes(
    schema_name: str,
    periodo_mes: Optional[str] = None,
    placa: Optional[str] = None,
    estado: Optional[str] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Viaje)
        if periodo_mes:
            query = query.filter(Viaje.periodo_mes == periodo_mes)
        if placa:
            query = query.filter(Viaje.placa == placa.upper().strip())
        if estado:
            query = query.filter(Viaje.estado == estado)
            
        return query.order_by(Viaje.fecha_carga.desc()).all()
    finally:
        session.close()

@router.post("/preview", response_model=ViajeCalculoPreview)
def preview_calculo_viaje(
    schema_name: str,
    volumen_origen_litros: float,
    volumen_recepcionado_litros: float,
    producto: str,
    tarifa_flete: float,
    tipo_tarifa: Optional[str] = "BS_POR_M3",
    precio_merma_override: Optional[float] = None,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()

        calc = calculate_viaje_values(
            volumen_origen_litros=volumen_origen_litros,
            volumen_recepcionado_litros=volumen_recepcionado_litros,
            producto=producto,
            tarifa_flete=tarifa_flete,
            tipo_tarifa=tipo_tarifa,
            params=params,
            precio_merma_litro_override=precio_merma_override
        )
        return calc
    finally:
        session.close()

@router.post("/", response_model=ViajeResponse)
def create_viaje(
    schema_name: str,
    viaje_in: ViajeCreate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()

        # Calcular mermas y flete automáticamente
        calc = calculate_viaje_values(
            volumen_origen_litros=viaje_in.volumen_origen_litros,
            volumen_recepcionado_litros=viaje_in.volumen_recepcionado_litros,
            producto=viaje_in.producto,
            tarifa_flete=viaje_in.tarifa_flete,
            tipo_tarifa=viaje_in.tipo_tarifa,
            params=params,
            precio_merma_litro_override=viaje_in.precio_merma_litro_bs
        )

        # Buscar unidad_id si existe por la placa
        unidad = session.query(UnidadTransporte).filter(UnidadTransporte.placa == viaje_in.placa.upper().strip()).first()
        unidad_id = unidad.id if unidad else viaje_in.unidad_id

        viaje = Viaje(
            mic_dta=viaje_in.mic_dta,
            lote_codigo=viaje_in.lote_codigo,
            unidad_id=unidad_id,
            placa=viaje_in.placa.upper().strip(),
            tramo=viaje_in.tramo,
            cliente=viaje_in.cliente or "YPFB",
            producto=viaje_in.producto.upper(),
            fecha_carga=viaje_in.fecha_carga,
            fecha_descarga=viaje_in.fecha_descarga,
            periodo_mes=viaje_in.periodo_mes,
            volumen_origen_litros=viaje_in.volumen_origen_litros,
            volumen_recepcionado_litros=viaje_in.volumen_recepcionado_litros,
            merma_real_litros=calc["merma_real_litros"],
            tolerancia_pct=calc["tolerancia_pct"],
            merma_tolerable_litros=calc["merma_tolerable_litros"],
            merma_excedente_litros=calc["merma_excedente_litros"],
            precio_merma_litro_bs=calc["precio_merma_litro_bs"],
            merma_descontar_bs=calc["merma_descontar_bs"],
            tarifa_flete=viaje_in.tarifa_flete,
            tipo_tarifa=viaje_in.tipo_tarifa or "BS_POR_M3",
            flete_total_bs=calc["flete_total_bs"],
            estado="Pendiente",
            observaciones=viaje_in.observaciones
        )
        session.add(viaje)
        session.commit()
        session.refresh(viaje)
        return viaje
    finally:
        session.close()

@router.get("/{id}", response_model=ViajeResponse)
def get_viaje(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        viaje = session.query(Viaje).filter(Viaje.id == id).first()
        if not viaje:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        return viaje
    finally:
        session.close()

@router.put("/{id}", response_model=ViajeResponse)
def update_viaje(
    schema_name: str,
    id: int,
    viaje_in: ViajeUpdate,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        viaje = session.query(Viaje).filter(Viaje.id == id).first()
        if not viaje:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")

        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()
        update_data = viaje_in.model_dump(exclude_unset=True)

        for field, val in update_data.items():
            setattr(viaje, field, val)

        # Recalcular si cambiaron volúmenes, producto o tarifas
        calc = calculate_viaje_values(
            volumen_origen_litros=viaje.volumen_origen_litros,
            volumen_recepcionado_litros=viaje.volumen_recepcionado_litros,
            producto=viaje.producto,
            tarifa_flete=viaje.tarifa_flete,
            tipo_tarifa=viaje.tipo_tarifa,
            params=params,
            precio_merma_litro_override=viaje.precio_merma_litro_bs
        )
        viaje.merma_real_litros = calc["merma_real_litros"]
        viaje.tolerancia_pct = calc["tolerancia_pct"]
        viaje.merma_tolerable_litros = calc["merma_tolerable_litros"]
        viaje.merma_excedente_litros = calc["merma_excedente_litros"]
        viaje.precio_merma_litro_bs = calc["precio_merma_litro_bs"]
        viaje.merma_descontar_bs = calc["merma_descontar_bs"]
        viaje.flete_total_bs = calc["flete_total_bs"]

        session.commit()
        session.refresh(viaje)
        return viaje
    finally:
        session.close()

@router.delete("/{id}")
def delete_viaje(schema_name: str, id: int, empresa: Empresa = Depends(verify_tenant_exists)):
    session = get_tenant_session(schema_name)
    try:
        viaje = session.query(Viaje).filter(Viaje.id == id).first()
        if not viaje:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        session.delete(viaje)
        session.commit()
        return {"message": "Viaje eliminado"}
    finally:
        session.close()
