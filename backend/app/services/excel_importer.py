import io
import re
from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple
from dateutil import parser as date_parser
import openpyxl
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.tenant import Viaje, ParametroLiquidacion, UnidadTransporte
from app.services.calculation_engine import calculate_viaje_values, determine_trip_period


def sanitize_schema_name(name: str) -> str:
    """Sanitiza el nombre de la empresa para usarlo como esquema PostgreSQL."""
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', name).strip('_').lower()
    return f"empresa_{slug[:30]}"


def normalize_company_name(name: Any) -> str:
    """Normaliza nombres de empresas (apóstrofes, espacios múltiples, mayúsculas)."""
    if not name:
        return ""
    s = str(name).strip().replace("´", "").replace("`", "").replace("’", "").replace("'", "")
    s = re.sub(r'\s+', ' ', s)
    return s.upper()


def get_excel_sheets(file_bytes: bytes) -> List[str]:
    """Retorna los nombres de las hojas en el libro Excel de manera ultra rápida."""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    sheets = list(wb.sheetnames)
    wb.close()
    return sheets


def parse_date_value(val: Any) -> Optional[date]:
    """Parsea valores de fecha de forma robusta soportando datetime, date, str y números de serie Excel."""
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, (int, float)):
        # Número de serie de Excel (días desde 1899-12-30)
        try:
            from datetime import timedelta
            return date(1899, 12, 30) + timedelta(days=int(val))
        except Exception:
            return None
    val_str = str(val).strip()
    if not val_str or val_str.upper() in ("NONE", "NULL", "FALTA", "-", "0"):
        return None
    try:
        dt = date_parser.parse(val_str, dayfirst=True)
        return dt.date()
    except Exception:
        try:
            dt = date_parser.parse(val_str, dayfirst=False)
            return dt.date()
        except Exception:
            return None


def clean_float(val: Any, default: float = 0.0) -> float:
    """Convierte un valor a float limpiando caracteres como comas y espacios."""
    if val is None or val == "":
        return default
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(" ", "").replace(",", ".")
    try:
        return float(val_str)
    except Exception:
        return default


def clean_string(val: Any) -> str:
    """Limpia cadenas de texto."""
    if val is None:
        return ""
    return str(val).strip()


