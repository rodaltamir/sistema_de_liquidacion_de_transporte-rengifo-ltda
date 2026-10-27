import io
import json
import re
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import Response
from typing import List, Optional
from app.db.session import get_tenant_session
from app.api.deps import verify_tenant_exists
from app.models.public import Empresa
from app.models.tenant import Viaje, ParametroLiquidacion, UnidadTransporte
from app.schemas.viaje import ViajeCreate, ViajeUpdate, ViajeResponse, ViajeCalculoPreview
from app.services.calculation_engine import calculate_viaje_values, determine_trip_period
from app.services.excel_export import generate_viajes_template_excel, export_viajes_list_excel
from app.services.excel_importer import get_excel_sheets, parse_excel_viajes_data, execute_import_viajes

from sqlalchemy import func, or_, cast, Integer

router = APIRouter(prefix="/tenants/{schema_name}/viajes", tags=["Viajes y Despachos"])

def process_descuentos(raw_list):
    if not raw_list:
        return "[]", 0.0
    if isinstance(raw_list, str):
        try:
            parsed = json.loads(raw_list)
        except Exception:
            return "[]", 0.0
    else:
        parsed = raw_list

    clean_items = []
    total = 0.0
    if isinstance(parsed, list):
        for item in parsed:
            if hasattr(item, "model_dump"):
                d = item.model_dump()
            elif isinstance(item, dict):
                d = item
            else:
                continue
            concepto = str(d.get("concepto") or "").strip()
            try:
                monto = float(d.get("monto") or 0.0)
            except Exception:
                monto = 0.0
            if concepto and monto > 0:
                clean_items.append({"concepto": concepto, "monto": round(monto, 2)})
                total += monto
    return json.dumps(clean_items), round(total, 2)



