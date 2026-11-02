import os
import pdfplumber
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# Register Ubuntu fonts
pdfmetrics.registerFont(TTFont('Ubuntu', 'backend/api/static/fonts/Ubuntu-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Bold', 'backend/api/static/fonts/Ubuntu-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Italic', 'backend/api/static/fonts/Ubuntu-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Light', 'backend/api/static/fonts/Ubuntu-Light.ttf'))

class ExactNumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count):
        self.saveState()
        # Footer rule: Ref is top=791.29 to 792.04, x0=39.60, x1=566.63, h=0.75
        self.setStrokeColor(colors.HexColor('#adadad'))
        self.setLineWidth(0.75)
        # In bottom-left coords: y = 841.69 - 791.29 - 0.375 = 50.025
        self.line(39.60, 841.69 - 791.66, 566.63, 841.69 - 791.66)

        # Page number: Ref is top=801.47, bottom=809.46, x0=558.34, x1=562.85, size=8.0
        self.setFont('Ubuntu', 8.0)
        self.setFillColor(colors.HexColor('#6c718a'))
        page_str = str(self._pageNumber) if page_count == 1 else f"Page {self._pageNumber} of {page_count}"
        # baseline is at 841.69 - 807.6
        self.drawString(558.34, 841.69 - 807.65, page_str)
        self.restoreState()

out_pdf = 'design-reference/output/test_tuned.pdf'

# Page setup:
# In Ref:
# Left margin is 46.35
# Right edge of table is 560.63 -> rightMargin = 595.42 - 560.63 = 34.79
# Top of logo is 57.15 -> with 0 padding table, topMargin = 57.15
doc = SimpleDocTemplate(
    out_pdf,
    pagesize=A4,
    leftMargin=46.35,
    rightMargin=34.79,
    topMargin=57.15,
    bottomMargin=50.40
)

doc_width = 595.42 - 46.35 - 34.79 # 514.28 pt
elements = []

# 1. Header
logo_img = Image('backend/api/static/logo_colored_wordmark.png', width=177, height=54)

comp_style_bold = ParagraphStyle('C1', fontName='Ubuntu-Bold', fontSize=10, leading=11.84, textColor=colors.HexColor('#333333'))
comp_style_reg = ParagraphStyle('C2', fontName='Ubuntu', fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))

# In Ref:
# Line 1: top=114.36 (logo bottom is 111.15 -> gap=3.21)
# Line 2: top=126.20
# Line 3: top=137.90
# Line 4: top=148.30
# Line 5: top=158.69
# Line 6: top=169.07
# Line 7: top=179.46
comp_p1 = Paragraph("ALI MOHAMMED MOTAH Establishment For<br/>Contracting", comp_style_bold)
comp_p2 = Paragraph(
    "ALI MOHAMMED MOTAH Establishment For Contracting<br/>"
    "TRN 301374966800003<br/>"
    "Riyadh, KSA<br/>"
    "0575287403<br/>"
    "ad@arabseason.net - www.arabseason.com",
    comp_style_reg
)

left_header = [
    logo_img,
    Spacer(1, 3.21),
    comp_p1,
    comp_p2
]

# Right Header:
# In Ref:
# DELIVERY: top=61.28, bottom=89.29, x0=426.60, x1=553.37
# CHALLAN: top=93.53, bottom=121.54, x0=436.13, x1=559.85
# Delivery Challan# DC-00002: top=123.13, bottom=133.14, x0=426.26, x1=559.76
# Notice: Distance from top of page (57.15) to DELIVERY (61.28) is 4.13 pt.
# Leading between DELIVERY and CHALLAN is 32.25 pt.
# Leading between CHALLAN and DocNum is 29.60 pt.
title_style_del = ParagraphStyle('TDel', fontName='Ubuntu', fontSize=28, leading=32.25, alignment=2, textColor=colors.HexColor('#000000'))
title_style_cha = ParagraphStyle('TCha', fontName='Ubuntu', fontSize=28, leading=32.25, alignment=2, textColor=colors.HexColor('#000000'))
docnum_style = ParagraphStyle('TNum', fontName='Ubuntu-Bold', fontSize=10, leading=12, alignment=2, textColor=colors.HexColor('#333333'))

