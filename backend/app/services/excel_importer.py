# backend/app/services/excel_importer.py
import io
import re
from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple, Set
from dateutil import parser as date_parser
import openpyxl
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.tenant import Viaje, ParametroLiquidacion, UnidadTransporte, Cliente, EmpresaApoyo
from app.db.session import sanitize_schema_name
from app.services.calculation_engine import calculate_viaje_values, determine_trip_period

# -------------------------------------------------------------------------
# PALABRAS CLAVE PARA CLASIFICACIÓN INTELIGENTE DE CLIENTES Y TRANSPORTISTAS
# -------------------------------------------------------------------------
KNOWN_CLIENT_KEYWORDS = [
    "ACEITE", "SOYA", "FINO", "YPFB", "Y.P.F.B", "CARGILL", "BUNGE", "GRAVETAL",
    "ACEROS AREQUIPA", "ACEROSPAURITO", "AREQUIPA", "MINERA", "MINERIA", "FERTILIZANTES", "FERTIBOL", "FERTIPRO",
    "ALICONSUMO", "PIL ANDINA", "REPSOL", "PETROBRAS", "SHELL", "TOTAL", "COBOCE", "SOBOCE",
    "ITAGROBOL", "GREEN METALS", "GREENFIELD", "MINERA DON VALERIANO", "INDUSTRIA Y COMERCIO",
    "AGRO", "CEMENTO", "ALIMENTOS", "COMERCIALIZADORA", "CORPORACION MINERA", "CAMPOSOL", "PRODECO",
    "HAMMER", "LAMBOL", "PLUS METALS", "SYNTEX", "DON VALERIANO", "METALS", "ASPHALT",
    "TEMPLARIOS", "TRUCKS TEMPLARIOS", "REALTRUCK", "REALTRUCKS", "BOCKTRANS", "MEDLOG",
    "LIMACHI", "PEDRO WEILLIAM"
]

KNOWN_TRANSPORT_KEYWORDS = [
    "TRANS ", "TRANS.", "TRANSPORTE", "TRANSPORTES",
    "TRAILER", "LOGISTICA", "LOGISTIC", "COOP. TRANS", "COOPERATIVA", "LINEA", "CARGO", "FLOTA",
    "EXPRESS", "INTERNACIONAL", "ASOCIACION", "SINDICATO", "UNION", "SERVICIOS DE TRANSPORTE"
]

def classify_entity_name(name: str) -> str:
    """Determina si un nombre corresponde a un Cliente o a una Empresa de Transporte."""
    if not name:
        return "cliente"
    name_upper = name.upper().strip()
    for kw in KNOWN_CLIENT_KEYWORDS:
        if kw in name_upper:
            return "cliente"
    for kw in KNOWN_TRANSPORT_KEYWORDS:
        if kw in name_upper:
            return "empresa"
    if any(legal in name_upper for legal in ["S.A.", "SOCIEDAD ANONIMA", "S.A", "SUCURSAL BOLIVIA", "S.A.C.", "AGROPECUARIA", "COMERCIAL", "INDUSTRIAL"]) and not any(kw in name_upper for kw in KNOWN_TRANSPORT_KEYWORDS):
        return "cliente"
    if any(t_term in name_upper for t_term in ["TRANS", "CARGO", "LOGISTIC", "FLOTA", "TRUCKS"]):
        return "empresa"
    return "cliente"

def normalize_company_name(name: Any) -> str:
    """Limpia y estandariza nombres de empresas o clientes."""
    if not name:
        return ""
    clean = str(name).strip()
    clean = re.sub(r'\s+', ' ', clean)
    clean = clean.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    return clean.strip().upper()

def get_excel_sheets(file_bytes: bytes) -> List[str]:
    """Lee los nombres de todas las hojas disponibles en un archivo Excel."""
    if isinstance(file_bytes, str):
        wb = openpyxl.load_workbook(file_bytes, read_only=True)
    else:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True)
    sheets = list(wb.sheetnames)
    wb.close()
    return sheets

def parse_date_value(val: Any) -> Optional[date]:
    """Convierte celdas de fecha a datetime.date."""
    if val is None or val == "":
        return None
    if isinstance(val, (datetime, date)):
        return val.date() if isinstance(val, datetime) else val

    val_str = str(val).strip()
    val_str = re.sub(r'\s*00:00(:00)?.*$', '', val_str)
    val_str = val_str.replace('/', '-')

    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%Y%m%d', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%y', '%d/%m/%y'):
        try:
            return datetime.strptime(val_str, fmt).date()
        except Exception:
            pass

    try:
        dt = date_parser.parse(val_str, dayfirst=False)
        if 1990 <= dt.year <= 2040:
            return dt.date()
    except Exception:
        pass

    return None

def clean_invoice_number(val: Any) -> Optional[str]:
    """Extrae y limpia el número de factura."""
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.upper() in ("NONE", "NULL", "-", "SIN FACTURA", "0"):
        return None
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    m = re.search(r'\b(\d+)\b', val_str)
    if m:
        return m.group(1)
    return val_str

def clean_float(val: Any, default: float = 0.0, hint: str = "generic") -> float:
    """Convierte un valor a float limpiando monedas, separadores de miles y comas decimales."""
    if val is None or val == "":
        return default
    if isinstance(val, (int, float)):
        v = float(val)
        return round(v, 2) if hint == "currency" else round(v, 4) if hint == "volume" else v
    val_str = str(val).strip().upper()
    for prefix in ("BS.", "BS", "BOB", "$US", "USD", "$", "LTS", "LT", "M3"):
        val_str = val_str.replace(prefix, "")
    val_str = val_str.strip().replace(" ", "")
    
    if not val_str:
        return default

    # Manejar formatos con miles y decimales
    if "," in val_str and "." in val_str:
        if val_str.find(",") < val_str.find("."):
            # Formato estándar ej. 13,288.80
            val_str = val_str.replace(",", "")
        else:
            # Formato latino ej. 13.288,80
            val_str = val_str.replace(".", "").replace(",", ".")
    elif "," in val_str:
        val_str = val_str.replace(",", ".")

    try:
        res = float(val_str)
        if hint == "currency":
            return round(res, 2)
        if hint == "volume":
            return round(res, 4)
        return res
    except Exception:
        return default

def clean_string(val: Any) -> str:
    """Limpia cadenas de texto normalizando espacios y saltos de línea."""
    if val is None:
        return ""
    s = str(val).replace("\r", " ").replace("\n", " ").strip()
    return re.sub(r'\s+', ' ', s)