def detect_columns_and_header_row(rows_iter) -> Tuple[Optional[int], Dict[str, int]]:
    """
    Escanea las primeras 10 filas para encontrar el encabezado y mapear dinámicamente las columnas.
    Soporta formato Driver S.R.L. / Plantilla de Importación y formato oficial del sistema.
    """
    col_map: Dict[str, int] = {}
    header_row_idx: Optional[int] = None

    for r_idx, row in enumerate(rows_iter, 1):
        if r_idx > 12:
            break
        row_vals = [clean_string(c) for c in row]
        row_upper = [v.upper() for v in row_vals]

        has_placa = any("PLACA" in v for v in row_upper)
        has_prod = any("PRODUCTO" in v for v in row_upper)
        has_vol = any("VOLUMEN" in v or "VOL" in v or "DESPACHADO" in v for v in row_upper)

        if has_placa and (has_prod or has_vol):
            header_row_idx = r_idx
            for c_idx, val in enumerate(row_upper):
                if not val:
                    continue
                if "PLACA" in val and "placa" not in col_map:
                    col_map["placa"] = c_idx
                elif ("EMPRESA TRANSPORTE" in val or "TRANSPORTISTA" in val or "ASOCIADO" in val or "SOCIO" in val or "PROPIETARIO" in val or ("EMPRESA" in val and "CLIENTE" not in val and "FACTURA" not in val)) and "empresa" not in col_map:
                    col_map["empresa"] = c_idx
                elif ("CLIENTE" in val or "CONSIGNATARIO" in val or "REMITENTE" in val or "FACTURA EMITIDA" in val) and "cliente" not in col_map:
                    col_map["cliente"] = c_idx
                elif "PRODUCTO" in val and "producto" not in col_map:
                    col_map["producto"] = c_idx
                elif ("PLANTA DE CARGA" in val or "ORIGEN" in val) and "FECHA" not in val and "VOL" not in val and "planta_carga" not in col_map:
                    col_map["planta_carga"] = c_idx
                elif ("PLANTA DE DESCARGA" in val or "DESTINO" in val) and "FECHA" not in val and "VOL" not in val and "planta_descarga" not in col_map:
                    col_map["planta_descarga"] = c_idx
                elif "TRAMO" in val and "tramo" not in col_map:
                    col_map["tramo"] = c_idx
                elif ("CARGA" in val and "FECHA" in val) or val in ("FECHA DE CARGA", "F. CARGA", "FECHA CARGA", "F_CARGA"):
                    col_map["fecha_carga"] = c_idx
                elif ("RECEPCI" in val and "FECHA" in val) or ("DESCARGA" in val and "FECHA" in val) or val in ("FECHA RECEPCIÓN", "FECHA RECEPCION", "FECHA DESCARGA", "F. DESCARGA"):
                    col_map["fecha_descarga"] = c_idx
                elif ("DESPACHADO" in val and ("VOL" in val or "15" in val or "LITRO" in val)) or ("ORIGEN" in val and "VOL" in val):
                    col_map["vol_origen"] = c_idx
                elif ("RECEPCIONAD" in val and ("VOL" in val or "15" in val or "LITRO" in val)) or ("DESCARGADO" in val and "VOL" in val):
                    col_map["vol_recepcion"] = c_idx
                elif ("FACTURAR" in val or "FACTURADO" in val) and ("VOL" in val or "M3" in val or "LITRO" in val):
                    col_map["vol_facturado"] = c_idx
                elif "TARIFA" in val or ("FLETE" in val and "BS" in val and "IMPORTE" not in val):
                    col_map["tarifa"] = c_idx
                elif "IMPORTE" in val and ("FACTURAR" in val or "TOTAL" in val or "BS" in val):
                    col_map["importe_total"] = c_idx
                elif ("N°" in val or "NRO" in val or "NUM" in val or "Nº" in val) and "FACTURA" in val and "fecha" not in val:
                    col_map["nro_factura"] = c_idx
                elif "FECHA" in val and "FACTURA" in val:
                    col_map["fecha_factura"] = c_idx
                elif ("MIC" in val or "DTA" in val or "MCI" in val) and "FECHA" not in val:
                    col_map["mic_dta"] = c_idx
                elif "MERMA" in val and "DESCONTAR" in val and "BS" in val:
                    col_map["merma_descontar"] = c_idx
                elif "PRECIO MERMA" in val:
                    col_map["precio_merma"] = c_idx
                elif "LOTE" in val:
                    col_map["lote"] = c_idx
                elif "OBS" in val or "OBSERVACI" in val:
                    col_map["obs"] = c_idx
            break

    return header_row_idx, col_map


