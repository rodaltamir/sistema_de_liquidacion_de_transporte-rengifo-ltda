import io
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def export_liquidacion_placa_pdf(liquidacion: Any, viajes: List[Any], empresa: Dict[str, Any], params: Any) -> io.BytesIO:
    """
    Genera un PDF oficial con dos páginas correspondientes a las Hojas 2 y 3 del PDF:
    - Página 1: Detalle de Fletes por Placa (Horizontal)
    - Página 2: Resumen de Descuentos y Líquido Pagable (Vertical u Horizontal con firmas)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=20,
        rightMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=14,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        fontName='Helvetica-Bold'
    )
    sub_style = ParagraphStyle(
        'SubStyle',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#334155'),
        fontName='Helvetica-Bold'
    )
    empresa_style = ParagraphStyle(
        'EmpresaStyle',
        parent=styles['Normal'],
        fontSize=12,
        leading=14,
        textColor=colors.HexColor('#0369A1'),
        fontName='Helvetica-Bold',
        alignment=2 # Derecha
    )
    cell_style = ParagraphStyle(
        'CellStyle',
        parent=styles['Normal'],
        fontSize=7,
        leading=8,
        fontName='Helvetica'
    )
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Normal'],
        fontSize=7,
        leading=8,
        textColor=colors.white,
        fontName='Helvetica-Bold',
        alignment=1
    )

    story = []

    # ==============================================================
    # PÁGINA 1: DETALLE DE FLETES (HOJA 2 DEL PDF)
    # ==============================================================
    empresa_name = empresa.get("name", "EMPRESA DE TRANSPORTE")
    header_data = [
        [
            Paragraph("<b>LIQUIDACION DE FLETES</b>", title_style),
            Paragraph(f"<b>{empresa_name}</b>", empresa_style)
        ],
        [
            Paragraph(f"MES: {liquidacion.periodo_mes} &nbsp;&nbsp;|&nbsp;&nbsp; <b>PLACA: {liquidacion.placa}</b>", sub_style),
            Paragraph(f"TASA MERMA: <b>{getattr(params, 'precio_merma_general_bs', 7.45)} Bs</b>", sub_style)
        ]
    ]
    t_header = Table(header_data, colWidths=[450, 300])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 8))

    # Tabla de viajes (17 columnas oficiales con Fila Especial de Factura)
    table_headers = [
        Paragraph("Nº", header_style),
        Paragraph("CARGA", header_style),
        Paragraph("DESCARGA", header_style),
        Paragraph("MCI/DTA Y OTROS", header_style),
        Paragraph("PLACA", header_style),
        Paragraph("TRAMO", header_style),
        Paragraph("CLIENTE", header_style),
        Paragraph("PROD.", header_style),
        Paragraph("VOL. ORIGEN", header_style),
        Paragraph("VOL. RECEP./DESC.", header_style),
        Paragraph("MERMA (L)", header_style),
        Paragraph("MERMA EXC.", header_style),
        Paragraph("TOLER.", header_style),
        Paragraph("DESC. (Bs)", header_style),
        Paragraph("VOL. FACT.", header_style),
        Paragraph("TARIFA", header_style),
        Paragraph("TOTAL (Bs)", header_style),
    ]

    t_rows = [table_headers]
    custom_table_styles = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]

    # Agrupar viajes por Tramo -> Producto -> Nº de Factura, ordenando cronológicamente
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

    for grp_k in groups_dict:
        groups_dict[grp_k].sort(key=lambda x: (str(getattr(x, "fecha_carga", "") or ""), getattr(x, "id", 0)))

    sorted_groups = sorted(
        groups_dict.items(),
        key=lambda item: (
            str(getattr(item[1][0], "fecha_carga", "") or "") if item[1] else "",
            item[0][0],
            item[0][1],
            item[0][2]
        )
    )

    global_idx = 1
    total_vol_fact_pdf = 0.0
    total_vol_orig_pdf = 0.0
    total_vol_rec_pdf = 0.0
    total_mreal_pdf = 0.0
    total_mdesc_pdf = 0.0
    total_flete_pdf = 0.0

    current_table_row = 1

    for (t_key, p_key, f_key), grp_viajes in sorted_groups:
        grp_vol_orig = 0.0
        grp_vol_rec = 0.0
        grp_vol_fact = 0.0
        grp_mreal = 0.0
        grp_mdesc = 0.0
        grp_flete = 0.0
        grp_tarifa = 0.0

        for v in grp_viajes:
            v_orig = float(v.volumen_origen_litros or 0)
            raw_v_fact = getattr(v, "volumen_facturado", None)
            if raw_v_fact is not None and float(raw_v_fact) > 0:
                v_fact_num = float(raw_v_fact)
                v_fact = (v_fact_num / 1000.0) if v_fact_num > 1000.0 else v_fact_num
            else:
                v_fact = round(v_rec / 1000.0, 3)
            raw_mreal = float(v.merma_real_litros or 0)
            mreal = -abs(raw_mreal) if raw_mreal != 0 else 0.0
            mdesc = float(v.merma_descontar_bs or 0)
            flete = float(v.flete_total_bs or 0)
            tarifa = float(v.tarifa_flete or 0)

            grp_vol_orig += v_orig
            grp_vol_rec += v_rec
            grp_vol_fact += v_fact
            grp_mreal += mreal
            grp_mdesc += mdesc
            grp_flete += flete
            grp_tarifa = tarifa

            total_vol_orig_pdf += v_orig
            total_vol_rec_pdf += v_rec
            total_vol_fact_pdf += v_fact
            total_mreal_pdf += mreal
            total_mdesc_pdf += mdesc
            total_flete_pdf += flete

            t_rows.append([
                Paragraph(str(global_idx), cell_style),
                Paragraph(str(v.fecha_carga), cell_style),
                Paragraph(str(v.fecha_descarga), cell_style),
                Paragraph(v.mic_dta or "-", cell_style),
                Paragraph(v.placa, cell_style),
                Paragraph(v.tramo, cell_style),
                Paragraph(v.cliente or "YPFB", cell_style),
                Paragraph(v.producto, cell_style),
                Paragraph(f"{v_orig:,.0f}", cell_style),
                Paragraph(f"{v_rec:,.0f}", cell_style),
                Paragraph(f"{mreal:,.1f}", cell_style),
                Paragraph(f"{v.merma_excedente_litros:,.1f}", cell_style),
                Paragraph(f"{v.merma_tolerable_litros:.0f}L", cell_style),
                Paragraph(f"{mdesc:,.2f}", cell_style),
                Paragraph(f"{v_fact:,.2f}", cell_style),
                Paragraph(f"{tarifa:,.2f}", cell_style),
                Paragraph(f"<b>{flete:,.2f}</b>", cell_style),
            ])
            global_idx += 1
            current_table_row += 1

        # FILA ESPECIAL: Subtotal del grupo con Factura y Fecha
        nros_f = [str(getattr(x, "nro_factura", "") or "").strip() for x in grp_viajes if getattr(x, "nro_factura", None)]
        nros_f = [x for x in dict.fromkeys(nros_f) if x and x != "-"]
        fechas_f = [str(x.fecha_factura) for x in grp_viajes if getattr(x, "fecha_factura", None)]
        fechas_f = [x for x in dict.fromkeys(fechas_f) if x and x != "-"]
        fac_label = ", ".join(nros_f) if nros_f else "S/F"
        fecha_label = ", ".join(fechas_f) if fechas_f else "-"

        subtotal_label = f"<b>TOTAL {p_key} | FACTURA: {fac_label} | FECHA: {fecha_label}</b>"

        t_rows.append([
            Paragraph(subtotal_label, cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph(f"<b>{grp_vol_orig:,.0f}</b>", cell_style),
            Paragraph(f"<b>{grp_vol_rec:,.0f}</b>", cell_style),
            Paragraph(f"<b>{grp_mreal:,.1f}</b>", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph(f"<b>{grp_mdesc:,.2f}</b>", cell_style),
            Paragraph(f"<b>{grp_vol_fact:,.2f}</b>", cell_style),
            Paragraph(f"<b>{grp_tarifa:,.2f}</b>", cell_style),
            Paragraph(f"<b>{grp_flete:,.2f}</b>", cell_style),
        ])

        custom_table_styles.append(('SPAN', (0, current_table_row), (7, current_table_row)))
        custom_table_styles.append(('BACKGROUND', (0, current_table_row), (-1, current_table_row), colors.HexColor('#FEF3C7')))
        current_table_row += 1

    # Fila total general
    t_rows.append([
        Paragraph("<b>TOTAL GENERAL</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{(getattr(liquidacion, 'total_volumen_origen_litros', None) or total_vol_orig_pdf):,.0f}</b>", cell_style),
        Paragraph(f"<b>{(getattr(liquidacion, 'total_volumen_recepcionado_litros', None) or total_vol_rec_pdf):,.0f}</b>", cell_style),
        Paragraph(f"<b>{(getattr(liquidacion, 'total_merma_real_litros', None) or total_mreal_pdf):,.1f}</b>", cell_style),
        Paragraph(f"<b>{(getattr(liquidacion, 'total_merma_excedente_litros', None) or 0.0):,.1f}</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{(getattr(liquidacion, 'desc_merma_bs', None) or total_mdesc_pdf):,.2f}</b>", cell_style),
        Paragraph(f"<b>{total_vol_fact_pdf:,.2f}</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{(getattr(liquidacion, 'flete_total_bruto_bs', None) or total_flete_pdf):,.2f}</b>", cell_style),
    ])

    custom_table_styles.append(('SPAN', (0, current_table_row), (7, current_table_row)))
    custom_table_styles.append(('BACKGROUND', (0, current_table_row), (-1, current_table_row), colors.HexColor('#FEF08A')))

    col_widths = [18, 44, 44, 56, 45, 95, 38, 48, 46, 46, 38, 38, 42, 44, 44, 38, 50]
    table = Table(t_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle(custom_table_styles))
    story.append(table)
    story.append(Spacer(1, 15))

    # Firmas
    f_realizado = getattr(params, 'firma_realizado_por', 'JAQUELINE LOVERA TIÑINI')
    f_revisado = getattr(params, 'firma_revisado_por', 'JOSE LOVERA TIÑINI / GERENTE GENERAL')
    f_autorizado = getattr(params, 'firma_autorizado_por', 'DIRECTORIO')
    f_cancelado = getattr(params, 'firma_cancelado_por', 'TOMASA TIÑINI MITA / APOYO')

    sign_data = [
        [
            Paragraph("<b>REALIZADO POR:</b>", sub_style),
            Paragraph("<b>REVISADO POR:</b>", sub_style),
            Paragraph("<b>AUTORIZADO POR:</b>", sub_style),
            Paragraph("<b>CANCELADO POR:</b>", sub_style)
        ],
        [
            Paragraph(f"{f_realizado}", cell_style),
            Paragraph(f"{f_revisado}", cell_style),
            Paragraph(f"{f_autorizado}", cell_style),
            Paragraph(f"{f_cancelado}", cell_style)
        ]
    ]
    t_signs = Table(sign_data, colWidths=[185, 185, 185, 185])
    t_signs.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#94A3B8')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
    ]))
    story.append(t_signs)

    # ==============================================================
    # PÁGINA 2: RESUMEN DE DESCUENTOS Y LÍQUIDO PAGABLE (HOJA 3 DEL PDF)
    # ==============================================================
    story.append(PageBreak())

    header_data2 = [
        [
            Paragraph("<b>LIQUIDACION DE FLETES - RESUMEN DE DEDUCCIONES</b>", title_style),
            Paragraph(f"<b>{empresa_name}</b>", empresa_style)
        ],
        [
            Paragraph(f"MES: {liquidacion.periodo_mes} &nbsp;&nbsp;|&nbsp;&nbsp; <b>PLACA: {liquidacion.placa}</b>", sub_style),
            Paragraph("<b>PÁGINA 2 DE 2</b>", sub_style)
        ]
    ]
    t_header2 = Table(header_data2, colWidths=[450, 300])
    story.append(t_header2)
    story.append(Spacer(1, 15))

    desc_rows = [
        [Paragraph("<b>DESCRIPCION</b>", header_style), Paragraph("<b>TOTAL Bs</b>", header_style)],
        [Paragraph("<b>FLETE TOTAL</b>", sub_style), Paragraph(f"<b>{(liquidacion.flete_total_bruto_bs or 0.0):,.2f}</b>", sub_style)],
        [Paragraph("Descuento por Merma", cell_style), Paragraph(f"{(liquidacion.desc_merma_bs or 0.0):,.2f}", cell_style)],
        [Paragraph("Descuento de Comision 1 $us p/m3", cell_style), Paragraph(f"{(liquidacion.desc_comision_usd_m3_bs or 0.0):,.2f}", cell_style)],
        [Paragraph("Descuento de Comision 7%", cell_style), Paragraph(f"{(liquidacion.desc_comision_7pct_bs or 0.0):,.2f}", cell_style)],
        [Paragraph("Descuento YPFB BOL-GART 7%", cell_style), Paragraph(f"{(liquidacion.desc_comision_ypfb_bolgart_7pct_bs or 0.0):,.2f}", cell_style)],
        [Paragraph("Descuento de Comision 3%", cell_style), Paragraph(f"{(liquidacion.desc_comision_3pct_bs or 0.0):,.2f}", cell_style)],
        [Paragraph("Hojas de Ruta", cell_style), Paragraph(f"{(liquidacion.desc_hojas_ruta_bs or 0.0):,.2f}", cell_style)],
        [Paragraph("GPS", cell_style), Paragraph(f"{(liquidacion.desc_gps_bs or 0.0):,.2f}", cell_style)],
        [Paragraph("Anticipos y Otros 7%", cell_style), Paragraph(f"{(liquidacion.desc_anticipos_otros_bs or 0.0):,.2f}", cell_style)],
    ]
    if getattr(liquidacion, 'desc_otros_ajustes_bs', None) and liquidacion.desc_otros_ajustes_bs != 0:
        desc_rows.append([Paragraph("Otros Descuentos / Ajustes", cell_style), Paragraph(f"{(liquidacion.desc_otros_ajustes_bs or 0.0):,.2f}", cell_style)])

    desc_rows.append([Paragraph("<b>TOTAL DESCUENTO</b>", sub_style), Paragraph(f"<b>{(liquidacion.total_descuentos_bs or 0.0):,.2f}</b>", sub_style)])
    desc_rows.append([Paragraph("<b>LIQUIDO PAGABLE</b>", title_style), Paragraph(f"<b>{(liquidacion.liquido_pagable_bs or 0.0):,.2f}</b>", title_style)])

    t_desc = Table(desc_rows, colWidths=[380, 160])
    t_desc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,-2), (-1,-2), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#DCFCE7')), # Greenish highlight
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_desc)
    story.append(Spacer(1, 25))

    # Firmas en página 2
    story.append(t_signs)

    doc.build(story)
    buffer.seek(0)
    return buffer


def export_liquidacion_asociacion_pdf(asociacion_name: str, periodo_mes: str, grupos_empresa: List[Dict[str, Any]]) -> io.BytesIO:
    """
    Genera un PDF oficial con la Liquidación General de la Asociación (Hoja 1 del PDF).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=15,
        rightMargin=15,
        topMargin=15,
        bottomMargin=15
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'AsocTitle',
        parent=styles['Heading1'],
        fontSize=12,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        fontName='Helvetica-Bold'
    )
    sub_style = ParagraphStyle(
        'AsocSub',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        fontName='Helvetica'
    )
    header_style = ParagraphStyle(
        'AsocHeader',
        parent=styles['Normal'],
        fontSize=6.5,
        leading=7.5,
        textColor=colors.white,
        alignment=1,
        fontName='Helvetica-Bold'
    )
    cell_style = ParagraphStyle(
        'AsocCell',
        parent=styles['Normal'],
        fontSize=6.5,
        leading=7.5,
        fontName='Helvetica'
    )

    story = []
    story.append(Paragraph(f"<b>{asociacion_name.upper()} - LIQUIDACIÓN DE FLETES CONCILIADA</b>", title_style))
    story.append(Paragraph(f"(A LA FINALIZACIÓN DE LA PRESTACIÓN DEL SERVICIO DEL PERIODO {periodo_mes.upper()} Y DESPUÉS DE REALIZADA LA CONCILIACIÓN)", sub_style))
    story.append(Spacer(1, 8))

    table_headers = [
        Paragraph("LOTE", header_style),
        Paragraph("EMPRESA", header_style),
        Paragraph("TRAMO", header_style),
        Paragraph("PROD.", header_style),
        Paragraph("PLACA", header_style),
        Paragraph("CARGA", header_style),
        Paragraph("RECEP.", header_style),
        Paragraph("DESPACHO (L)", header_style),
        Paragraph("RECEPCION (L)", header_style),
        Paragraph("MERMA REAL", header_style),
        Paragraph("EXCEDENTE", header_style),
        Paragraph("PRECIO M.", header_style),
        Paragraph("M. DESC (Bs)", header_style),
        Paragraph("VOL (m3)", header_style),
        Paragraph("FLETE ($us/m3)", header_style),
        Paragraph("IMPORTE (Bs)", header_style),
    ]

    t_rows = [table_headers]
    tot_gen_desp = 0.0
    tot_gen_rec = 0.0
    tot_gen_mreal = 0.0
    tot_gen_mdesc = 0.0
    tot_gen_m3 = 0.0
    tot_gen_imp = 0.0

    for grp in grupos_empresa:
        emp_name = grp.get("empresa_name", "")
        viajes = grp.get("viajes", [])

        # Subencabezado de empresa
        t_rows.append([
            Paragraph(f"<b>EMPRESA: {emp_name}</b>", cell_style),
            "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""
        ])

        sub_desp = 0.0
        sub_rec = 0.0
        sub_mreal = 0.0
        sub_mdesc = 0.0
        sub_m3 = 0.0
        sub_imp = 0.0

        for v in viajes:
            p_raw = str(v.get("producto", "")).strip().upper()
            if any(k in p_raw for k in ["DIESEL", "GASOLINA", "DO", "GE", "COMBUSTIBLE"]):
                p_code = "DO"
            elif any(k in p_raw for k in ["INSUMO", "ADITIV", "IYA"]):
                p_code = "IYA"
            else:
                p_code = p_raw or "DO"

            desp = float(v.get("volumen_origen_litros", 0))
            rec = float(v.get("volumen_recepcionado_litros", 0))
            mreal = float(v.get("merma_real_litros", 0))
            mex = float(v.get("merma_excedente_litros", 0))
            pm = float(v.get("precio_merma_litro_bs", 0))
            mdesc = float(v.get("merma_descontar_bs", 0))
            m3 = rec / 1000.0
            tf = float(v.get("tarifa_flete", 0))
            imp = float(v.get("flete_total_bs", 0))

            sub_desp += desp
            sub_rec += rec
            sub_mreal += mreal
            sub_mdesc += mdesc
            sub_m3 += m3
            sub_imp += imp

            t_rows.append([
                Paragraph(v.get("lote_codigo", "-"), cell_style),
                Paragraph(emp_name, cell_style),
                Paragraph(v.get("tramo", ""), cell_style),
                Paragraph(p_code, cell_style),
                Paragraph(v.get("placa", ""), cell_style),
                Paragraph(str(v.get("fecha_carga", "")), cell_style),
                Paragraph(str(v.get("fecha_descarga", "")), cell_style),
                Paragraph(f"{desp:,.0f}", cell_style),
                Paragraph(f"{rec:,.0f}", cell_style),
                Paragraph(f"{mreal:,.1f}", cell_style),
                Paragraph(f"{mex:,.1f}", cell_style),
                Paragraph(f"{pm:,.2f}", cell_style),
                Paragraph(f"{mdesc:,.2f}", cell_style),
                Paragraph(f"{m3:,.3f}", cell_style),
                Paragraph(f"{tf:,.2f}", cell_style),
                Paragraph(f"<b>{imp:,.2f}</b>", cell_style),
            ])

        # Subtotal empresa
        t_rows.append([
            Paragraph(f"<b>TOTAL {emp_name}</b>", cell_style),
            "", "", "", "", "", "",
            Paragraph(f"<b>{sub_desp:,.0f}</b>", cell_style),
            Paragraph(f"<b>{sub_rec:,.0f}</b>", cell_style),
            Paragraph(f"<b>{sub_mreal:,.1f}</b>", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph(f"<b>{sub_mdesc:,.2f}</b>", cell_style),
            Paragraph(f"<b>{sub_m3:,.3f}</b>", cell_style),
            Paragraph("", cell_style),
            Paragraph(f"<b>{sub_imp:,.2f}</b>", cell_style),
        ])

        tot_gen_desp += sub_desp
        tot_gen_rec += sub_rec
        tot_gen_mreal += sub_mreal
        tot_gen_mdesc += sub_mdesc
        tot_gen_m3 += sub_m3
        tot_gen_imp += sub_imp

    # Fila total general
    t_rows.append([
        Paragraph("<b>TOTAL GENERAL ASOCIACIÓN</b>", cell_style),
        "", "", "", "", "", "",
        Paragraph(f"<b>{tot_gen_desp:,.0f}</b>", cell_style),
        Paragraph(f"<b>{tot_gen_rec:,.0f}</b>", cell_style),
        Paragraph(f"<b>{tot_gen_mreal:,.1f}</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{tot_gen_mdesc:,.2f}</b>", cell_style),
        Paragraph(f"<b>{tot_gen_m3:,.3f}</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{tot_gen_imp:,.2f}</b>", cell_style),
    ])

    col_widths = [22, 60, 110, 32, 45, 42, 42, 48, 48, 40, 38, 38, 45, 45, 45, 55]
    table = Table(t_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#FEF08A')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(table)
    story.append(Spacer(1, 8))

    legend_style = ParagraphStyle(
        'LegendStyle',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0F172A')
    )
    story.append(Paragraph("<b>DO = Diesel</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>IYA = Insumos y Aditivos</b>", legend_style))
    story.append(Spacer(1, 6))

    legal_style = ParagraphStyle(
        'LegalFoot',
        parent=styles['Normal'],
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor('#64748B'),
        fontName='Helvetica-Oblique'
    )
    story.append(Paragraph(
        "Conforme lo establece la Ley 843 en su Art. 4 y de acuerdo a la cláusula contractual de Facturación y Pago, el momento en que finalizará la ejecución o la prestación del Servicio se origina después de realizada la Conciliación (Acta de Conformidad por la Comisión de Recepción) y emitida la planilla de Liquidación.",
        legal_style
    ))
    story.append(Spacer(1, 12))

    # Firmas oficiales de la Asociación
    asoc_sign_data = [
        [
            Paragraph("<b>DIRECTORIO ASOCIACIÓN</b>", sub_style),
            Paragraph("<b>COMISIÓN DE CONCILIACIÓN</b>", sub_style),
            Paragraph("<b>REPRESENTANTES LEGALES</b>", sub_style),
            Paragraph("<b>AUDITORÍA / CONTABILIDAD</b>", sub_style)
        ],
        [
            Paragraph("Firma y Sello", cell_style),
            Paragraph("Firma y Sello", cell_style),
            Paragraph("Firma y Sello", cell_style),
            Paragraph("Firma y Sello", cell_style)
        ]
    ]
    t_asoc_signs = Table(asoc_sign_data, colWidths=[185, 185, 185, 185])
    t_asoc_signs.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#94A3B8')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
    ]))
    story.append(t_asoc_signs)

    doc.build(story)
    buffer.seek(0)
    return buffer