def normalize_volumes(vol_o_raw: float, vol_r_raw: float, vol_f_raw: float) -> Tuple[float, float, float, float]:
    """
    Normaliza volúmenes evitando el error por miles (escalamiento de unidades).
    Distingue con total precisión Litros (L) de Metros Cúbicos (m3).
    Un camión cisterna estándar transporta entre 20,000 y 45,000 Litros (20 a 45 m3).
    """
    vol_o = round(vol_o_raw, 1)
    vol_r = round(vol_r_raw, 1)

    if vol_f_raw > 0:
        if vol_f_raw > 500:
            vol_m3 = round(vol_f_raw / 1000.0, 4)
            vol_f_litros = round(vol_f_raw, 1)
        else:
            vol_m3 = round(vol_f_raw, 4)
            vol_f_litros = round(vol_m3 * 1000.0, 1)
    elif vol_r > 0:
        if vol_r > 500:
            vol_f_litros = vol_r
            vol_m3 = round(vol_r / 1000.0, 4)
        else:
            vol_m3 = vol_r
            vol_f_litros = round(vol_r * 1000.0, 1)
    elif vol_o > 0:
        if vol_o > 500:
            vol_f_litros = vol_o
            vol_m3 = round(vol_o / 1000.0, 4)
        else:
            vol_m3 = vol_o
            vol_f_litros = round(vol_o * 1000.0, 1)
    else:
        vol_f_litros = 0.0
        vol_m3 = 0.0

    return vol_o, vol_r, vol_f_litros, vol_m3

def detect_columns_and_header_row(rows_iter) -> Tuple[Optional[int], Dict[str, int]]:
    """
    Escanea las primeras 15 filas para mapear dinámicamente las columnas canónicas.
    """
    col_map: Dict[str, int] = {}
    header_row_idx: Optional[int] = None

    for r_idx, row in enumerate(rows_iter, 1):
        if r_idx > 15:
            break
        row_vals = [clean_string(c) for c in row]
        row_upper = [v.upper() for v in row_vals]

        has_placa = any("PLACA" in v or "TRACTO" in v or "CISTERNA" in v for v in row_upper)
        has_prod = any("PRODUCTO" in v or "MERCADERIA" in v for v in row_upper)
        has_vol = any("VOLUMEN" in v or "VOL" in v or "DESPACHADO" in v or "LITROS" in v for v in row_upper)
        has_emp = any("EMPRESA" in v or "TRANSPORTE" in v or "CLIENTE" in v or "CONSIGNATARIO" in v for v in row_upper)

        if has_placa and (has_prod or has_vol or has_emp):
            header_row_idx = r_idx
            for c_idx, val in enumerate(row_upper):
                if not val:
                    continue
                if ("PLACA" in val or "TRACTO" in val or "CISTERNA" in val) and "placa" not in col_map:
                    col_map["placa"] = c_idx
                elif ("EMPRESA TRANSPORTE" in val or "TRANSPORTISTA" in val or "ASOCIADO" in val or "SOCIO" in val or "PROPIETARIO" in val or ("EMPRESA" in val and "CLIENTE" not in val and "FACTURA" not in val)) and "empresa" not in col_map:
                    col_map["empresa"] = c_idx
                elif ("CLIENTE" in val or "CONSIGNATARIO" in val or "REMITENTE" in val or "FACTURA EMITIDA" in val or "RAZON SOCIAL" in val or "RAZÓN SOCIAL" in val or "DESTINATARIO" in val or "PAGADOR" in val) and "cliente" not in col_map:
                    col_map["cliente"] = c_idx
                elif ("PRODUCTO" in val or "MERCADERIA" in val) and "producto" not in col_map:
                    col_map["producto"] = c_idx
                elif ("PLANTA DE CARGA" in val or "PLANTA CARGA" in val or ("ORIGEN" in val and "FECHA" not in val and "VOL" not in val)) and "planta_carga" not in col_map:
                    col_map["planta_carga"] = c_idx
                elif ("PLANTA DE DESCARGA" in val or "PLANTA DESCARGA" in val or ("DESTINO" in val and "FECHA" not in val and "VOL" not in val)) and "planta_descarga" not in col_map:
                    col_map["planta_descarga"] = c_idx
                elif ("TRAMO" in val or "RUTA" in val) and "tramo" not in col_map:
                    col_map["tramo"] = c_idx
                elif ("CARGA" in val and "FECHA" in val) or val in ("FECHA DE CARGA", "F. CARGA", "FECHA CARGA", "F_CARGA", "FECHA DESPACHO"):
                    col_map["fecha_carga"] = c_idx
                elif ("RECEPCI" in val and "FECHA" in val) or ("DESCARGA" in val and "FECHA" in val) or val in ("FECHA RECEPCIÓN", "FECHA RECEPCION", "FECHA DESCARGA", "F. DESCARGA", "F_DESCARGA"):
                    col_map["fecha_descarga"] = c_idx
                elif ("DESPACHADO" in val and ("VOL" in val or "15" in val or "LITRO" in val or "LT" in val)) or ("ORIGEN" in val and "VOL" in val) or val in ("VOL. ORIGEN", "VOL ORIGEN", "VOL. CARGA"):
                    col_map["vol_origen"] = c_idx
                elif ("RECEPCIONAD" in val and ("VOL" in val or "15" in val or "LITRO" in val or "LT" in val)) or ("DESCARGADO" in val and "VOL" in val) or val in ("VOL. RECEPCION", "VOL RECEPCION", "VOL. DESCARGA"):
                    col_map["vol_recepcion"] = c_idx
                elif ("FACTURAR" in val or "FACTURADO" in val) and ("VOL" in val or "M3" in val or "LITRO" in val or "LT" in val):
                    col_map["vol_facturado"] = c_idx
                elif "TARIFA" in val or ("FLETE" in val and ("BS" in val or "M3" in val or "US" in val) and "IMPORTE" not in val and "TOTAL" not in val):
                    col_map["tarifa"] = c_idx
                elif ("IMPORTE" in val or "TOTAL" in val) and ("FACTURAR" in val or "FLETE" in val or "BS" in val or "BOB" in val or "PAGAR" in val):
                    col_map["importe_total"] = c_idx
                elif "FECHA" in val and ("FACTURA" in val or "FAC" in val or "EMISION" in val) and "fecha_factura" not in col_map:
                    col_map["fecha_factura"] = c_idx
                elif ("FACTURA" in val or "FAC" in val) and not any(k in val for k in (
                    "FECHA", "EMITIDA", "EMPRESA", "CLIENTE", "IMPORTE", "TOTAL", "MONTO", "A FACTURAR",
                    "Y OTROS", "OTROS", "OBS", "ESTADO", "DETALLE", "TIPO", "COMENTARIO", "NOTA"
                )):
                    is_exact_nro = any(k in val for k in ("N°", "NRO", "NUMERO", "NUM", "N.", "#"))
                    if "nro_factura" not in col_map or is_exact_nro:
                        col_map["nro_factura"] = c_idx
                elif ("MIC" in val or "DTA" in val or "MCI" in val or "CRT" in val) and "FECHA" not in val:
                    col_map["mic_dta"] = c_idx
                elif ("MIC" in val or "DTA" in val) and "FECHA" in val:
                    col_map["fecha_mic"] = c_idx
                elif "CONTRATO" in val:
                    col_map["contrato"] = c_idx
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

