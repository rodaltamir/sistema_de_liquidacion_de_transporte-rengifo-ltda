import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from typing import Dict, Any, List

# Estilos corporativos para transporte
FONT_TITLE = Font(name="Arial", size=14, bold=True, color="1E293B")
FONT_SUBTITLE = Font(name="Arial", size=10, bold=True, color="334155")
FONT_HEADER = Font(name="Arial", size=9, bold=True, color="FFFFFF")
FONT_BOLD = Font(name="Arial", size=9, bold=True, color="0F172A")
FONT_REGULAR = Font(name="Arial", size=9, color="1E293B")
FONT_MUTED = Font(name="Arial", size=8, italic=True, color="64748B")

FILL_HEADER = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Azul Marino Oficial
FILL_SUBHEADER = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid") # Celeste Institucional
FILL_ACCENT = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid") # Gris suave
FILL_TOTAL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid") # Gris intermedio
FILL_HIGHLIGHT = PatternFill(start_color="FEF08A", end_color="FEF08A", fill_type="solid") # Amarillo suave
FILL_SUCCESS = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid") # Verde claro para líquido pagable

BORDER_THIN = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)
BORDER_TOP_THICK = Border(
    top=Side(style='medium', color='0F172A'),
    bottom=Side(style='double', color='0F172A'),
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1')
)