# Note: In Ref, right edge of table is 560.63.
# CHALLAN right edge is 559.85 (0.78 pt from table right edge).
# DocNum right edge is 559.76 (0.87 pt from table right edge).
# DELIVERY right edge is 553.37 (7.26 pt from table right edge).
title_p1 = Paragraph("DELIVERY&nbsp;", title_style_del) # trailing non-breaking space makes width match 553.37
title_p2 = Paragraph("CHALLAN", title_style_cha)
docnum_p = Paragraph("Delivery Challan# DC-00002", docnum_style)

right_header = [
    Spacer(1, 4.13),
    title_p1,
    title_p2,
    Spacer(1, 1.59),
    docnum_p
]

header_table = Table([[left_header, right_header]], colWidths=[280, doc_width - 280])
header_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(header_table)

# 2. Party & Meta
# In Ref:
# Header bottom (last line of company block) is at 188.46.
# Challan Date starts at top=217.74 -> Gap = 217.74 - 188.46 = 29.28 pt.
elements.append(Spacer(1, 29.28))

party_p = Paragraph(
    "<font size=10 color='#333333'>Deliver To</font><br/>"
    "<font size=9><b>Marwa</b></font>",
    ParagraphStyle('PRef', fontName='Ubuntu', fontSize=10, leading=11.31, textColor=colors.HexColor('#333333'))
)