def reconcile_sheet_fletes(clean_records: List[Dict[str, Any]], facturas_subtotales: Dict[str, Dict[str, Any]]) -> None:
    """
    Reconcilia facturas agrupadas para evitar la deriva por milésimas.
    Si una factura tiene subtotal en el Excel y la suma de sus viajes tiene una discrepancia
    menor a 0.05 Bs (por centavos o milésimas), absorbe la diferencia en el último viaje
    para que la suma sea 100% matemática y exacta.
    """
    fac_groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in clean_records:
        fac = r.get("nro_factura")
        if fac:
            k = str(fac).strip()
            if k not in fac_groups:
                fac_groups[k] = []
            fac_groups[k].append(r)

    for fac_num, r_list in fac_groups.items():
        sub_info = facturas_subtotales.get(fac_num)
        if not sub_info:
            continue
        subtotal_target = round(float(sub_info.get("subtotal_importe_bs", 0.0)), 2)
        if subtotal_target <= 0:
            continue
        sum_trips = round(sum(t.get("flete_total_bs", 0.0) for t in r_list), 2)
        diff = round(subtotal_target - sum_trips, 2)
        if 0 < abs(diff) <= 0.10 and r_list:
            last_r = r_list[-1]
            last_r["flete_total_bs"] = round(last_r["flete_total_bs"] + diff, 2)
            last_r["reconciliado_subtotal"] = True

