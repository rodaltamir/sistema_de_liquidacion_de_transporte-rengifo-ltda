import io
import os
import re
import json
import base64
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from collections import defaultdict
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as OpenpyxlImage
from PIL import Image as PILImage
from app.services.calculation_engine import calculate_liquidacion_resumen

# -------------------------------------------------------------------------
# CONSTANTES TIPOGRÁFICAS Y ESTILOS VISUALES
# Idénticos a las planillas oficiales impresas (Fotos de referencia)
# -------------------------------------------------------------------------
FONT_FAMILY = "Arial"

FONT_MAIN_TITLE = Font(name=FONT_FAMILY, size=11, bold=True, underline="single", color="000000")
FONT_TITLE_REGULAR = Font(name=FONT_FAMILY, size=10, bold=False, color="000000")
FONT_TITLE_BOLD = Font(name=FONT_FAMILY, size=10, bold=True, color="000000")

FONT_HEADER = Font(name=FONT_FAMILY, size=8.5, bold=True, color="000000")
FONT_DATA_REGULAR = Font(name=FONT_FAMILY, size=8.5, bold=False, color="000000")
FONT_DATA_BOLD = Font(name=FONT_FAMILY, size=8.5, bold=True, color="000000")
FONT_TOTAL_MAIN = Font(name=FONT_FAMILY, size=9.5, bold=True, color="000000")
FONT_MUTED_LEGAL = Font(name=FONT_FAMILY, size=7.5, italic=True, color="334155")

# Rellenos sutiles idénticos a los formularios oficiales
FILL_HEADER = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")       # Blanco hueso / gris tenue
FILL_HEADER_ALT = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")   # Gris claro para agrupación
FILL_SHADED_GRAY = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")  # Sombreado de totales y tarjetas
FILL_TOTAL_ROW = PatternFill(start_color="CBD5E1", end_color="CBD5E1", fill_type="solid")    # Resaltado de total general
FILL_HIGHLIGHT_YELLOW = PatternFill(start_color="FEF08A", end_color="FEF08A", fill_type="solid") # Resaltado suave

# Bordes finos de imprenta
BORDER_THIN_BLACK = Border(
    left=Side(style='thin', color='000000'),
    right=Side(style='thin', color='000000'),
    top=Side(style='thin', color='000000'),
    bottom=Side(style='thin', color='000000')
)

BORDER_TOTAL_DOUBLE = Border(
    left=Side(style='thin', color='000000'),
    right=Side(style='thin', color='000000'),
    top=Side(style='thin', color='000000'),
    bottom=Side(style='double', color='000000')
)

MESES_ABREV = {
    1: "ene.", 2: "feb.", 3: "mar.", 4: "abr.", 5: "may.", 6: "jun.",
    7: "jul.", 8: "ago.", 9: "sep.", 10: "oct.", 11: "nov.", 12: "dic."
}

def format_fecha_bolivia(d_val: Any) -> str:
    """Formatea fecha a estilo boliviano (ej: 28-feb.-23)"""
    if not d_val:
        return ""
    if isinstance(d_val, str):
        try:
            d_val = datetime.strptime(d_val[:10], "%Y-%m-%d").date()
        except Exception:
            return d_val
    try:
        return f"{d_val.day}-{MESES_ABREV.get(d_val.month, str(d_val.month))}-{str(d_val.year)[-2:]}"
    except Exception:
        return str(d_val)

def format_periodo_label(periodo: str) -> str:
    """Formatea código YYYY-MM a mar.-22 o conserva el texto si es personalizado"""
    if not periodo:
        return ""
    if len(periodo) == 7 and periodo[4] == "-":
        try:
            y = periodo[:4]
            m = int(periodo[5:7])
            return f"{MESES_ABREV.get(m, str(m))}-{y[-2:]}"
        except Exception:
            return periodo
    return periodo

def parse_firma_entry(raw_val: str, default_name: str = "", default_cargo: str = ""):
    """
    Desglosa limpiamente el nombre y el cargo sin duplicarlos si vienen juntos como 'NOMBRE / CARGO'.
    """
    val = (raw_val or "").strip()
    if not val:
        return default_name, default_cargo
    if " / " in val:
        parts = val.split(" / ", 1)
        return parts[0].strip(), parts[1].strip()
    elif "/" in val:
        parts = val.split("/", 1)
        return parts[0].strip(), parts[1].strip()
    return val, default_cargo

def add_logo_to_worksheet(
    ws, 
    logo_base64: Optional[str] = None, 
    empresa_name: str = "", 
    cell_coord: str = "N1", 
    max_width: int = 160, 
    max_height: int = 55
):
    """
    Inserta el logotipo en la celda indicada respetando proporciones.
    Soporta imágenes importadas en base64, logos estáticos en disco o logo por defecto.
    """
    img_stream = None
    if logo_base64 and isinstance(logo_base64, str) and len(logo_base64) > 30:
        try:
            clean_b64 = logo_base64.split(",", 1)[1] if "," in logo_base64 else logo_base64
            img_stream = io.BytesIO(base64.b64decode(clean_b64))
        except Exception:
            img_stream = None

    if not img_stream:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        static_dir = os.path.join(base_dir, "..", "static")
        
        chax_path = os.path.join(static_dir, "chaxmana_logo.png")
        def_path = os.path.join(static_dir, "default_logo.png")
        
        if "CHAXMANA" in (empresa_name or "").upper() and os.path.exists(chax_path):
            try:
                img_stream = open(chax_path, "rb")
            except Exception:
                img_stream = None
        elif os.path.exists(def_path):
            try:
                img_stream = open(def_path, "rb")
            except Exception:
                img_stream = None

    if img_stream:
        try:
            pil_img = PILImage.open(img_stream)
            w, h = pil_img.size
            if w > 0 and h > 0:
                scale = min(max_width / w, max_height / h)
                new_w = max(1, int(w * scale))
                new_h = max(1, int(h * scale))
                
                out_io = io.BytesIO()
                pil_img.save(out_io, format="PNG")
                out_io.seek(0)
                
                xl_img = OpenpyxlImage(out_io)
                xl_img.width = new_w
                xl_img.height = new_h
                ws.add_image(xl_img, cell_coord)
        except Exception as e:
            print(f"Aviso: No se pudo adjuntar imagen de logo al Excel: {e}")

def adjust_column_widths(ws, min_widths: Dict[str, float]):
    """
    Ajusta dinámicamente el ancho de las columnas según su contenido real
    para evitar textos o palabras recortadas, excluyendo celdas combinadas anchas.
    """
    for col_let, min_w in min_widths.items():
        ws.column_dimensions[col_let].width = min_w

    # Recopilar celdas que pertenecen a combinaciones de múltiples columnas
    multi_col_cells = set()
    for rng in ws.merged_cells.ranges:
        if rng.max_col > rng.min_col:
            for r in range(rng.min_row, rng.max_row + 1):
                for c in range(rng.min_col, rng.max_col + 1):
                    multi_col_cells.add((r, c))

    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        curr_w = ws.column_dimensions[col_letter].width or 12
        max_len = 0
        for cell in col:
            if (cell.row, cell.column) in multi_col_cells:
                continue
            if cell.value is not None:
                if isinstance(cell.value, (int, float)):
                    val_str = f"{cell.value:,.2f}"
                else:
                    val_str = str(cell.value)
                val_lines = val_str.split("\n")
                for line in val_lines:
                    max_len = max(max_len, len(str(line).strip()))
        if max_len > 0:
            # Margen proporcional para evitar cualquier corte de palabras u oraciones
            needed_w = max(curr_w, min(int(max_len * 1.15) + 5, 55))
            ws.column_dimensions[col_letter].width = needed_w