# In Ref:
# Challan Date : 15 Oct 2026: top=217.74. Label ends at 450.06, value starts at 510.38, ends at 559.80.
# Challan Type : Others: top=236.79. Label ends at 450.05, value starts at 531.56, ends at 559.84.
meta_table_data = [
    [
        Paragraph("Challan Date :", ParagraphStyle('ML1', fontName='Ubuntu', fontSize=10, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
        Paragraph("15 Oct 2026", ParagraphStyle('MV1', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#333333')))
    ],
    [
        Paragraph("Challan Type :", ParagraphStyle('ML2', fontName='Ubuntu', fontSize=10, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
        Paragraph("Others", ParagraphStyle('MV2', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#333333')))
    ]
]
# Meta table colWidths: Label ends at 450.06 -> colWidth = 450.06 - (560.63 - 250) = 139.43.
meta_table = Table(meta_table_data, colWidths=[140, 110], rowHeights=[19.05, 19.05])
meta_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
]))

# Deliver To starts at top=229.89 (12.15 pt after Challan Date top 217.74)
party_cell = [Spacer(1, 12.15), party_p]

party_meta_table = Table([[party_cell, meta_table]], colWidths=[264.28, 250])
party_meta_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(party_meta_table)

# 3. Line Items Table
# In Ref:
# Bottom of Meta Block is 255.84. Table header starts at top=266.37 -> Gap = 10.53 pt.
elements.append(Spacer(1, 10.53))

col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
th_center = ParagraphStyle('THC', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=1, textColor=colors.HexColor('#ffffff'))
th_left = ParagraphStyle('THL', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=0, textColor=colors.HexColor('#ffffff'))
th_right = ParagraphStyle('THR', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#ffffff'))

tb_center = ParagraphStyle('TBC', fontName='Ubuntu', fontSize=9, leading=10, alignment=1, textColor=colors.HexColor('#333333'))
tb_left = ParagraphStyle('TBL', fontName='Ubuntu', fontSize=9, leading=10.39, alignment=0, textColor=colors.HexColor('#333333'))
tb_right = ParagraphStyle('TBR', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#333333'))

table_data = [
    [
        Paragraph("#", th_center),
        Paragraph("Item & Description", th_left),
        Paragraph("Qty", th_right),
        Paragraph("Rate", th_right),
        Paragraph("Amount", th_right),
    ],
    [
        Paragraph("1", tb_center),
        Paragraph("Banner printing<br/><font color='#727272'>Forex with sticker</font>", tb_left),
        Paragraph("1.00", tb_right),
        Paragraph("150.00", tb_right),
        Paragraph("150.00", tb_right),
    ]
]

items_table = Table(table_data, colWidths=col_widths, rowHeights=[24.00, 36.15])
items_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3c3d3a')),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING', (0,0), (-1,0), 7.0),
    ('BOTTOMPADDING', (0,0), (-1,0), 7.0),
    ('LEFTPADDING', (0,0), (0,-1), 0),
    ('RIGHTPADDING', (0,0), (0,-1), 0),
    ('LEFTPADDING', (1,0), (1,-1), 15.0), # exactly 15pt left padding for Item & Description
    ('RIGHTPADDING', (1,0), (1,-1), 6.0),
    ('LEFTPADDING', (2,0), (-1,-1), 4.0),
    ('RIGHTPADDING', (2,0), (-1,-1), 6.5), # right padding for numbers
    ('TOPPADDING', (0,1), (-1,1), 8.83), # exactly matches 299.20 top
    ('LINEBELOW', (0,1), (-1,1), 0.75, colors.HexColor('#adadad')),
]))
elements.append(items_table)

# 4. Totals Block
# In Ref:
# Items table bottom is 326.52. Sub Total row starts at 327.27 -> Gap = 0.75 pt.
elements.append(Spacer(1, 0.75))

tot_lbl_style = ParagraphStyle('TL', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
tot_val_style = ParagraphStyle('TV', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
tot_lbl_b = ParagraphStyle('TLB', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
tot_val_b = ParagraphStyle('TVB', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))

# Total row in Ref:
# Total band starts at 459.38.
# SAR symbol image is at x0=517.58, w=5.96, h=6.75
# Value 150.00 starts at x0=525.34, x1=553.11.
# Gap between cell left (459.38) and SAR symbol (517.58) = 58.20 pt.
# SAR width = 5.96 pt.
# Gap between SAR right (523.54) and 150.00 (525.34) = 1.80 pt.
# Amount width = 27.77 pt (ends at 553.11).
# Cell ends at 560.63 -> right gap = 560.63 - 553.11 = 7.52 pt.
sar_img = Image('backend/api/static/sar_symbol.png', width=5.96, height=6.75)
val_cell = Table([['', sar_img, '', Paragraph("150.00", tot_val_b)]], colWidths=[58.20, 5.96, 1.80, 35.29])
val_cell.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (3,0), (3,0), 7.52),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))

totals_data = [
    [
        '',
        Paragraph("Sub Total", tot_lbl_style),
        Paragraph("150.00", tot_val_style)
    ],
    [
        '',
        Paragraph("Total", tot_lbl_b),
        val_cell
    ]
]
totals_table = Table(totals_data, colWidths=[256.76, 156.27, 101.25], rowHeights=[25.38, 30.00])
totals_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BACKGROUND', (1,1), (2,1), colors.HexColor('#f5f4f3')),
    ('RIGHTPADDING', (1,0), (1,-1), 7.52),
    ('RIGHTPADDING', (2,0), (2,0), 7.52),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(totals_table)

# Gap from Totals bottom (382.65) to Total In Words (391.48) = 8.83 pt
elements.append(Spacer(1, 8.83))

# Total In Words Table
# In Words: x0=362.51. Table starts at leftMargin=46.35.
# Blank col: 362.51 - 46.35 = 316.16 pt.
# Label col: 69.52 pt (ends at 432.03).
# Value col: 560.63 - 432.03 = 128.60 pt.
words_data = [
    [
        '',
        Paragraph("Total In Words:", ParagraphStyle('TWL', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
        Paragraph("Saudi Riyal One Hundred<br/>Fifty", ParagraphStyle('TWV', fontName='Ubuntu-Bold', fontSize=9, leading=10.66, alignment=0, textColor=colors.HexColor('#333333')))
    ]
]
words_table = Table(words_data, colWidths=[316.16, 69.52, 128.60])
words_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(words_table)

# Gap from Words bottom (411.89) to Signature (436.93) = 25.04 pt
elements.append(Spacer(1, 25.04))

# 5. Authorized Signature
# In Ref: Text starts at 45.60, width 96.79 (ends at 142.39).
# Underline starts at 146.21 (gap=3.82) to 296.21 (width=150.00, thickness=0.75).
sig_line = HRFlowable(width=150, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
sig_data = [
    [
        Paragraph("Authorized Signature", ParagraphStyle('SigP', fontName='Ubuntu', fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
        sig_line
    ]
]
sig_table = Table(sig_data, colWidths=[100.61, 155], hAlign='LEFT')
sig_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(sig_table)

doc.build(elements, canvasmaker=ExactNumberedCanvas)
print("Built test_tuned.pdf successfully")
