import io
from datetime import date, datetime
from dateutil import parser as date_parser
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import Response
from typing import List, Optional
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Viaje, ParametroLiquidacion, UnidadTransporte
from app.schemas.viaje import ViajeCreate, ViajeUpdate, ViajeResponse, ViajeCalculoPreview
from app.services.calculation_engine import calculate_viaje_values
from app.services.excel_export import generate_viajes_template_excel

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

@router.get("/plantilla-excel")
def download_plantilla_viajes(schema_name: str, empresa: Empresa = Depends(verify_tenant_exists)):
    excel_buffer = generate_viajes_template_excel(empresa_name=empresa.name)
    clean_emp = "".join([c if c.isalnum() else "_" for c in empresa.name])[:20]
    filename = f"Plantilla_Viajes_{clean_emp}.xlsx"
    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/importar-excel")
async def importar_viajes_excel(
    schema_name: str,
    file: UploadFile = File(...),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    if not file.filename.endswith(('.xlsx', '.xlsm', '.xltx')):
        raise HTTPException(status_code=400, detail="El archivo debe tener formato Excel (.xlsx)")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(filename=io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {str(e)}")

    ws = wb.active
    session = get_tenant_session(schema_name)
    try:
        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()

        viajes_creados = []
        errores = []
        periodos_detectados = set()

        start_row = 5
        for r in range(start_row, ws.max_row + 1):
            mic_dta = ws.cell(row=r, column=1).value
            placa = ws.cell(row=r, column=2).value
            tramo = ws.cell(row=r, column=3).value
            cliente = ws.cell(row=r, column=4).value
            producto = ws.cell(row=r, column=5).value
            f_carga = ws.cell(row=r, column=6).value
            f_descarga = ws.cell(row=r, column=7).value
            vol_origen = ws.cell(row=r, column=8).value
            vol_rec = ws.cell(row=r, column=9).value
            tarifa = ws.cell(row=r, column=10).value
            tipo_tarifa = ws.cell(row=r, column=11).value
            precio_merma = ws.cell(row=r, column=12).value
            lote = ws.cell(row=r, column=13).value
            obs = ws.cell(row=r, column=14).value

            if not placa and not vol_origen and not vol_rec:
                continue

            try:
                placa_str = str(placa or "").strip().upper()
                if not placa_str:
                    errores.append(f"Fila {r}: Placa no especificada")
                    continue

                tramo_str = str(tramo or "TRAMO NO ESPECIFICADO").strip().upper()
                cliente_str = str(cliente or "YPFB").strip().upper()
                producto_raw = str(producto or "DIESEL").strip().upper()
                if "GAS" in producto_raw:
                    producto_str = "GASOLINA"
                elif "IYA" in producto_raw or "ADIT" in producto_raw:
                    producto_str = "IYA"
                else:
                    producto_str = "DIESEL"

                def parse_date(v):
                    if isinstance(v, (datetime, date)):
                        return v.date() if isinstance(v, datetime) else v
                    if isinstance(v, str):
                        try:
                            return date_parser.parse(v).date()
                        except Exception:
                            return date.today()
                    return date.today()

                date_carga = parse_date(f_carga) if f_carga else date.today()
                date_descarga = parse_date(f_descarga) if f_descarga else date_carga

                vol_o = float(str(vol_origen or 0).replace(",", "."))
                vol_r = float(str(vol_rec or 0).replace(",", "."))
                tf = float(str(tarifa or 392.00).replace(",", ".")) if tarifa else 392.00
                tipo_t = str(tipo_tarifa or "BS_POR_M3").strip().upper()
                if "USD" in tipo_t:
                    tipo_t = "USD_POR_M3"
                else:
                    tipo_t = "BS_POR_M3"

                pm = float(str(precio_merma).replace(",", ".")) if precio_merma else None

                periodo = f"{date_carga.year}-{str(date_carga.month).zfill(2)}"
                periodos_detectados.add(periodo)

                # Asegurar que exista la unidad
                u = session.query(UnidadTransporte).filter(UnidadTransporte.placa == placa_str).first()
                if not u:
                    u = UnidadTransporte(
                        placa=placa_str,
                        marca="Tractocamión / Cisterna",
                        capacidad_litros=vol_o,
                        estado="Activo"
                    )
                    session.add(u)
                    session.commit()
                    session.refresh(u)

                # Calcular mermas y flete automáticamente
                calc = calculate_viaje_values(
                    volumen_origen_litros=vol_o,
                    volumen_recepcionado_litros=vol_r,
                    producto=producto_str,
                    tarifa_flete=tf,
                    tipo_tarifa=tipo_t,
                    params=params,
                    precio_merma_litro_override=pm
                )

                viaje = Viaje(
                    mic_dta=str(mic_dta).strip() if mic_dta else None,
                    lote_codigo=str(lote).strip() if lote else "1",
                    unidad_id=u.id,
                    placa=placa_str,
                    tramo=tramo_str,
                    cliente=cliente_str,
                    producto=producto_str,
                    fecha_carga=date_carga,
                    fecha_descarga=date_descarga,
                    periodo_mes=periodo,
                    volumen_origen_litros=vol_o,
                    volumen_recepcionado_litros=vol_r,
                    merma_real_litros=calc["merma_real_litros"],
                    tolerancia_pct=calc["tolerancia_pct"],
                    merma_tolerable_litros=calc["merma_tolerable_litros"],
                    merma_excedente_litros=calc["merma_excedente_litros"],
                    precio_merma_litro_bs=calc["precio_merma_litro_bs"],
                    merma_descontar_bs=calc["merma_descontar_bs"],
                    tarifa_flete=tf,
                    tipo_tarifa=tipo_t,
                    flete_total_bs=calc["flete_total_bs"],
                    estado="Pendiente",
                    observaciones=str(obs).strip() if obs else None
                )
                session.add(viaje)
                viajes_creados.append(viaje)

            except Exception as row_ex:
                errores.append(f"Fila {r}: {str(row_ex)}")

        if viajes_creados:
            session.commit()

        return {
            "success": True,
            "message": f"Se importaron {len(viajes_creados)} viajes con éxito.",
            "total_importados": len(viajes_creados),
            "periodos_detectados": sorted(list(periodos_detectados)),
            "errores": errores
        }
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