# =========================================================================
# EXPORTACIÓN 1: LIQUIDACIÓN DE EMPRESA POR PLACA (FOTOS 2 Y 3)
# =========================================================================
def export_liquidacion_placa_excel(
    liquidacion: Any, 
    viajes: List[Any], 
    empresa: Dict[str, Any], 
    params: Any
) -> io.BytesIO:
    """
    Genera un archivo Excel (.xlsx) oficial multi-hoja con diseño idéntico a las fotos 2 y 3:
    - Pestaña 1: 'Liquidacion de Fletes' (Detalle de viajes por placa y merma)
    - Pestaña 2: 'Resumen Descuentos' (Deducciones y líquido pagable)
    """
    wb = openpyxl.Workbook()
    empresa_nombre = empresa.get("name", "EMPRESA DE TRANSPORTE")
    logo_b64 = empresa.get("logo_base64")
    periodo_fmt = format_periodo_label(str(liquidacion.periodo_mes or ""))

    # Datos de firma: REALIZADO POR se obtiene de liquidacion o parámetros; los demás quedan en blanco
    realizado_nom = ""
    if getattr(liquidacion, "firmas_json", None):
        try:
            f_data = json.loads(liquidacion.firmas_json)
            if isinstance(f_data, dict):
                realizado_nom = f_data.get("realizado_por") or ""
        except Exception:
            pass
    if not realizado_nom:
        realizado_nom = getattr(params, "firma_realizado_por", None) or "JAQUELINE LOVERA TIÑINI"

    realizado_nom, _ = parse_firma_entry(realizado_nom, "JAQUELINE LOVERA TIÑINI", "")

    revisado_nom = ""
    revisado_carg = ""
    autorizado_nom = ""
    autorizado_carg = ""
    cancelado_nom = ""
    cancelado_carg = ""

    # ---------------------------------------------------------------------
    # HOJA 1: DETALLE DE FLETES (FOTO 2)
    # ---------------------------------------------------------------------
    ws1 = wb.active
    ws1.title = "Liquidacion de Fletes"
    ws1.views.sheetView[0].showGridLines = True

    # 1. Cabecera Superior Izquierda
    ws1.merge_cells("A2:E2")
    ws1["A2"] = "LIQUIDACION DE FLETES"
    ws1["A2"].font = FONT_MAIN_TITLE
    ws1["A2"].alignment = Alignment(horizontal="left", vertical="center")

    ws1.merge_cells("A3:E3")
    ws1["A3"] = periodo_fmt
    ws1["A3"].font = FONT_TITLE_REGULAR
    ws1["A3"].alignment = Alignment(horizontal="left", vertical="center")

    ws1.merge_cells("A4:E4")
    placa_h1 = "TODAS LAS PLACAS (CONSOLIDADO GENERAL)" if str(liquidacion.placa).upper() == "TODAS" else str(liquidacion.placa)
    ws1["A4"] = f"PLACA   {placa_h1}"
    ws1["A4"].font = FONT_TITLE_BOLD
    ws1["A4"].alignment = Alignment(horizontal="left", vertical="center")

    # Nombre de Empresa centrado y elegante en el encabezado
    ws1.merge_cells("G2:N3")
    ws1["G2"] = empresa_nombre.upper()
    ws1["G2"].font = Font(name=FONT_FAMILY, size=12, bold=True, color="0F172A")
    ws1["G2"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # 2. Factor Merma Superior Derecha (Columna Q fila 4)
    factor_merma = getattr(params, 'precio_merma_general_bs', 7.45)
    c_factor = ws1.cell(row=4, column=17, value=factor_merma)
    c_factor.font = FONT_DATA_REGULAR
    c_factor.number_format = '0.00'
    c_factor.alignment = Alignment(horizontal="right", vertical="center")

    # 3. Logotipo en la Esquina Superior Derecha (Columna P-Q)
    add_logo_to_worksheet(ws1, logo_base64=logo_b64, empresa_name=empresa_nombre, cell_coord="P1", max_width=140, max_height=48)

    # 4. Encabezados de Columnas (Fila 6) - 17 Columnas oficiales (Facturación integrada en Fila Especial)
    headers_sheet1 = [
        "Nº",
        "FECHA DE\nCARGA",
        "FECHA DE\nDESCARGA",
        "MCI/DTA Nº\nY OTROS",
        "PLACA",
        "TRAMO",
        "CLIENTE",
        "PRODUCTO",
        "Volumen en\nLt. Origen",
        "Volumen\nRecepcionado/\nDescargado",
        "Merma\nT-T",
        "Total\nMerma Litros",
        "MERMA\n0,15% s/Volumen\n(Diesel 0.15%\nGasolina 0.35%)",
        "Merma a\nDescontar\nY.P.F.B.",
        "Volumen\nFacturado",
        "TARIFA\nBs.",
        "Total a pagar\nen Bob."
    ]

    header_row = 6
    ws1.row_dimensions[header_row].height = 52

    for col_idx, h_text in enumerate(headers_sheet1, 1):
        cell = ws1.cell(row=header_row, column=col_idx, value=h_text)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN_BLACK

    # 5. Agrupación y Ordenamiento de Viajes: Tramo -> Producto -> Nº Factura -> Fecha (antigua a más nueva)
    groups_dict = {}
    for v in viajes:
        t_key = str(getattr(v, "tramo", "") or "SIN TRAMO").strip().upper()
        p_key = str(getattr(v, "producto", "") or "SIN PRODUCTO").strip().upper()
        f_raw = str(getattr(v, "nro_factura", "") or "").strip().upper()
        f_key = f_raw if f_raw and f_raw != "-" else "S/F"
        grp_k = (t_key, p_key, f_key)
        if grp_k not in groups_dict:
            groups_dict[grp_k] = []
        groups_dict[grp_k].append(v)

    # Ordenar cronológicamente dentro de cada grupo
    for grp_k in groups_dict:
        groups_dict[grp_k].sort(key=lambda x: (str(getattr(x, "fecha_carga", "") or ""), getattr(x, "id", 0)))

    # Ordenar grupos cronológicamente por la fecha más antigua de sus viajes
    sorted_groups = sorted(
        groups_dict.items(),
        key=lambda item: (
            str(getattr(item[1][0], "fecha_carga", "") or "") if item[1] else "",
            item[0][0],
            item[0][1],
            item[0][2]
        )
    )

    curr_row = 7
    global_idx = 1
    total_vol_orig = 0.0
    total_vol_rec = 0.0
    total_vol_fact = 0.0
    total_merma_real = 0.0
    total_m_desc_bs = 0.0
    total_flete_bs = 0.0

    fill_subtotal = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    font_subtotal = Font(name=FONT_FAMILY, size=8.5, bold=True, color="78350F")

    for (t_key, p_key, f_key), grp_viajes in sorted_groups:
        grp_vol_orig = 0.0
        grp_vol_rec = 0.0
        grp_vol_fact = 0.0
        grp_merma_real = 0.0
        grp_m_desc = 0.0
        grp_flete = 0.0
        grp_tarifa = 0.0

        for v in grp_viajes:
            ws1.row_dimensions[curr_row].height = 21

            # Col 1: Nº
            c1 = ws1.cell(row=curr_row, column=1, value=global_idx)
            c1.alignment = Alignment(horizontal="center", vertical="center")
            global_idx += 1

            # Col 2: Fecha Carga
            c2 = ws1.cell(row=curr_row, column=2, value=format_fecha_bolivia(v.fecha_carga))
            c2.alignment = Alignment(horizontal="center", vertical="center")

            # Col 3: Fecha Descarga
            c3 = ws1.cell(row=curr_row, column=3, value=format_fecha_bolivia(v.fecha_descarga))
            c3.alignment = Alignment(horizontal="center", vertical="center")

            # Col 4: MCI/DTA Nº Y OTROS
            c4 = ws1.cell(row=curr_row, column=4, value=v.mic_dta or "-")
            c4.alignment = Alignment(horizontal="center", vertical="center")

            # Col 5: Placa
            c5 = ws1.cell(row=curr_row, column=5, value=v.placa)
            c5.alignment = Alignment(horizontal="center", vertical="center")

            # Col 6: Tramo
            c6 = ws1.cell(row=curr_row, column=6, value=v.tramo or "")
            c6.alignment = Alignment(horizontal="left", vertical="center")

            # Col 7: Cliente
            c7 = ws1.cell(row=curr_row, column=7, value=v.cliente or "YPFB")
            c7.alignment = Alignment(horizontal="center", vertical="center")

            # Col 8: Producto
            c8 = ws1.cell(row=curr_row, column=8, value=(v.producto or "").upper())
            c8.alignment = Alignment(horizontal="center", vertical="center")

            # Col 9: Volumen Origen
            v_orig = float(v.volumen_origen_litros or 0)
            grp_vol_orig += v_orig
            total_vol_orig += v_orig
            c9 = ws1.cell(row=curr_row, column=9, value=v_orig)
            c9.number_format = '#,##0'
            c9.alignment = Alignment(horizontal="right", vertical="center")

            # Col 10: Volumen Recepcionado/Descargado
            v_rec = float(v.volumen_recepcionado_litros or 0)
            grp_vol_rec += v_rec
            total_vol_rec += v_rec
            c10 = ws1.cell(row=curr_row, column=10, value=v_rec)
            c10.number_format = '#,##0'
            c10.alignment = Alignment(horizontal="right", vertical="center")

            # Col 11: Merma T-T (Merma Real)
            raw_m_real = float(v.merma_real_litros or 0)
            m_real = -abs(raw_m_real) if raw_m_real != 0 else 0.0
            grp_merma_real += m_real
            total_merma_real += m_real
            c11 = ws1.cell(row=curr_row, column=11, value=m_real)
            c11.number_format = '#,##0.0;-#,##0.0;0.0'
            c11.alignment = Alignment(horizontal="right", vertical="center")

            # Col 12: Total Merma Litros
            m_exc = float(v.merma_excedente_litros or 0)
            c12 = ws1.cell(row=curr_row, column=12, value=m_exc)
            c12.number_format = '#,##0.0'
            c12.alignment = Alignment(horizontal="right", vertical="center")

            # Col 13: Tolerancia
            tol_lts = float(v.merma_tolerable_litros or 0)
            c13 = ws1.cell(row=curr_row, column=13, value=tol_lts)
            c13.number_format = '#,##0'
            c13.alignment = Alignment(horizontal="center", vertical="center")

            # Col 14: Merma Descontar YPFB
            m_desc = float(v.merma_descontar_bs or 0)
            grp_m_desc += m_desc
            total_m_desc_bs += m_desc
            c14 = ws1.cell(row=curr_row, column=14, value=m_desc)
            c14.number_format = '#,##0.00'
            c14.alignment = Alignment(horizontal="right", vertical="center")

            # Col 15: Volumen Facturado (muestra en m³ con formato #,##0.00, calculado desde Litros / 1000)
            raw_v_fact = getattr(v, "volumen_facturado", None)
            if raw_v_fact is not None and float(raw_v_fact) > 0:
                v_fact_num = float(raw_v_fact)
                v_fact_m3 = (v_fact_num / 1000.0) if v_fact_num > 1000.0 else v_fact_num
            else:
                v_fact_m3 = round(v_rec / 1000.0, 3)

            grp_vol_fact += v_fact_m3
            total_vol_fact += v_fact_m3
            c15 = ws1.cell(row=curr_row, column=15, value=v_fact_m3)
            c15.number_format = '#,##0.00'
            c15.alignment = Alignment(horizontal="right", vertical="center")

            # Col 16: Tarifa Bs
            tarifa = float(v.tarifa_flete or 0)
            grp_tarifa = tarifa
            c16 = ws1.cell(row=curr_row, column=16, value=tarifa)
            c16.number_format = '#,##0.00'
            c16.alignment = Alignment(horizontal="right", vertical="center")

            # Col 17: Total a pagar en Bob.
            flete = float(v.flete_total_bs or 0)
            grp_flete += flete
            total_flete_bs += flete
            c17 = ws1.cell(row=curr_row, column=17, value=flete)
            c17.number_format = '#,##0.00'
            c17.alignment = Alignment(horizontal="right", vertical="center")

            for col_c in range(1, 18):
                ws1.cell(row=curr_row, column=col_c).font = FONT_DATA_REGULAR
                ws1.cell(row=curr_row, column=col_c).border = BORDER_THIN_BLACK

            curr_row += 1

        # FILA ESPECIAL: Subtotal del Grupo con Factura y Fecha
        nros_f = [str(getattr(x, "nro_factura", "") or "").strip() for x in grp_viajes if getattr(x, "nro_factura", None)]
        nros_f = [x for x in dict.fromkeys(nros_f) if x and x != "-"]
        fechas_f = [format_fecha_bolivia(getattr(x, "fecha_factura", None)) for x in grp_viajes if getattr(x, "fecha_factura", None)]
        fechas_f = [x for x in dict.fromkeys(fechas_f) if x and x != "-"]
        fac_label = ", ".join(nros_f) if nros_f else "S/F"
        fecha_label = ", ".join(fechas_f) if fechas_f else "-"

        subtotal_title = f"TOTAL {p_key}  |  FACTURA: {fac_label}  |  FECHA FACTURA: {fecha_label}"

        ws1.row_dimensions[curr_row].height = 23
        ws1.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=8)
        c_title = ws1.cell(row=curr_row, column=1, value=subtotal_title)
        c_title.alignment = Alignment(horizontal="left", vertical="center")

        ws1.cell(row=curr_row, column=9, value=grp_vol_orig).number_format = '#,##0'
        ws1.cell(row=curr_row, column=10, value=grp_vol_rec).number_format = '#,##0'
        ws1.cell(row=curr_row, column=11, value=grp_merma_real).number_format = '#,##0.0;-#,##0.0;0.0'
        ws1.cell(row=curr_row, column=12, value="")
        ws1.cell(row=curr_row, column=13, value="")
        ws1.cell(row=curr_row, column=14, value=grp_m_desc).number_format = '#,##0.00'
        ws1.cell(row=curr_row, column=15, value=grp_vol_fact).number_format = '#,##0.00'
        ws1.cell(row=curr_row, column=16, value=grp_tarifa).number_format = '#,##0.00'
        ws1.cell(row=curr_row, column=17, value=grp_flete).number_format = '#,##0.00'

        for col_c in range(1, 18):
            cell_sub = ws1.cell(row=curr_row, column=col_c)
            cell_sub.font = font_subtotal
            cell_sub.fill = fill_subtotal
            cell_sub.border = BORDER_THIN_BLACK
            if col_c >= 9:
                cell_sub.alignment = Alignment(horizontal="right", vertical="center")

        curr_row += 1

    # 6. Fila de Totales Generales de la Hoja 1
    ws1.row_dimensions[curr_row].height = 23
    ws1.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=8)
    c_tot_label = ws1.cell(row=curr_row, column=1, value="TOTAL GENERAL:")
    c_tot_label.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_orig = ws1.cell(row=curr_row, column=9, value=total_vol_orig or float(liquidacion.total_volumen_origen_litros or 0))
    c_tot_orig.number_format = '#,##0'
    c_tot_orig.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_rec = ws1.cell(row=curr_row, column=10, value=total_vol_rec or float(liquidacion.total_volumen_recepcionado_litros or 0))
    c_tot_rec.number_format = '#,##0'
    c_tot_rec.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_mreal = ws1.cell(row=curr_row, column=11, value=total_merma_real)
    c_tot_mreal.number_format = '#,##0.0;-#,##0.0;0.0'
    c_tot_mreal.alignment = Alignment(horizontal="right", vertical="center")

    ws1.cell(row=curr_row, column=12, value="")
    ws1.cell(row=curr_row, column=13, value="")

    c_tot_mdesc = ws1.cell(row=curr_row, column=14, value=total_m_desc_bs or float(liquidacion.desc_merma_bs or 0))
    c_tot_mdesc.number_format = '#,##0.00'
    c_tot_mdesc.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_vfact = ws1.cell(row=curr_row, column=15, value=total_vol_fact)
    c_tot_vfact.number_format = '#,##0.00'
    c_tot_vfact.alignment = Alignment(horizontal="right", vertical="center")

    ws1.cell(row=curr_row, column=16, value="")

    c_tot_pagar = ws1.cell(row=curr_row, column=17, value=total_flete_bs or float(liquidacion.flete_total_bruto_bs or 0))
    c_tot_pagar.number_format = '#,##0.00'
    c_tot_pagar.alignment = Alignment(horizontal="right", vertical="center")

    for col_c in range(1, 18):
        cell_tot = ws1.cell(row=curr_row, column=col_c)
        cell_tot.font = FONT_TOTAL_MAIN
        cell_tot.fill = FILL_SHADED_GRAY
        cell_tot.border = BORDER_TOTAL_DOUBLE

    # 7. Cuadro de Firmas Oficial (Abarca de Columna A a Q)
    sign_start_row = curr_row + 4
    ws1.row_dimensions[sign_start_row].height = 17
    ws1.row_dimensions[sign_start_row + 1].height = 18
    ws1.row_dimensions[sign_start_row + 2].height = 42

    panels_info = [
        ("A", "D", "", f" REALIZADO POR:\n\n   {realizado_nom}" if realizado_nom else " REALIZADO POR:"),
        ("E", "H", "", " REVISADO POR:"),
        ("I", "L", "", " AUTORIZADO POR:"),
        ("M", "Q", "", " CANCELADO POR:")
    ]

    for col_start, col_end, nom_val, _ in panels_info:
        if nom_val and nom_val.strip():
            ws1.merge_cells(f"{col_start}{sign_start_row}:{col_end}{sign_start_row}")
            c_nom = ws1[f"{col_start}{sign_start_row}"]
            c_nom.value = nom_val.strip()
            c_nom.font = Font(name=FONT_FAMILY, size=8.5, bold=True)
            c_nom.alignment = Alignment(horizontal="center", vertical="bottom")

    border_sign_underline = Border(bottom=Side(style='thin', color='000000'))
    for col_u in range(1, 18):
        ws1.cell(row=sign_start_row + 1, column=col_u).border = border_sign_underline

    row_tags = sign_start_row + 2
    for col_start, col_end, _, text_val in panels_info:
        ws1.merge_cells(f"{col_start}{row_tags}:{col_end}{row_tags}")
        cell_p = ws1[f"{col_start}{row_tags}"]
        cell_p.value = text_val
        cell_p.font = Font(name=FONT_FAMILY, size=8, bold=True)
        cell_p.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)

        c_s_idx = openpyxl.utils.column_index_from_string(col_start)
        c_e_idx = openpyxl.utils.column_index_from_string(col_end)
        for c_idx in range(c_s_idx, c_e_idx + 1):
            cell_box = ws1.cell(row=row_tags, column=c_idx)
            cell_box.border = Border(
                left=Side(style='thin', color='000000') if c_idx == c_s_idx else None,
                right=Side(style='thin', color='000000') if c_idx == c_e_idx else None,
                top=Side(style='thin', color='000000'),
                bottom=Side(style='thin', color='000000')
            )

    ws1.page_setup.orientation = ws1.ORIENTATION_LANDSCAPE
    ws1.page_setup.paperSize = ws1.PAPERSIZE_LETTER
    ws1.sheet_properties.pageSetUpPr.fitToPage = True
    ws1.page_setup.fitToWidth = 1
    ws1.page_setup.fitToHeight = 0
    ws1.print_options.horizontalCentered = True

    # Holgura de 2.0 cm en la parte superior para perforado y anillado
    ws1.page_margins.top = 0.8       # 0.8 pulgadas = 2.032 cm
    ws1.page_margins.bottom = 0.4    # 0.4 pulgadas = 1.0 cm
    ws1.page_margins.left = 0.4      # 0.4 pulgadas = 1.0 cm
    ws1.page_margins.right = 0.4     # 0.4 pulgadas = 1.0 cm
    ws1.page_margins.header = 0.3
    ws1.page_margins.footer = 0.3

    min_widths_sheet1 = {
        "A": 7.0, "B": 14.0, "C": 14.0, "D": 18.0, "E": 13.0,
        "F": 32.0, "G": 13.0, "H": 16.0, "I": 16.0, "J": 16.0,
        "K": 14.0, "L": 15.0, "M": 16.0, "N": 17.0, "O": 16.0,
        "P": 14.0, "Q": 19.0
    }
    adjust_column_widths(ws1, min_widths_sheet1)


    # ---------------------------------------------------------------------
    # HOJA 2: RESUMEN DE DESCUENTOS Y LÍQUIDO PAGABLE (FOTO 3)
    # Estructura alineada y centrada: Tabla y firmas ocupan columnas B a E
    # ---------------------------------------------------------------------
    ws2 = wb.create_sheet(title="Resumen Descuentos")
    ws2.views.sheetView[0].showGridLines = True

    # 1. Cabecera Superior Izquierda (Combinada en columnas B-C)
    ws2.merge_cells("B2:C2")
    ws2["B2"] = "LIQUIDACION DE FLETES"
    ws2["B2"].font = FONT_MAIN_TITLE
    ws2["B2"].alignment = Alignment(horizontal="left", vertical="center")

    ws2.merge_cells("B3:C3")
    ws2["B3"] = periodo_fmt
    ws2["B3"].font = FONT_TITLE_REGULAR
    ws2["B3"].alignment = Alignment(horizontal="left", vertical="center")

    ws2.merge_cells("B4:C4")
    placa_h2 = "TODAS LAS PLACAS (CONSOLIDADO GENERAL)" if str(liquidacion.placa).upper() == "TODAS" else str(liquidacion.placa)
    ws2["B4"] = f"PLACA   {placa_h2}"
    ws2["B4"].font = FONT_TITLE_BOLD
    ws2["B4"].alignment = Alignment(horizontal="left", vertical="center")

    # 2. Logotipo en la Esquina Superior Derecha (Alineado sobre columnas D-E)
    add_logo_to_worksheet(ws2, logo_base64=logo_b64, empresa_name=empresa_nombre, cell_coord="D1", max_width=165, max_height=55)

    # 3. Tabla de Deducciones (Alineada en columnas B a E)
    # B-C-D combinadas para DESCRIPCION (ancho generoso), E para TOTAL Bs
    r_res = 6
    ws2.row_dimensions[r_res].height = 24

    ws2.merge_cells("B{}:D{}".format(r_res, r_res))
    c_h_desc = ws2["B{}".format(r_res)]
    c_h_desc.value = "DESCRIPCION"
    c_h_desc.font = FONT_HEADER
    c_h_desc.fill = FILL_SHADED_GRAY
    c_h_desc.alignment = Alignment(horizontal="center", vertical="center")
    for col_x in range(2, 5):
        ws2.cell(row=r_res, column=col_x).border = BORDER_THIN_BLACK

    c_h_tot = ws2.cell(row=r_res, column=5, value="TOTAL Bs")
    c_h_tot.font = FONT_HEADER
    c_h_tot.fill = FILL_SHADED_GRAY
    c_h_tot.alignment = Alignment(horizontal="center", vertical="center")
    c_h_tot.border = BORDER_THIN_BLACK

    # Ítems oficiales de deducción
    deductions_items = [
        ("FLETE TOTAL", float(liquidacion.flete_total_bruto_bs or 0), True, False),
        ("Descuento por Merma", float(liquidacion.desc_merma_bs or 0), False, False),
        ("Descuento de Comisión 1 $us p/m3", float(liquidacion.desc_comision_usd_m3_bs or 0), False, False),
        ("Descuento de Comisión 7%", float(liquidacion.desc_comision_7pct_bs or 0), False, False),
        ("Descuento YPFB BOL-GART 7%", float(liquidacion.desc_comision_ypfb_bolgart_7pct_bs or 0), False, False),
        ("Descuento de Comisión 3%", float(liquidacion.desc_comision_3pct_bs or 0), False, False),
        ("Hojas de Ruta", float(liquidacion.desc_hojas_ruta_bs or 0), False, False),
        ("GPS", float(liquidacion.desc_gps_bs or 0), False, False),
        ("Anticipos y Otros 7%", float(liquidacion.desc_anticipos_otros_bs or 0), False, False),
    ]

    if liquidacion.desc_otros_ajustes_bs and float(liquidacion.desc_otros_ajustes_bs) != 0:
        deductions_items.append(("Otros Descuentos", float(liquidacion.desc_otros_ajustes_bs), False, False))

    deductions_items.append(("TOTAL DESCUENTO", float(liquidacion.total_descuentos_bs or 0), True, False))
    deductions_items.append(("LIQUIDO PAGABLE", float(liquidacion.liquido_pagable_bs or 0), True, True))

    for desc_label, val_amount, is_bold, is_highlight in deductions_items:
        r_res += 1
        ws2.row_dimensions[r_res].height = 20

        ws2.merge_cells("B{}:D{}".format(r_res, r_res))
        cell_lbl = ws2["B{}".format(r_res)]
        cell_lbl.value = desc_label
        cell_lbl.font = FONT_DATA_BOLD if is_bold else FONT_DATA_REGULAR
        cell_lbl.alignment = Alignment(horizontal="left", vertical="center")
        for col_x in range(2, 5):
            ws2.cell(row=r_res, column=col_x).border = BORDER_THIN_BLACK

        cell_val = ws2.cell(row=r_res, column=5, value=val_amount)
        cell_val.number_format = '#,##0.00'
        cell_val.font = FONT_TOTAL_MAIN if is_highlight else (FONT_DATA_BOLD if is_bold else FONT_DATA_REGULAR)
        cell_val.alignment = Alignment(horizontal="right", vertical="center")
        cell_val.border = BORDER_THIN_BLACK

    # 4. Cuadro de Firmas Oficial en Hoja 2 (Alineado simétricamente debajo de la tabla en columnas B, C, D, E)
    sign_row2 = r_res + 4
    ws2.row_dimensions[sign_row2].height = 17
    ws2.row_dimensions[sign_row2 + 1].height = 17
    ws2.row_dimensions[sign_row2 + 2].height = 42

    # Fila 1 de Firmas: Nombres sobre la línea
    if revisado_nom:
        ws2.cell(row=sign_row2, column=3, value=revisado_nom).font = Font(name=FONT_FAMILY, size=8.5, bold=True)
        ws2.cell(row=sign_row2, column=3).alignment = Alignment(horizontal="center", vertical="bottom")

    if cancelado_nom:
        ws2.cell(row=sign_row2, column=5, value=cancelado_nom).font = Font(name=FONT_FAMILY, size=8.5, bold=True)
        ws2.cell(row=sign_row2, column=5).alignment = Alignment(horizontal="center", vertical="bottom")

    # Fila 2 de Firmas: Cargos (si existen) y Línea de firma continua
    if revisado_carg and revisado_carg.strip():
        ws2.cell(row=sign_row2 + 1, column=3, value=revisado_carg.strip()).font = Font(name=FONT_FAMILY, size=7.5, bold=False)
        ws2.cell(row=sign_row2 + 1, column=3).alignment = Alignment(horizontal="center", vertical="top")

    if cancelado_carg and cancelado_carg.strip():
        ws2.cell(row=sign_row2 + 1, column=5, value=cancelado_carg.strip()).font = Font(name=FONT_FAMILY, size=7.5, bold=False)
        ws2.cell(row=sign_row2 + 1, column=5).alignment = Alignment(horizontal="center", vertical="top")

    # Línea de firma en la base de la fila sign_row2 + 1
    border_sign_underline = Border(bottom=Side(style='thin', color='000000'))
    for col_u in range(2, 6):
        ws2.cell(row=sign_row2 + 1, column=col_u).border = border_sign_underline

    # Fila 3 de Firmas: Cuadros Oficiales en columnas B, C, D, E (Títulos en esquina superior izquierda)
    row_tags2 = sign_row2 + 2
    panels_info2 = [
        (2, f" REALIZADO POR:\n\n   {realizado_nom}" if realizado_nom else " REALIZADO POR:"),
        (3, " REVISADO POR:"),
        (4, " AUTORIZADO POR:"),
        (5, " CANCELADO POR:")
    ]

    for col_idx, text_val in panels_info2:
        cell_p = ws2.cell(row=row_tags2, column=col_idx, value=text_val)
        cell_p.font = Font(name=FONT_FAMILY, size=8, bold=True)
        cell_p.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        cell_p.border = BORDER_THIN_BLACK

    # Configuración de página horizontal y centrada para impresión
    ws2.page_setup.orientation = ws2.ORIENTATION_LANDSCAPE
    ws2.page_setup.paperSize = ws2.PAPERSIZE_LETTER
    ws2.sheet_properties.pageSetUpPr.fitToPage = True
    ws2.page_setup.fitToWidth = 1
    ws2.page_setup.fitToHeight = 0
    ws2.print_options.horizontalCentered = True

    # Holgura de 2.0 cm en la parte superior para perforado y anillado
    ws2.page_margins.top = 0.8       # 0.8 pulgadas = 2.032 cm
    ws2.page_margins.bottom = 0.4    # 0.4 pulgadas = 1.0 cm
    ws2.page_margins.left = 0.4      # 0.4 pulgadas = 1.0 cm
    ws2.page_margins.right = 0.4     # 0.4 pulgadas = 1.0 cm
    ws2.page_margins.header = 0.3
    ws2.page_margins.footer = 0.3

    # Anchos armónicos para Hoja 2
    min_widths_sheet2 = {
        "A": 4.0, "B": 28.0, "C": 28.0, "D": 26.0, "E": 26.0
    }
    adjust_column_widths(ws2, min_widths_sheet2)


    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


