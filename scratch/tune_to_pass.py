import os
import pdfplumber
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
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
        self.line(39.60, 841.69 - 791.66, 566.63, 841.69 - 791.66)

        # Page number: Ref is top=801.47, bottom=809.46, x0=558.34, x1=562.85, size=8.0
        self.setFont('Ubuntu', 8.0)
        self.setFillColor(colors.HexColor('#6c718a'))
        page_str = str(self._pageNumber) if page_count == 1 else f"Page {self._pageNumber} of {page_count}"
        self.drawString(558.34, 841.69 - 807.65, page_str)
        self.restoreState()

out_pdf = 'design-reference/output/test_tuned_pass.pdf'

# Frame top adjusted by -2.0 pt: top is 55.15
frame = Frame(
    45.60, 50.40, 515.03, 841.69 - 55.15 - 50.40,
    id='F1',
    leftPadding=0,
    rightPadding=0,
    topPadding=0,
    bottomPadding=0
)
template = PageTemplate('Main', frames=[frame])
doc = BaseDocTemplate(out_pdf, pagesize=A4, pageTemplates=[template])

doc_width = 515.03
elements = []

# 1. Header
logo_img = Image('backend/api/static/logo_colored_wordmark.png', width=177, height=54)

comp_style_bold = ParagraphStyle('C1', fontName='Ubuntu-Bold', fontSize=10, leading=11.84, textColor=colors.HexColor('#333333'))
comp_style_reg = ParagraphStyle('C2', fontName='Ubuntu', fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))

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
title_style = ParagraphStyle('TDel', fontName='Ubuntu', fontSize=28, leading=32.25, alignment=2, textColor=colors.HexColor('#000000'))
docnum_style = ParagraphStyle('TNum', fontName='Ubuntu-Bold', fontSize=10, leading=12, alignment=2, textColor=colors.HexColor('#333333'))

title_p = Paragraph("DELIVERY&nbsp;<br/>CHALLAN", title_style)
docnum_p = Paragraph("Delivery Challan# DC-00002", docnum_style)

right_header = [
    Spacer(1, 0.4), # tuned so DELIVERY starts at 61.28
    title_p,
    Spacer(1, 1.59),
    docnum_p
]

header_table = Table([[left_header, right_header]], colWidths=[280, doc_width - 280])
header_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (0,0), 0.75), # Logo & company indent to 46.35
    ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(header_table)

# 2. Party & Meta
# Gap tuned to 23.20 pt so Challan Date matches top=217.74
elements.append(Spacer(1, 23.20))

party_p = Paragraph(
    "<font size=10 color='#333333'>Deliver To</font><br/>"
    "<font size=9><b>Marwa</b></font>",
    ParagraphStyle('PRef', fontName='Ubuntu', fontSize=10, leading=11.31, textColor=colors.HexColor('#333333'))
)

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
meta_table = Table(meta_table_data, colWidths=[140, 110], rowHeights=[19.05, 19.05])
meta_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
]))

party_cell = [Spacer(1, 16.70), party_p]

party_meta_table = Table([[party_cell, meta_table]], colWidths=[265.03, 250])
party_meta_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 0.75), # Marwa at x0=46.35
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(party_meta_table)

# 3. Line Items Table
# Gap tuned to 15.10 pt so Table Header matches top=266.37
elements.append(Spacer(1, 15.10))

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
    ('LEFTPADDING', (0,0), (0,0), 2.1), # tunes # to exactly x0=57.34
    ('RIGHTPADDING', (0,0), (0,-1), 0),
    ('LEFTPADDING', (1,0), (1,-1), 15.0), # exactly 15pt left padding for Item & Description
    ('RIGHTPADDING', (1,0), (1,-1), 6.0),
    ('LEFTPADDING', (2,0), (-1,-1), 4.0),
    ('RIGHTPADDING', (2,0), (-1,-1), 6.5), # right padding for numbers
    ('LEFTPADDING', (0,1), (0,1), 2.1), # tunes row 1 to x0=57.77
    ('TOPPADDING', (0,1), (-1,1), 8.83), # exactly matches 299.20 top
    ('LINEBELOW', (0,1), (-1,1), 0.75, colors.HexColor('#adadad')),
]))
elements.append(items_table)

# 4. Totals Block
elements.append(Spacer(1, 0.75))

tot_lbl_style = ParagraphStyle('TL', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
tot_val_style = ParagraphStyle('TV', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
tot_lbl_b = ParagraphStyle('TLB', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
tot_val_b = ParagraphStyle('TVB', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))

sar_img = Image('backend/api/static/sar_symbol.png', width=5.96, height=6.75)
val_cell = Table([['', sar_img, '', Paragraph("150.00", tot_val_b)]], colWidths=[57.00, 5.96, 1.80, 36.49])
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
totals_table = Table(totals_data, colWidths=[257.51, 156.27, 101.25], rowHeights=[25.38, 30.00])
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

words_data = [
    [
        '',
        Paragraph("Total In Words:", ParagraphStyle('TWL', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
        Paragraph("Saudi Riyal One Hundred<br/>Fifty", ParagraphStyle('TWV', fontName='Ubuntu-Bold', fontSize=9, leading=10.66, alignment=0, textColor=colors.HexColor('#333333')))
    ]
]
words_table = Table(words_data, colWidths=[316.91, 61.59, 136.53])
words_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('LEFTPADDING', (2,0), (2,0), 7.93),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(words_table)

# Gap from Words bottom (411.89) to Signature (436.93) = 23.00 pt
elements.append(Spacer(1, 23.00))

# 5. Authorized Signature
sig_line = HRFlowable(width=150, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
sig_data = [
    [
        Paragraph("Authorized Signature", ParagraphStyle('SigP', fontName='Ubuntu', fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
        sig_line
    ]
]
sig_table = Table(sig_data, colWidths=[100.61, 155], hAlign='LEFT')
sig_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING', (0,0), (0,0), 0),
    ('TOPPADDING', (1,0), (1,0), 7.41), # puts line top at exactly 444.34
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
elements.append(sig_table)

doc.build(elements, canvasmaker=ExactNumberedCanvas)
print("Built test_tuned_pass.pdf successfully")