def limpiar_datos_para_importacion(
    ws,
    sheet_title: str,
    target_empresa_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Algoritmo de limpieza y saneamiento de datos previo a la importación (función de segundo plano).
    - Identifica y aísla exclusivamente las columnas canónicas requeridas para la operación.
    - Elimina columnas auxiliares y ruidosas de manera parcial únicamente para la importación.
    - Desacopla las filas de subtotales de facturas para que no se confundan con viajes.
    - Previene errores por miles (escalamiento de unidades) y milésimas (deriva decimal).
    - Armoniza fechas con el año oficial de la hoja (sheet_year) para corregir errores de tipeo humano.
    """
    year_match = re.search(r'\b(20\d\d)\b', sheet_title)
    sheet_year = int(year_match.group(1)) if year_match else None

    sheet_upper = sheet_title.upper()
    detected_sheet_company = None
    if "DRIVER" in sheet_upper:
        detected_sheet_company = "DRIVER S.R.L."
    elif target_empresa_name:
        detected_sheet_company = target_empresa_name

    sample_rows = []
    for r in ws.iter_rows(values_only=True):
        sample_rows.append(r)
        if len(sample_rows) >= 15:
            break

    if not detected_sheet_company:
        for s_row in sample_rows:
            for c_cell in s_row:
                c_str = str(c_cell or "").upper()
                if "DRIVER" in c_str:
                    detected_sheet_company = "DRIVER S.R.L."
                    break
            if detected_sheet_company:
                break

    header_row_idx, col_map = detect_columns_and_header_row(sample_rows)
    if not header_row_idx or "placa" not in col_map:
        if ws.max_column and ws.max_column >= 18:
            header_row_idx = 4
            col_map = {
                "fecha_carga": 1, "fecha_descarga": 2, "mic_dta": 3, "placa": 4,
                "tramo": 5, "cliente": 6, "nro_factura": 7, "fecha_factura": 8,
                "producto": 9, "vol_origen": 10, "vol_recepcion": 11,
                "vol_facturado": 16, "tarifa": 17, "importe_total": 18
            }
        elif ws.max_column and ws.max_column >= 7:
            header_row_idx = 1
            col_map = {
                "empresa": 0, "producto": 1, "planta_carga": 2, "planta_descarga": 4,
                "placa": 5, "fecha_carga": 6, "fecha_descarga": 7, "vol_origen": 8,
                "vol_recepcion": 9, "vol_facturado": 15, "tarifa": 16,
                "importe_total": 17, "fecha_factura": 18, "nro_factura": 19, "mic_dta": 20
            }

    clean_records: List[Dict[str, Any]] = []
    facturas_subtotales: Dict[str, Dict[str, Any]] = {}
    facturas_trips_temp: Dict[str, List[Dict[str, Any]]] = {}
    sheet_grand_total: float = 0.0

    carrier_company = target_empresa_name or detected_sheet_company or "DRIVER S.R.L."
    has_two_separate_entity_columns = (
        col_map.get("empresa") is not None and 
        col_map.get("cliente") is not None and 
        col_map["empresa"] != col_map["cliente"]
    )

    last_seen_cliente: Optional[str] = None
    invoice_clients: Dict[str, str] = {}
    total_filas = 0
    consecutive_empty = 0

    for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
        if r_idx <= header_row_idx:
            continue

        if not any(c is not None and str(c).strip() != "" for c in row):
            consecutive_empty += 1
            if consecutive_empty >= 20:
                break
            continue
        consecutive_empty = 0
        total_filas += 1

        row_str = " ".join(str(c or "").upper() for c in row)
        if any(kw in row_str for kw in (
            "TOTAL VENTAS", "VENTAS NETAS", "V.N. SIN DERECHO", "V.B. CON DERECHO",
            "V.N. CON DERECHO", "DEBITO FISCAL", "DEBITO ", "CREDITO FISCAL", "RESUMEN GESTION"
        )):
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

        vol_o_raw = clean_float(get_c("vol_origen"), 0.0, hint="volume")
        vol_r_raw = clean_float(get_c("vol_recepcion"), 0.0, hint="volume")
        vol_f_raw = clean_float(get_c("vol_facturado"), 0.0, hint="volume")
        tarifa_raw = clean_float(get_c("tarifa"), 0.0, hint="currency")
        importe_raw = clean_float(get_c("importe_total"), 0.0, hint="currency")

        nro_fac_clean = clean_invoice_number(get_c("nro_factura"))
        mic_raw = clean_string(get_c("mic_dta"))
        contrato_raw = clean_string(get_c("contrato"))

        f_carga_raw = get_c("fecha_carga")
        f_descarga_raw = get_c("fecha_descarga")
        f_fac_raw = get_c("fecha_factura")

        placa_upper = placa_raw.upper().strip()
        col_a_raw = cliente_raw or empresa_raw
        col_a_upper = col_a_raw.upper().strip()

        fac_key = str(nro_fac_clean).strip() if nro_fac_clean else ""
        prev_trips = facturas_trips_temp.get(fac_key, []) if fac_key else []
        sum_prev_imp = sum(t.get("flete_total_bs", 0.0) for t in prev_trips)
        sum_prev_vol = sum(t.get("volumen_facturado_m3", 0.0) for t in prev_trips)

        has_plate = bool(placa_upper and placa_upper not in ("NONE", "NULL", "-", ""))
        is_subtotal_row = False

        if placa_upper in ("TOTAL", "SUBTOTAL", "RESUMEN", "SUMA") or col_a_upper in ("TOTAL", "SUBTOTAL", "RESUMEN", "SUMA"):
            is_subtotal_row = True
        elif not has_plate:
            if not col_a_upper or col_a_upper in ("NONE", "NULL", "-"):
                is_subtotal_row = True
            elif prev_trips and abs(importe_raw - sum_prev_imp) < 1.0 and importe_raw > 0:
                is_subtotal_row = True
            elif prev_trips and abs(vol_f_raw - sum_prev_vol) < 0.1 and vol_f_raw > 0:
                is_subtotal_row = True

        if is_subtotal_row:
            if fac_key and (importe_raw > 0 or vol_f_raw > 0):
                facturas_subtotales[fac_key] = {
                    "fila": r_idx,
                    "hoja": sheet_title,
                    "subtotal_vol_m3": vol_f_raw,
                    "subtotal_importe_bs": importe_raw
                }
            elif not fac_key and importe_raw > 1000:
                sheet_grand_total = importe_raw
            continue

        if not placa_upper and not col_a_upper and importe_raw == 0 and vol_f_raw == 0:
            continue

        is_sin_placa = not placa_upper or placa_upper in ("SIN PLACA", "SINPLACA", "FALTA PLACA", "FALTAPLACA", "S/P", "NONE", "NULL", "-")
        clean_placa = "SIN PLACA" if is_sin_placa else placa_upper.replace(" ", "")

        if has_two_separate_entity_columns:
            clean_empresa = normalize_company_name(empresa_raw) or carrier_company
            clean_cliente = normalize_company_name(cliente_raw)
        else:
            clean_empresa = carrier_company
            clean_cliente = normalize_company_name(col_a_raw)

        if not clean_cliente or clean_cliente in ("NONE", "NULL", "-", ""):
            if nro_fac_clean and str(nro_fac_clean).strip() in invoice_clients:
                clean_cliente = invoice_clients[str(nro_fac_clean).strip()]
            elif last_seen_cliente:
                clean_cliente = last_seen_cliente
            else:
                prod_u = clean_string(producto_raw).upper()
                if any(x in prod_u for x in ("BOBINA", "ACERO", "FIERRO", "BARRA", "PLANCHA", "PERFIL")):
                    clean_cliente = "CORPORACION ACEROS AREQUIPA S.A."
                elif any(x in prod_u for x in ("SOYA", "GIRASOL", "HARINA", "COMPENSACION", "ACEITE")):
                    clean_cliente = "INDUSTRIAS DE ACEITE S.A."
                elif any(x in prod_u for x in ("FERTILIZANTE", "BORATO", "UREA")):
                    clean_cliente = "FERTILIZANTES DE LOS ANDES S.R.L."
                elif any(x in prod_u for x in ("MINERAL", "CONCENTRADO", "PLOMO", "ZINC", "ESTAÑO")):
                    clean_cliente = "PRODECO S.R.L."
                elif any(x in prod_u for x in ("MALTA", "CEBADA")):
                    clean_cliente = "BOCKTRANS S.R.L."
                elif any(x in prod_u for x in ("DIESEL", "GASOLINA", "GLP", "CRUDO", "PETROLEO", "INSUMOS", "IYA")):
                    clean_cliente = "YPFB"
                else:
                    clean_cliente = "CLIENTE GENERAL"
        else:
            last_seen_cliente = clean_cliente
            if nro_fac_clean:
                invoice_clients[str(nro_fac_clean).strip()] = clean_cliente

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

        clean_prod = producto_raw.upper() if producto_raw else "DIESEL"

        date_fac = parse_date_value(f_fac_raw)
        date_carga_parsed = parse_date_value(f_carga_raw)
        date_descarga_parsed = parse_date_value(f_descarga_raw)

        # Si la hoja tiene año explícito (sheet_year), armonizar errores de tipeo de año
        if sheet_year:
            if date_carga_parsed and date_carga_parsed.year != sheet_year and abs(date_carga_parsed.year - sheet_year) <= 2:
                try:
                    date_carga_parsed = date(sheet_year, date_carga_parsed.month, date_carga_parsed.day)
                except Exception:
                    pass
            if date_descarga_parsed and date_descarga_parsed.year != sheet_year and abs(date_descarga_parsed.year - sheet_year) <= 2:
                try:
                    date_descarga_parsed = date(sheet_year, date_descarga_parsed.month, date_descarga_parsed.day)
                except Exception:
                    pass
            if date_fac and date_fac.year != sheet_year and abs(date_fac.year - sheet_year) <= 2:
                try:
                    date_fac = date(sheet_year, date_fac.month, date_fac.day)
                except Exception:
                    pass

        sin_fechas_operativas = (date_carga_parsed is None and date_descarga_parsed is None)
        date_carga = date_carga_parsed
        date_descarga = date_descarga_parsed

        if date_fac:
            periodo = f"{date_fac.year}-{str(date_fac.month).zfill(2)}"
        elif date_descarga_parsed:
            periodo = f"{date_descarga_parsed.year}-{str(date_descarga_parsed.month).zfill(2)}"
        elif date_carga_parsed:
            periodo = f"{date_carga_parsed.year}-{str(date_carga_parsed.month).zfill(2)}"
        elif sheet_year:
            periodo = f"{sheet_year}-01"
        else:
            periodo = determine_trip_period(date_carga, date_descarga, date_fac)

        if not date_carga:
            if date_descarga:
                date_carga = date_descarga
            elif date_fac:
                date_carga = date_fac
            elif sheet_year:
                m_int = int(periodo[5:7]) if len(periodo) >= 7 and periodo[5:7].isdigit() else 1
                date_carga = date(sheet_year, m_int, 1)
            else:
                date_carga = date.today()

        if not date_descarga:
            date_descarga = date_carga

        vol_o, vol_r, vol_f_litros, vol_m3 = normalize_volumes(vol_o_raw, vol_r_raw, vol_f_raw)

        tarifa = tarifa_raw
        if tarifa <= 0:
            if importe_raw > 0 and vol_m3 > 0:
                tarifa = round(importe_raw / vol_m3, 2)
            elif importe_raw > 0:
                tarifa = importe_raw
            else:
                tarifa = 392.00

        if importe_raw > 0:
            flete_calculado = round(importe_raw, 2)
        elif vol_m3 > 0 and tarifa > 0:
            flete_calculado = round(vol_m3 * tarifa, 2)
        else:
            flete_calculado = 0.0

        tipo_tarifa = "BS_TOTAL_VIAJE" if (vol_m3 == 0 and flete_calculado > 0) else "BS_POR_M3"

        clean_mic = mic_raw.upper().strip() if mic_raw and mic_raw.upper().strip() not in ("FALTA MIC", "SIN MIC", "NONE", "") else None
        clean_contrato = contrato_raw.strip() if contrato_raw and contrato_raw.strip() not in ("NONE", "NULL", "") else None

        if vol_o > 0 and vol_r > 0:
            m_real = round(vol_r - vol_o, 1)
            prod_u = clean_prod.upper()
            tol_pct = 0.25 if "GASOLINA" in prod_u else 0.15 if ("DIESEL" in prod_u or prod_u == "DO") else 0.0
            m_tol = round(vol_o * (tol_pct / 100.0), 1)
            m_exc = max(0.0, round(abs(m_real) - m_tol, 1)) if abs(m_real) > m_tol else 0.0
            m_desc_bs = round(m_exc * 7.45, 2)
        else:
            m_real = 0.0
            tol_pct = 0.0
            m_tol = 0.0
            m_exc = 0.0
            m_desc_bs = 0.0
        liq_pagable = round(flete_calculado - m_desc_bs, 2)

        rec = {
            "hoja": sheet_title,
            "fila_hoja": r_idx,
            "empresa": clean_empresa,
            "cliente": clean_cliente,
            "entidad_origen": col_a_raw or clean_cliente,
            "tipo_entidad": "cliente",
            "es_apoyo": False,
            "empresa_apoyo_nombre": None,
            "placa": clean_placa,
            "tramo": clean_tramo,
            "producto": clean_prod,
            "fecha_carga": date_carga.isoformat(),
            "fecha_descarga": date_descarga.isoformat(),
            "fecha_factura": date_fac.isoformat() if date_fac else None,
            "sin_fechas_operativas": sin_fechas_operativas,
            "fecha_asignada_de_factura": bool(sin_fechas_operativas and date_fac),
            "nro_factura": nro_fac_clean,
            "mic_dta": clean_mic,
            "contrato": clean_contrato,
            "volumen_origen_litros": vol_o,
            "volumen_recepcionado_litros": vol_r,
            "volumen_facturado": vol_f_litros,
            "volumen_facturado_m3": round(vol_m3, 3),
            "tarifa_flete": tarifa,
            "tipo_tarifa": tipo_tarifa,
            "flete_total_bs": flete_calculado,
            "merma_real_litros": m_real,
            "tolerancia_pct": tol_pct,
            "merma_tolerable_litros": m_tol,
            "merma_excedente_litros": m_exc,
            "merma_descontar_bs": m_desc_bs,
            "liquido_pagable_bs": liq_pagable,
            "periodo_mes": periodo,
            "is_incompleto": (flete_calculado <= 0 and vol_m3 <= 0),
            "incompleto_reason": "Volumen e Importe en 0" if (flete_calculado <= 0 and vol_m3 <= 0) else None,
            "status": "INCOMPLETO" if (flete_calculado <= 0 and vol_m3 <= 0) else "LISTO",
            "included": True
        }
        clean_records.append(rec)
        if nro_fac_clean:
            k = str(nro_fac_clean).strip()
            if k not in facturas_trips_temp:
                facturas_trips_temp[k] = []
            facturas_trips_temp[k].append(rec)

    reconcile_sheet_fletes(clean_records, facturas_subtotales)

    if sheet_grand_total > 0 and clean_records:
        current_sum = round(sum(r.get("flete_total_bs", 0.0) for r in clean_records), 2)
        diff_total = round(sheet_grand_total - current_sum, 2)
        if 0 < abs(diff_total) <= 0.50:
            clean_records[-1]["flete_total_bs"] = round(clean_records[-1]["flete_total_bs"] + diff_total, 2)

    discarded_cols = max(0, (ws.max_column or 0) - len(col_map))
    return {
        "records": clean_records,
        "facturas_subtotales": facturas_subtotales,
        "estadisticas_limpieza": {
            "filas_analizadas": total_filas,
            "filas_validas": len(clean_records),
            "subtotales_aislados": len(facturas_subtotales),
            "columnas_utiles_aisladas": list(col_map.keys()),
            "columnas_ruidosas_descartadas": discarded_cols,
            "sheet_year": sheet_year
        }
    }

def parse_excel_viajes_data(
    file_bytes: bytes,
    sheet_name: Optional[str] = None,
    session: Optional[Session] = None,
    db: Optional[Session] = None,
    asociacion_id: Optional[int] = None,
    max_preview_records: Optional[int] = None,
    target_empresa_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Lee, valida y procesa una hoja Excel de viajes integrando el motor de limpieza de fondo.
    """
    if isinstance(file_bytes, str):
        wb = openpyxl.load_workbook(file_bytes, read_only=True, data_only=True)
    elif isinstance(file_bytes, (bytes, bytearray)):
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    else:
        wb = openpyxl.load_workbook(file_bytes, read_only=True, data_only=True)
    sheets = list(wb.sheetnames)

    if not sheet_name or sheet_name in ("__ALL__", "ALL", "TODAS", "todas"):
        target_sheets = sheets
        selected_sheet_display = "__ALL__"
    elif sheet_name in sheets:
        target_sheets = [sheet_name]
        selected_sheet_display = sheet_name
    elif "," in sheet_name:
        target_sheets = [s.strip() for s in sheet_name.split(",") if s.strip() in sheets]
        if not target_sheets:
            target_sheets = sheets
        selected_sheet_display = sheet_name
    else:
        target_sheets = [sheets[0]]
        selected_sheet_display = sheets[0]

    valid_records: List[Dict[str, Any]] = []
    skipped_records: List[Dict[str, Any]] = []
    periodos_detectados = set()
    placas_detectadas = set()
    hojas_procesadas_stats: List[Dict[str, Any]] = []

    facturas_trips: Dict[str, List[Dict[str, Any]]] = {}
    facturas_subtotales: Dict[str, Dict[str, Any]] = {}

    total_vol_facturado_lt = 0.0
    total_flete_bs = 0.0
    global_fila_counter = 0

    for sheet_title in target_sheets:
        ws = wb[sheet_title]
        clean_res = limpiar_datos_para_importacion(ws, sheet_title, target_empresa_name)
        sheet_records = clean_res.get("records", [])
        sheet_subs = clean_res.get("facturas_subtotales", {})
        stats = clean_res.get("estadisticas_limpieza", {})

        facturas_subtotales.update(sheet_subs)

        for r in sheet_records:
            global_fila_counter += 1
            r["fila"] = global_fila_counter
            valid_records.append(r)

            total_vol_facturado_lt += r.get("volumen_facturado", 0.0)
            total_flete_bs += r.get("flete_total_bs", 0.0)

            if r.get("periodo_mes"):
                periodos_detectados.add(r["periodo_mes"])
            if r.get("placa") and r["placa"] != "SIN PLACA":
                placas_detectadas.add(r["placa"])

            fac = r.get("nro_factura")
            if fac:
                k = str(fac).strip()
                if k not in facturas_trips:
                    facturas_trips[k] = []
                facturas_trips[k].append(r)

        hojas_procesadas_stats.append({
            "hoja": sheet_title,
            "viajes": len(sheet_records),
            "anio": stats.get("sheet_year"),
            "subtotales_aislados": len(sheet_subs),
            "filas_analizadas": stats.get("filas_analizadas", 0)
        })

    wb.close()

    preview_items = valid_records[:max_preview_records] if max_preview_records else valid_records
    valid_placas = [p for p in placas_detectadas if p and p not in ("SIN PLACA", "SINPLACA", "FALTAPLACA", "TOTAL")]

    facturas_conciliacion = []
    for fac_num, trip_list in facturas_trips.items():
        sum_vol_m3 = round(sum(t.get("volumen_facturado_m3", 0.0) for t in trip_list), 3)
        sum_imp_bs = round(sum(t.get("flete_total_bs", 0.0) for t in trip_list), 2)
        f_date = trip_list[0].get("fecha_factura") if trip_list else None
        f_cliente = trip_list[0].get("cliente") if trip_list else ""
        f_empresa = trip_list[0].get("empresa") if trip_list else ""

        sub = facturas_subtotales.get(fac_num)
        if sub:
            subtotal_excel_bs = round(float(sub.get("subtotal_importe_bs", 0.0)), 2)
            diferencia_bs = round(abs(sum_imp_bs - subtotal_excel_bs), 2)
            cuadra = diferencia_bs <= 0.05
            tiene_subtotal_fila = True
        else:
            subtotal_excel_bs = sum_imp_bs
            diferencia_bs = 0.0
            cuadra = True
            tiene_subtotal_fila = False

        facturas_conciliacion.append({
            "nro_factura": fac_num,
            "fecha_factura": f_date,
            "cliente": f_cliente,
            "empresa": f_empresa,
            "total_viajes": len(trip_list),
            "total_volumen_m3": sum_vol_m3,
            "total_importe_bs": sum_imp_bs,
            "subtotal_excel_bs": subtotal_excel_bs,
            "diferencia_bs": diferencia_bs,
            "cuadra": cuadra,
            "tiene_subtotal_fila": tiene_subtotal_fila
        })

    facturas_conciliacion.sort(key=lambda x: str(x["nro_factura"]))

    from app.models.public import Empresa
    existing_empresas = db.query(Empresa).all() if db else []
    emp_lookup = {normalize_company_name(e.name): e for e in existing_empresas}

    empresas_stats: Dict[str, Dict[str, Any]] = {}
    clientes_stats: Dict[str, Dict[str, Any]] = {}

    for r in valid_records:
        cli_nom = r.get("cliente")
        if cli_nom:
            if cli_nom not in clientes_stats:
                clientes_stats[cli_nom] = {
                    "nombre": cli_nom,
                    "total_viajes": 0,
                    "total_volumen_m3": 0.0,
                    "total_flete_bs": 0.0
                }
            clientes_stats[cli_nom]["total_viajes"] += 1
            clientes_stats[cli_nom]["total_volumen_m3"] += r.get("volumen_facturado_m3", 0.0)
            clientes_stats[cli_nom]["total_flete_bs"] += r.get("flete_total_bs", 0.0)

        emp_nom = r.get("empresa")
        if emp_nom:
            if emp_nom not in empresas_stats:
                empresas_stats[emp_nom] = {
                    "nombre": emp_nom,
                    "total_viajes": 0,
                    "total_volumen_m3": 0.0,
                    "total_flete_bs": 0.0,
                    "placas": set()
                }
            empresas_stats[emp_nom]["total_viajes"] += 1
            empresas_stats[emp_nom]["total_volumen_m3"] += r.get("volumen_facturado_m3", 0.0)
            empresas_stats[emp_nom]["total_flete_bs"] += r.get("flete_total_bs", 0.0)
            if r.get("placa") and r["placa"] != "SIN PLACA":
                empresas_stats[emp_nom]["placas"].add(r["placa"])

    empresas_detectadas_list = []
    for emp_name, stats_e in sorted(empresas_stats.items()):
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
            "tipo_sugerido": "empresa",
            "action": action,
            "empresa_id": empresa_id,
            "schema_name": schema_name,
            "already_in_asociacion": already_in_asociacion,
            "total_viajes": stats_e["total_viajes"],
            "total_volumen_m3": round(stats_e["total_volumen_m3"], 3),
            "total_volumen_litros": round(stats_e["total_volumen_m3"] * 1000.0, 1),
            "total_flete_bs": round(stats_e["total_flete_bs"], 2),
            "cisternas_count": len(stats_e["placas"])
        })

    clientes_detectados_list = []
    for cli_name, stats_c in sorted(clientes_stats.items()):
        clientes_detectados_list.append({
            "nombre": cli_name,
            "tipo_sugerido": "cliente",
            "action": "registrar_cliente",
            "total_viajes": stats_c["total_viajes"],
            "total_volumen_m3": round(stats_c["total_volumen_m3"], 3),
            "total_volumen_litros": round(stats_c["total_volumen_m3"] * 1000.0, 1),
            "total_flete_bs": round(stats_c["total_flete_bs"], 2)
        })

    is_multi_empresa = len(empresas_stats) > 1

    return {
        "success": True,
        "sheets": sheets,
        "selected_sheet": selected_sheet_display,
        "hojas_procesadas": hojas_procesadas_stats,
        "total_hojas": len(sheets),
        "total_valid_rows": len(valid_records),
        "total_skipped_rows": len(skipped_records),
        "records": preview_items,
        "skipped_details": skipped_records[:100],
        "is_multi_empresa": is_multi_empresa,
        "empresas_detectadas": empresas_detectadas_list,
        "clientes_detectados": clientes_detectados_list,
        "facturas_conciliacion": facturas_conciliacion,
        "summary": {
            "total_viajes": len(valid_records),
            "viajes_listos": sum(1 for r in valid_records if not r.get("is_incompleto")),
            "viajes_incompletos": sum(1 for r in valid_records if r.get("is_incompleto")),
            "total_volumen_litros": round(total_vol_facturado_lt, 1),
            "total_volumen_m3": round(total_vol_facturado_lt / 1000.0, 3),
            "total_flete_bs": round(total_flete_bs, 2),
            "periodos_detectados": sorted(list(periodos_detectados)),
            "total_placas_unicas": len(valid_placas),
            "total_empresas_detectadas": len(empresas_detectadas_list),
            "total_clientes_detectados": len(clientes_detectados_list),
            "total_facturas_detectadas": len(facturas_conciliacion),
            "facturas_cuadran_100": all(f["cuadra"] for f in facturas_conciliacion),
            "total_hojas_procesadas": len(hojas_procesadas_stats)
        }
    }