def export_liquidacion_placa_excel(liquidacion: Any, viajes: List[Any], empresa: Dict[str, Any], params: Any) -> io.BytesIO:
    """
    Genera un archivo Excel (.xlsx) oficial multi-hoja conforme al estándar de liquidación:
    - Pestaña 1: 'Detalle Fletes' (Página 2 del PDF - Fletes por Camión y Merma)
    - Pestaña 2: 'Resumen Descuentos' (Página 3 del PDF - Deducciones y Líquido Pagable)
    """
    wb = openpyxl.Workbook()
    
    # -------------------------------------------------------------
    # HOJA 1: DETALLE DE FLETES (PÁGINA 2 DEL PDF)
    # -------------------------------------------------------------
    ws1 = wb.active
    ws1.title = "Detalle Fletes"
    ws1.views.sheetView[0].showGridLines = True

    # Encabezado
    ws1.merge_cells("A2:J2")
    ws1["A2"] = "LIQUIDACIÓN DE FLETES - DETALLE OPERATIVO"
    ws1["A2"].font = FONT_TITLE
    ws1["A2"].alignment = Alignment(horizontal="left", vertical="center")

    ws1["A3"] = f"PERIODO: {liquidacion.periodo_mes}"
    ws1["A3"].font = FONT_SUBTITLE
    
    ws1["A4"] = f"PLACA: {liquidacion.placa}"
    ws1["A4"].font = FONT_SUBTITLE

    ws1.merge_cells("L2:Q3")
    empresa_nombre = empresa.get("name", "EMPRESA DE TRANSPORTE")
    ws1["L2"] = empresa_nombre
    ws1["L2"].font = Font(name="Arial", size=11, bold=True, color="0369A1")
    ws1["L2"].alignment = Alignment(horizontal="right", vertical="center")

    # Factor de merma general
    ws1["P4"] = "FACTOR MERMA:"
    ws1["P4"].font = FONT_BOLD
    ws1["P4"].alignment = Alignment(horizontal="right", vertical="center")
    ws1["Q4"] = getattr(params, 'precio_merma_general_bs', 7.45)
    ws1["Q4"].font = Font(name="Arial", size=10, bold=True, color="B91C1C")
    ws1["Q4"].border = BORDER_THIN
    ws1["Q4"].alignment = Alignment(horizontal="center", vertical="center")

    # Columnas de Página 2
    headers = [
        "Nº", "FECHA DE CARGA", "FECHA DE DESCARGA", "MIC/DTA Nº", "EMPRESA",
        "PLACA", "TRAMO", "CLIENTE", "PRODUCTO", "Volumen en LL Origen",
        "Volumen Recepcionado", "Merma Real (Lts)", "Total Merma Excedente",
        "TOLERANCIA MERMA", "Merma a Descontar Bs", "TARIFA Bs.", "Total a pagar en Bob."
    ]

    row_num = 6
    for col_idx, header in enumerate(headers, 1):
        cell = ws1.cell(row=row_num, column=col_idx, value=header)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN
    ws1.row_dimensions[row_num].height = 28

    # Filas de Viajes
    start_row = 7
    current_row = start_row
    for idx, v in enumerate(viajes, 1):
        ws1.cell(row=current_row, column=1, value=idx).alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=2, value=str(v.fecha_carga)).alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=3, value=str(v.fecha_descarga)).alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=4, value=v.mic_dta or "-").alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=5, value=empresa.get("name", ""))
        ws1.cell(row=current_row, column=6, value=v.placa).alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=7, value=v.tramo)
        ws1.cell(row=current_row, column=8, value=v.cliente or "YPFB").alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=9, value=v.producto).alignment = Alignment(horizontal="center")

        c_orig = ws1.cell(row=current_row, column=10, value=v.volumen_origen_litros)
        c_orig.number_format = '#,##0.00'
        c_orig.alignment = Alignment(horizontal="right")

        c_rec = ws1.cell(row=current_row, column=11, value=v.volumen_recepcionado_litros)
        c_rec.number_format = '#,##0.00'
        c_rec.alignment = Alignment(horizontal="right")

        c_mr = ws1.cell(row=current_row, column=12, value=v.merma_real_litros)
        c_mr.number_format = '#,##0.0'
        c_mr.alignment = Alignment(horizontal="right")

        c_mex = ws1.cell(row=current_row, column=13, value=v.merma_excedente_litros)
        c_mex.number_format = '#,##0.0'
        c_mex.alignment = Alignment(horizontal="right")

        tol_str = f"{v.merma_tolerable_litros:.0f} Lts ({v.tolerancia_pct}%)"
        ws1.cell(row=current_row, column=14, value=tol_str).alignment = Alignment(horizontal="center")

        c_mdesc = ws1.cell(row=current_row, column=15, value=v.merma_descontar_bs)
        c_mdesc.number_format = '#,##0.00'
        c_mdesc.alignment = Alignment(horizontal="right")

        c_tar = ws1.cell(row=current_row, column=16, value=v.tarifa_flete)
        c_tar.number_format = '#,##0.00'
        c_tar.alignment = Alignment(horizontal="right")

        c_flete = ws1.cell(row=current_row, column=17, value=v.flete_total_bs)
        c_flete.number_format = '#,##0.00'
        c_flete.font = FONT_BOLD
        c_flete.alignment = Alignment(horizontal="right")

        for c in range(1, 18):
            cell = ws1.cell(row=current_row, column=c)
            cell.font = FONT_REGULAR if c != 17 else FONT_BOLD
            cell.border = BORDER_THIN
        ws1.row_dimensions[current_row].height = 20
        current_row += 1

    # Fila de Totales Hoja 1
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=9)
    c_tot_label = ws1.cell(row=current_row, column=1, value="TOTALES:")
    c_tot_label.font = FONT_BOLD
    c_tot_label.alignment = Alignment(horizontal="right")

    c_tot_orig = ws1.cell(row=current_row, column=10, value=liquidacion.total_volumen_origen_litros)
    c_tot_orig.number_format = '#,##0.00'
    c_tot_orig.font = FONT_BOLD
    c_tot_orig.alignment = Alignment(horizontal="right")

    c_tot_rec = ws1.cell(row=current_row, column=11, value=liquidacion.total_volumen_recepcionado_litros)
    c_tot_rec.number_format = '#,##0.00'
    c_tot_rec.font = FONT_BOLD
    c_tot_rec.alignment = Alignment(horizontal="right")

    ws1.cell(row=current_row, column=12, value=liquidacion.total_merma_real_litros).number_format = '#,##0.0'
    ws1.cell(row=current_row, column=13, value=liquidacion.total_merma_excedente_litros).number_format = '#,##0.0'
    ws1.cell(row=current_row, column=14, value="")
    ws1.cell(row=current_row, column=15, value=liquidacion.desc_merma_bs).number_format = '#,##0.00'
    ws1.cell(row=current_row, column=16, value="")

    c_tot_flete = ws1.cell(row=current_row, column=17, value=liquidacion.flete_total_bruto_bs)
    c_tot_flete.number_format = '#,##0.00'
    c_tot_flete.font = Font(name="Arial", size=10, bold=True, color="0F172A")
    c_tot_flete.fill = FILL_HIGHLIGHT
    c_tot_flete.alignment = Alignment(horizontal="right")

    for c in range(1, 18):
        cell = ws1.cell(row=current_row, column=c)
        cell.border = BORDER_TOP_THICK
        if c < 17:
            cell.fill = FILL_TOTAL

    # Bloque de Firmas (Página 2 del PDF)
    sign_row = current_row + 4
    signatures = [
        ("REALIZADO POR:", getattr(params, 'firma_realizado_por', 'JAQUELINE LOVERA TIÑINI')),
        ("REVISADO POR:", getattr(params, 'firma_revisado_por', 'JOSE LOVERA TIÑINI / GERENTE GENERAL')),
        ("AUTORIZADO POR:", getattr(params, 'firma_autorizado_por', 'DIRECTORIO')),
        ("CANCELADO POR:", getattr(params, 'firma_cancelado_por', 'TOMASA TIÑINI MITA / APOYO'))
    ]

    col_positions = [2, 6, 10, 14]
    for idx, (title, name) in enumerate(signatures):
        col = col_positions[idx]
        ws1.merge_cells(start_row=sign_row, start_column=col, end_row=sign_row, end_column=col+2)
        ws1.merge_cells(start_row=sign_row+1, start_column=col, end_row=sign_row+1, end_column=col+2)
        
        c_title = ws1.cell(row=sign_row, column=col, value=title)
        c_title.font = FONT_BOLD
        c_title.alignment = Alignment(horizontal="center")
        
        c_name = ws1.cell(row=sign_row+1, column=col, value=name)
        c_name.font = FONT_REGULAR
        c_name.alignment = Alignment(horizontal="center")

        for r in range(sign_row, sign_row+3):
            for cc in range(col, col+3):
                ws1.cell(row=r, column=cc).border = BORDER_THIN

    # Autoajustar anchos en Hoja 1
    for col in ws1.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len and len(val_str) < 40:
                max_len = len(val_str)
        ws1.column_dimensions[col_letter].width = max(max_len + 3, 11)

    # -------------------------------------------------------------
    # HOJA 2: RESUMEN DE DESCUENTOS Y LÍQUIDO PAGABLE (PÁGINA 3 DEL PDF)
    # -------------------------------------------------------------
    ws2 = wb.create_sheet(title="Resumen Descuentos")
    ws2.views.sheetView[0].showGridLines = True

    # Encabezado Hoja 2
    ws2.merge_cells("B2:D2")
    ws2["B2"] = "LIQUIDACIÓN DE FLETES - RESUMEN DE PAGOS"
    ws2["B2"].font = FONT_TITLE
    ws2["B2"].alignment = Alignment(horizontal="left", vertical="center")

    ws2["B3"] = f"PERIODO: {liquidacion.periodo_mes}"
    ws2["B3"].font = FONT_SUBTITLE
    
    ws2["B4"] = f"PLACA: {liquidacion.placa}"
    ws2["B4"].font = FONT_SUBTITLE

    ws2.merge_cells("E2:G3")
    ws2["E2"] = empresa_nombre
    ws2["E2"].font = Font(name="Arial", size=12, bold=True, color="0369A1")
    ws2["E2"].alignment = Alignment(horizontal="right", vertical="center")

    # Tabla Central de Deducciones (Idéntica a la Hoja 3 del PDF)
    r = 6
    ws2.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
    ws2.cell(row=r, column=3, value="DESCRIPCIÓN").font = FONT_HEADER
    ws2.cell(row=r, column=3).fill = FILL_HEADER
    ws2.cell(row=r, column=3).alignment = Alignment(horizontal="center", vertical="center")
    
    ws2.cell(row=r, column=6, value="TOTAL Bs").font = FONT_HEADER
    ws2.cell(row=r, column=6).fill = FILL_HEADER
    ws2.cell(row=r, column=6).alignment = Alignment(horizontal="center", vertical="center")
    
    for c in range(3, 7):
        ws2.cell(row=r, column=c).border = BORDER_THIN
    ws2.row_dimensions[r].height = 24

    items = [
        ("FLETE TOTAL BRUTO", liquidacion.flete_total_bruto_bs, True, False, FILL_TOTAL),
        ("(-) Descuento por Merma", liquidacion.desc_merma_bs, False, False, None),
        ("(-) Descuento de Comisión 1 $us p/m3", liquidacion.desc_comision_usd_m3_bs, False, False, None),
        ("(-) Descuento de Comisión 7%", liquidacion.desc_comision_7pct_bs, False, False, None),
        ("(-) Descuento YPFB BOL-GART 7%", liquidacion.desc_comision_ypfb_bolgart_7pct_bs, False, False, None),
        ("(-) Descuento de Comisión 3%", liquidacion.desc_comision_3pct_bs, False, False, None),
        ("(-) Hojas de Ruta", liquidacion.desc_hojas_ruta_bs, False, False, None),
        ("(-) GPS", liquidacion.desc_gps_bs, False, False, None),
        ("(-) Anticipos y Otros", liquidacion.desc_anticipos_otros_bs, False, False, None),
    ]

    if liquidacion.desc_otros_ajustes_bs and liquidacion.desc_otros_ajustes_bs != 0:
        items.append(("(-) Otros Descuentos / Ajustes", liquidacion.desc_otros_ajustes_bs, False, False, None))

    items.append(("(=) TOTAL DESCUENTOS", liquidacion.total_descuentos_bs, True, False, FILL_ACCENT))
    items.append(("(=) LÍQUIDO PAGABLE", liquidacion.liquido_pagable_bs, True, True, FILL_SUCCESS))

    for desc, val, is_bold, is_highlight, fill_bg in items:
        r += 1
        ws2.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
        c_desc = ws2.cell(row=r, column=3, value=desc)
        c_desc.font = FONT_BOLD if is_bold else FONT_REGULAR
        c_desc.alignment = Alignment(horizontal="left", vertical="center")

        c_val = ws2.cell(row=r, column=6, value=val)
        c_val.font = Font(name="Arial", size=10, bold=is_bold, color="0F172A" if not is_highlight else "166534")
        c_val.number_format = '#,##0.00'
        c_val.alignment = Alignment(horizontal="right", vertical="center")

        for c in range(3, 7):
            cell = ws2.cell(row=r, column=c)
            cell.border = BORDER_THIN
            if fill_bg:
                cell.fill = fill_bg
        ws2.row_dimensions[r].height = 22

    # 4 Bloques de firmas en Hoja 2
    sign_row3 = r + 4
    for idx, (title, name) in enumerate(signatures):
        c_start = 2 + idx * 2
        ws2.merge_cells(start_row=sign_row3, start_column=c_start, end_row=sign_row3, end_column=c_start+1)
        ws2.merge_cells(start_row=sign_row3+1, start_column=c_start, end_row=sign_row3+1, end_column=c_start+1)
        
        ws2.cell(row=sign_row3, column=c_start, value=title).font = FONT_BOLD
        ws2.cell(row=sign_row3, column=c_start).alignment = Alignment(horizontal="center")
        
        ws2.cell(row=sign_row3+1, column=c_start, value=name).font = FONT_REGULAR
        ws2.cell(row=sign_row3+1, column=c_start).alignment = Alignment(horizontal="center")

        for rr in range(sign_row3, sign_row3+3):
            for cc in range(c_start, c_start+2):
                ws2.cell(row=rr, column=cc).border = BORDER_THIN

    # Anchos de columna en hoja 2
    ws2.column_dimensions["A"].width = 4
    ws2.column_dimensions["B"].width = 15
    ws2.column_dimensions["C"].width = 18
    ws2.column_dimensions["D"].width = 18
    ws2.column_dimensions["E"].width = 18
    ws2.column_dimensions["F"].width = 22
    ws2.column_dimensions["G"].width = 16
    ws2.column_dimensions["H"].width = 16
    ws2.column_dimensions["I"].width = 16

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def export_liquidacion_asociacion_excel(asociacion_name: str, periodo_mes: str, grupos_empresa: List[Dict[str, Any]]) -> io.BytesIO:
    """
    Genera un archivo Excel (.xlsx) fiel a la Página 1 del PDF:
    Liquidación General de la Asociación (Reconciliación y Facturación de Fletes ante YPFB).
    Agrupa por Empresa de Transporte y Producto con subtotales, total general, cláusula legal y 4 firmas de auditoría.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Liquidacion Asociacion"
    ws.views.sheetView[0].showGridLines = True

    # Encabezado institucional
    ws.merge_cells("A1:P1")
    ws["A1"] = f"{asociacion_name.upper()} - LIQUIDACIÓN DE FLETES CONCILIADA"
    ws["A1"].font = FONT_TITLE
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:P2")
    ws["A2"] = f"(A LA FINALIZACIÓN DE LA PRESTACIÓN DEL SERVICIO DEL PERIODO {periodo_mes.upper()} Y DESPUÉS DE REALIZADA LA CONCILIACIÓN)"
    ws["A2"].font = FONT_SUBTITLE
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    # Columnas de Página 1 del PDF
    headers = [
        "LOTE", "Empresa Transporte", "Tramo", "Producto", "Placa",
        "Fecha Carga", "Fecha Recepción", "Volumen Despachado (Lts)",
        "Volumen Recepcionado (Lts)", "Merma Real (Lts)", "Merma Excedente (Lts)",
        "Precio Merma (Bs/L)", "Merma Descontar (Bs)", "Volumen Facturar (m3)",
        "Flete ($us/m3)", "Importe a Facturar (Bs)"
    ]

    r = 4
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=r, column=col_idx, value=h)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN
    ws.row_dimensions[r].height = 30

    tot_gen_desp = 0.0
    tot_gen_rec = 0.0
    tot_gen_mreal = 0.0
    tot_gen_mdesc_bs = 0.0
    tot_gen_m3 = 0.0
    tot_gen_importe_bs = 0.0

    current_row = 5
    for grp in grupos_empresa:
        empresa_name = grp.get("empresa_name", "")
        viajes = grp.get("viajes", [])

        # Fila de Empresa
        ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=16)
        c_emp = ws.cell(row=current_row, column=1, value=f"EMPRESA DE TRANSPORTE: {empresa_name.upper()}")
        c_emp.font = Font(name="Arial", size=10, bold=True, color="0C4A6E")
        c_emp.fill = PatternFill(start_color="BAE6FD", end_color="BAE6FD", fill_type="solid")
        for cc in range(1, 17):
            ws.cell(row=current_row, column=cc).border = BORDER_THIN
        current_row += 1

        sub_desp = 0.0
        sub_rec = 0.0
        sub_mreal = 0.0
        sub_mdesc_bs = 0.0
        sub_m3 = 0.0
        sub_importe_bs = 0.0

        for v in viajes:
            ws.cell(row=current_row, column=1, value=v.get("lote_codigo", "-")).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=2, value=empresa_name)
            ws.cell(row=current_row, column=3, value=v.get("tramo", ""))
            ws.cell(row=current_row, column=4, value=v.get("producto", "")).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=5, value=v.get("placa", "")).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=6, value=str(v.get("fecha_carga", ""))).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=7, value=str(v.get("fecha_descarga", ""))).alignment = Alignment(horizontal="center")

            desp = float(v.get("volumen_origen_litros", 0))
            rec = float(v.get("volumen_recepcionado_litros", 0))
            mreal = float(v.get("merma_real_litros", 0))
            mex = float(v.get("merma_excedente_litros", 0))
            p_merma = float(v.get("precio_merma_litro_bs", 0))
            mdesc = float(v.get("merma_descontar_bs", 0))
            m3_val = rec / 1000.0
            tarifa = float(v.get("tarifa_flete", 0))
            flete_bs = float(v.get("flete_total_bs", 0))

            ws.cell(row=current_row, column=8, value=desp).number_format = '#,##0'
            ws.cell(row=current_row, column=9, value=rec).number_format = '#,##0'
            ws.cell(row=current_row, column=10, value=mreal).number_format = '#,##0.0'
            ws.cell(row=current_row, column=11, value=mex).number_format = '#,##0.0'
            ws.cell(row=current_row, column=12, value=p_merma).number_format = '#,##0.00'
            ws.cell(row=current_row, column=13, value=mdesc).number_format = '#,##0.00'
            ws.cell(row=current_row, column=14, value=m3_val).number_format = '#,##0.000'
            ws.cell(row=current_row, column=15, value=tarifa).number_format = '#,##0.00'
            ws.cell(row=current_row, column=16, value=flete_bs).number_format = '#,##0.00'

            sub_desp += desp
            sub_rec += rec
            sub_mreal += mreal
            sub_mdesc_bs += mdesc
            sub_m3 += m3_val
            sub_importe_bs += flete_bs

            for cc in range(1, 17):
                ws.cell(row=current_row, column=cc).border = BORDER_THIN
            current_row += 1

        # Subtotal Empresa
        ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=7)
        c_sub = ws.cell(row=current_row, column=1, value=f"Total {empresa_name}")
        c_sub.font = FONT_BOLD
        c_sub.alignment = Alignment(horizontal="right")

        ws.cell(row=current_row, column=8, value=sub_desp).number_format = '#,##0'
        ws.cell(row=current_row, column=9, value=sub_rec).number_format = '#,##0'
        ws.cell(row=current_row, column=10, value=sub_mreal).number_format = '#,##0.0'
        ws.cell(row=current_row, column=11, value=0)
        ws.cell(row=current_row, column=12, value=0)
        ws.cell(row=current_row, column=13, value=sub_mdesc_bs).number_format = '#,##0.00'
        ws.cell(row=current_row, column=14, value=sub_m3).number_format = '#,##0.000'
        ws.cell(row=current_row, column=15, value=0)
        ws.cell(row=current_row, column=16, value=sub_importe_bs).number_format = '#,##0.00'

        for cc in range(1, 17):
            cell = ws.cell(row=current_row, column=cc)
            cell.font = FONT_BOLD
            cell.fill = FILL_ACCENT
            cell.border = BORDER_THIN

        tot_gen_desp += sub_desp
        tot_gen_rec += sub_rec
        tot_gen_mreal += sub_mreal
        tot_gen_mdesc_bs += sub_mdesc_bs
        tot_gen_m3 += sub_m3
        tot_gen_importe_bs += sub_importe_bs
        current_row += 1

    # Fila de Total General Asociación
    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=7)
    c_tot = ws.cell(row=current_row, column=1, value="TOTAL GENERAL ASOCIACIÓN")
    c_tot.font = Font(name="Arial", size=10, bold=True, color="0F172A")
    c_tot.alignment = Alignment(horizontal="right")

    ws.cell(row=current_row, column=8, value=tot_gen_desp).number_format = '#,##0'
    ws.cell(row=current_row, column=9, value=tot_gen_rec).number_format = '#,##0'
    ws.cell(row=current_row, column=10, value=tot_gen_mreal).number_format = '#,##0.0'
    ws.cell(row=current_row, column=11, value=0)
    ws.cell(row=current_row, column=12, value=0)
    ws.cell(row=current_row, column=13, value=tot_gen_mdesc_bs).number_format = '#,##0.00'
    ws.cell(row=current_row, column=14, value=tot_gen_m3).number_format = '#,##0.000'
    ws.cell(row=current_row, column=15, value=0)
    ws.cell(row=current_row, column=16, value=tot_gen_importe_bs).number_format = '#,##0.00'

    for cc in range(1, 17):
        cell = ws.cell(row=current_row, column=cc)
        cell.font = Font(name="Arial", size=10, bold=True)
        cell.fill = FILL_HIGHLIGHT
        cell.border = BORDER_TOP_THICK

    # Nota Legal (del PDF Página 1)
    current_row += 2
    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row+1, end_column=16)
    c_legal = ws.cell(row=current_row, column=1, value="Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación.")
    c_legal.font = FONT_MUTED
    c_legal.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

    # 4 Bloques de firmas institucionales para la Asociación
    sign_row = current_row + 3
    asoc_signatures = [
        "DIRECTORIO ASOCIACIÓN",
        "COMISIÓN DE CONCILIACIÓN",
        "REPRESENTANTES LEGALES",
        "AUDITORÍA / CONTABILIDAD"
    ]
    col_steps = [2, 6, 10, 14]
    for idx, title in enumerate(asoc_signatures):
        col = col_steps[idx]
        ws.merge_cells(start_row=sign_row, start_column=col, end_row=sign_row, end_column=col+2)
        ws.merge_cells(start_row=sign_row+1, start_column=col, end_row=sign_row+1, end_column=col+2)

        c_title = ws.cell(row=sign_row, column=col, value=title)
        c_title.font = FONT_BOLD
        c_title.alignment = Alignment(horizontal="center")

        c_line = ws.cell(row=sign_row+1, column=col, value="Firma y Sello")
        c_line.font = FONT_MUTED
        c_line.alignment = Alignment(horizontal="center")

        for r_s in range(sign_row, sign_row+3):
            for c_s in range(col, col+3):
                ws.cell(row=r_s, column=c_s).border = BORDER_THIN

    # Autoajustar anchos
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len and len(val_str) < 40:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 10)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_viajes_template_excel(empresa_name: str = "") -> io.BytesIO:
    """
    Genera una plantilla Excel (.xlsx) estructurada y formateada para la importación
    masiva de viajes y despachos de hidrocarburos/carga.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Carga de Viajes"
    ws.views.sheetView[0].showGridLines = True

    # Título y Guía
    ws.merge_cells("A1:K1")
    ws["A1"] = f"PLANTILLA DE IMPORTACIÓN MASIVA DE VIAJES - {empresa_name.upper() if empresa_name else 'EMPRESA DE TRANSPORTE'}"
    ws["A1"].font = FONT_TITLE
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center")

    ws.merge_cells("A2:K2")
    ws["A2"] = "Complete las filas a partir de la fila 4. Los cálculos de mermas y fletes se generarán automáticamente según el producto."
    ws["A2"].font = FONT_MUTED

    headers = [
        ("MIC/DTA Nº", "Ej. 23BO051130T", 16),
        ("PLACA", "Ej. 4412-DPC", 13),
        ("TRAMO", "Ej. ARICA - TAMBO QUEMADO - LA PAZ", 32),
        ("CLIENTE", "Ej. YPFB", 14),
        ("PRODUCTO", "GASOLINA, DIESEL o IYA", 15),
        ("FECHA CARGA", "YYYY-MM-DD (2026-03-01)", 16),
        ("FECHA DESCARGA", "YYYY-MM-DD (2026-03-05)", 16),
        ("VOL. ORIGEN (LTS)", "Litros cargados (ej. 34000)", 18),
        ("VOL. RECEPCIONADO (LTS)", "Litros entregados (ej. 33920)", 20),
        ("TARIFA FLETE", "Bs/m3 o USD (ej. 392.00)", 16),
        ("TIPO TARIFA", "BS_POR_M3 o USD_POR_M3", 16),
        ("PRECIO MERMA Bs/L", "Opcional (defecto 7.45)", 16),
        ("LOTE", "Opcional (ej. 1)", 10),
        ("OBSERVACIONES", "Opcional", 22)
    ]

    r = 4
    for idx, (title, comment, width) in enumerate(headers, 1):
        cell = ws.cell(row=r, column=idx, value=title)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN
        ws.column_dimensions[get_column_letter(idx)].width = width
    ws.row_dimensions[r].height = 26

    # 2 filas de ejemplo
    ejemplos = [
        ("23BO051130T", "4412-DPC", "ARICA - TAMBO QUEMADO - LA PAZ", "YPFB", "GASOLINA", "2026-03-01", "2026-03-05", 34000.0, 33920.0, 392.00, "BS_POR_M3", 7.45, "1", "Viaje de ejemplo Gasolina"),
        ("23CL257330A", "4412-DPC", "IQUIQUE - TAMBO QUEMADO - LA PAZ", "YPFB", "DIESEL", "2026-03-08", "2026-03-14", 33500.0, 33460.0, 738.00, "BS_POR_M3", 7.45, "1", "Viaje de ejemplo Diésel"),
    ]

    for row_idx, ej in enumerate(ejemplos, 5):
        for col_idx, val in enumerate(ej, 1):
            c = ws.cell(row=row_idx, column=col_idx, value=val)
            c.font = FONT_REGULAR
            c.border = BORDER_THIN
            if isinstance(val, float):
                c.number_format = '#,##0.00'
                c.alignment = Alignment(horizontal="right")
            elif col_idx in [1, 2, 4, 5, 6, 7, 11, 13]:
                c.alignment = Alignment(horizontal="center")
            else:
                c.alignment = Alignment(horizontal="left")
        ws.row_dimensions[row_idx].height = 20

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
