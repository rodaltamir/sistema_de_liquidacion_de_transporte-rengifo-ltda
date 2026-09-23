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

    # Tabla de viajes
    table_headers = [
        Paragraph("Nº", header_style),
        Paragraph("CARGA", header_style),
        Paragraph("DESCARGA", header_style),
        Paragraph("MIC/DTA", header_style),
        Paragraph("PLACA", header_style),
        Paragraph("TRAMO", header_style),
        Paragraph("CLIENTE", header_style),
        Paragraph("PROD.", header_style),
        Paragraph("VOL. ORIGEN", header_style),
        Paragraph("VOL. RECEP.", header_style),
        Paragraph("MERMA (L)", header_style),
        Paragraph("MERMA EXC.", header_style),
        Paragraph("TOLER.", header_style),
        Paragraph("DESC. (Bs)", header_style),
        Paragraph("TARIFA", header_style),
        Paragraph("TOTAL (Bs)", header_style),
    ]

    t_rows = [table_headers]
    for idx, v in enumerate(viajes, 1):
        t_rows.append([
            Paragraph(str(idx), cell_style),
            Paragraph(str(v.fecha_carga), cell_style),
            Paragraph(str(v.fecha_descarga), cell_style),
            Paragraph(v.mic_dta or "-", cell_style),
            Paragraph(v.placa, cell_style),
            Paragraph(v.tramo, cell_style),
            Paragraph(v.cliente or "YPFB", cell_style),
            Paragraph(v.producto, cell_style),
            Paragraph(f"{v.volumen_origen_litros:,.0f}", cell_style),
            Paragraph(f"{v.volumen_recepcionado_litros:,.0f}", cell_style),
            Paragraph(f"{v.merma_real_litros:,.1f}", cell_style),
            Paragraph(f"{v.merma_excedente_litros:,.1f}", cell_style),
            Paragraph(f"{v.merma_tolerable_litros:.0f}L ({v.tolerancia_pct}%)", cell_style),
            Paragraph(f"{v.merma_descontar_bs:,.2f}", cell_style),
            Paragraph(f"{v.tarifa_flete:,.2f}", cell_style),
            Paragraph(f"<b>{v.flete_total_bs:,.2f}</b>", cell_style),
        ])

    # Fila total
    t_rows.append([
        Paragraph("<b>TOTALES</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{liquidacion.total_volumen_origen_litros:,.0f}</b>", cell_style),
        Paragraph(f"<b>{liquidacion.total_volumen_recepcionado_litros:,.0f}</b>", cell_style),
        Paragraph(f"<b>{liquidacion.total_merma_real_litros:,.1f}</b>", cell_style),
        Paragraph(f"<b>{liquidacion.total_merma_excedente_litros:,.1f}</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{liquidacion.desc_merma_bs:,.2f}</b>", cell_style),
        Paragraph("", cell_style),
        Paragraph(f"<b>{liquidacion.flete_total_bruto_bs:,.2f}</b>", cell_style),
    ])

    col_widths = [20, 48, 48, 65, 50, 120, 40, 42, 52, 52, 45, 45, 55, 48, 40, 55]
    table = Table(t_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#FEF08A')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
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
        [Paragraph("<b>FLETE TOTAL</b>", sub_style), Paragraph(f"<b>{liquidacion.flete_total_bruto_bs:,.2f}</b>", sub_style)],
        [Paragraph("Descuento por Merma", cell_style), Paragraph(f"{liquidacion.desc_merma_bs:,.2f}", cell_style)],
        [Paragraph("Descuento de Comision 1 $us p/m3", cell_style), Paragraph(f"{liquidacion.desc_comision_usd_m3_bs:,.2f}", cell_style)],
        [Paragraph("Descuento de Comision 7%", cell_style), Paragraph(f"{liquidacion.desc_comision_7pct_bs:,.2f}", cell_style)],
        [Paragraph("Descuento YPFB BOL-GART 7%", cell_style), Paragraph(f"{liquidacion.desc_comision_ypfb_bolgart_7pct_bs:,.2f}", cell_style)],
        [Paragraph("Descuento de Comision 3%", cell_style), Paragraph(f"{liquidacion.desc_comision_3pct_bs:,.2f}", cell_style)],
        [Paragraph("Hojas de Ruta", cell_style), Paragraph(f"{liquidacion.desc_hojas_ruta_bs:,.2f}", cell_style)],
        [Paragraph("GPS", cell_style), Paragraph(f"{liquidacion.desc_gps_bs:,.2f}", cell_style)],
        [Paragraph("Anticipos y Otros 7%", cell_style), Paragraph(f"{liquidacion.desc_anticipos_otros_bs:,.2f}", cell_style)],
    ]
    if liquidacion.desc_otros_ajustes_bs and liquidacion.desc_otros_ajustes_bs != 0:
        desc_rows.append([Paragraph("Otros Descuentos / Ajustes", cell_style), Paragraph(f"{liquidacion.desc_otros_ajustes_bs:,.2f}", cell_style)])

    desc_rows.append([Paragraph("<b>TOTAL DESCUENTO</b>", sub_style), Paragraph(f"<b>{liquidacion.total_descuentos_bs:,.2f}</b>", sub_style)])
    desc_rows.append([Paragraph("<b>LIQUIDO PAGABLE</b>", title_style), Paragraph(f"<b>{liquidacion.liquido_pagable_bs:,.2f}</b>", title_style)])

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
                Paragraph(v.get("producto", ""), cell_style),
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
    story.append(Spacer(1, 10))

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