# =========================================================================
# EXPORTACIÓN 2: LIQUIDACIÓN GENERAL ASOCIACIÓN (FOTO 1)
# =========================================================================
def export_liquidacion_asociacion_excel(
    asociacion_name: str, 
    periodo_mes: str, 
    grupos_empresa: List[Dict[str, Any]]
) -> io.BytesIO:
    """
    Genera un archivo Excel (.xlsx) oficial multi-empresa idéntico a la Foto 1:
    - Encabezado Institucional: Gerencia GPDI / DOP / UPCA
    - Título: LIQUIDACIÓN OFICIAL y Cláusula de Conciliación
    - Periodo de Descarga en esquina superior derecha
    - Cabecera agrupada con super-encabezado 'Datos'
    - Subtotales por Producto (ej. Total DO, Total IEA)
    - Subtotales por Empresa (ej. Total BRITANIC S.R.L.)
    - Total General Asociación y Cláusula Legal de la Ley 843
    - Ajuste responsivo de columnas
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Liquidacion Oficial"
    ws.views.sheetView[0].showGridLines = True

    # 1. Encabezado Institucional (Foto 1: Esquina superior izquierda)
    ws.row_dimensions[1].height = 45
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 18
    ws.row_dimensions[4].height = 18
    ws.row_dimensions[5].height = 24

    add_logo_to_worksheet(ws, logo_base64=None, empresa_name=asociacion_name, cell_coord="A1", max_width=110, max_height=38)

    ws.merge_cells("A2:D2")
    ws["A2"] = "Gerencia de Productos Derivados e Industrializados - GPDI"
    ws["A2"].font = Font(name=FONT_FAMILY, size=7.5, bold=True, color="334155")
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center")

    ws.merge_cells("A3:D3")
    ws["A3"] = "Dirección de Operaciones - DOP"
    ws["A3"].font = Font(name=FONT_FAMILY, size=7.5, bold=True, color="334155")
    ws["A3"].alignment = Alignment(horizontal="left", vertical="center")

    ws.merge_cells("A4:D4")
    ws["A4"] = "Unidad de Pagos, Conciliaciones y Aduanas - UPCA"
    ws["A4"].font = Font(name=FONT_FAMILY, size=7.5, bold=True, color="334155")
    ws["A4"].alignment = Alignment(horizontal="left", vertical="center")

    # 2. Título Central (Foto 1)
    ws.merge_cells("E2:K2")
    ws["E2"] = "LIQUIDACIÓN OFICIAL"
    ws["E2"].font = Font(name=FONT_FAMILY, size=12, bold=True, color="000000")
    ws["E2"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("E3:K3")
    periodo_upper = str(periodo_mes or "GENERAL").upper()
    ws["E3"] = f"(A LA FINALIZACIÓN DE LA PRESTACIÓN DEL SERVICIO DEL PERIODO {periodo_upper} Y DESPUÉS DE REALIZADA LA CONCILIACIÓN)"
    ws["E3"].font = Font(name=FONT_FAMILY, size=8, bold=True, italic=True, color="334155")
    ws["E3"].alignment = Alignment(horizontal="center", vertical="center")

    # 3. Periodo de Descarga (Esquina superior derecha)
    ws.merge_cells("L2:O2")
    ws["L2"] = f"Periodo de Descarga: {format_periodo_label(periodo_mes)}"
    ws["L2"].font = Font(name=FONT_FAMILY, size=9, bold=True, color="000000")
    ws["L2"].alignment = Alignment(horizontal="right", vertical="center")

    # 4. Nombre de la Asociación (Encima de la tabla)
    ws.merge_cells("A5:F5")
    ws["A5"] = asociacion_name.upper()
    ws["A5"].font = Font(name=FONT_FAMILY, size=9.5, bold=True, color="000000")
    ws["A5"].alignment = Alignment(horizontal="left", vertical="center")

    # 5. Encabezados de la Tabla con Super-Encabezado 'Datos' (Filas 6 y 7 de la Foto 1)
    ws.row_dimensions[6].height = 22
    ws.row_dimensions[7].height = 36

    # Columnas 1 a 7 combinadas verticalmente en filas 6-7
    cols_left = [
        (1, "LOTE"),
        (2, "Empresa Transporte"),
        (3, "Tramo"),
        (4, "Producto"),
        (5, "Placa"),
        (6, "Fecha Carga"),
        (7, "Fecha Recepción")
    ]
    for c_idx, lbl in cols_left:
        ws.merge_cells(start_row=6, start_column=c_idx, end_row=7, end_column=c_idx)
        c_cell = ws.cell(row=6, column=c_idx, value=lbl)
        c_cell.font = FONT_HEADER
        c_cell.fill = FILL_HEADER
        c_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for r_x in [6, 7]:
            ws.cell(row=r_x, column=c_idx).border = BORDER_THIN_BLACK

    # Super-encabezado 'Datos' en columnas 8 a 15
    ws.merge_cells("H6:O6")
    c_datos = ws["H6"]
    c_datos.value = "Datos"
    c_datos.font = FONT_HEADER
    c_datos.fill = FILL_HEADER
    c_datos.alignment = Alignment(horizontal="center", vertical="center")
    for c_x in range(8, 16):
        ws.cell(row=6, column=c_x).border = BORDER_THIN_BLACK

    # Sub-encabezados de la fila 7
    subheaders_datos = [
        (8, "Volumen Despachado\n15.56°(lts)"),
        (9, "Volumen Recepcionado\n15.56°(lts)"),
        (10, "Merma Conforme\n(lts)"),
        (11, "Precio Merma\n(Bs/litro)"),
        (12, "Merma a Descontar\n(Bs)"),
        (13, "Volumen a Facturar\n(m3)"),
        (14, "Flete\n(Bs/m3)"),
        (15, "Importe a Facturar\n(Bs)")
    ]
    for c_idx, sub_lbl in subheaders_datos:
        c_sub = ws.cell(row=7, column=c_idx, value=sub_lbl)
        c_sub.font = FONT_HEADER
        c_sub.fill = FILL_HEADER
        c_sub.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c_sub.border = BORDER_THIN_BLACK

    # 6. Agrupación y Filas de Datos (Foto 1)
    current_row = 8
    tot_general_desp = 0.0
    tot_general_rec = 0.0
    tot_general_mconf = 0.0
    tot_general_mdesc = 0.0
    tot_general_m3 = 0.0
    tot_general_imp = 0.0

    for grp in grupos_empresa:
        empresa_name = grp.get("empresa_name", "")
        viajes = grp.get("viajes", [])

        # Agrupar viajes por producto unificando Gasolina y Diesel bajo DO
        prod_dict: Dict[str, List[Any]] = {}
        for v in viajes:
            p_raw = str(v.get("producto") or "").strip().upper()
            if any(k in p_raw for k in ["DIESEL", "GASOLINA", "DO", "GE", "COMBUSTIBLE"]):
                p_key = "DO"
            elif any(k in p_raw for k in ["INSUMO", "ADITIV", "IYA"]):
                p_key = "IYA"
            elif p_raw:
                p_key = p_raw
            else:
                p_key = "DO"
            prod_dict.setdefault(p_key, []).append(v)

        emp_desp = 0.0
        emp_rec = 0.0
        emp_mconf = 0.0
        emp_mdesc = 0.0
        emp_m3 = 0.0
        emp_imp = 0.0

        for prod_name, p_viajes in prod_dict.items():
            prod_desp = 0.0
            prod_rec = 0.0
            prod_mconf = 0.0
            prod_mdesc = 0.0
            prod_m3 = 0.0
            prod_imp = 0.0

            for v in p_viajes:
                ws.row_dimensions[current_row].height = 19

                # 1 LOTE
                c_lote = ws.cell(row=current_row, column=1, value=v.get("lote_codigo", 1))
                c_lote.alignment = Alignment(horizontal="center", vertical="center")

                # 2 Empresa
                c_emp = ws.cell(row=current_row, column=2, value=empresa_name)
                c_emp.alignment = Alignment(horizontal="left", vertical="center")

                # 3 Tramo
                c_tr = ws.cell(row=current_row, column=3, value=v.get("tramo", ""))
                c_tr.alignment = Alignment(horizontal="left", vertical="center")

                # 4 Producto
                c_pr = ws.cell(row=current_row, column=4, value=prod_name)
                c_pr.alignment = Alignment(horizontal="center", vertical="center")

                # 5 Placa
                c_pl = ws.cell(row=current_row, column=5, value=v.get("placa", ""))
                c_pl.alignment = Alignment(horizontal="center", vertical="center")

                # 6 Fecha Carga
                c_fc = ws.cell(row=current_row, column=6, value=format_fecha_bolivia(v.get("fecha_carga")))
                c_fc.alignment = Alignment(horizontal="center", vertical="center")

                # 7 Fecha Recepción
                c_fr = ws.cell(row=current_row, column=7, value=format_fecha_bolivia(v.get("fecha_descarga")))
                c_fr.alignment = Alignment(horizontal="center", vertical="center")

                # 8 Volumen Despachado
                v_desp = float(v.get("volumen_origen_litros") or 0)
                prod_desp += v_desp
                c_vd = ws.cell(row=current_row, column=8, value=v_desp)
                c_vd.number_format = '#,##0'
                c_vd.alignment = Alignment(horizontal="right", vertical="center")

                # 9 Volumen Recepcionado
                v_rec = float(v.get("volumen_recepcionado_litros") or 0)
                prod_rec += v_rec
                c_vr = ws.cell(row=current_row, column=9, value=v_rec)
                c_vr.number_format = '#,##0'
                c_vr.alignment = Alignment(horizontal="right", vertical="center")

                # 10 Merma Conforme (Lts)
                v_mc = float(v.get("merma_real_litros") or 0)
                prod_mconf += v_mc
                c_mc = ws.cell(row=current_row, column=10, value=v_mc)
                c_mc.number_format = '#,##0'
                c_mc.alignment = Alignment(horizontal="right", vertical="center")

                # 11 Precio Merma (Bs/L)
                p_m = float(v.get("precio_merma_litro_bs") or 7.45)
                c_pm = ws.cell(row=current_row, column=11, value=p_m)
                c_pm.number_format = '#,##0.000000' if p_m != int(p_m) else '#,##0.00'
                c_pm.alignment = Alignment(horizontal="right", vertical="center")

                # 12 Merma a Descontar (Bs)
                v_md = float(v.get("merma_descontar_bs") or 0)
                prod_mdesc += v_md
                c_md = ws.cell(row=current_row, column=12, value=v_md)
                c_md.number_format = '#,##0.00'
                c_md.alignment = Alignment(horizontal="right", vertical="center")

                # 13 Volumen a Facturar (m3) - Calculado desde Volumen Facturado en Lt / 1000
                v_f = v.get("volumen_facturado")
                if v_f is not None and float(v_f) > 0:
                    val_f = float(v_f)
                    v_fact_lt = val_f * 1000.0 if val_f < 1000.0 else val_f
                    v_m3 = round(v_fact_lt / 1000.0, 3)
                else:
                    v_m3 = float(v.get("volumen_facturar_m3") or (v_rec / 1000.0))
                prod_m3 += v_m3
                c_m3 = ws.cell(row=current_row, column=13, value=v_m3)
                c_m3.number_format = '#,##0.000'
                c_m3.alignment = Alignment(horizontal="right", vertical="center")

                # 14 Flete (Bs/m3)
                v_tar = float(v.get("tarifa_flete") or 0)
                c_tar = ws.cell(row=current_row, column=14, value=v_tar)
                c_tar.number_format = '#,##0.00'
                c_tar.alignment = Alignment(horizontal="right", vertical="center")

                # 15 Importe a Facturar (Bs)
                v_imp = float(v.get("flete_total_bs") or 0)
                if v_imp == 0 and v_tar > 0:
                    v_imp = round(v_m3 * v_tar, 2)
                prod_imp += v_imp
                c_imp = ws.cell(row=current_row, column=15, value=v_imp)
                c_imp.number_format = '#,##0.00'
                c_imp.alignment = Alignment(horizontal="right", vertical="center")

                for cc in range(1, 16):
                    ws.cell(row=current_row, column=cc).font = FONT_DATA_REGULAR
                    ws.cell(row=current_row, column=cc).border = BORDER_THIN_BLACK

                current_row += 1

            # Subtotal por Producto (ej. 'Total DO')
            ws.row_dimensions[current_row].height = 20
            ws.cell(row=current_row, column=4, value=f"Total {prod_name}").font = FONT_DATA_BOLD
            ws.cell(row=current_row, column=4).alignment = Alignment(horizontal="center", vertical="center")

            ws.cell(row=current_row, column=8, value=prod_desp).number_format = '#,##0'
            ws.cell(row=current_row, column=9, value=prod_rec).number_format = '#,##0'
            ws.cell(row=current_row, column=10, value=prod_mconf).number_format = '#,##0'
            ws.cell(row=current_row, column=12, value=prod_mdesc).number_format = '#,##0.00'
            ws.cell(row=current_row, column=13, value=prod_m3).number_format = '#,##0.000'
            ws.cell(row=current_row, column=15, value=prod_imp).number_format = '#,##0.00'

            for cc in range(1, 16):
                cell_p = ws.cell(row=current_row, column=cc)
                cell_p.font = FONT_DATA_BOLD
                cell_p.border = BORDER_THIN_BLACK

            emp_desp += prod_desp
            emp_rec += prod_rec
            emp_mconf += prod_mconf
            emp_mdesc += prod_mdesc
            emp_m3 += prod_m3
            emp_imp += prod_imp
            current_row += 1

        # Subtotal por Empresa (ej. 'Total EMPRESA DE TRANSPORTES...')
        ws.row_dimensions[current_row].height = 21
        ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=3)
        c_tot_emp = ws.cell(row=current_row, column=1, value=f"Total {empresa_name}")
        c_tot_emp.font = FONT_DATA_BOLD
        c_tot_emp.alignment = Alignment(horizontal="left", vertical="center")

        ws.cell(row=current_row, column=8, value=emp_desp).number_format = '#,##0'
        ws.cell(row=current_row, column=9, value=emp_rec).number_format = '#,##0'
        ws.cell(row=current_row, column=10, value=emp_mconf).number_format = '#,##0'
        ws.cell(row=current_row, column=12, value=emp_mdesc).number_format = '#,##0.00'
        ws.cell(row=current_row, column=13, value=emp_m3).number_format = '#,##0.000'
        ws.cell(row=current_row, column=15, value=emp_imp).number_format = '#,##0.00'

        for cc in range(1, 16):
            cell_e = ws.cell(row=current_row, column=cc)
            cell_e.font = FONT_DATA_BOLD
            cell_e.fill = FILL_SHADED_GRAY
            cell_e.border = BORDER_THIN_BLACK

        tot_general_desp += emp_desp
        tot_general_rec += emp_rec
        tot_general_mconf += emp_mconf
        tot_general_mdesc += emp_mdesc
        tot_general_m3 += emp_m3
        tot_general_imp += emp_imp
        current_row += 1

    # 7. Total General de la Asociación (Foto 1)
    ws.row_dimensions[current_row].height = 24
    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=7)
    c_tot_gen = ws.cell(row=current_row, column=1, value="Total general")
    c_tot_gen.font = FONT_TOTAL_MAIN
    c_tot_gen.alignment = Alignment(horizontal="left", vertical="center")

    ws.cell(row=current_row, column=8, value=tot_general_desp).number_format = '#,##0'
    ws.cell(row=current_row, column=9, value=tot_general_rec).number_format = '#,##0'
    ws.cell(row=current_row, column=10, value=tot_general_mconf).number_format = '#,##0'
    ws.cell(row=current_row, column=12, value=tot_general_mdesc).number_format = '#,##0.00'
    ws.cell(row=current_row, column=13, value=tot_general_m3).number_format = '#,##0.000'
    ws.cell(row=current_row, column=15, value=tot_general_imp).number_format = '#,##0.00'

    for cc in range(1, 16):
        cell_g = ws.cell(row=current_row, column=cc)
        cell_g.font = FONT_TOTAL_MAIN
        cell_g.fill = FILL_TOTAL_ROW
        cell_g.border = BORDER_TOTAL_DOUBLE

    # 8. Cláusulas y Leyendas Inferiores (Foto 1)
    current_row += 2
    ws.cell(row=current_row, column=1, value="DO = Diesel").font = FONT_DATA_BOLD
    current_row += 1
    ws.cell(row=current_row, column=1, value="IYA = Insumos y Aditivos").font = FONT_DATA_BOLD

    current_row += 1
    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row + 1, end_column=15)
    ws.row_dimensions[current_row].height = 22
    ws.row_dimensions[current_row + 1].height = 22
    c_ley = ws.cell(
        row=current_row, 
        column=1, 
        value="Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación."
    )
    c_ley.font = FONT_MUTED_LEGAL
    c_ley.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

    # Configuración de página horizontal y centrada para impresión
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_options.horizontalCentered = True

    # Holgura de 2.0 cm en la parte superior para perforado y anillado
    ws.page_margins.top = 0.8       # 0.8 pulgadas = 2.032 cm
    ws.page_margins.bottom = 0.4    # 0.4 pulgadas = 1.0 cm
    ws.page_margins.left = 0.4      # 0.4 pulgadas = 1.0 cm
    ws.page_margins.right = 0.4     # 0.4 pulgadas = 1.0 cm
    ws.page_margins.header = 0.3
    ws.page_margins.footer = 0.3

    # Anchos responsivos base para la planilla de Asociación
    min_widths_asoc = {
        "A": 7, "B": 30, "C": 34, "D": 12, "E": 14,
        "F": 15, "G": 15, "H": 18, "I": 18, "J": 14,
        "K": 14, "L": 17, "M": 16, "N": 14, "O": 19
    }
    adjust_column_widths(ws, min_widths_asoc)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


# =========================================================================
# =========================================================================
# EXPORTACIÓN 3: PLANTILLA Y EXPORTACIÓN OFICIAL DE CARGA DE VIAJES
# =========================================================================
FILL_SUBTOTAL_BLUE = PatternFill(start_color="D9E8F5", end_color="D9E8F5", fill_type="solid") # Azul suave de subtotales
FONT_SUBTOTAL_BOLD = Font(name=FONT_FAMILY, size=8.5, bold=True, color="1E3A8A")

def generate_viajes_template_excel(empresa_name: str = "") -> io.BytesIO:
    """
    Genera la plantilla oficial Excel de 23 columnas compatible 100% con
    el estándar de despachos y facturación de empresas de transporte (ej. Driver S.R.L.),
    incluyendo fórmulas automáticas de importe (=Volumen*Flete) y subtotales por factura.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Planilla Ventas y Despachos"
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Empresa Transporte",
        "Producto",
        "Planta de Carga",
        "Factura y otros",
        "Planta de descarga",
        "Placa",
        "Fecha Carga",
        "Fecha Recepción",
        "Volumen Despachado (Litro)",
        "Volumen Recepcionado (Litro)",
        "Diferencia Desp.-Rece. (Litro)",
        "Merma Permisible (Litro)",
        "Merma (Litro)",
        "Precio Merma + IVA (Bs/Litro)",
        "Merma a Descontar Bs.",
        "Volumen a facturar (m3)",
        "Flete (Bs/m3)",
        "Importe a Facturar (Bs)",
        "FECHA DE FACTURA DRIVER SRL",
        "N° FACTURA DRIVER SRL",
        "MIC/DTA",
        "FECHA DE MIC/DTA",
        "N° CONTRATO"
    ]

    header_row = 1
    ws.row_dimensions[header_row].height = 36
    for col_idx, h_text in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col_idx, value=h_text)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN_BLACK

    # Filas de ejemplo realistas
    sample_rows = [
        # 1. Cliente agroindustrial con "SIN PLACA"
        [
            "INDUSTRIAS DE ACEITE S.A.", "SOYA A GRANEL", "LA PAZ", "Falta MIC", "AREQUIPA",
            "SIN PLACA", "07/01/2026", "08/01/2026", 0, 0, 0, 0, 0, 0, 0,
            252.0, 626.40, 157852.80, "07/01/2026", 1243, None, None, "193464"
        ],
        # 2. Despacho cisterna YPFB (Factura 1245 viaje 1)
        [
            "YPFB", "INSUMOS Y ADITIVOS", "ARICA", "Falta MIC", "COCHABAMBA",
            "5614-FSP", "02/01/2026", "05/01/2026", 30999, 30934, 0, 0, 0, 5.26, 0,
            30.934, 503.61, 15578.67, "08/01/2026", 1245, None, None, "199/2025"
        ],
        # 3. Despacho cisterna YPFB (Factura 1245 viaje 2)
        [
            "YPFB", "DIESEL", "ARICA", "Falta MIC", "LA PAZ",
            "5239-EFG", "03/01/2026", "06/01/2026", 31017, 30971, 0, 0, 0, 5.73, 0,
            30.971, 431.98, 13378.85, "08/01/2026", 1245, None, None, "199/2025"
        ],
        # 4. Fila Subtotal de la Factura 1245 (Azul)
        [
            None, None, None, None, None, None, None, None, None, None, None, None, None, None, None,
            "=SUM(P3:P4)", None, "=SUM(R3:R4)", "08/01/2026", 1245, None, None, "199/2025"
        ],
        # 5. Transportista asociado / Apoyo con carga seca y MIC/DTA
        [
            "PEDRO WEILLIAM LIMACHI AYALA", "BOBINAS DE ACERO", "MATARANI", None, "LA PAZ",
            "5767-EEP", "04/01/2026", "07/01/2026", 0, 0, 0, 0, 0, 0, 0,
            27.647, 473.28, 13084.54, "09/01/2026", 1247, "25BO775266R", "05/01/2026", None
        ]
    ]

    for r_idx, s_data in enumerate(sample_rows, 2):
        ws.row_dimensions[r_idx].height = 20
        is_subtotal = (s_data[0] is None and s_data[5] is None)
        for col_idx, val in enumerate(s_data, 1):
            cell = ws.cell(row=r_idx, column=col_idx, value=val)
            cell.border = BORDER_THIN_BLACK
            if is_subtotal:
                cell.fill = FILL_SUBTOTAL_BLUE
                cell.font = FONT_SUBTOTAL_BOLD
            else:
                cell.font = FONT_DATA_REGULAR

            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                if col_idx in (9, 10, 11, 12, 13):
                    cell.number_format = '#,##0'
                elif col_idx == 16:
                    cell.number_format = '#,##0.000'
                elif col_idx in (17, 18):
                    cell.number_format = '#,##0.00'
            elif isinstance(val, str) and val.startswith("="):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = '#,##0.00'
            else:
                cell.alignment = Alignment(horizontal="center" if col_idx in (6, 7, 8, 19, 20, 21, 22) else "left", vertical="center")

    min_widths_template = {
        "A": 28, "B": 20, "C": 18, "D": 16, "E": 18,
        "F": 14, "G": 14, "H": 14, "I": 15, "J": 15,
        "K": 14, "L": 14, "M": 14, "N": 15, "O": 15,
        "P": 18, "Q": 14, "R": 18, "S": 16, "T": 14,
        "U": 18, "V": 16, "W": 16
    }
    adjust_column_widths(ws, min_widths_template)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def export_viajes_list_excel(
    viajes: List[Any],
    empresa: Dict[str, Any],
    params: Any,
    order_by: str = "fecha",
    order_dir: str = "asc",
    periodo: Optional[str] = None,
    placa: Optional[str] = None,
    nro_factura: Optional[str] = None,
    factura_desde: Optional[str] = None,
    factura_hasta: Optional[str] = None,
    facturas: Optional[List[str]] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    cliente: Optional[str] = None,
    producto: Optional[str] = None,
) -> io.BytesIO:
    """
    Genera un archivo Excel (.xlsx) oficial de Despachos/Viajes con el diseño elegante y completo
    de la Liquidación Oficial:
    - Hoja 1: 'Liquidacion de Fletes' (17 columnas oficiales, encabezado institucional, logo,
              agrupación ordenada con banners ambar de subtotales por Factura/Producto/Tramo,
              totales generales y cuadro de 4 firmas).
    - Hoja 2: 'Resumen Descuentos' (Deducciones financieras oficiales calculadas por el motor
              matemático y cuadro de firmas).
    - Hoja 3: 'Matriz por Cisterna' (Consolidado de flota por cisterna si existen múltiples unidades).
    """
    wb = openpyxl.Workbook()
    empresa_nombre = empresa.get("name", "EMPRESA DE TRANSPORTE")
    logo_b64 = empresa.get("logo_base64")

    # Determinar etiqueta de período para el encabezado
    if periodo:
        periodo_fmt = f"PERIODO   {format_periodo_label(str(periodo))}"
    elif fecha_desde and fecha_hasta:
        periodo_fmt = f"FECHAS   {format_fecha_bolivia(fecha_desde)} AL {format_fecha_bolivia(fecha_hasta)}"
    elif fecha_desde:
        periodo_fmt = f"DESDE   {format_fecha_bolivia(fecha_desde)}"
    elif facturas and len(facturas) > 0:
        clean_f = [str(f).strip() for f in facturas if f and str(f).strip()]
        periodo_fmt = f"FACTURAS   {', '.join(clean_f[:6])}"
    elif factura_desde and factura_hasta:
        periodo_fmt = f"FACTURAS   {factura_desde} AL {factura_hasta}"
    elif nro_factura:
        periodo_fmt = f"FACTURA   {nro_factura}"
    else:
        fechas_v = [v.fecha_carga for v in viajes if getattr(v, "fecha_carga", None)]
        if fechas_v:
            min_f = min(fechas_v)
            max_f = max(fechas_v)
            if min_f == max_f:
                periodo_fmt = f"FECHA   {format_fecha_bolivia(min_f)}"
            else:
                periodo_fmt = f"PERIODO   {format_fecha_bolivia(min_f)} AL {format_fecha_bolivia(max_f)}"
        else:
            periodo_fmt = "CONSOLIDADO GENERAL DE VIAJES"

    # Determinar etiqueta de placa para el encabezado
    if placa and str(placa).upper() != "TODAS":
        placa_h1 = str(placa).upper()
    else:
        placas_set = {str(getattr(v, "placa", "") or "").strip().upper() for v in viajes if getattr(v, "placa", None)}
        placas_set = {p for p in placas_set if p and p != "SIN PLACA"}
        if len(placas_set) == 1:
            placa_h1 = list(placas_set)[0]
        elif len(placas_set) > 1:
            placa_h1 = f"TODAS LAS PLACAS ({len(placas_set)} UNIDADES)"
        else:
            placa_h1 = "TODAS LAS PLACAS (CONSOLIDADO GENERAL)"

    # Firmas oficiales
    realizado_nom = getattr(params, "firma_realizado_por", None) or "JAQUELINE LOVERA TIÑINI"
    realizado_nom, _ = parse_firma_entry(realizado_nom, "JAQUELINE LOVERA TIÑINI", "")
    revisado_nom = getattr(params, "firma_revisado_por", "") or ""
    revisado_carg = ""
    autorizado_nom = getattr(params, "firma_autorizado_por", "") or ""
    autorizado_carg = ""
    cancelado_nom = getattr(params, "firma_cancelado_por", "") or ""
    cancelado_carg = ""

    # =========================================================================
    # HOJA 1: DETALLE DE FLETES (DISEÑO OFICIAL FOTO 2)
    # =========================================================================
    ws1 = wb.active
    ws1.title = "Liquidacion de Fletes"
    ws1.views.sheetView[0].showGridLines = True

    # 1. Cabecera Superior Izquierda
    ws1.merge_cells("A2:E2")
    ws1["A2"] = "LIQUIDACION DE FLETES"
    ws1["A2"].font = FONT_MAIN_TITLE
    ws1["A2"].alignment = Alignment(horizontal="left", vertical="center")

    ws1.merge_cells("A3:E3")
    ws1["A3"] = periodo_fmt
    ws1["A3"].font = FONT_TITLE_REGULAR
    ws1["A3"].alignment = Alignment(horizontal="left", vertical="center")

    ws1.merge_cells("A4:E4")
    ws1["A4"] = f"PLACA   {placa_h1}"
    ws1["A4"].font = FONT_TITLE_BOLD
    ws1["A4"].alignment = Alignment(horizontal="left", vertical="center")

    # Nombre de Empresa centrado y elegante en el encabezado
    ws1.merge_cells("G2:N3")
    ws1["G2"] = empresa_nombre.upper()
    ws1["G2"].font = Font(name=FONT_FAMILY, size=12, bold=True, color="0F172A")
    ws1["G2"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Factor Merma Superior Derecha (Columna Q fila 4)
    factor_merma = getattr(params, 'precio_merma_general_bs', 7.45) or 7.45
    c_factor = ws1.cell(row=4, column=17, value=factor_merma)
    c_factor.font = FONT_DATA_REGULAR
    c_factor.number_format = '0.00'
    c_factor.alignment = Alignment(horizontal="right", vertical="center")

    # Logotipo en la Esquina Superior Derecha (Columna P-Q)
    add_logo_to_worksheet(ws1, logo_base64=logo_b64, empresa_name=empresa_nombre, cell_coord="P1", max_width=140, max_height=48)

    # Encabezados de Columnas (Fila 6) - 17 Columnas oficiales
    headers_sheet1 = [
        "Nº",
        "FECHA DE\nCARGA",
        "FECHA DE\nDESCARGA",
        "MCI/DTA Nº\nY OTROS",
        "PLACA",
        "TRAMO",
        "CLIENTE",
        "PRODUCTO",
        "Volumen en\nLt. Origen",
        "Volumen\nRecepcionado/\nDescargado",
        "Merma\nT-T",
        "Total\nMerma Litros",
        "MERMA\n0,15% s/Volumen\n(Diesel 0.15%\nGasolina 0.35%)",
        "Merma a\nDescontar\nY.P.F.B.",
        "Volumen\nFacturado",
        "TARIFA\nBs.",
        "Total a pagar\nen Bob."
    ]

    header_row = 6
    ws1.row_dimensions[header_row].height = 52
    for col_idx, h_text in enumerate(headers_sheet1, 1):
        cell = ws1.cell(row=header_row, column=col_idx, value=h_text)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN_BLACK

    # Agrupación y Ordenamiento Dinámico
    def parse_fac_num(f_str: Any):
        nums = re.sub(r'\D', '', str(f_str or ""))
        return int(nums) if nums else str(f_str or "")

    is_desc = (str(order_dir).lower() == "desc")

    # Construir grupos coherentes según el ordenamiento solicitado
    groups_dict = {}
    for v in viajes:
        p_placa = str(getattr(v, "placa", "") or "SIN PLACA").strip().upper()
        t_key = str(getattr(v, "tramo", "") or "SIN TRAMO").strip().upper()
        p_key = str(getattr(v, "producto", "") or "SIN PRODUCTO").strip().upper()
        f_raw = str(getattr(v, "nro_factura", "") or "").strip().upper()
        f_key = f_raw if f_raw and f_raw != "-" else "S/F"

        if order_by == "placa":
            grp_k = (p_placa, t_key, p_key, f_key)
        else:
            grp_k = (t_key, p_key, f_key)

        if grp_k not in groups_dict:
            groups_dict[grp_k] = []
        groups_dict[grp_k].append(v)

    # Ordenar viajes dentro de cada grupo
    for grp_k in groups_dict:
        if order_by == "placa":
            groups_dict[grp_k].sort(
                key=lambda x: (str(getattr(x, "fecha_carga", "") or ""), getattr(x, "id", 0)),
                reverse=is_desc
            )
        elif order_by == "factura":
            groups_dict[grp_k].sort(
                key=lambda x: (str(getattr(x, "fecha_carga", "") or ""), getattr(x, "id", 0)),
                reverse=is_desc
            )
        elif order_by == "fecha":
            groups_dict[grp_k].sort(
                key=lambda x: (str(getattr(x, "fecha_carga", "") or ""), getattr(x, "id", 0)),
                reverse=is_desc
            )
        else:
            groups_dict[grp_k].sort(
                key=lambda x: (str(getattr(x, "fecha_carga", "") or ""), getattr(x, "id", 0))
            )

    # Ordenar los grupos principales
    if order_by == "factura":
        sorted_groups = sorted(
            groups_dict.items(),
            key=lambda item: (
                0 if item[0][-1] != "S/F" else 1,
                parse_fac_num(item[0][-1]) if isinstance(parse_fac_num(item[0][-1]), int) else 999999,
                str(item[0][-1]),
                str(getattr(item[1][0], "fecha_carga", "") or "") if item[1] else ""
            ),
            reverse=is_desc
        )
    elif order_by == "placa":
        sorted_groups = sorted(
            groups_dict.items(),
            key=lambda item: (
                str(item[0][0]),
                str(getattr(item[1][0], "fecha_carga", "") or "") if item[1] else ""
            ),
            reverse=is_desc
        )
    elif order_by == "cliente":
        sorted_groups = sorted(
            groups_dict.items(),
            key=lambda item: (
                str(getattr(item[1][0], "cliente", "") or "") if item[1] else "",
                str(getattr(item[1][0], "fecha_carga", "") or "") if item[1] else ""
            ),
            reverse=is_desc
        )
    elif order_by == "flete":
        sorted_groups = sorted(
            groups_dict.items(),
            key=lambda item: sum(float(getattr(x, "flete_total_bs", 0.0) or 0.0) for x in item[1]),
            reverse=is_desc
        )
    else:  # "fecha" (default)
        sorted_groups = sorted(
            groups_dict.items(),
            key=lambda item: (
                str(getattr(item[1][0], "fecha_carga", "") or "") if item[1] else "",
                str(item[0][0])
            ),
            reverse=is_desc
        )

    curr_row = 7
    global_idx = 1
    total_vol_orig = 0.0
    total_vol_rec = 0.0
    total_vol_fact = 0.0
    total_merma_real = 0.0
    total_m_desc_bs = 0.0
    total_flete_bs = 0.0

    fill_subtotal = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    font_subtotal = Font(name=FONT_FAMILY, size=8.5, bold=True, color="78350F")

    for grp_k, grp_viajes in sorted_groups:
        grp_vol_orig = 0.0
        grp_vol_rec = 0.0
        grp_vol_fact = 0.0
        grp_merma_real = 0.0
        grp_m_desc = 0.0
        grp_flete = 0.0
        grp_tarifa = 0.0

        for v in grp_viajes:
            ws1.row_dimensions[curr_row].height = 21

            # Col 1: Nº
            c1 = ws1.cell(row=curr_row, column=1, value=global_idx)
            c1.alignment = Alignment(horizontal="center", vertical="center")
            global_idx += 1

            # Col 2: Fecha Carga
            c2 = ws1.cell(row=curr_row, column=2, value=format_fecha_bolivia(v.fecha_carga))
            c2.alignment = Alignment(horizontal="center", vertical="center")

            # Col 3: Fecha Descarga
            c3 = ws1.cell(row=curr_row, column=3, value=format_fecha_bolivia(v.fecha_descarga))
            c3.alignment = Alignment(horizontal="center", vertical="center")

            # Col 4: MCI/DTA Nº Y OTROS
            c4 = ws1.cell(row=curr_row, column=4, value=v.mic_dta or "-")
            c4.alignment = Alignment(horizontal="center", vertical="center")

            # Col 5: Placa
            c5 = ws1.cell(row=curr_row, column=5, value=v.placa)
            c5.alignment = Alignment(horizontal="center", vertical="center")

            # Col 6: Tramo
            c6 = ws1.cell(row=curr_row, column=6, value=v.tramo or "")
            c6.alignment = Alignment(horizontal="left", vertical="center")

            # Col 7: Cliente
            c7 = ws1.cell(row=curr_row, column=7, value=v.cliente or "YPFB")
            c7.alignment = Alignment(horizontal="center", vertical="center")

            # Col 8: Producto
            c8 = ws1.cell(row=curr_row, column=8, value=(v.producto or "").upper())
            c8.alignment = Alignment(horizontal="center", vertical="center")

            # Col 9: Volumen Origen
            v_orig = float(v.volumen_origen_litros or 0)
            grp_vol_orig += v_orig
            total_vol_orig += v_orig
            c9 = ws1.cell(row=curr_row, column=9, value=v_orig)
            c9.number_format = '#,##0'
            c9.alignment = Alignment(horizontal="right", vertical="center")

            # Col 10: Volumen Recepcionado/Descargado
            v_rec = float(v.volumen_recepcionado_litros or 0)
            grp_vol_rec += v_rec
            total_vol_rec += v_rec
            c10 = ws1.cell(row=curr_row, column=10, value=v_rec)
            c10.number_format = '#,##0'
            c10.alignment = Alignment(horizontal="right", vertical="center")

            # Col 11: Merma T-T (Merma Real)
            raw_m_real = float(v.merma_real_litros or 0)
            m_real = -abs(raw_m_real) if raw_m_real != 0 else 0.0
            grp_merma_real += m_real
            total_merma_real += m_real
            c11 = ws1.cell(row=curr_row, column=11, value=m_real)
            c11.number_format = '#,##0.0;-#,##0.0;0.0'
            c11.alignment = Alignment(horizontal="right", vertical="center")

            # Col 12: Total Merma Litros
            m_exc = float(v.merma_excedente_litros or 0)
            c12 = ws1.cell(row=curr_row, column=12, value=m_exc)
            c12.number_format = '#,##0.0'
            c12.alignment = Alignment(horizontal="right", vertical="center")

            # Col 13: Tolerancia
            tol_lts = float(v.merma_tolerable_litros or 0)
            c13 = ws1.cell(row=curr_row, column=13, value=tol_lts)
            c13.number_format = '#,##0'
            c13.alignment = Alignment(horizontal="center", vertical="center")

            # Col 14: Merma Descontar YPFB
            m_desc = float(v.merma_descontar_bs or 0)
            grp_m_desc += m_desc
            total_m_desc_bs += m_desc
            c14 = ws1.cell(row=curr_row, column=14, value=m_desc)
            c14.number_format = '#,##0.00'
            c14.alignment = Alignment(horizontal="right", vertical="center")

            # Col 15: Volumen Facturado (muestra en m³ con formato #,##0.00, calculado desde Litros / 1000)
            raw_v_fact = getattr(v, "volumen_facturado", None)
            if raw_v_fact is not None and float(raw_v_fact) > 0:
                v_fact_num = float(raw_v_fact)
                v_fact_m3 = (v_fact_num / 1000.0) if v_fact_num > 1000.0 else v_fact_num
            else:
                v_fact_m3 = round(v_rec / 1000.0, 3)

            grp_vol_fact += v_fact_m3
            total_vol_fact += v_fact_m3
            c15 = ws1.cell(row=curr_row, column=15, value=v_fact_m3)
            c15.number_format = '#,##0.00'
            c15.alignment = Alignment(horizontal="right", vertical="center")

            # Col 16: Tarifa Bs
            tarifa = float(v.tarifa_flete or 0)
            grp_tarifa = tarifa
            c16 = ws1.cell(row=curr_row, column=16, value=tarifa)
            c16.number_format = '#,##0.00'
            c16.alignment = Alignment(horizontal="right", vertical="center")

            # Col 17: Total a pagar en Bob.
            flete = float(v.flete_total_bs or 0)
            grp_flete += flete
            total_flete_bs += flete
            c17 = ws1.cell(row=curr_row, column=17, value=flete)
            c17.number_format = '#,##0.00'
            c17.alignment = Alignment(horizontal="right", vertical="center")

            for col_c in range(1, 18):
                ws1.cell(row=curr_row, column=col_c).font = FONT_DATA_REGULAR
                ws1.cell(row=curr_row, column=col_c).border = BORDER_THIN_BLACK

            curr_row += 1

        # FILA ESPECIAL: Subtotal del Grupo con Factura y Fecha (Banners Ámbar Foto 2)
        p_display = grp_viajes[0].producto.upper() if grp_viajes and getattr(grp_viajes[0], "producto", None) else "PRODUCTO"
        nros_f = [str(getattr(x, "nro_factura", "") or "").strip() for x in grp_viajes if getattr(x, "nro_factura", None)]
        nros_f = [x for x in dict.fromkeys(nros_f) if x and x != "-"]
        fechas_f = [format_fecha_bolivia(getattr(x, "fecha_factura", None)) for x in grp_viajes if getattr(x, "fecha_factura", None)]
        fechas_f = [x for x in dict.fromkeys(fechas_f) if x and x != "-"]
        fac_label = ", ".join(nros_f) if nros_f else "S/F"
        fecha_label = ", ".join(fechas_f) if fechas_f else "-"

        subtotal_title = f"TOTAL {p_display}  |  FACTURA: {fac_label}  |  FECHA FACTURA: {fecha_label}"

        ws1.row_dimensions[curr_row].height = 23
        ws1.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=8)
        c_title = ws1.cell(row=curr_row, column=1, value=subtotal_title)
        c_title.alignment = Alignment(horizontal="left", vertical="center")

        ws1.cell(row=curr_row, column=9, value=grp_vol_orig).number_format = '#,##0'
        ws1.cell(row=curr_row, column=10, value=grp_vol_rec).number_format = '#,##0'
        ws1.cell(row=curr_row, column=11, value=grp_merma_real).number_format = '#,##0.0;-#,##0.0;0.0'
        ws1.cell(row=curr_row, column=12, value="")
        ws1.cell(row=curr_row, column=13, value="")
        ws1.cell(row=curr_row, column=14, value=grp_m_desc).number_format = '#,##0.00'
        ws1.cell(row=curr_row, column=15, value=grp_vol_fact).number_format = '#,##0.00'
        ws1.cell(row=curr_row, column=16, value=grp_tarifa).number_format = '#,##0.00'
        ws1.cell(row=curr_row, column=17, value=grp_flete).number_format = '#,##0.00'

        for col_c in range(1, 18):
            cell_sub = ws1.cell(row=curr_row, column=col_c)
            cell_sub.font = font_subtotal
            cell_sub.fill = fill_subtotal
            cell_sub.border = BORDER_THIN_BLACK
            if col_c >= 9:
                cell_sub.alignment = Alignment(horizontal="right", vertical="center")

        curr_row += 1

    # Caso borde: si no hubo viajes
    if len(viajes) == 0:
        ws1.row_dimensions[curr_row].height = 24
        ws1.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=17)
        c_empty = ws1.cell(row=curr_row, column=1, value="NO SE ENCONTRARON REGISTROS DE VIAJES PARA LOS FILTROS SELECCIONADOS")
        c_empty.font = FONT_DATA_BOLD
        c_empty.alignment = Alignment(horizontal="center", vertical="center")
        curr_row += 1

    # Fila de Totales Generales de la Hoja 1 (Doble Subrayado)
    ws1.row_dimensions[curr_row].height = 24
    ws1.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=8)
    c_tot_label = ws1.cell(row=curr_row, column=1, value="TOTAL GENERAL:")
    c_tot_label.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_orig = ws1.cell(row=curr_row, column=9, value=total_vol_orig)
    c_tot_orig.number_format = '#,##0'
    c_tot_orig.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_rec = ws1.cell(row=curr_row, column=10, value=total_vol_rec)
    c_tot_rec.number_format = '#,##0'
    c_tot_rec.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_mreal = ws1.cell(row=curr_row, column=11, value=total_merma_real)
    c_tot_mreal.number_format = '#,##0.0;-#,##0.0;0.0'
    c_tot_mreal.alignment = Alignment(horizontal="right", vertical="center")

    ws1.cell(row=curr_row, column=12, value="")
    ws1.cell(row=curr_row, column=13, value="")

    c_tot_mdesc = ws1.cell(row=curr_row, column=14, value=total_m_desc_bs)
    c_tot_mdesc.number_format = '#,##0.00'
    c_tot_mdesc.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_vfact = ws1.cell(row=curr_row, column=15, value=total_vol_fact)
    c_tot_vfact.number_format = '#,##0.00'
    c_tot_vfact.alignment = Alignment(horizontal="right", vertical="center")

    ws1.cell(row=curr_row, column=16, value="")

    c_tot_pagar = ws1.cell(row=curr_row, column=17, value=total_flete_bs)
    c_tot_pagar.number_format = '#,##0.00'
    c_tot_pagar.alignment = Alignment(horizontal="right", vertical="center")

    for col_c in range(1, 18):
        cell_tot = ws1.cell(row=curr_row, column=col_c)
        cell_tot.font = FONT_TOTAL_MAIN
        cell_tot.fill = FILL_SHADED_GRAY
        cell_tot.border = BORDER_TOTAL_DOUBLE

    # Cuadro de Firmas Oficial Hoja 1 (Abarca de Columna A a Q)
    sign_start_row = curr_row + 4
    ws1.row_dimensions[sign_start_row].height = 17
    ws1.row_dimensions[sign_start_row + 1].height = 18
    ws1.row_dimensions[sign_start_row + 2].height = 42

    panels_info = [
        ("A", "D", "", f" REALIZADO POR:\n\n   {realizado_nom}" if realizado_nom else " REALIZADO POR:"),
        ("E", "H", "", f" REVISADO POR:\n\n   {revisado_nom}" if revisado_nom else " REVISADO POR:"),
        ("I", "L", "", f" AUTORIZADO POR:\n\n   {autorizado_nom}" if autorizado_nom else " AUTORIZADO POR:"),
        ("M", "Q", "", f" CANCELADO POR:\n\n   {cancelado_nom}" if cancelado_nom else " CANCELADO POR:")
    ]

    for col_start, col_end, nom_val, _ in panels_info:
        if nom_val and nom_val.strip():
            ws1.merge_cells(f"{col_start}{sign_start_row}:{col_end}{sign_start_row}")
            c_nom = ws1[f"{col_start}{sign_start_row}"]
            c_nom.value = nom_val.strip()
            c_nom.font = Font(name=FONT_FAMILY, size=8.5, bold=True)
            c_nom.alignment = Alignment(horizontal="center", vertical="bottom")

    border_sign_underline = Border(bottom=Side(style='thin', color='000000'))
    for col_u in range(1, 18):
        ws1.cell(row=sign_start_row + 1, column=col_u).border = border_sign_underline

    row_tags = sign_start_row + 2
    for col_start, col_end, _, text_val in panels_info:
        ws1.merge_cells(f"{col_start}{row_tags}:{col_end}{row_tags}")
        cell_p = ws1[f"{col_start}{row_tags}"]
        cell_p.value = text_val
        cell_p.font = Font(name=FONT_FAMILY, size=8, bold=True)
        cell_p.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)

        c_s_idx = openpyxl.utils.column_index_from_string(col_start)
        c_e_idx = openpyxl.utils.column_index_from_string(col_end)
        for c_idx in range(c_s_idx, c_e_idx + 1):
            cell_box = ws1.cell(row=row_tags, column=c_idx)
            cell_box.border = Border(
                left=Side(style='thin', color='000000') if c_idx == c_s_idx else None,
                right=Side(style='thin', color='000000') if c_idx == c_e_idx else None,
                top=Side(style='thin', color='000000'),
                bottom=Side(style='thin', color='000000')
            )

    ws1.page_setup.orientation = ws1.ORIENTATION_LANDSCAPE
    ws1.page_setup.paperSize = ws1.PAPERSIZE_LETTER
    ws1.sheet_properties.pageSetUpPr.fitToPage = True
    ws1.page_setup.fitToWidth = 1
    ws1.page_setup.fitToHeight = 0
    ws1.print_options.horizontalCentered = True

    ws1.page_margins.top = 0.8
    ws1.page_margins.bottom = 0.4
    ws1.page_margins.left = 0.4
    ws1.page_margins.right = 0.4
    ws1.page_margins.header = 0.3
    ws1.page_margins.footer = 0.3

    min_widths_sheet1 = {
        "A": 7.0, "B": 14.0, "C": 14.0, "D": 18.0, "E": 13.0,
        "F": 32.0, "G": 13.0, "H": 16.0, "I": 16.0, "J": 16.0,
        "K": 14.0, "L": 15.0, "M": 16.0, "N": 17.0, "O": 16.0,
        "P": 14.0, "Q": 19.0
    }
    adjust_column_widths(ws1, min_widths_sheet1)

    # =========================================================================
    # HOJA 2: RESUMEN DE DESCUENTOS Y LÍQUIDO PAGABLE (DISEÑO OFICIAL FOTO 3)
    # =========================================================================
    resumen_calc = calculate_liquidacion_resumen(viajes, params)

    ws2 = wb.create_sheet(title="Resumen Descuentos")
    ws2.views.sheetView[0].showGridLines = True

    # 1. Cabecera Superior Izquierda
    ws2.merge_cells("B2:C2")
    ws2["B2"] = "LIQUIDACION DE FLETES"
    ws2["B2"].font = FONT_MAIN_TITLE
    ws2["B2"].alignment = Alignment(horizontal="left", vertical="center")

    ws2.merge_cells("B3:C3")
    ws2["B3"] = periodo_fmt
    ws2["B3"].font = FONT_TITLE_REGULAR
    ws2["B3"].alignment = Alignment(horizontal="left", vertical="center")

    ws2.merge_cells("B4:C4")
    ws2["B4"] = f"PLACA   {placa_h1}"
    ws2["B4"].font = FONT_TITLE_BOLD
    ws2["B4"].alignment = Alignment(horizontal="left", vertical="center")

    # 2. Logotipo en la Esquina Superior Derecha
    add_logo_to_worksheet(ws2, logo_base64=logo_b64, empresa_name=empresa_nombre, cell_coord="D1", max_width=165, max_height=55)

    # 3. Tabla de Deducciones Oficial
    r_res = 6
    ws2.row_dimensions[r_res].height = 24

    ws2.merge_cells(f"B{r_res}:D{r_res}")
    c_h_desc = ws2[f"B{r_res}"]
    c_h_desc.value = "DESCRIPCION"
    c_h_desc.font = FONT_HEADER
    c_h_desc.fill = FILL_SHADED_GRAY
    c_h_desc.alignment = Alignment(horizontal="center", vertical="center")
    for col_x in range(2, 5):
        ws2.cell(row=r_res, column=col_x).border = BORDER_THIN_BLACK

    c_h_tot = ws2.cell(row=r_res, column=5, value="TOTAL Bs")
    c_h_tot.font = FONT_HEADER
    c_h_tot.fill = FILL_SHADED_GRAY
    c_h_tot.alignment = Alignment(horizontal="center", vertical="center")
    c_h_tot.border = BORDER_THIN_BLACK

    deductions_items = [
        ("FLETE TOTAL", float(resumen_calc.get("flete_total_bruto", 0.0) or 0.0), True, False),
        ("Descuento por Merma", float(resumen_calc.get("desc_merma_bs", 0.0) or 0.0), False, False),
        ("Descuento de Comisión 1 $us p/m3", float(resumen_calc.get("desc_comision_usd_m3_bs", 0.0) or 0.0), False, False),
        ("Descuento de Comisión 7%", float(resumen_calc.get("desc_comision_7pct_bs", 0.0) or 0.0), False, False),
        ("Descuento YPFB BOL-GART 7%", float(resumen_calc.get("desc_comision_ypfb_bolgart_7pct_bs", 0.0) or 0.0), False, False),
        ("Descuento de Comisión 3%", float(resumen_calc.get("desc_comision_3pct_bs", 0.0) or 0.0), False, False),
        ("Hojas de Ruta", float(resumen_calc.get("desc_hojas_ruta_bs", 0.0) or 0.0), False, False),
        ("GPS", float(resumen_calc.get("desc_gps_bs", 0.0) or 0.0), False, False),
        ("Anticipos y Otros 7%", float(resumen_calc.get("desc_anticipos_otros_bs", 0.0) or 0.0), False, False),
    ]

    otros_aj = float(resumen_calc.get("desc_otros_ajustes_bs", 0.0) or 0.0)
    if otros_aj != 0:
        deductions_items.append(("Otros Descuentos", otros_aj, False, False))

    deductions_items.append(("TOTAL DESCUENTO", float(resumen_calc.get("total_descuentos_bs", 0.0) or 0.0), True, False))
    deductions_items.append(("LIQUIDO PAGABLE", float(resumen_calc.get("liquido_pagable_bs", 0.0) or 0.0), True, True))

    for desc_label, val_amount, is_bold, is_highlight in deductions_items:
        r_res += 1
        ws2.row_dimensions[r_res].height = 20

        ws2.merge_cells(f"B{r_res}:D{r_res}")
        cell_lbl = ws2[f"B{r_res}"]
        cell_lbl.value = desc_label
        cell_lbl.font = FONT_DATA_BOLD if is_bold else FONT_DATA_REGULAR
        cell_lbl.alignment = Alignment(horizontal="left", vertical="center")
        for col_x in range(2, 5):
            ws2.cell(row=r_res, column=col_x).border = BORDER_THIN_BLACK

        cell_val = ws2.cell(row=r_res, column=5, value=val_amount)
        cell_val.number_format = '#,##0.00'
        cell_val.font = FONT_TOTAL_MAIN if is_highlight else (FONT_DATA_BOLD if is_bold else FONT_DATA_REGULAR)
        cell_val.alignment = Alignment(horizontal="right", vertical="center")
        cell_val.border = BORDER_THIN_BLACK

    # Cuadro de Firmas Hoja 2
    sign_row2 = r_res + 4
    ws2.row_dimensions[sign_row2].height = 17
    ws2.row_dimensions[sign_row2 + 1].height = 17
    ws2.row_dimensions[sign_row2 + 2].height = 42

    border_sign_underline = Border(bottom=Side(style='thin', color='000000'))
    for col_u in range(2, 6):
        ws2.cell(row=sign_row2 + 1, column=col_u).border = border_sign_underline

    row_tags2 = sign_row2 + 2
    panels_info2 = [
        (2, f" REALIZADO POR:\n\n   {realizado_nom}" if realizado_nom else " REALIZADO POR:"),
        (3, f" REVISADO POR:\n\n   {revisado_nom}" if revisado_nom else " REVISADO POR:"),
        (4, f" AUTORIZADO POR:\n\n   {autorizado_nom}" if autorizado_nom else " AUTORIZADO POR:"),
        (5, f" CANCELADO POR:\n\n   {cancelado_nom}" if cancelado_nom else " CANCELADO POR:")
    ]

    for col_idx, text_val in panels_info2:
        cell_p = ws2.cell(row=row_tags2, column=col_idx, value=text_val)
        cell_p.font = Font(name=FONT_FAMILY, size=8, bold=True)
        cell_p.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        cell_p.border = BORDER_THIN_BLACK

    ws2.page_setup.orientation = ws2.ORIENTATION_LANDSCAPE
    ws2.page_setup.paperSize = ws2.PAPERSIZE_LETTER
    ws2.sheet_properties.pageSetUpPr.fitToPage = True
    ws2.page_setup.fitToWidth = 1
    ws2.page_setup.fitToHeight = 0
    ws2.print_options.horizontalCentered = True

    ws2.page_margins.top = 0.8
    ws2.page_margins.bottom = 0.4
    ws2.page_margins.left = 0.4
    ws2.page_margins.right = 0.4
    ws2.page_margins.header = 0.3
    ws2.page_margins.footer = 0.3

    min_widths_sheet2 = {
        "A": 4.0, "B": 28.0, "C": 28.0, "D": 26.0, "E": 26.0
    }
    adjust_column_widths(ws2, min_widths_sheet2)

    # =========================================================================
    # HOJA 3: MATRIZ POR CISTERNA (CONSOLIDADO DE FLOTA)
    # Generada automáticamente si existen cisternas registradas
    # =========================================================================
    placas_map = defaultdict(list)
    for v in viajes:
        p_c = str(getattr(v, "placa", "") or "SIN PLACA").strip().upper()
        placas_map[p_c].append(v)

    if len(placas_map) > 1:
        ws3 = wb.create_sheet(title="Matriz por Cisterna")
        ws3.views.sheetView[0].showGridLines = True

        ws3.merge_cells("A2:E2")
        ws3["A2"] = "CONSOLIDADO DE FLOTA POR CISTERNA"
        ws3["A2"].font = FONT_MAIN_TITLE
        ws3["A2"].alignment = Alignment(horizontal="left", vertical="center")

        ws3.merge_cells("A3:E3")
        ws3["A3"] = periodo_fmt
        ws3["A3"].font = FONT_TITLE_REGULAR
        ws3["A3"].alignment = Alignment(horizontal="left", vertical="center")

        ws3.merge_cells("G2:K3")
        ws3["G2"] = empresa_nombre.upper()
        ws3["G2"].font = Font(name=FONT_FAMILY, size=12, bold=True, color="0F172A")
        ws3["G2"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        add_logo_to_worksheet(ws3, logo_base64=logo_b64, empresa_name=empresa_nombre, cell_coord="K1", max_width=140, max_height=48)

        headers_sheet3 = [
            "Nº",
            "PLACA",
            "TIPO FLOTA",
            "CANT. VIAJES",
            "VOL. ORIGEN (Lt)",
            "VOL. RECEP. (Lt)",
            "VOL. FACT. (m³)",
            "DESC. MERMA (Bs)",
            "FLETE BRUTO (Bs)",
            "TOTAL DESCUENTO (Bs)",
            "LÍQUIDO PAGABLE (Bs)"
        ]

        h_row3 = 5
        ws3.row_dimensions[h_row3].height = 32
        for col_idx, h_text in enumerate(headers_sheet3, 1):
            cell = ws3.cell(row=h_row3, column=col_idx, value=h_text)
            cell.font = FONT_HEADER
            cell.fill = FILL_HEADER
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = BORDER_THIN_BLACK

        curr_r3 = 6
        sorted_placas = sorted(placas_map.keys())
        tot3_viajes = 0
        tot3_orig = 0.0
        tot3_rec = 0.0
        tot3_fact_m3 = 0.0
        tot3_merma = 0.0
        tot3_flete = 0.0
        tot3_desc = 0.0
        tot3_liq = 0.0

        for idx_p, p_placa in enumerate(sorted_placas, 1):
            p_viajes = placas_map[p_placa]
            p_res = calculate_liquidacion_resumen(p_viajes, params)

            p_v_orig = sum(float(getattr(x, "volumen_origen_litros", 0.0) or 0.0) for x in p_viajes)
            p_v_rec = sum(float(getattr(x, "volumen_recepcionado_litros", 0.0) or 0.0) for x in p_viajes)
            p_v_m3 = round(p_v_rec / 1000.0, 3)
            p_m_desc = float(p_res.get("desc_merma_bs", 0.0) or 0.0)
            p_flete_bruto = float(p_res.get("flete_total_bruto", 0.0) or 0.0)
            p_tot_desc = float(p_res.get("total_descuentos_bs", 0.0) or 0.0)
            p_liq = float(p_res.get("liquido_pagable_bs", 0.0) or 0.0)

            tot3_viajes += len(p_viajes)
            tot3_orig += p_v_orig
            tot3_rec += p_v_rec
            tot3_fact_m3 += p_v_m3
            tot3_merma += p_m_desc
            tot3_flete += p_flete_bruto
            tot3_desc += p_tot_desc
            tot3_liq += p_liq

            ws3.row_dimensions[curr_r3].height = 20
            row_vals3 = [
                idx_p,
                p_placa,
                "Propia",
                len(p_viajes),
                p_v_orig,
                p_v_rec,
                p_v_m3,
                p_m_desc,
                p_flete_bruto,
                p_tot_desc,
                p_liq
            ]

            for c_idx, val in enumerate(row_vals3, 1):
                c = ws3.cell(row=curr_r3, column=c_idx, value=val)
                c.font = FONT_DATA_REGULAR
                c.border = BORDER_THIN_BLACK
                if c_idx in (1, 2, 3):
                    c.alignment = Alignment(horizontal="center", vertical="center")
                elif c_idx == 4:
                    c.alignment = Alignment(horizontal="center", vertical="center")
                    c.number_format = '#,##0'
                elif c_idx in (5, 6):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                    c.number_format = '#,##0'
                elif c_idx == 7:
                    c.alignment = Alignment(horizontal="right", vertical="center")
                    c.number_format = '#,##0.00'
                else:
                    c.alignment = Alignment(horizontal="right", vertical="center")
                    c.number_format = '#,##0.00'

            curr_r3 += 1

        # Fila Total General Matriz
        ws3.row_dimensions[curr_r3].height = 24
        ws3.merge_cells(start_row=curr_r3, start_column=1, end_row=curr_r3, end_column=3)
        c_tot3_lbl = ws3.cell(row=curr_r3, column=1, value="TOTAL GENERAL:")
        c_tot3_lbl.alignment = Alignment(horizontal="right", vertical="center")

        ws3.cell(row=curr_r3, column=4, value=tot3_viajes).number_format = '#,##0'
        ws3.cell(row=curr_r3, column=5, value=tot3_orig).number_format = '#,##0'
        ws3.cell(row=curr_r3, column=6, value=tot3_rec).number_format = '#,##0'
        ws3.cell(row=curr_r3, column=7, value=tot3_fact_m3).number_format = '#,##0.00'
        ws3.cell(row=curr_r3, column=8, value=tot3_merma).number_format = '#,##0.00'
        ws3.cell(row=curr_r3, column=9, value=tot3_flete).number_format = '#,##0.00'
        ws3.cell(row=curr_r3, column=10, value=tot3_desc).number_format = '#,##0.00'
        ws3.cell(row=curr_r3, column=11, value=tot3_liq).number_format = '#,##0.00'

        for c_idx in range(1, 12):
            c_end = ws3.cell(row=curr_r3, column=c_idx)
            c_end.font = FONT_TOTAL_MAIN
            c_end.fill = FILL_SHADED_GRAY
            c_end.border = BORDER_TOTAL_DOUBLE
            if c_idx >= 4:
                c_end.alignment = Alignment(horizontal="right", vertical="center")

        ws3.page_setup.orientation = ws3.ORIENTATION_LANDSCAPE
        ws3.page_setup.paperSize = ws3.PAPERSIZE_LETTER
        ws3.sheet_properties.pageSetUpPr.fitToPage = True
        ws3.page_setup.fitToWidth = 1
        ws3.page_setup.fitToHeight = 0
        ws3.print_options.horizontalCentered = True

        ws3.page_margins.top = 0.8
        ws3.page_margins.bottom = 0.4
        ws3.page_margins.left = 0.4
        ws3.page_margins.right = 0.4
        ws3.page_margins.header = 0.3
        ws3.page_margins.footer = 0.3

        min_widths_sheet3 = {
            "A": 7.0, "B": 15.0, "C": 14.0, "D": 14.0, "E": 17.0,
            "F": 17.0, "G": 16.0, "H": 18.0, "I": 19.0, "J": 20.0,
            "K": 20.0
        }
        adjust_column_widths(ws3, min_widths_sheet3)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


# =========================================================================
# EXPORTACIÓN 4: RESUMEN EJECUTIVO CONSOLIDADO DE FLOTA POR PERIODO
# =========================================================================
def export_resumen_flota_excel(
    empresa: Dict[str, Any],
    periodo_label: str,
    display_label: str,
    placas_data: List[Any],
    params: Any
) -> io.BytesIO:
    """
    Genera un informe Excel ejecutivo con la tabla consolidada de todas las cisternas
    y su estado de liquidación para el período seleccionado.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Resumen de Flota"
    ws.views.sheetView[0].showGridLines = True

    empresa_nombre = empresa.get("name", "EMPRESA DE TRANSPORTE")
    logo_b64 = empresa.get("logo_base64")

    # Cabecera Superior
    ws.merge_cells("A2:E2")
    ws["A2"] = "CONSOLIDADO GENERAL DE LIQUIDACIONES DE FLOTA"
    ws["A2"].font = FONT_MAIN_TITLE
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center")

    ws.merge_cells("A3:E3")
    ws["A3"] = f"PERIODO: {display_label.upper()}"
    ws["A3"].font = FONT_TITLE_REGULAR
    ws["A3"].alignment = Alignment(horizontal="left", vertical="center")

    ws.merge_cells("G2:L3")
    ws["G2"] = empresa_nombre.upper()
    ws["G2"].font = Font(name=FONT_FAMILY, size=12, bold=True, color="0F172A")
    ws["G2"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    add_logo_to_worksheet(ws, logo_base64=logo_b64, empresa_name=empresa_nombre, cell_coord="L1", max_width=140, max_height=48)

    headers = [
        "Nº", "PLACA", "TIPO FLOTA", "VIAJES", "VOL. FACTURADO (Lt)", "VOL. FACTURADO (m³)",
        "FLETE TOTAL BRUTO (Bs)", "DESC. MERMA (Bs)", "TOTAL DEDUCCIONES (Bs)",
        "LÍQUIDO PAGABLE (Bs)", "ESTADO", "CÓDIGO PLANILLA"
    ]

    header_row = 5
    ws.row_dimensions[header_row].height = 28
    for col_idx, h_text in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col_idx, value=h_text)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN_BLACK

    curr_row = header_row + 1
    tot_viajes = 0
    tot_vol_lt = 0.0
    tot_vol_m3 = 0.0
    tot_flete = 0.0
    tot_mermas = 0.0
    tot_desc = 0.0
    tot_liquido = 0.0

    for idx, item in enumerate(placas_data, 1):
        p_placa = getattr(item, "placa", None) if not isinstance(item, dict) else item.get("placa", "")
        p_tipo = getattr(item, "tipo_flota", None) if not isinstance(item, dict) else item.get("tipo_flota", "Propia")
        p_viajes = int(getattr(item, "viajes_count", None) if not isinstance(item, dict) else item.get("viajes_count", 0))
        p_vol_lt = float(getattr(item, "volumen_facturado_litros", None) if not isinstance(item, dict) else item.get("volumen_facturado_litros", 0.0))
        p_vol_m3 = round(p_vol_lt / 1000.0, 3)
        p_flete = float(getattr(item, "flete_total_bruto_bs", None) if not isinstance(item, dict) else item.get("flete_total_bruto_bs", 0.0))
        p_merma = float(getattr(item, "desc_merma_bs", None) if not isinstance(item, dict) else item.get("desc_merma_bs", 0.0))
        p_desc = float(getattr(item, "total_descuentos_bs", None) if not isinstance(item, dict) else item.get("total_descuentos_bs", 0.0))
        p_liq = float(getattr(item, "liquido_pagable_bs", None) if not isinstance(item, dict) else item.get("liquido_pagable_bs", 0.0))
        p_estado = getattr(item, "estado", None) if not isinstance(item, dict) else item.get("estado", "Pendiente")
        p_codigo = getattr(item, "codigo", None) if not isinstance(item, dict) else (item.get("codigo") or "-")
        if not p_codigo:
            p_codigo = "-"

        tot_viajes += p_viajes
        tot_vol_lt += p_vol_lt
        tot_vol_m3 += p_vol_m3
        tot_flete += p_flete
        tot_mermas += p_merma
        tot_desc += p_desc
        tot_liquido += p_liq

        row_vals = [
            (idx, "center", None),
            (p_placa, "center", None),
            (p_tipo, "center", None),
            (p_viajes, "center", '#,##0'),
            (p_vol_lt, "right", '#,##0'),
            (p_vol_m3, "right", '#,##0.00'),
            (p_flete, "right", '#,##0.00'),
            (p_merma, "right", '#,##0.00'),
            (p_desc, "right", '#,##0.00'),
            (p_liq, "right", '#,##0.00'),
            (p_estado, "center", None),
            (p_codigo, "center", None)
        ]

        ws.row_dimensions[curr_row].height = 20
        for col_idx, (v_val, a_align, n_fmt) in enumerate(row_vals, 1):
            cell = ws.cell(row=curr_row, column=col_idx, value=v_val)
            cell.font = FONT_DATA_REGULAR
            cell.alignment = Alignment(horizontal=a_align, vertical="center")
            cell.border = BORDER_THIN_BLACK
            if n_fmt:
                cell.number_format = n_fmt
        curr_row += 1

    # Fila de Totales
    ws.row_dimensions[curr_row].height = 24
    c_tot_label = ws.cell(row=curr_row, column=1, value="TOTALES")
    c_tot_label.alignment = Alignment(horizontal="center", vertical="center")
    ws.merge_cells(f"A{curr_row}:C{curr_row}")

    ws.cell(row=curr_row, column=4, value=tot_viajes).number_format = '#,##0'
    ws.cell(row=curr_row, column=5, value=tot_vol_lt).number_format = '#,##0'
    ws.cell(row=curr_row, column=6, value=tot_vol_m3).number_format = '#,##0.00'
    ws.cell(row=curr_row, column=7, value=tot_flete).number_format = '#,##0.00'
    ws.cell(row=curr_row, column=8, value=tot_mermas).number_format = '#,##0.00'
    ws.cell(row=curr_row, column=9, value=tot_desc).number_format = '#,##0.00'
    ws.cell(row=curr_row, column=10, value=tot_liquido).number_format = '#,##0.00'
    ws.cell(row=curr_row, column=11, value="")
    ws.cell(row=curr_row, column=12, value="")

    for c in range(1, 13):
        cell_t = ws.cell(row=curr_row, column=c)
        cell_t.font = FONT_TOTAL_MAIN
        cell_t.fill = FILL_SHADED_GRAY
        cell_t.border = BORDER_TOTAL_DOUBLE
        if c in [4, 5, 6, 7, 8, 9, 10]:
            cell_t.alignment = Alignment(horizontal="right", vertical="center")

    # Firmas Oficiales
    sign_start_row = curr_row + 4
    ws.row_dimensions[sign_start_row].height = 17
    ws.row_dimensions[sign_start_row + 1].height = 18
    ws.row_dimensions[sign_start_row + 2].height = 40

    realizado_nom = getattr(params, "firma_realizado_por", "JAQUELINE LOVERA TIÑINI")
    panels = [
        ("A", "C", realizado_nom, " REALIZADO POR:"),
        ("D", "F", "", " REVISADO POR:"),
        ("G", "I", "", " AUTORIZADO POR:"),
        ("J", "L", "", " CANCELADO POR:")
    ]
    for col_s, col_e, n_val, l_val in panels:
        if n_val:
            ws.merge_cells(f"{col_s}{sign_start_row}:{col_e}{sign_start_row}")
            ws[f"{col_s}{sign_start_row}"] = n_val
            ws[f"{col_s}{sign_start_row}"].font = Font(name=FONT_FAMILY, size=8.5, bold=True)
            ws[f"{col_s}{sign_start_row}"].alignment = Alignment(horizontal="center", vertical="bottom")

    for col_u in range(1, 13):
        ws.cell(row=sign_start_row + 1, column=col_u).border = Border(bottom=Side(style='thin', color='000000'))

    row_tags = sign_start_row + 2
    for col_s, col_e, _, l_val in panels:
        ws.merge_cells(f"{col_s}{row_tags}:{col_e}{row_tags}")
        ws[f"{col_s}{row_tags}"] = l_val
        ws[f"{col_s}{row_tags}"].font = Font(name=FONT_FAMILY, size=8, bold=True)
        ws[f"{col_s}{row_tags}"].alignment = Alignment(horizontal="left", vertical="top")

    # Margen y tamaño
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_options.horizontalCentered = True

    ws.page_margins.top = 0.8
    ws.page_margins.bottom = 0.4
    ws.page_margins.left = 0.4
    ws.page_margins.right = 0.4

    min_widths = {
        "A": 6, "B": 14, "C": 14, "D": 10, "E": 18, "F": 18,
        "G": 20, "H": 18, "I": 20, "J": 20, "K": 16, "L": 24
    }
    adjust_column_widths(ws, min_widths)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