@router.get("/periodos")
def get_periodos_disponibles(
    schema_name: str,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        results = session.query(
            Viaje.periodo_mes,
            func.count(Viaje.id).label("total_viajes"),
            func.sum(Viaje.volumen_recepcionado_litros).label("total_volumen"),
            func.sum(Viaje.flete_total_bs).label("total_flete")
        ).group_by(Viaje.periodo_mes).order_by(Viaje.periodo_mes.desc()).all()
        
        periodos = []
        for r in results:
            if r.periodo_mes:
                periodos.append({
                    "periodo_mes": r.periodo_mes,
                    "total_viajes": r.total_viajes,
                    "total_volumen_litros": float(r.total_volumen or 0),
                    "total_flete_bs": float(r.total_flete or 0)
                })
        return periodos
    finally:
        session.close()


@router.get("/facturas-disponibles")
def get_facturas_disponibles_viajes(
    schema_name: str,
    empresa: Empresa = Depends(verify_tenant_exists)
):
    """
    Retorna la lista de todas las facturas registradas en los despachos,
    con conteo de viajes, flete acumulado, volumen y fechas mín/máx,
    ordenadas naturalmente de forma correlativa descendente.
    """
    session = get_tenant_session(schema_name)
    try:
        num_clean = cast(func.nullif(func.regexp_replace(Viaje.nro_factura, r'[^0-9]', '', 'g'), ''), Integer)
        rows = session.query(
            Viaje.nro_factura,
            func.count(Viaje.id).label("total_viajes"),
            func.coalesce(func.sum(Viaje.flete_total_bs), 0.0).label("flete_total"),
            func.coalesce(func.sum(Viaje.volumen_recepcionado_litros), 0.0).label("volumen_total"),
            func.min(Viaje.fecha_carga).label("fecha_min"),
            func.max(Viaje.fecha_carga).label("fecha_max"),
            func.max(Viaje.fecha_factura).label("fecha_factura")
        ).filter(
            Viaje.nro_factura.isnot(None),
            func.trim(Viaje.nro_factura) != ""
        ).group_by(
            Viaje.nro_factura
        ).order_by(
            num_clean.desc().nulls_last(),
            Viaje.nro_factura.desc()
        ).all()

        result = []
        for r in rows:
            result.append({
                "nro_factura": str(r[0]).strip(),
                "total_viajes": int(r[1]),
                "flete_total": round(float(r[2] or 0), 2),
                "volumen_total": round(float(r[3] or 0), 2),
                "fecha_min": r[4].strftime("%Y-%m-%d") if r[4] else None,
                "fecha_max": r[5].strftime("%Y-%m-%d") if r[5] else None,
                "fecha_factura": r[6].strftime("%Y-%m-%d") if r[6] else None,
            })
        return result
    finally:
        session.close()


@router.get("/", response_model=List[ViajeResponse])
def list_viajes(
    schema_name: str,
    periodo_mes: Optional[str] = None,
    anio: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    placa: Optional[str] = None,
    estado: Optional[str] = None,
    producto: Optional[str] = None,
    tramo: Optional[str] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = Query(None),
    tipo_periodo: Optional[str] = None,
    facturado: Optional[str] = None,
    search: Optional[str] = None,
    orden: Optional[str] = None,
    order_by: Optional[str] = None,
    order_dir: Optional[str] = "asc",
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Viaje)
        if facturas and len(facturas) > 0:
            clean_facs = [str(f).strip() for f in facturas if f and str(f).strip()]
            query = query.filter(Viaje.nro_factura.in_(clean_facs))
        elif factura_desde and factura_hasta:
            d_s = str(factura_desde).strip()
            h_s = str(factura_hasta).strip()
            d_digits = re.sub(r'[^0-9]', '', d_s)
            h_digits = re.sub(r'[^0-9]', '', h_s)
            if d_digits and h_digits:
                d_val = min(int(d_digits), int(h_digits))
                h_val = max(int(d_digits), int(h_digits))
                num_col = cast(func.nullif(func.regexp_replace(Viaje.nro_factura, r'[^0-9]', '', 'g'), ''), Integer)
                query = query.filter(num_col.between(d_val, h_val))
            else:
                query = query.filter(Viaje.nro_factura.between(d_s, h_s))
        elif nro_factura or factura_desde:
            target_fac = str(nro_factura or factura_desde).strip()
            query = query.filter(
                or_(
                    func.trim(Viaje.nro_factura) == target_fac,
                    Viaje.nro_factura.ilike(f"%{target_fac}%")
                )
            )
        elif periodo_mes:
            if periodo_mes.startswith("FAC-"):
                val = periodo_mes.replace("FAC-", "")
                if "_" in val:
                    parts = val.split("_")
                    d_s, h_s = parts[0], parts[1]
                    d_digits = re.sub(r'[^0-9]', '', d_s)
                    h_digits = re.sub(r'[^0-9]', '', h_s)
                    if d_digits and h_digits:
                        d_val, h_val = min(int(d_digits), int(h_digits)), max(int(d_digits), int(h_digits))
                        num_col = cast(func.nullif(func.regexp_replace(Viaje.nro_factura, r'[^0-9]', '', 'g'), ''), Integer)
                        query = query.filter(num_col.between(d_val, h_val))
                    else:
                        query = query.filter(Viaje.nro_factura.between(d_s, h_s))
                else:
                    query = query.filter(Viaje.nro_factura == val)
            else:
                query = query.filter(Viaje.periodo_mes == periodo_mes)

        if anio:
            query = query.filter(Viaje.periodo_mes.startswith(f"{anio}-"))
        if fecha_desde:
            query = query.filter(Viaje.fecha_carga >= fecha_desde)
        if fecha_hasta:
            query = query.filter(Viaje.fecha_carga <= fecha_hasta)
        if placa and placa.upper() != "TODAS":
            query = query.filter(Viaje.placa == placa.upper().strip())
        if estado:
            query = query.filter(Viaje.estado == estado)
        if producto and producto.upper().strip() != "TODOS":
            query = query.filter(Viaje.producto == producto.upper().strip())
        if tramo:
            query = query.filter(Viaje.tramo == tramo.upper().strip())
        if facturado == "si":
            query = query.filter(Viaje.nro_factura.isnot(None), Viaje.nro_factura != "")
        elif facturado == "no":
            query = query.filter((Viaje.nro_factura.is_(None)) | (Viaje.nro_factura == ""))
        if search:
            st = f"%{search.strip()}%"
            query = query.filter(
                (Viaje.nro_factura.ilike(st)) |
                (Viaje.mic_dta.ilike(st)) |
                (Viaje.placa.ilike(st)) |
                (Viaje.tramo.ilike(st)) |
                (Viaje.cliente.ilike(st)) |
                (Viaje.producto.ilike(st))
            )
            
        if order_by:
            col_sort = Viaje.fecha_carga
            if order_by == "factura":
                col_sort = Viaje.nro_factura
            elif order_by == "placa":
                col_sort = Viaje.placa
            elif order_by == "cliente":
                col_sort = Viaje.cliente
            elif order_by == "flete":
                col_sort = Viaje.flete_total_bs

            if order_dir and str(order_dir).lower() == "desc":
                return query.order_by(col_sort.desc(), Viaje.id.desc()).all()
            return query.order_by(col_sort.asc(), Viaje.id.asc()).all()

        if orden in ("asc", "agrupado"):
            return query.order_by(Viaje.tramo.asc(), Viaje.producto.asc(), Viaje.fecha_carga.asc(), Viaje.id.asc()).all()
        return query.order_by(Viaje.fecha_carga.desc(), Viaje.id.desc()).all()
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
    volumen_facturado: Optional[float] = None,
    total_descuentos_adicionales: Optional[float] = 0.0,
    total_descuentos_mermas: Optional[float] = 0.0,
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
            precio_merma_litro_override=precio_merma_override,
            volumen_facturado=volumen_facturado,
            total_descuentos_adicionales=total_descuentos_adicionales or 0.0,
            total_descuentos_mermas=total_descuentos_mermas or 0.0
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

        # Validar duplicados
        placa_clean = viaje_in.placa.upper().strip()
        mic_clean = viaje_in.mic_dta.strip().upper() if viaje_in.mic_dta and viaje_in.mic_dta.strip() else None

        if mic_clean:
            dup_mic = session.query(Viaje).filter(Viaje.mic_dta == mic_clean).first()
            if dup_mic:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ya existe un viaje registrado con el MIC/DTA '{mic_clean}' (Placa: {dup_mic.placa}, Fecha de carga: {dup_mic.fecha_carga})"
                )

        # Validar duplicado exacto por placa y fechas de carga y descarga
        dup_viaje = session.query(Viaje).filter(
            Viaje.placa == placa_clean,
            Viaje.fecha_carga == viaje_in.fecha_carga,
            Viaje.fecha_descarga == viaje_in.fecha_descarga,
            Viaje.volumen_recepcionado_litros == viaje_in.volumen_recepcionado_litros
        ).first()
        if dup_viaje:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un viaje idéntico registrado para la placa {placa_clean} en las fechas {viaje_in.fecha_carga} a {viaje_in.fecha_descarga} (MIC: {dup_viaje.mic_dta or 'S/N'})"
            )

        # Determinar periodo mensual (respetando valor explícito si fue provisto)
        if viaje_in.periodo_mes and viaje_in.periodo_mes.strip():
            periodo_determinado = viaje_in.periodo_mes.strip()
        else:
            periodo_determinado = determine_trip_period(viaje_in.fecha_carga, viaje_in.fecha_descarga)

        # Manejo de listas dinámicas de descuentos
        desc_adic_json, total_desc_adic = process_descuentos(viaje_in.descuentos_adicionales)
        desc_mermas_json, total_desc_mermas = process_descuentos(viaje_in.descuentos_mermas)

        # Volumen facturado (en Litros, por defecto igual a volumen recepcionado)
        vol_fact = viaje_in.volumen_facturado
        if vol_fact is None or vol_fact <= 0:
            vol_fact = round(viaje_in.volumen_recepcionado_litros, 1)
        elif vol_fact < 1000.0:
            vol_fact = round(vol_fact * 1000.0, 1)

        # Calcular mermas y flete automáticamente
        calc = calculate_viaje_values(
            volumen_origen_litros=viaje_in.volumen_origen_litros,
            volumen_recepcionado_litros=viaje_in.volumen_recepcionado_litros,
            producto=viaje_in.producto,
            tarifa_flete=viaje_in.tarifa_flete,
            tipo_tarifa=viaje_in.tipo_tarifa,
            params=params,
            precio_merma_litro_override=viaje_in.precio_merma_litro_bs,
            volumen_facturado=vol_fact,
            total_descuentos_adicionales=total_desc_adic,
            total_descuentos_mermas=total_desc_mermas
        )

        # Buscar unidad_id si existe por la placa
        unidad = session.query(UnidadTransporte).filter(UnidadTransporte.placa == placa_clean).first()
        unidad_id = unidad.id if unidad else viaje_in.unidad_id

        viaje = Viaje(
            mic_dta=mic_clean,
            lote_codigo=viaje_in.lote_codigo,
            unidad_id=unidad_id,
            placa=placa_clean,
            es_apoyo=viaje_in.es_apoyo or False,
            empresa_apoyo_id=viaje_in.empresa_apoyo_id,
            empresa_apoyo_nombre=viaje_in.empresa_apoyo_nombre,
            tramo=viaje_in.tramo,
            cliente=viaje_in.cliente or "YPFB",
            producto=viaje_in.producto.upper(),
            fecha_carga=viaje_in.fecha_carga,
            fecha_descarga=viaje_in.fecha_descarga,
            periodo_mes=periodo_determinado,
            nro_factura=viaje_in.nro_factura.strip() if viaje_in.nro_factura else None,
            fecha_factura=viaje_in.fecha_factura,
            volumen_origen_litros=viaje_in.volumen_origen_litros,
            volumen_recepcionado_litros=viaje_in.volumen_recepcionado_litros,
            volumen_facturado=calc["volumen_facturado"],
            merma_real_litros=calc["merma_real_litros"],
            tolerancia_pct=calc["tolerancia_pct"],
            merma_tolerable_litros=calc["merma_tolerable_litros"],
            merma_excedente_litros=calc["merma_excedente_litros"],
            precio_merma_litro_bs=calc["precio_merma_litro_bs"],
            merma_descontar_bs=calc["merma_descontar_bs"],
            descuentos_adicionales=desc_adic_json,
            descuentos_mermas=desc_mermas_json,
            total_descuentos_adicionales_bs=total_desc_adic,
            total_descuentos_mermas_bs=total_desc_mermas,
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

@router.post("/excel-info")
async def get_excel_info(
    schema_name: str,
    file: UploadFile = File(...),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    if not file.filename.endswith(('.xlsx', '.xlsm', '.xltx')):
        raise HTTPException(status_code=400, detail="El archivo debe tener formato Excel (.xlsx)")
    contents = await file.read()
    try:
        sheets = get_excel_sheets(contents)
        return {
            "success": True,
            "filename": file.filename,
            "sheets": sheets,
            "default_sheet": "__ALL__" if len(sheets) > 1 else (sheets[0] if sheets else "")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {str(e)}")

@router.post("/preview-excel")
async def preview_viajes_excel(
    schema_name: str,
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    if not file.filename.endswith(('.xlsx', '.xlsm', '.xltx')):
        raise HTTPException(status_code=400, detail="El archivo debe tener formato Excel (.xlsx)")
    contents = await file.read()
    session = get_tenant_session(schema_name)
    try:
        preview_data = parse_excel_viajes_data(
            file_bytes=contents,
            sheet_name=sheet_name,
            session=session,
            max_preview_records=None,
            target_empresa_name=empresa.name
        )
        return preview_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al analizar el archivo Excel: {str(e)}")
    finally:
        session.close()

@router.post("/importar-excel")
async def importar_viajes_excel(
    schema_name: str,
    file: Optional[UploadFile] = File(None),
    sheet_name: Optional[str] = Form(None),
    overwrite_duplicates: bool = Form(False),
    edited_records_json: Optional[str] = Form(None),
    entidades_clasificacion_json: Optional[str] = Form(None),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
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
            parsed_data = parse_excel_viajes_data(
                file_bytes=contents,
                sheet_name=sheet_name,
                session=session,
                max_preview_records=None,
                target_empresa_name=empresa.name
            )
            records_to_import = parsed_data["records"]
        else:
            raise HTTPException(status_code=400, detail="Debe proporcionar un archivo o registros para importar.")

        if not records_to_import:
            raise HTTPException(status_code=400, detail="No hay registros válidos para importar.")

        params = session.query(ParametroLiquidacion).first()
        if not params:
            params = ParametroLiquidacion()
            session.add(params)
            session.commit()

        result = execute_import_viajes(
            records=records_to_import,
            session=session,
            params=params,
            overwrite_duplicates=overwrite_duplicates
        )

        viajes_creados = result["total_importados"]
        viajes_actualizados = result["total_actualizados"]
        viajes_omitidos = result["total_omitidos"]
        clientes_reg = result.get("clientes_registrados", 0)

        msg_parts = [f"Se importaron {viajes_creados} viajes exitosamente."]
        if clientes_reg > 0:
            msg_parts.append(f"Se registraron {clientes_reg} clientes en el catálogo.")

        return {
            "success": True,
            "message": " ".join(msg_parts),
            "total_importados": viajes_creados,
            "total_actualizados": viajes_actualizados,
            "total_omitidos": viajes_omitidos,
            "clientes_registrados": clientes_reg,
            "total_filas_leidas": len(records_to_import),
            "periodos_detectados": result["periodos_detectados"],
            "errores": result["errores"]
        }
    finally:
        session.close()

@router.get("/exportar-excel")
def export_viajes_excel(
    schema_name: str,
    periodo: Optional[str] = Query(None),
    periodo_mes: Optional[str] = Query(None),
    anio: Optional[int] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    cliente: Optional[str] = Query(None),
    placa: Optional[str] = Query(None),
    producto: Optional[str] = Query(None),
    tramo: Optional[str] = Query(None),
    nro_factura: Optional[str] = Query(None),
    factura_desde: Optional[str] = Query(None),
    factura_hasta: Optional[str] = Query(None),
    facturas: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    order_by: Optional[str] = Query("fecha"),
    order_dir: Optional[str] = Query("asc"),
    empresa: Empresa = Depends(verify_tenant_exists)
):
    session = get_tenant_session(schema_name)
    try:
        query = session.query(Viaje)
        if facturas and len(facturas) > 0:
            clean_facs = [str(f).strip() for f in facturas if f and str(f).strip()]
            query = query.filter(Viaje.nro_factura.in_(clean_facs))
        elif factura_desde and factura_hasta:
            d_s = str(factura_desde).strip()
            h_s = str(factura_hasta).strip()
            d_digits = re.sub(r'[^0-9]', '', d_s)
            h_digits = re.sub(r'[^0-9]', '', h_s)
            if d_digits and h_digits:
                d_val = min(int(d_digits), int(h_digits))
                h_val = max(int(d_digits), int(h_digits))
                num_col = cast(func.nullif(func.regexp_replace(Viaje.nro_factura, r'[^0-9]', '', 'g'), ''), Integer)
                query = query.filter(num_col.between(d_val, h_val))
            else:
                query = query.filter(Viaje.nro_factura.between(d_s, h_s))
        elif nro_factura or factura_desde:
            target_fac = str(nro_factura or factura_desde).strip()
            query = query.filter(
                or_(
                    func.trim(Viaje.nro_factura) == target_fac,
                    Viaje.nro_factura.ilike(f"%{target_fac}%")
                )
            )
        else:
            p = periodo_mes or periodo
            if p:
                if p.startswith("FAC-"):
                    val = p.replace("FAC-", "")
                    if "_" in val:
                        parts = val.split("_")
                        query = query.filter(Viaje.nro_factura.between(parts[0], parts[1]))
                    else:
                        query = query.filter(Viaje.nro_factura == val)
                else:
                    query = query.filter(Viaje.periodo_mes == p)
        if anio:
            query = query.filter(Viaje.periodo_mes.startswith(f"{anio}-"))
        if fecha_desde:
            query = query.filter(Viaje.fecha_carga >= fecha_desde)
        if fecha_hasta:
            query = query.filter(Viaje.fecha_carga <= fecha_hasta)
        if cliente:
            query = query.filter(Viaje.cliente.ilike(f"%{cliente.strip()}%"))
        if placa and placa.upper() != "TODAS":
            query = query.filter(Viaje.placa.ilike(f"%{placa.strip()}%"))
        if producto and producto.upper() != "TODOS":
            query = query.filter(Viaje.producto.ilike(f"%{producto.strip()}%"))
        if tramo:
            query = query.filter(Viaje.tramo.ilike(f"%{tramo.strip()}%"))
        if search:
            st = f"%{search.strip()}%"
            query = query.filter(
                (Viaje.nro_factura.ilike(st)) |
                (Viaje.mic_dta.ilike(st)) |
                (Viaje.placa.ilike(st)) |
                (Viaje.tramo.ilike(st)) |
                (Viaje.cliente.ilike(st)) |
                (Viaje.producto.ilike(st))
            )

        col_sort = Viaje.fecha_carga
        if order_by == "factura":
            col_sort = Viaje.nro_factura
        elif order_by == "placa":
            col_sort = Viaje.placa
        elif order_by == "cliente":
            col_sort = Viaje.cliente
        elif order_by == "flete":
            col_sort = Viaje.flete_total_bs

        if order_dir and str(order_dir).lower() == "desc":
            query = query.order_by(col_sort.desc(), Viaje.id.desc())
        else:
            query = query.order_by(col_sort.asc(), Viaje.id.asc())

        viajes = query.all()
        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()
        empresa_dict = {"name": empresa.name, "logo_base64": empresa.logo_base64}
        excel_buffer = export_viajes_list_excel(
            viajes=viajes,
            empresa=empresa_dict,
            params=params,
            order_by=order_by or "fecha",
            order_dir=order_dir or "asc"
        )
        clean_emp = "".join([c if c.isalnum() else "_" for c in empresa.name])[:20]
        filename = f"Despachos_Viajes_{clean_emp}_{order_by}_{order_dir}.xlsx"
        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
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

        # Manejo de listas de descuentos en actualización
        if "descuentos_adicionales" in update_data:
            desc_adic_json, total_desc_adic = process_descuentos(update_data["descuentos_adicionales"])
            viaje.descuentos_adicionales = desc_adic_json
            viaje.total_descuentos_adicionales_bs = total_desc_adic
            del update_data["descuentos_adicionales"]
            if "total_descuentos_adicionales_bs" in update_data:
                del update_data["total_descuentos_adicionales_bs"]

        if "descuentos_mermas" in update_data:
            desc_mermas_json, total_desc_mermas = process_descuentos(update_data["descuentos_mermas"])
            viaje.descuentos_mermas = desc_mermas_json
            viaje.total_descuentos_mermas_bs = total_desc_mermas
            del update_data["descuentos_mermas"]
            if "total_descuentos_mermas_bs" in update_data:
                del update_data["total_descuentos_mermas_bs"]

        for field, val in update_data.items():
            setattr(viaje, field, val)

        # Volumen facturado (en Litros, por defecto igual a volumen recepcionado)
        vol_fact = viaje.volumen_facturado
        if vol_fact is None or vol_fact <= 0:
            vol_fact = round(viaje.volumen_recepcionado_litros, 1)
        elif vol_fact < 1000.0:
            vol_fact = round(vol_fact * 1000.0, 1)

        # Recalcular si cambiaron volúmenes, producto o tarifas
        calc = calculate_viaje_values(
            volumen_origen_litros=viaje.volumen_origen_litros,
            volumen_recepcionado_litros=viaje.volumen_recepcionado_litros,
            producto=viaje.producto,
            tarifa_flete=viaje.tarifa_flete,
            tipo_tarifa=viaje.tipo_tarifa,
            params=params,
            precio_merma_litro_override=viaje.precio_merma_litro_bs,
            volumen_facturado=vol_fact,
            total_descuentos_adicionales=viaje.total_descuentos_adicionales_bs,
            total_descuentos_mermas=viaje.total_descuentos_mermas_bs
        )
        viaje.volumen_facturado = calc["volumen_facturado"]
        viaje.merma_real_litros = calc["merma_real_litros"]
        viaje.tolerancia_pct = calc["tolerancia_pct"]
        viaje.merma_tolerable_litros = calc["merma_tolerable_litros"]
        viaje.merma_excedente_litros = calc["merma_excedente_litros"]
        viaje.precio_merma_litro_bs = calc["precio_merma_litro_bs"]
        viaje.merma_descontar_bs = calc["merma_descontar_bs"]
        viaje.flete_total_bs = calc["flete_total_bs"]
        if "periodo_mes" in update_data and update_data["periodo_mes"]:
            viaje.periodo_mes = str(update_data["periodo_mes"]).strip()
        elif not viaje.periodo_mes:
            viaje.periodo_mes = determine_trip_period(viaje.fecha_carga, viaje.fecha_descarga)

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