def execute_import_viajes(
    records: List[Dict[str, Any]],
    session: Session,
    params: Optional[ParametroLiquidacion] = None,
    overwrite_duplicates: bool = False,
    target_grand_total: Optional[float] = None
) -> Dict[str, Any]:
    """
    Inserta o actualiza una lista de registros de viajes con total fidelidad aritmética.
    """
    if not params:
        params = session.query(ParametroLiquidacion).first() or ParametroLiquidacion()

    viajes_creados = 0
    viajes_actualizados = 0
    viajes_omitidos = 0
    clientes_registrados = 0
    errores: List[str] = []
    periodos_detectados: Set[str] = set()
    matched_existing_ids: Set[int] = set()

    unidades_db = session.query(UnidadTransporte).all()
    unidades_map = {u.placa.strip().upper(): u for u in unidades_db if u.placa}

    default_unit = session.query(UnidadTransporte).filter(UnidadTransporte.placa == "SIN PLACA").first()
    if not default_unit:
        first_active = session.query(UnidadTransporte).filter(UnidadTransporte.estado == "Activo").first()
        if first_active:
            default_unit = first_active
        else:
            default_unit = UnidadTransporte(
                placa="SIN PLACA",
                tipo_unidad="Camion Cisterna",
                capacidad_litros=35000.0,
                estado="Activo"
            )
            session.add(default_unit)
            session.flush()

    clientes_db = session.query(Cliente).all()
    clientes_map = {normalize_company_name(c.nombre): c for c in clientes_db if c.nombre}

    apoyo_db = session.query(EmpresaApoyo).all()
    apoyo_map = {normalize_company_name(a.nombre): a for a in apoyo_db if a.nombre}

    sorted_records = sorted(records, key=lambda x: (
        x.get("nro_factura") or "",
        x.get("fecha_carga") or "",
        x.get("fila", 0)
    ))

    # Si se especificó target_grand_total, verificar micro-deriva de centavos
    if target_grand_total is not None and target_grand_total > 0 and sorted_records:
        total_curr = sum(r.get("flete_total_bs", 0.0) for r in sorted_records if r.get("included") is not False)
        diff_centavos = round(target_grand_total - total_curr, 2)
        if 0 < abs(diff_centavos) <= 0.50:
            last_inc = [r for r in sorted_records if r.get("included") is not False][-1]
            last_inc["flete_total_bs"] = round(last_inc.get("flete_total_bs", 0.0) + diff_centavos, 2)

    for rec in sorted_records:
        if rec.get("included") is False:
            viajes_omitidos += 1
            continue

        try:
            placa_clean = (rec.get("placa") or "SIN PLACA").strip().upper()
            if not placa_clean or placa_clean in ("SIN PLACA", "SINPLACA", "FALTA PLACA", "FALTAPLACA", "S/P", "NONE", "NULL", "-"):
                placa_clean = "SIN PLACA"

            unidad = unidades_map.get(placa_clean)
            if not unidad:
                if placa_clean == "SIN PLACA":
                    unidad = default_unit
                else:
                    unidad = UnidadTransporte(
                        placa=placa_clean,
                        tipo_unidad="Camion Cisterna",
                        capacidad_litros=35000.0,
                        estado="Activo"
                    )
                    session.add(unidad)
                    session.flush()
                    unidades_map[placa_clean] = unidad

            cliente_name_norm = normalize_company_name(rec.get("cliente") or rec.get("empresa") or "CLIENTE GENERAL")
            if cliente_name_norm and cliente_name_norm not in clientes_map:
                nuevo_cli = Cliente(
                    nombre=cliente_name_norm,
                    nit=None,
                    is_active=True
                )
                session.add(nuevo_cli)
                session.flush()
                clientes_map[cliente_name_norm] = nuevo_cli
                clientes_registrados += 1
            cliente = clientes_map.get(cliente_name_norm).nombre if cliente_name_norm in clientes_map else cliente_name_norm

            es_apoyo = bool(rec.get("es_apoyo", False))
            emp_apoyo_nom = rec.get("empresa_apoyo_nombre")
            if es_apoyo and emp_apoyo_nom:
                emp_apoyo_norm = normalize_company_name(emp_apoyo_nom)
                if emp_apoyo_norm and emp_apoyo_norm not in apoyo_map:
                    nuevo_apoyo = EmpresaApoyo(
                        nombre=emp_apoyo_norm,
                        ci_nit=None,
                        is_active=True
                    )
                    session.add(nuevo_apoyo)
                    session.flush()
                    apoyo_map[emp_apoyo_norm] = nuevo_apoyo

            date_carga = parse_date_value(rec.get("fecha_carga")) or date.today()
            date_descarga = parse_date_value(rec.get("fecha_descarga")) or date_carga
            date_fac = parse_date_value(rec.get("fecha_factura"))
            periodo = rec.get("periodo_mes") or determine_trip_period(date_carga, date_descarga, date_fac)
            periodos_detectados.add(periodo)

            nro_fac = clean_invoice_number(rec.get("nro_factura"))
            mic_dta = rec.get("mic_dta")
            producto = rec.get("producto") or "DIESEL"
            tramo = rec.get("tramo") or "TRAMO NO ESPECIFICADO"
            origen = tramo.split("-")[0].strip() if "-" in tramo else tramo
            destino = tramo.split("-")[1].strip() if "-" in tramo else tramo

            vol_o = float(rec.get("volumen_origen_litros") or 0.0)
            vol_r = float(rec.get("volumen_recepcionado_litros") or 0.0)
            vol_f = float(rec.get("volumen_facturado") or (rec.get("volumen_facturado_m3", 0.0) * 1000.0) or vol_r or vol_o)
            tarifa = float(rec.get("tarifa_flete") or 392.00)
            flete_exacto = float(rec.get("flete_total_bs") or 0.0)
            tipo_t = rec.get("tipo_tarifa") or "BS_POR_M3"

            calc = calculate_viaje_values(
                volumen_origen_litros=vol_o,
                volumen_recepcionado_litros=vol_r,
                volumen_facturado=vol_f,
                tarifa_flete=tarifa,
                tipo_tarifa=tipo_t,
                producto=producto,
                params=params,
                flete_total_override=flete_exacto if flete_exacto > 0 else None
            )

            existente = None
            if not overwrite_duplicates:
                q = session.query(Viaje).filter(
                    Viaje.placa == unidad.placa,
                    Viaje.fecha_carga == date_carga,
                    Viaje.periodo_mes == periodo
                )
                if nro_fac:
                    q = q.filter(Viaje.nro_factura == nro_fac)
                elif mic_dta:
                    q = q.filter(Viaje.mic_dta == mic_dta)
                else:
                    q = q.filter(Viaje.fecha_descarga == date_descarga)

                matches = q.all()
                for m_cand in matches:
                    if m_cand.id not in matched_existing_ids:
                        existente = m_cand
                        break

            if existente:
                if overwrite_duplicates:
                    existente.cliente = cliente
                    existente.tramo = tramo
                    existente.nro_factura = nro_fac
                    existente.fecha_factura = date_fac
                    existente.producto = producto
                    existente.volumen_origen_litros = vol_o
                    existente.volumen_recepcionado_litros = vol_r
                    existente.volumen_facturado = calc["volumen_facturado"]
                    existente.merma_real_litros = calc["merma_real_litros"]
                    existente.tolerancia_pct = calc["tolerancia_pct"]
                    existente.merma_tolerable_litros = calc["merma_tolerable_litros"]
                    existente.merma_excedente_litros = calc["merma_excedente_litros"]
                    existente.precio_merma_litro_bs = calc["precio_merma_litro_bs"]
                    existente.merma_descontar_bs = calc["merma_descontar_bs"]
                    existente.tarifa_flete = tarifa
                    existente.tipo_tarifa = tipo_t
                    existente.flete_total_bs = calc["flete_total_bs"]
                    matched_existing_ids.add(existente.id)
                    viajes_actualizados += 1
                else:
                    viajes_omitidos += 1
                continue

            nuevo_viaje = Viaje(
                placa=unidad.placa,
                unidad_id=unidad.id,
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
                es_apoyo=es_apoyo,
                empresa_apoyo_nombre=emp_apoyo_nom if es_apoyo else None,
                empresa_apoyo_id=None,
                estado="Pendiente"
            )
            session.add(nuevo_viaje)
            session.flush()
            matched_existing_ids.add(nuevo_viaje.id)
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
        "clientes_registrados": clientes_registrados,
        "periodos_detectados": sorted(list(periodos_detectados)),
        "errores": errores
    }