def parse_excel_viajes_data(
    file_bytes: bytes,
    sheet_name: Optional[str] = None,
    session: Optional[Session] = None,
    db: Optional[Session] = None,
    asociacion_id: Optional[int] = None,
    max_preview_records: Optional[int] = None
) -> Dict[str, Any]:
    """
    Lee, valida y procesa una hoja Excel de viajes.
    Soporta formato por Empresa (individual) y formato por Asociación (multi-empresa).
    Retorna registros listos para previsualización o importación.
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    sheets = list(wb.sheetnames)
    target_sheet = sheet_name if sheet_name and sheet_name in sheets else sheets[0]
    ws = wb[target_sheet]

    # Tomar primeras 15 filas para detección de encabezados
    sample_rows = []
    for r in ws.iter_rows(values_only=True):
        sample_rows.append(r)
        if len(sample_rows) >= 15:
            break

    header_row_idx, col_map = detect_columns_and_header_row(sample_rows)

    if not header_row_idx or "placa" not in col_map:
        # Fallback a posiciones estándar si no detectó por nombres
        if ws.max_column and ws.max_column >= 18:
            header_row_idx = 4
            col_map = {
                "fecha_carga": 1,
                "fecha_descarga": 2,
                "mic_dta": 3,
                "placa": 4,
                "tramo": 5,
                "cliente": 6,
                "nro_factura": 7,
                "fecha_factura": 8,
                "producto": 9,
                "vol_origen": 10,
                "vol_recepcion": 11,
                "vol_facturado": 16,
                "tarifa": 17
            }
        else:
            header_row_idx = 1
            col_map = {
                "empresa": 0,
                "cliente": 1,
                "producto": 2,
                "planta_carga": 3,
                "planta_descarga": 5,
                "placa": 6,
                "fecha_carga": 7,
                "fecha_descarga": 8,
                "vol_origen": 9,
                "vol_recepcion": 10,
                "vol_facturado": 15,
                "tarifa": 16,
                "importe_total": 17,
                "fecha_factura": 18,
                "nro_factura": 19,
                "mic_dta": 20
            }

    valid_records: List[Dict[str, Any]] = []
    skipped_records: List[Dict[str, Any]] = []
    periodos_detectados = set()
    placas_detectadas = set()

    total_vol_facturado_lt = 0.0
    total_flete_bs = 0.0

    # Iterar todas las filas
    for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
        if r_idx <= header_row_idx:
            continue

        if not any(row):
            continue

        def get_c(key: str) -> Any:
            idx = col_map.get(key)
            if idx is not None and idx < len(row):
                return row[idx]
            return None

        placa_raw = clean_string(get_c("placa"))
        empresa_raw = clean_string(get_c("empresa"))
        cliente_raw = clean_string(get_c("cliente"))
        producto_raw = clean_string(get_c("producto"))
        planta_c = clean_string(get_c("planta_carga"))
        planta_d = clean_string(get_c("planta_descarga"))
        tramo_raw = clean_string(get_c("tramo"))

        vol_o_raw = clean_float(get_c("vol_origen"), 0.0)
        vol_r_raw = clean_float(get_c("vol_recepcion"), 0.0)
        vol_f_raw = clean_float(get_c("vol_facturado"), 0.0)
        tarifa_raw = clean_float(get_c("tarifa"), 0.0)
        importe_raw = clean_float(get_c("importe_total"), 0.0)

        nro_fac_raw = clean_string(get_c("nro_factura"))
        mic_raw = clean_string(get_c("mic_dta"))

        f_carga_raw = get_c("fecha_carga")
        f_descarga_raw = get_c("fecha_descarga")
        f_fac_raw = get_c("fecha_factura")

        # 1. Filtro de filas de resumen / subtotales o vacías
        placa_upper = placa_raw.upper()
        if not placa_upper or placa_upper in ("TOTAL", "SUBTOTAL", "RESUMEN", "GENERAL", "PROMEDIO"):
            skipped_records.append({
                "fila": r_idx,
                "motivo": f"Fila de resumen o total ignorada ({placa_raw or 'Fila vacía'})"
            })
            continue

        if placa_upper in ("SIN PLACA", "FALTA PLACA") and vol_o_raw == 0 and vol_r_raw == 0:
            skipped_records.append({
                "fila": r_idx,
                "motivo": f"Fila sin placa y sin volumen asignado ('{placa_raw}')"
            })
            continue

        # Normalizar placa
        clean_placa = placa_upper.replace(" ", "")

        # 2. Tramo
        if planta_c or planta_d:
            orig = planta_c if planta_c and planta_c.upper() != "FALTA MIC" else ""
            dest = planta_d if planta_d and planta_d.upper() != "FALTA MIC" else ""
            if orig and dest:
                clean_tramo = f"{orig} - {dest}".upper()
            elif orig:
                clean_tramo = orig.upper()
            elif dest:
                clean_tramo = dest.upper()
            else:
                clean_tramo = tramo_raw.upper() if tramo_raw else "TRAMO NO ESPECIFICADO"
        else:
            clean_tramo = tramo_raw.upper() if tramo_raw else "TRAMO NO ESPECIFICADO"

        # 3. Cliente
        clean_cliente = cliente_raw.upper() if cliente_raw else "YPFB"

        # 4. Producto
        clean_prod = producto_raw.upper() if producto_raw else "DIESEL"

        # 5. Fechas
        date_fac = parse_date_value(f_fac_raw)
        date_carga = parse_date_value(f_carga_raw)
        date_descarga = parse_date_value(f_descarga_raw)

        if not date_carga:
            date_carga = date_descarga or date_fac or date.today()
        if not date_descarga:
            date_descarga = date_carga

        # 6. Volúmenes
        vol_o = round(vol_o_raw, 1)
        vol_r = round(vol_r_raw, 1)

        # Volumen facturado: si viene en m3 (< 1000 y > 0), convertir a Litros
        if 0 < vol_f_raw < 1000:
            vol_f = round(vol_f_raw * 1000.0, 1)
        elif vol_f_raw >= 1000:
            vol_f = round(vol_f_raw, 1)
        else:
            vol_f = vol_r if vol_r > 0 else (vol_o if vol_o > 0 else 0.0)

        # 7. Tarifa y Flete
        tarifa = tarifa_raw
        if tarifa <= 0:
            if importe_raw > 0 and vol_f > 0:
                tarifa = round(importe_raw / (vol_f / 1000.0), 2)
            else:
                tarifa = 392.00  # Default general

        flete_calculado = round((vol_f / 1000.0) * tarifa, 2)
        if importe_raw > 0 and abs(importe_raw - flete_calculado) <= 1.0:
            flete_calculado = importe_raw

        # 8. Período
        periodo = determine_trip_period(date_carga, date_descarga)
        periodos_detectados.add(periodo)
        placas_detectadas.add(clean_placa)

        # 9. Normalización de Empresa
        clean_empresa = normalize_company_name(empresa_raw)

        # 10. Validación de Completitud (Detección de Datos Faltantes)
        clean_mic = mic_raw.upper().strip() if mic_raw and mic_raw.upper().strip() not in ("FALTA MIC", "SIN MIC", "NONE", "") else None
        
        missing_fields = []
        if not clean_placa or clean_placa in ("SINPLACA", "FALTAPLACA", "NONE", ""):
            missing_fields.append("Falta Placa")
        if vol_f <= 0:
            missing_fields.append("Volumen en 0")
        if not clean_tramo or clean_tramo == "TRAMO NO ESPECIFICADO":
            missing_fields.append("Falta Tramo")

        is_incompleto = len(missing_fields) > 0
        incompleto_reason = ", ".join(missing_fields) if is_incompleto else ""

        record = {
            "fila": r_idx,
            "empresa": clean_empresa,
            "placa": clean_placa,
            "tramo": clean_tramo,
            "cliente": clean_cliente,
            "producto": clean_prod,
            "fecha_carga": date_carga.isoformat(),
            "fecha_descarga": date_descarga.isoformat(),
            "fecha_factura": date_fac.isoformat() if date_fac else None,
            "nro_factura": nro_fac_raw if nro_fac_raw else None,
            "mic_dta": clean_mic,
            "volumen_origen_litros": vol_o,
            "volumen_recepcionado_litros": vol_r,
            "volumen_facturado": vol_f,
            "volumen_facturado_m3": round(vol_f / 1000.0, 3),
            "tarifa_flete": tarifa,
            "tipo_tarifa": "BS_POR_M3",
            "flete_total_bs": flete_calculado,
            "periodo_mes": periodo,
            "is_incompleto": is_incompleto,
            "incompleto_reason": incompleto_reason,
            "status": "INCOMPLETO" if is_incompleto else "LISTO"
        }

        valid_records.append(record)
        total_vol_facturado_lt += vol_f
        total_flete_bs += flete_calculado

    wb.close()

    preview_items = valid_records[:max_preview_records] if max_preview_records else valid_records
    valid_placas = [p for p in placas_detectadas if p and p not in ("SINPLACA", "FALTAPLACA", "TOTAL")]

    # Agregación y detección de empresas (para importación por Asociación / multi-empresa)
    empresas_stats: Dict[str, Dict[str, Any]] = {}
    for r in valid_records:
        emp = r.get("empresa")
        if not emp:
            continue
        if emp not in empresas_stats:
            empresas_stats[emp] = {
                "nombre": emp,
                "total_viajes": 0,
                "viajes_listos": 0,
                "viajes_incompletos": 0,
                "total_volumen_litros": 0.0,
                "total_flete_bs": 0.0,
                "placas": set(),
            }
        empresas_stats[emp]["total_viajes"] += 1
        if r.get("is_incompleto"):
            empresas_stats[emp]["viajes_incompletos"] += 1
        else:
            empresas_stats[emp]["viajes_listos"] += 1
        empresas_stats[emp]["total_volumen_litros"] += r.get("volumen_facturado", 0.0)
        empresas_stats[emp]["total_flete_bs"] += r.get("flete_total_bs", 0.0)
        if r.get("placa"):
            empresas_stats[emp]["placas"].add(r["placa"])

    from app.models.public import Empresa
    existing_empresas = db.query(Empresa).all() if db else []
    emp_lookup = {normalize_company_name(e.name): e for e in existing_empresas}

    empresas_detectadas_list = []
    for emp_name, stats in sorted(empresas_stats.items()):
        existing = emp_lookup.get(emp_name)
        if existing:
            action = "reutilizar"
            empresa_id = existing.id
            schema_name = existing.schema_name
            already_in_asociacion = (existing.asociacion_id == asociacion_id) if asociacion_id else False
        else:
            action = "crear"
            empresa_id = None
            schema_name = sanitize_schema_name(emp_name)
            already_in_asociacion = False

        empresas_detectadas_list.append({
            "nombre": emp_name,
            "action": action,
            "empresa_id": empresa_id,
            "schema_name": schema_name,
            "already_in_asociacion": already_in_asociacion,
            "total_viajes": stats["total_viajes"],
            "viajes_listos": stats["viajes_listos"],
            "viajes_incompletos": stats["viajes_incompletos"],
            "total_volumen_litros": round(stats["total_volumen_litros"], 1),
            "total_volumen_m3": round(stats["total_volumen_litros"] / 1000.0, 3),
            "total_flete_bs": round(stats["total_flete_bs"], 2),
            "cisternas_count": len(stats["placas"])
        })

    is_multi_empresa = len(empresas_stats) > 1

    return {
        "success": True,
        "sheets": sheets,
        "selected_sheet": target_sheet,
        "header_row": header_row_idx,
        "total_valid_rows": len(valid_records),
        "total_skipped_rows": len(skipped_records),
        "records": preview_items,
        "skipped_details": skipped_records[:50],
        "is_multi_empresa": is_multi_empresa,
        "empresas_detectadas": empresas_detectadas_list,
        "summary": {
            "total_viajes": len(valid_records),
            "viajes_listos": sum(1 for r in valid_records if not r.get("is_incompleto")),
            "viajes_incompletos": sum(1 for r in valid_records if r.get("is_incompleto")),
            "total_volumen_litros": round(total_vol_facturado_lt, 1),
            "total_volumen_m3": round(total_vol_facturado_lt / 1000.0, 3),
            "total_flete_bs": round(total_flete_bs, 2),
            "periodos_detectados": sorted(list(periodos_detectados)),
            "total_placas_unicas": len(valid_placas),
            "total_empresas_detectadas": len(empresas_detectadas_list)
        }
    }


def execute_import_viajes(
    records: List[Dict[str, Any]],
    session: Session,
    params: Optional[ParametroLiquidacion] = None,
    overwrite_duplicates: bool = False
) -> Dict[str, Any]:
    """
    Inserta o actualiza una lista de registros de viajes (procesados o editados por el usuario)
    en la sesión de base de datos del esquema correspondiente.
    """
    if not params:
        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

    viajes_creados = 0
    viajes_actualizados = 0
    viajes_omitidos = 0
    errores = []
    periodos_detectados = set()

    unidades_cache = {u.placa: u for u in session.query(UnidadTransporte).all()}

    for rec in records:
        if rec.get("included") is False:
            continue
        try:
            placa = clean_string(rec.get("placa")).upper().replace(" ", "")
            if not placa or placa in ("SINPLACA", "FALTAPLACA", "TOTAL", "SUBTOTAL"):
                continue

            date_carga = parse_date_value(rec.get("fecha_carga")) or date.today()
            date_descarga = parse_date_value(rec.get("fecha_descarga")) or date_carga
            date_fac = parse_date_value(rec.get("fecha_factura"))
            mic_str = clean_string(rec.get("mic_dta")).upper() or None
            if mic_str in ("FALTA MIC", "SIN MIC", "NONE", ""):
                mic_str = None

            vol_o = clean_float(rec.get("volumen_origen_litros"), 0.0)
            vol_r = clean_float(rec.get("volumen_recepcionado_litros"), 0.0)
            vol_f_raw = clean_float(rec.get("volumen_facturado"), 0.0)
            if 0 < vol_f_raw < 1000:
                vol_f = round(vol_f_raw * 1000.0, 1)
            elif vol_f_raw >= 1000:
                vol_f = round(vol_f_raw, 1)
            else:
                vol_f = vol_r if vol_r > 0 else (vol_o if vol_o > 0 else 0.0)

            tarifa = clean_float(rec.get("tarifa_flete"), 392.00)
            tipo_t = clean_string(rec.get("tipo_tarifa")) or "BS_POR_M3"
            tramo = clean_string(rec.get("tramo")) or "TRAMO NO ESPECIFICADO"
            cliente = clean_string(rec.get("cliente")) or "YPFB"
            producto = clean_string(rec.get("producto")) or "DIESEL"
            nro_fac = clean_string(rec.get("nro_factura")) or None

            # Si el registro especifica un ID existente de viaje, se actualiza
            existing_viaje = None
            if rec.get("id"):
                existing_viaje = session.query(Viaje).filter(Viaje.id == rec["id"]).first()

            # Crear o verificar unidad
            u = unidades_cache.get(placa)
            if not u:
                u = session.query(UnidadTransporte).filter(UnidadTransporte.placa == placa).first()
            if not u:
                u = UnidadTransporte(
                    placa=placa,
                    marca="Tractocamión / Cisterna",
                    capacidad_litros=vol_o if vol_o > 0 else 34000,
                    estado="Activo"
                )
                session.add(u)
                session.commit()
                session.refresh(u)
                unidades_cache[placa] = u

            calc = calculate_viaje_values(
                volumen_origen_litros=vol_o,
                volumen_recepcionado_litros=vol_r,
                producto=producto,
                tarifa_flete=tarifa,
                tipo_tarifa=tipo_t,
                params=params,
                volumen_facturado=vol_f
            )

            periodo = determine_trip_period(date_carga, date_descarga)
            periodos_detectados.add(periodo)

            if existing_viaje:
                existing_viaje.placa = placa
                existing_viaje.unidad_id = u.id
                existing_viaje.tramo = tramo
                existing_viaje.cliente = cliente
                existing_viaje.producto = producto
                existing_viaje.fecha_carga = date_carga
                existing_viaje.fecha_descarga = date_descarga
                existing_viaje.periodo_mes = periodo
                if nro_fac:
                    existing_viaje.nro_factura = nro_fac
                if date_fac:
                    existing_viaje.fecha_factura = date_fac
                if mic_str:
                    existing_viaje.mic_dta = mic_str
                existing_viaje.volumen_origen_litros = vol_o
                existing_viaje.volumen_recepcionado_litros = vol_r
                existing_viaje.volumen_facturado = calc["volumen_facturado"]
                existing_viaje.merma_real_litros = calc["merma_real_litros"]
                existing_viaje.tolerancia_pct = calc["tolerancia_pct"]
                existing_viaje.merma_tolerable_litros = calc["merma_tolerable_litros"]
                existing_viaje.merma_excedente_litros = calc["merma_excedente_litros"]
                existing_viaje.precio_merma_litro_bs = calc["precio_merma_litro_bs"]
                existing_viaje.merma_descontar_bs = calc["merma_descontar_bs"]
                existing_viaje.tarifa_flete = tarifa
                existing_viaje.flete_total_bs = calc["flete_total_bs"]
                viajes_actualizados += 1
                continue

            nuevo_viaje = Viaje(
                mic_dta=mic_str,
                lote_codigo="1",
                unidad_id=u.id,
                placa=placa,
                tramo=tramo,
                cliente=cliente,
                nro_factura=nro_fac,
                fecha_factura=date_fac,
                producto=producto,
                fecha_carga=date_carga,
                fecha_descarga=date_descarga,
                periodo_mes=periodo,
                volumen_origen_litros=vol_o,
                volumen_recepcionado_litros=vol_r,
                volumen_facturado=calc["volumen_facturado"],
                merma_real_litros=calc["merma_real_litros"],
                tolerancia_pct=calc["tolerancia_pct"],
                merma_tolerable_litros=calc["merma_tolerable_litros"],
                merma_excedente_litros=calc["merma_excedente_litros"],
                precio_merma_litro_bs=calc["precio_merma_litro_bs"],
                merma_descontar_bs=calc["merma_descontar_bs"],
                tarifa_flete=tarifa,
                tipo_tarifa=tipo_t,
                flete_total_bs=calc["flete_total_bs"],
                estado="Pendiente"
            )
            session.add(nuevo_viaje)
            viajes_creados += 1
        except Exception as row_ex:
            errores.append(f"Fila {rec.get('fila', '?')}: {str(row_ex)}")

    if viajes_creados or viajes_actualizados:
        session.commit()

    return {
        "success": True,
        "total_importados": viajes_creados,
        "total_actualizados": viajes_actualizados,
        "total_omitidos": viajes_omitidos,
        "periodos_detectados": sorted(list(periodos_detectados)),
        "errores": errores
    }


def execute_import_asociacion_multi_empresa(
    records: List[Dict[str, Any]],
    db: Session,
    asociacion_id: Optional[int] = None,
    nueva_asociacion_nombre: Optional[str] = None,
    nueva_asociacion_sigla: Optional[str] = None,
    overwrite_duplicates: bool = False
) -> Dict[str, Any]:
    """
    Importa despachos distribuyéndolos entre múltiples empresas de transporte.
    Para cada empresa identificada en los registros:
    - Si ya existe en el sistema: la reutiliza (y la vincula a la asociación si no lo estaba).
    - Si no existe: la crea automáticamente en public.empresas con su asociación e
      inicializa su esquema PostgreSQL dedicado (init_tenant_schema).
    Luego inserta o actualiza sus viajes en su esquema correspondiente.
    """
    from app.models.public import Asociacion, Empresa
    from app.db.session import get_tenant_session, init_tenant_schema
    from app.models.tenant import ParametroLiquidacion

    asoc = None
    if asociacion_id:
        asoc = db.query(Asociacion).filter(Asociacion.id == asociacion_id).first()
        if not asoc and not nueva_asociacion_nombre:
            raise ValueError(f"Asociación con ID {asociacion_id} no encontrada.")

    if not asoc and nueva_asociacion_nombre and nueva_asociacion_nombre.strip():
        asoc_name_clean = nueva_asociacion_nombre.strip()
        asoc = db.query(Asociacion).filter(Asociacion.name.ilike(asoc_name_clean)).first()
        if not asoc:
            asoc = Asociacion(
                name=asoc_name_clean,
                sigla=nueva_asociacion_sigla.strip().upper() if nueva_asociacion_sigla else None,
                is_active=True
            )
            db.add(asoc)
            db.commit()
            db.refresh(asoc)

    # Agrupar registros válidos/incluidos por empresa normalizada
    records_by_company: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        if r.get("included") is False:
            continue
        emp_name = normalize_company_name(r.get("empresa"))
        if not emp_name:
            emp_name = "EMPRESA ASOCIADA"
        if emp_name not in records_by_company:
            records_by_company[emp_name] = []
        records_by_company[emp_name].append(r)

    if not records_by_company:
        return {
            "success": False,
            "message": "No hay registros seleccionados para importar.",
            "total_empresas_procesadas": 0,
            "empresas_creadas": 0,
            "empresas_reutilizadas": 0,
            "total_viajes_importados": 0,
            "total_viajes_actualizados": 0,
            "empresas_detalle": []
        }

    all_empresas = db.query(Empresa).all()
    emp_lookup = {normalize_company_name(e.name): e for e in all_empresas}

    empresas_results = []
    total_importados_global = 0
    total_actualizados_global = 0
    total_creadas = 0
    total_reutilizadas = 0

    for emp_name, comp_records in records_by_company.items():
        emp = emp_lookup.get(emp_name)
        is_new = False

        if emp:
            total_reutilizadas += 1
            if asoc and emp.asociacion_id != asoc.id:
                emp.asociacion_id = asoc.id
                db.commit()
                db.refresh(emp)
        else:
            is_new = True
            total_creadas += 1
            base_schema = sanitize_schema_name(emp_name)
            schema_name = base_schema
            counter = 1
            while db.query(Empresa).filter(Empresa.schema_name == schema_name).first():
                schema_name = f"{base_schema}_{counter}"
                counter += 1

            emp = Empresa(
                name=emp_name,
                schema_name=schema_name,
                nit=None,
                tipo_empresa="Sociedad",
                asociacion_id=asoc.id if asoc else None,
                icon="Truck",
                is_active=True
            )
            db.add(emp)
            db.commit()
            db.refresh(emp)
            emp_lookup[emp_name] = emp

            # Inicializar esquema PostgreSQL dedicado
            init_tenant_schema(emp.schema_name)

        # Importar los viajes al esquema de la empresa
        tenant_session = get_tenant_session(emp.schema_name)
        try:
            params = tenant_session.query(ParametroLiquidacion).first()
            if not params:
                params = ParametroLiquidacion()
                tenant_session.add(params)
                tenant_session.commit()

            res = execute_import_viajes(
                records=comp_records,
                session=tenant_session,
                params=params,
                overwrite_duplicates=overwrite_duplicates
            )

            empresas_results.append({
                "empresa_id": emp.id,
                "empresa_name": emp.name,
                "schema_name": emp.schema_name,
                "accion": "creada" if is_new else "reutilizada",
                "total_viajes": len(comp_records),
                "importados": res["total_importados"],
                "actualizados": res["total_actualizados"],
                "omitidos": res["total_omitidos"],
                "errores": res["errores"]
            })
            total_importados_global += res["total_importados"]
            total_actualizados_global += res["total_actualizados"]
        finally:
            tenant_session.close()

    asoc_name_display = asoc.name if asoc else "Asociación"
    return {
        "success": True,
        "asociacion_id": asoc.id if asoc else None,
        "asociacion_name": asoc_name_display,
        "total_empresas_procesadas": len(records_by_company),
        "empresas_creadas": total_creadas,
        "empresas_reutilizadas": total_reutilizadas,
        "total_viajes_importados": total_importados_global,
        "total_viajes_actualizados": total_actualizados_global,
        "empresas_detalle": empresas_results,
        "message": f"Se procesaron con éxito {len(records_by_company)} empresas ({total_creadas} creadas, {total_reutilizadas} reutilizadas) con un total de {total_importados_global} despachos importados en {asoc_name_display}."
    }

