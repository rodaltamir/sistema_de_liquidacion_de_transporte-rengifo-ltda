import io
from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple
from dateutil import parser as date_parser
import openpyxl
from sqlalchemy.orm import Session
from app.models.tenant import Viaje, ParametroLiquidacion, UnidadTransporte
from app.services.calculation_engine import calculate_viaje_values, determine_trip_period


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
                elif ("EMPRESA" in val or "CLIENTE" in val or "FACTURA EMITIDA" in val) and "cliente" not in col_map:
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
    max_preview_records: Optional[int] = None
) -> Dict[str, Any]:
    """
    Lee, valida y procesa una hoja Excel de viajes.
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
                "cliente": 0,
                "producto": 1,
                "planta_carga": 2,
                "planta_descarga": 4,
                "placa": 5,
                "fecha_carga": 6,
                "fecha_descarga": 7,
                "vol_origen": 8,
                "vol_recepcion": 9,
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

    # Cache de viajes existentes para detección de duplicados
    existing_mics = set()
    existing_trips = set()
    if session:
        try:
            mics_db = session.query(Viaje.mic_dta).filter(Viaje.mic_dta.isnot(None), Viaje.mic_dta != "").all()
            existing_mics = {str(m[0]).strip().upper() for m in mics_db if m[0]}

            trips_db = session.query(
                Viaje.placa, Viaje.fecha_carga, Viaje.fecha_descarga, Viaje.volumen_recepcionado_litros
            ).all()
            for t in trips_db:
                if t[0] and t[1] and t[2]:
                    existing_trips.add((str(t[0]).strip().upper(), t[1], t[2], round(float(t[3] or 0), 1)))
        except Exception as e:
            print("Error cargando cache de duplicados:", e)

    seen_mics_in_file = set()
    seen_trips_in_file = set()

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

        # 9. Detección de Duplicados
        clean_mic = mic_raw.upper().strip() if mic_raw and mic_raw.upper().strip() not in ("FALTA MIC", "SIN MIC", "NONE", "") else None
        is_dup_system = False
        dup_reason = ""

        if clean_mic and clean_mic in existing_mics:
            is_dup_system = True
            dup_reason = f"MIC/DTA '{clean_mic}' ya registrado en el sistema"
        else:
            trip_key = (clean_placa, date_carga, date_descarga, round(vol_r, 1))
            if trip_key in existing_trips:
                is_dup_system = True
                dup_reason = f"Viaje de {clean_placa} del {date_carga} a {date_descarga} ({vol_r} L) ya existe en el sistema"

        is_dup_in_file = False
        if clean_mic:
            if clean_mic in seen_mics_in_file:
                is_dup_in_file = True
                dup_reason = f"MIC/DTA '{clean_mic}' repetido en el archivo"
            seen_mics_in_file.add(clean_mic)
        else:
            trip_file_key = (clean_placa, date_carga, date_descarga, round(vol_r, 1))
            if trip_file_key in seen_trips_in_file:
                is_dup_in_file = True
                dup_reason = f"Registro idéntico repetido en el archivo ({clean_placa}, {date_carga})"
            seen_trips_in_file.add(trip_file_key)

        record = {
            "fila": r_idx,
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
            "is_duplicate_system": is_dup_system,
            "is_duplicate_file": is_dup_in_file,
            "duplicate_reason": dup_reason,
            "status": "DUPLICADO" if (is_dup_system or is_dup_in_file) else "VALIDO"
        }

        valid_records.append(record)
        total_vol_facturado_lt += vol_f
        total_flete_bs += flete_calculado

    wb.close()

    preview_items = valid_records[:max_preview_records] if max_preview_records else valid_records

    return {
        "success": True,
        "sheets": sheets,
        "selected_sheet": target_sheet,
        "header_row": header_row_idx,
        "total_valid_rows": len(valid_records),
        "total_skipped_rows": len(skipped_records),
        "records": preview_items,
        "skipped_details": skipped_records[:50],
        "summary": {
            "total_viajes": len(valid_records),
            "viajes_nuevos": sum(1 for r in valid_records if not r["is_duplicate_system"] and not r["is_duplicate_file"]),
            "viajes_duplicados": sum(1 for r in valid_records if r["is_duplicate_system"] or r["is_duplicate_file"]),
            "total_volumen_litros": round(total_vol_facturado_lt, 1),
            "total_volumen_m3": round(total_vol_facturado_lt / 1000.0, 3),
            "total_flete_bs": round(total_flete_bs, 2),
            "periodos_detectados": sorted(list(periodos_detectados)),
            "total_placas_unicas": len(placas_detectadas)
        }
    }
