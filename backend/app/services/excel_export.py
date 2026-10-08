import io
import os
import base64
from datetime import datetime, date
from typing import Dict, Any, List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as OpenpyxlImage
from PIL import Image as PILImage

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
                val_lines = str(cell.value).split("\n")
                for line in val_lines:
                    max_len = max(max_len, len(str(line).strip()))
        if max_len > 0:
            ws.column_dimensions[col_letter].width = max(curr_w, min(max_len + 4, 46))


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

    # Desglose limpio de firmas oficiales (sin duplicar nombres ni cargos)
    realizado_nom, _ = parse_firma_entry(getattr(params, 'firma_realizado_por', 'JAQUELINE LOVERA TIÑINI'), 'JAQUELINE LOVERA TIÑINI', '')
    revisado_nom, revisado_carg = parse_firma_entry(getattr(params, 'firma_revisado_por', 'JOSE LOVERA TIÑINI / GERENTE GENERAL'), 'JOSE LOVERA TIÑINI', 'GERENTE GENERAL')
    autorizado_nom, autorizado_carg = parse_firma_entry(getattr(params, 'firma_autorizado_por', ''), '', '')
    cancelado_nom, cancelado_carg = parse_firma_entry(getattr(params, 'firma_cancelado_por', 'TOMASA TIÑINI MITA / APOYO'), 'TOMASA TIÑINI MITA', 'APOYO')

    # ---------------------------------------------------------------------
    # HOJA 1: DETALLE DE FLETES (FOTO 2)
    # ---------------------------------------------------------------------
    ws1 = wb.active
    ws1.title = "Liquidacion de Fletes"
    ws1.views.sheetView[0].showGridLines = True

    # 1. Cabecera Superior Izquierda (Combinada en columnas A-D para no estirar la columna A)
    ws1.merge_cells("A2:D2")
    ws1["A2"] = "LIQUIDACION DE FLETES"
    ws1["A2"].font = FONT_MAIN_TITLE
    ws1["A2"].alignment = Alignment(horizontal="left", vertical="center")

    ws1.merge_cells("A3:D3")
    ws1["A3"] = periodo_fmt
    ws1["A3"].font = FONT_TITLE_REGULAR
    ws1["A3"].alignment = Alignment(horizontal="left", vertical="center")

    ws1.merge_cells("A4:D4")
    ws1["A4"] = f"PLACA   {liquidacion.placa}"
    ws1["A4"].font = FONT_TITLE_BOLD
    ws1["A4"].alignment = Alignment(horizontal="left", vertical="center")

    # 2. Factor Merma Superior Derecha (Foto 2: celda con "7,45" en columna Q fila 4)
    factor_merma = getattr(params, 'precio_merma_general_bs', 7.45)
    c_factor = ws1.cell(row=4, column=17, value=factor_merma)
    c_factor.font = FONT_DATA_REGULAR
    c_factor.number_format = '0.00'
    c_factor.alignment = Alignment(horizontal="right", vertical="center")

    # 3. Logotipo en la Esquina Superior Derecha (Cols N-Q)
    add_logo_to_worksheet(ws1, logo_base64=logo_b64, empresa_name=empresa_nombre, cell_coord="N1", max_width=165, max_height=55)

    # 4. Encabezados de Columnas (Fila 6) - Idénticos a la Foto 2
    headers_sheet1 = [
        "Nº",
        "FECHA DE\nCARGA",
        "FECHA DE\nDESCARGA",
        "MIC/DTA Nº",
        "EMPRESA",
        "PLACA",
        "TRAMO",
        "CLIENTE",
        "PRODUCTO",
        "Volumen en\nLt. Origen",
        "Volumen\nRecepcionado",
        "Merma\nT-T",
        "Total\nMerma Litros",
        "MERMA\n0,15% s/Volumen\n(Diesel 0.15%\nGasolina 0.35%)",
        "Merma a\nDescontar\nY.P.F.B.",
        "TARIFA\nBs.",
        "Total a pagar\nen Bob."
    ]

    header_row = 6
    ws1.row_dimensions[header_row].height = 44

    for col_idx, h_text in enumerate(headers_sheet1, 1):
        cell = ws1.cell(row=header_row, column=col_idx, value=h_text)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN_BLACK

    # 5. Filas de Datos de Viajes
    curr_row = 7
    total_vol_orig = 0.0
    total_vol_rec = 0.0
    total_m_desc_bs = 0.0
    total_flete_bs = 0.0

    for idx, v in enumerate(viajes, 1):
        ws1.row_dimensions[curr_row].height = 21

        # Col 1: Nº
        c1 = ws1.cell(row=curr_row, column=1, value=idx)
        c1.alignment = Alignment(horizontal="center", vertical="center")

        # Col 2: Fecha Carga
        c2 = ws1.cell(row=curr_row, column=2, value=format_fecha_bolivia(v.fecha_carga))
        c2.alignment = Alignment(horizontal="center", vertical="center")

        # Col 3: Fecha Descarga
        c3 = ws1.cell(row=curr_row, column=3, value=format_fecha_bolivia(v.fecha_descarga))
        c3.alignment = Alignment(horizontal="center", vertical="center")

        # Col 4: MIC/DTA
        c4 = ws1.cell(row=curr_row, column=4, value=v.mic_dta or "-")
        c4.alignment = Alignment(horizontal="center", vertical="center")

        # Col 5: Empresa
        emp_display = empresa_nombre.replace("EMPRESA DE TRANSPORTES NACIONAL E INTERNACIONAL", "").strip() or empresa_nombre
        c5 = ws1.cell(row=curr_row, column=5, value=emp_display)
        c5.alignment = Alignment(horizontal="left", vertical="center")

        # Col 6: Placa
        c6 = ws1.cell(row=curr_row, column=6, value=v.placa)
        c6.alignment = Alignment(horizontal="center", vertical="center")

        # Col 7: Tramo
        c7 = ws1.cell(row=curr_row, column=7, value=v.tramo or "")
        c7.alignment = Alignment(horizontal="left", vertical="center")

        # Col 8: Cliente
        c8 = ws1.cell(row=curr_row, column=8, value=v.cliente or "YPFB")
        c8.alignment = Alignment(horizontal="center", vertical="center")

        # Col 9: Producto
        c9 = ws1.cell(row=curr_row, column=9, value=(v.producto or "").upper())
        c9.alignment = Alignment(horizontal="center", vertical="center")

        # Col 10: Volumen Origen
        v_orig = float(v.volumen_origen_litros or 0)
        total_vol_orig += v_orig
        c10 = ws1.cell(row=curr_row, column=10, value=v_orig)
        c10.number_format = '#,##0'
        c10.alignment = Alignment(horizontal="right", vertical="center")

        # Col 11: Volumen Recepcionado
        v_rec = float(v.volumen_recepcionado_litros or 0)
        total_vol_rec += v_rec
        c11 = ws1.cell(row=curr_row, column=11, value=v_rec)
        c11.number_format = '#,##0'
        c11.alignment = Alignment(horizontal="right", vertical="center")

        # Col 12: Merma T-T (Merma Real)
        m_real = float(v.merma_real_litros or 0)
        c12 = ws1.cell(row=curr_row, column=12, value=m_real)
        c12.number_format = '+#,##0.0;-#,##0.0;0.0'
        c12.alignment = Alignment(horizontal="right", vertical="center")

        # Col 13: Total Merma Litros (Excedente)
        m_exc = float(v.merma_excedente_litros or 0)
        c13 = ws1.cell(row=curr_row, column=13, value=m_exc)
        c13.number_format = '#,##0.0'
        c13.alignment = Alignment(horizontal="right", vertical="center")

        # Col 14: Tolerancia
        tol_lts = float(v.merma_tolerable_litros or 0)
        c14 = ws1.cell(row=curr_row, column=14, value=tol_lts)
        c14.number_format = '#,##0'
        c14.alignment = Alignment(horizontal="center", vertical="center")

        # Col 15: Merma Descontar YPFB
        m_desc = float(v.merma_descontar_bs or 0)
        total_m_desc_bs += m_desc
        c15 = ws1.cell(row=curr_row, column=15, value=m_desc)
        c15.number_format = '#,##0.00'
        c15.alignment = Alignment(horizontal="right", vertical="center")

        # Col 16: Tarifa Bs
        tarifa = float(v.tarifa_flete or 0)
        c16 = ws1.cell(row=curr_row, column=16, value=tarifa)
        c16.number_format = '#,##0.00'
        c16.alignment = Alignment(horizontal="right", vertical="center")

        # Col 17: Total a pagar en Bob.
        flete = float(v.flete_total_bs or 0)
        total_flete_bs += flete
        c17 = ws1.cell(row=curr_row, column=17, value=flete)
        c17.number_format = '#,##0.00'
        c17.alignment = Alignment(horizontal="right", vertical="center")

        for col_c in range(1, 18):
            ws1.cell(row=curr_row, column=col_c).font = FONT_DATA_REGULAR
            ws1.cell(row=curr_row, column=col_c).border = BORDER_THIN_BLACK

        curr_row += 1

    # 6. Fila de Totales de la Hoja 1 (Foto 2)
    ws1.row_dimensions[curr_row].height = 22

    # Conteo de viajes en columna 1
    c_tot_count = ws1.cell(row=curr_row, column=1, value=len(viajes))
    c_tot_count.font = FONT_DATA_BOLD
    c_tot_count.alignment = Alignment(horizontal="center", vertical="center")

    # Columnas 2 a 9 en blanco
    for c_empty in range(2, 10):
        ws1.cell(row=curr_row, column=c_empty, value="")

    # Totales de Volumen Origen y Recepcionado
    c_tot_orig = ws1.cell(row=curr_row, column=10, value=total_vol_orig or float(liquidacion.total_volumen_origen_litros or 0))
    c_tot_orig.number_format = '#,##0'
    c_tot_orig.font = FONT_DATA_BOLD
    c_tot_orig.alignment = Alignment(horizontal="right", vertical="center")

    c_tot_rec = ws1.cell(row=curr_row, column=11, value=total_vol_rec or float(liquidacion.total_volumen_recepcionado_litros or 0))
    c_tot_rec.number_format = '#,##0'
    c_tot_rec.font = FONT_DATA_BOLD
    c_tot_rec.alignment = Alignment(horizontal="right", vertical="center")

    for c_mid in range(12, 15):
        ws1.cell(row=curr_row, column=c_mid, value="")

    # Total Merma a Descontar YPFB (sombreado)
    c_tot_mdesc = ws1.cell(row=curr_row, column=15, value=total_m_desc_bs or float(liquidacion.desc_merma_bs or 0))
    c_tot_mdesc.number_format = '#,##0.00'
    c_tot_mdesc.font = FONT_DATA_BOLD
    c_tot_mdesc.fill = FILL_SHADED_GRAY
    c_tot_mdesc.alignment = Alignment(horizontal="right", vertical="center")

    ws1.cell(row=curr_row, column=16, value="")

    # Total a Pagar en Bob. (sombreado con doble borde)
    c_tot_pagar = ws1.cell(row=curr_row, column=17, value=total_flete_bs or float(liquidacion.flete_total_bruto_bs or 0))
    c_tot_pagar.number_format = '#,##0.00'
    c_tot_pagar.font = FONT_TOTAL_MAIN
    c_tot_pagar.fill = FILL_SHADED_GRAY
    c_tot_pagar.alignment = Alignment(horizontal="right", vertical="center")

    for col_c in range(1, 18):
        ws1.cell(row=curr_row, column=col_c).border = BORDER_TOTAL_DOUBLE

    # 7. Cuadro de Firmas Oficial (Foto 2 - Organizado simétricamente en columnas J a Q)
    # 4 Paneles de exactamente 2 columnas cada uno: J-K (1), L-M (2), N-O (3), P-Q (4)
    sign_start_row = curr_row + 4
    ws1.row_dimensions[sign_start_row].height = 20
    ws1.row_dimensions[sign_start_row + 1].height = 22
    ws1.row_dimensions[sign_start_row + 2].height = 20

    # Bloque 1: REALIZADO POR
    ws1.merge_cells("J{}:K{}".format(sign_start_row, sign_start_row))
    c_s1 = ws1["J{}".format(sign_start_row)]
    c_s1.value = "REALIZADO POR:"
    c_s1.font = Font(name=FONT_FAMILY, size=8, bold=True)
    c_s1.alignment = Alignment(horizontal="left", vertical="center")

    ws1.merge_cells("J{}:K{}".format(sign_start_row + 2, sign_start_row + 2))
    c_s1_name = ws1["J{}".format(sign_start_row + 2)]
    c_s1_name.value = realizado_nom
    c_s1_name.font = Font(name=FONT_FAMILY, size=8, bold=True)
    c_s1_name.alignment = Alignment(horizontal="center", vertical="center")

    # Bloque 2: REVISADO POR
    ws1.merge_cells("L{}:M{}".format(sign_start_row, sign_start_row))
    c_s2_name = ws1["L{}".format(sign_start_row)]
    c_s2_name.value = revisado_nom
    c_s2_name.font = Font(name=FONT_FAMILY, size=8, bold=True)
    c_s2_name.alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("L{}:M{}".format(sign_start_row + 1, sign_start_row + 1))
    c_s2_cargo = ws1["L{}".format(sign_start_row + 1)]
    c_s2_cargo.value = revisado_carg or "GERENTE GENERAL"
    c_s2_cargo.font = Font(name=FONT_FAMILY, size=7.5, bold=False)
    c_s2_cargo.alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("L{}:M{}".format(sign_start_row + 2, sign_start_row + 2))
    c_s2_tag = ws1["L{}".format(sign_start_row + 2)]
    c_s2_tag.value = "REVISADO POR:"
    c_s2_tag.font = Font(name=FONT_FAMILY, size=8, bold=True)
    c_s2_tag.alignment = Alignment(horizontal="center", vertical="center")

    # Bloque 3: AUTORIZADO POR
    ws1.merge_cells("N{}:O{}".format(sign_start_row + 2, sign_start_row + 2))
    c_s3 = ws1["N{}".format(sign_start_row + 2)]
    c_s3.value = "AUTORIZADO POR:"
    c_s3.font = Font(name=FONT_FAMILY, size=8, bold=True)
    c_s3.alignment = Alignment(horizontal="center", vertical="center")

    # Bloque 4: CANCELADO POR
    ws1.merge_cells("P{}:Q{}".format(sign_start_row, sign_start_row))
    c_s4_name = ws1["P{}".format(sign_start_row)]
    c_s4_name.value = cancelado_nom
    c_s4_name.font = Font(name=FONT_FAMILY, size=8, bold=True)
    c_s4_name.alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("P{}:Q{}".format(sign_start_row + 1, sign_start_row + 1))
    c_s4_cargo = ws1["P{}".format(sign_start_row + 1)]
    c_s4_cargo.value = cancelado_carg or "APOYO"
    c_s4_cargo.font = Font(name=FONT_FAMILY, size=7.5, bold=False)
    c_s4_cargo.alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("P{}:Q{}".format(sign_start_row + 2, sign_start_row + 2))
    c_s4_tag = ws1["P{}".format(sign_start_row + 2)]
    c_s4_tag.value = "CANCELADO POR:"
    c_s4_tag.font = Font(name=FONT_FAMILY, size=8, bold=True)
    c_s4_tag.alignment = Alignment(horizontal="center", vertical="center")

    # Bordes para cada panel del cuadro de firmas
    for r_f in range(sign_start_row, sign_start_row + 3):
        for col_f in range(10, 18):
            ws1.cell(row=r_f, column=col_f).border = BORDER_THIN_BLACK

    # Anchos base responsivos para Hoja 1
    min_widths_sheet1 = {
        "A": 6.5, "B": 15, "C": 15, "D": 18, "E": 28,
        "F": 13, "G": 38, "H": 13, "I": 13, "J": 16,
        "K": 16, "L": 14, "M": 14, "N": 17, "O": 16,
        "P": 14, "Q": 18
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
    ws2["B4"] = f"PLACA   {liquidacion.placa}"
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
    ws2.row_dimensions[sign_row2].height = 20
    ws2.row_dimensions[sign_row2 + 1].height = 22
    ws2.row_dimensions[sign_row2 + 2].height = 20

    # Panel 1: REALIZADO POR (Columna B)
    ws2.cell(row=sign_row2, column=2, value="REALIZADO POR:").font = Font(name=FONT_FAMILY, size=8, bold=True)
    ws2.cell(row=sign_row2, column=2).alignment = Alignment(horizontal="left", vertical="center")
    ws2.cell(row=sign_row2 + 2, column=2, value=realizado_nom).font = Font(name=FONT_FAMILY, size=8, bold=True)
    ws2.cell(row=sign_row2 + 2, column=2).alignment = Alignment(horizontal="center", vertical="center")

    # Panel 2: REVISADO POR (Columna C)
    ws2.cell(row=sign_row2, column=3, value=revisado_nom).font = Font(name=FONT_FAMILY, size=8, bold=True)
    ws2.cell(row=sign_row2, column=3).alignment = Alignment(horizontal="center", vertical="center")
    ws2.cell(row=sign_row2 + 1, column=3, value=revisado_carg or "GERENTE GENERAL").font = Font(name=FONT_FAMILY, size=7.5, bold=False)
    ws2.cell(row=sign_row2 + 1, column=3).alignment = Alignment(horizontal="center", vertical="center")
    ws2.cell(row=sign_row2 + 2, column=3, value="REVISADO POR:").font = Font(name=FONT_FAMILY, size=8, bold=True)
    ws2.cell(row=sign_row2 + 2, column=3).alignment = Alignment(horizontal="center", vertical="center")

    # Panel 3: AUTORIZADO POR (Columna D)
    ws2.cell(row=sign_row2 + 2, column=4, value="AUTORIZADO POR:").font = Font(name=FONT_FAMILY, size=8, bold=True)
    ws2.cell(row=sign_row2 + 2, column=4).alignment = Alignment(horizontal="center", vertical="center")

    # Panel 4: CANCELADO POR (Columna E)
    ws2.cell(row=sign_row2, column=5, value=cancelado_nom).font = Font(name=FONT_FAMILY, size=8, bold=True)
    ws2.cell(row=sign_row2, column=5).alignment = Alignment(horizontal="center", vertical="center")
    ws2.cell(row=sign_row2 + 1, column=5, value=cancelado_carg or "APOYO").font = Font(name=FONT_FAMILY, size=7.5, bold=False)
    ws2.cell(row=sign_row2 + 1, column=5).alignment = Alignment(horizontal="center", vertical="center")
    ws2.cell(row=sign_row2 + 2, column=5, value="CANCELADO POR:").font = Font(name=FONT_FAMILY, size=8, bold=True)
    ws2.cell(row=sign_row2 + 2, column=5).alignment = Alignment(horizontal="center", vertical="center")

    for r_f2 in range(sign_row2, sign_row2 + 3):
        for col_f2 in range(2, 6):
            ws2.cell(row=r_f2, column=col_f2).border = BORDER_THIN_BLACK

    # Anchos armónicos para Hoja 2
    min_widths_sheet2 = {
        "A": 4, "B": 26, "C": 26, "D": 22, "E": 24
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
    add_logo_to_worksheet(ws, logo_base64=None, empresa_name=asociacion_name, cell_coord="A1", max_width=130, max_height=48)

    ws.merge_cells("A2:D2")
    ws["A2"] = "Gerencia de Productos Derivados e Industrializados - GPDI"
    ws["A2"].font = Font(name=FONT_FAMILY, size=7.5, bold=True, color="334155")

    ws.merge_cells("A3:D3")
    ws["A3"] = "Dirección de Operaciones - DOP"
    ws["A3"].font = Font(name=FONT_FAMILY, size=7.5, bold=True, color="334155")

    ws.merge_cells("A4:D4")
    ws["A4"] = "Unidad de Pagos, Conciliaciones y Aduanas - UPCA"
    ws["A4"].font = Font(name=FONT_FAMILY, size=7.5, bold=True, color="334155")

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
    ws.row_dimensions[6].height = 20
    ws.row_dimensions[7].height = 28

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

        # Agrupar viajes por producto
        prod_dict: Dict[str, List[Any]] = {}
        for v in viajes:
            p_key = (v.get("producto") or "DO").upper()
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

                # 13 Volumen a Facturar (m3)
                v_m3 = v_rec / 1000.0
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
    ws.cell(row=current_row, column=1, value="2 = Diesel").font = FONT_DATA_BOLD
    current_row += 1
    ws.cell(row=current_row, column=1, value="3 = Insumos y Aditivos").font = FONT_DATA_BOLD

    current_row += 1
    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row + 1, end_column=15)
    c_ley = ws.cell(
        row=current_row, 
        column=1, 
        value="Informe H establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución de la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y remitida la planilla de Liquidación"
    )
    c_ley.font = FONT_MUTED_LEGAL
    c_ley.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

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
# EXPORTACIÓN 3: PLANTILLA DE CARGA DE VIAJES
# =========================================================================
def generate_viajes_template_excel(empresa_name: str = "") -> io.BytesIO:
    """
    Genera una plantilla Excel estructurada conforme al estándar oficial
    de 17 columnas (Foto 2) lista para importar viajes masivamente.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Plantilla Viajes"
    ws.views.sheetView[0].showGridLines = True

    ws.merge_cells("B2:E2")
    ws["B2"] = "PLANTILLA OFICIAL DE CARGA DE VIAJES"
    ws["B2"].font = FONT_MAIN_TITLE

    ws.merge_cells("B3:E3")
    ws["B3"] = empresa_name.upper() if empresa_name else "EMPRESA DE TRANSPORTE"
    ws["B3"].font = FONT_TITLE_BOLD

    # Logotipo en la parte superior derecha
    add_logo_to_worksheet(ws, logo_base64=None, empresa_name=empresa_name, cell_coord="N1", max_width=165, max_height=55)

    headers = [
        "Nº", "FECHA DE CARGA", "FECHA DE DESCARGA", "MIC/DTA Nº", "EMPRESA",
        "PLACA", "TRAMO", "CLIENTE", "PRODUCTO", "Volumen en Lt. Origen",
        "Volumen Recepcionado", "Merma T-T", "Total Merma Litros",
        "MERMA 0,15% s/Volumen", "Merma a Descontar Y.P.F.B.", "TARIFA Bs.", "Total a pagar en Bob."
    ]

    header_row = 5
    ws.row_dimensions[header_row].height = 34
    for col_idx, h_text in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col_idx, value=h_text)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN_BLACK

    # Fila de ejemplo
    sample_row = 6
    sample_data = [
        1, "28/02/2023", "03/03/2023", "23BO1391150T", empresa_name or "CHAXMANA TRANSPORT",
        "4412-DPC", "ARICA - TAMBO QUEMADO - LA PAZ", "YPFB", "GASOLINA",
        33959, 33900, -59.0, 14.0, 85, 104.30, 392.00, 13288.80
    ]
    for col_idx, val in enumerate(sample_data, 1):
        cell = ws.cell(row=sample_row, column=col_idx, value=val)
        cell.font = FONT_DATA_REGULAR
        cell.border = BORDER_THIN_BLACK
        if isinstance(val, (int, float)):
            cell.alignment = Alignment(horizontal="right", vertical="center")
        else:
            cell.alignment = Alignment(horizontal="center", vertical="center")

    min_widths_template = {
        "A": 6.5, "B": 15, "C": 15, "D": 18, "E": 28,
        "F": 13, "G": 38, "H": 13, "I": 13, "J": 16,
        "K": 16, "L": 13, "M": 14, "N": 17, "O": 16,
        "P": 14, "Q": 18
    }
    adjust_column_widths(ws, min_widths_template)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