def execute_import_asociacion_multi_empresa(
    records: List[Dict[str, Any]],
    db: Session,
    asociacion_id: Optional[int] = None,
    nueva_asociacion_nombre: Optional[str] = None,
    nueva_asociacion_sigla: Optional[str] = None,
    overwrite_duplicates: bool = False,
    entidades_clasificacion: Optional[Dict[str, str]] = None,
    empresa_principal_nombre: Optional[str] = None,
    target_grand_total: Optional[float] = None
) -> Dict[str, Any]:
    """
    Importa despachos distribuyéndolos entre múltiples empresas y clientes.
    """
    from app.models.public import Asociacion, Empresa
    from app.db.session import get_tenant_session, init_tenant_schema

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

    all_empresas = db.query(Empresa).all()
    emp_lookup = {normalize_company_name(e.name): e for e in all_empresas}

    main_empresa = None
    if empresa_principal_nombre:
        main_emp_norm = normalize_company_name(empresa_principal_nombre)
        main_empresa = emp_lookup.get(main_emp_norm)
    if not main_empresa and asoc:
        main_empresa = db.query(Empresa).filter(Empresa.asociacion_id == asoc.id).first()
    if not main_empresa and all_empresas:
        main_empresa = all_empresas[0]

    ent_map = entidades_clasificacion or {}

    records_by_company: Dict[str, List[Dict[str, Any]]] = {}
    clientes_encontrados: set = set()

    for r in records:
        if r.get("included") is False:
            continue

        emp_raw = r.get("empresa")
        cli_raw = r.get("cliente")
        ent_origen = r.get("entidad_origen") or emp_raw or ""

        ent_norm = normalize_company_name(ent_origen)
        clasificacion = ent_map.get(ent_norm) or r.get("tipo_entidad") or classify_entity_name(ent_norm)

        if clasificacion == "cliente":
            clientes_encontrados.add(ent_norm)
            r["cliente"] = ent_norm
            if main_empresa:
                target_comp_name = normalize_company_name(main_empresa.name)
            else:
                target_comp_name = normalize_company_name(empresa_principal_nombre or "EMPRESA PRINCIPAL")
            r["empresa"] = target_comp_name
        else:
            target_comp_name = normalize_company_name(emp_raw) if emp_raw else "EMPRESA ASOCIADA"

        if target_comp_name not in records_by_company:
            records_by_company[target_comp_name] = []
        records_by_company[target_comp_name].append(r)

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

    empresas_results = []
    total_importados_global = 0
    total_actualizados_global = 0
    total_creadas = 0
    total_reutilizadas = 0
    total_clientes_creados = 0

    for comp_name, comp_records in records_by_company.items():
        emp = emp_lookup.get(comp_name)
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
            base_schema = sanitize_schema_name(comp_name)
            schema_name = base_schema
            counter = 1
            while db.query(Empresa).filter(Empresa.schema_name == schema_name).first():
                schema_name = f"{base_schema}_{counter}"
                counter += 1

            emp = Empresa(
                name=comp_name,
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
            emp_lookup[comp_name] = emp

            init_tenant_schema(emp.schema_name)

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
                overwrite_duplicates=overwrite_duplicates,
                target_grand_total=target_grand_total
            )

            total_clientes_creados += res.get("clientes_registrados", 0)

            empresas_results.append({
                "empresa_id": emp.id,
                "empresa_name": emp.name,
                "schema_name": emp.schema_name,
                "accion": "creada" if is_new else "reutilizada",
                "total_viajes": len(comp_records),
                "importados": res["total_importados"],
                "actualizados": res["total_actualizados"],
                "omitidos": res["total_omitidos"],
                "clientes_registrados": res.get("clientes_registrados", 0),
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
        "total_clientes_creados": total_clientes_creados,
        "total_viajes_importados": total_importados_global,
        "total_viajes_actualizados": total_actualizados_global,
        "empresas_detalle": empresas_results,
        "message": f"Se procesaron con éxito {len(records_by_company)} empresas ({total_creadas} creadas, {total_reutilizadas} reutilizadas) y {total_clientes_creados} clientes registrados con un total de {total_importados_global} despachos en {asoc_name_display}."
    }
