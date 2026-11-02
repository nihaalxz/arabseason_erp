import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable, KeepTogether
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 1. Register fonts
FONT_DIR = 'backend/api/static/fonts'
for fname, ffile in [
    ('AppFont', 'AppFont-Regular.ttf'),
    ('AppFont-Bold', 'AppFont-Bold.ttf'),
    ('AppFont-Italic', 'AppFont-Italic.ttf'),
    ('AppFont-Light', 'AppFont-Light.ttf')
]:
    fpath = os.path.join(FONT_DIR, ffile)
    if os.path.exists(fpath):
        try:
            pdfmetrics.registerFont(TTFont(fname, fpath))
        except Exception as e:
            print(f'Error registering {fname}: {e}')

PAGE_W, PAGE_H = A4
LEFT_MARGIN = 45.6
RIGHT_MARGIN = 34.8
DOC_WIDTH = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN # 515.02 pt

COLOR_TEXT_PRIMARY = colors.HexColor('#000000')
COLOR_TEXT_DARK = colors.HexColor('#333333')
COLOR_TEXT_MUTED = colors.HexColor('#727272')
COLOR_TEXT_LIGHT = colors.HexColor('#6c718a')
COLOR_HEADER_BG = colors.HexColor('#3c3d3a')
COLOR_TOTAL_BG = colors.HexColor('#f5f4f3')
COLOR_BORDER = colors.HexColor('#adadad')

class CleanNumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.show_timestamp = kwargs.pop('show_timestamp', False)

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
        # Footer line at y = 50.4 pt from bottom (841.69 - 791.29 = 50.4)
        footer_y = 50.4
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.75)
        self.line(LEFT_MARGIN, footer_y, PAGE_W - RIGHT_MARGIN, footer_y)

        # Page number
        self.setFont('AppFont', 8)
        self.setFillColor(COLOR_TEXT_LIGHT)
        page_str = str(self._pageNumber) if page_count == 1 else f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(PAGE_W - RIGHT_MARGIN, footer_y - 10.5, page_str)

        # Optional timestamp for reports
        if getattr(self, 'show_timestamp', False):
            self.drawString(LEFT_MARGIN, footer_y - 10.5, f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}")

        self.restoreState()

def test_generate_delivery_challan():
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=LEFT_MARGIN,
        rightMargin=RIGHT_MARGIN,
        topMargin=57.15,
        bottomMargin=65.0
    )

    elements = []

    # 1. Header (Logo + Company on Left, Title + Number on Right)
    logo_path = 'backend/api/static/logo_colored_wordmark.png'
    logo_img = Image(logo_path, width=177, height=54)

    company_lines = [
        '<font name="AppFont-Bold" size="10" color="#333333">ALI MOHAMMED MOTAH Establishment For Contracting</font>',
        '<font name="AppFont" size="9" color="#333333">ALI MOHAMMED MOTAH Establishment For Contracting</font>',
        '<font name="AppFont" size="9" color="#333333">TRN 301374966800003</font>',
        '<font name="AppFont" size="9" color="#333333">Riyadh, KSA</font>',
        '<font name="AppFont" size="9" color="#333333">0575287403</font>',
        '<font name="AppFont" size="9" color="#333333">ad@arabseason.net - www.arabseason.com</font>'
    ]
    company_p = Paragraph("<br/>".join(company_lines), ParagraphStyle('Comp', leading=10.5))

    left_header = [logo_img, Spacer(1, 4), company_p]

    right_header_lines = [
        '<font name="AppFont-Light" size="28" color="#000000">DELIVERY</font>',
        '<font name="AppFont-Light" size="28" color="#000000">CHALLAN</font>',
        '<font name="AppFont-Bold" size="10" color="#333333">Delivery Challan# DC-00002</font>'
    ]
    right_header_p = Paragraph("<br/>".join(right_header_lines), ParagraphStyle('DocHdr', leading=32, alignment=2))

    hdr_table = Table([[left_header, right_header_p]], colWidths=[DOC_WIDTH * 0.55, DOC_WIDTH * 0.45])
    hdr_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(hdr_table)
    elements.append(Spacer(1, 28))

    # 2. Party & Meta block
    party_p = Paragraph(
        '<font name="AppFont" size="10" color="#333333">Deliver To</font><br/>'
        '<font name="AppFont-Bold" size="9" color="#333333">Marwa</font>',
        ParagraphStyle('Party', leading=12)
    )

    meta_table_data = [
        [
            Paragraph('<font name="AppFont" size="10" color="#333333">Challan Date :</font>', ParagraphStyle('ML', leading=12, alignment=0)),
            Paragraph('<font name="AppFont" size="9" color="#333333">15 Oct 2026</font>', ParagraphStyle('MV', leading=12, alignment=2))
        ],
        [
            Paragraph('<font name="AppFont" size="10" color="#333333">Challan Type :</font>', ParagraphStyle('ML', leading=12, alignment=0)),
            Paragraph('<font name="AppFont" size="9" color="#333333">Others</font>', ParagraphStyle('MV', leading=12, alignment=2))
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[DOC_WIDTH * 0.22, DOC_WIDTH * 0.23])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))

    party_meta_table = Table([[party_p, meta_table]], colWidths=[DOC_WIDTH * 0.55, DOC_WIDTH * 0.45])
    party_meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(party_meta_table)
    elements.append(Spacer(1, 18))

    # 3. Items Table
    # Col widths: 25.73, 274.8, 56.62, 56.63, 101.25 -> Total = 515.03
    col_widths = [26, 274, 57, 57, 101]
    th_style_l = ParagraphStyle('THL', fontName='AppFont', fontSize=9, textColor=colors.white, leading=11, alignment=0)
    th_style_r = ParagraphStyle('THR', fontName='AppFont', fontSize=9, textColor=colors.white, leading=11, alignment=2)
    th_style_c = ParagraphStyle('THC', fontName='AppFont', fontSize=9, textColor=colors.white, leading=11, alignment=1)

    table_data = [
        [
            Paragraph('#', th_style_c),
            Paragraph('Item &amp; Description', th_style_l),
            Paragraph('Qty', th_style_r),
            Paragraph('Rate', th_style_r),
            Paragraph('Amount', th_style_r),
        ],
        [
            Paragraph('1', ParagraphStyle('TDC', fontName='AppFont', fontSize=9, leading=11, alignment=1)),
            Paragraph(
                '<font name="AppFont" color="#727272" size="9">Banner printing</font><br/>'
                '<font name="AppFont" color="#727272" size="9">Forex with sticker</font>',
                ParagraphStyle('TDL', leading=10.5)
            ),
            Paragraph('1.00', ParagraphStyle('TDR', fontName='AppFont', fontSize=9, leading=11, alignment=2)),
            Paragraph('150.00', ParagraphStyle('TDR', fontName='AppFont', fontSize=9, leading=11, alignment=2)),
            Paragraph('150.00', ParagraphStyle('TDR', fontName='AppFont', fontSize=9, leading=11, alignment=2)),
        ]
    ]

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_HEADER_BG),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,1), (-1,-1), 8),
        ('BOTTOMPADDING', (0,1), (-1,-1), 8),
        ('LINEBELOW', (0,1), (-1,-1), 0.75, COLOR_BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 10))

    # 4. Totals Block
    sar_icon = Image('backend/api/static/sar_symbol.png', width=6, height=7)
    
    # Sub Total row
    sub_total_p = Paragraph('Sub Total', ParagraphStyle('ST', fontName='AppFont', fontSize=9, leading=11, alignment=2))
    sub_val_p = Paragraph('150.00', ParagraphStyle('STV', fontName='AppFont', fontSize=9, leading=11, alignment=2))
    
    # Total row inside warm-gray band
    total_lbl = Paragraph('<b>Total</b>', ParagraphStyle('TL', fontName='AppFont-Bold', fontSize=9, leading=11, alignment=2))
    total_val_table = Table([[sar_icon, Paragraph('<b>150.00</b>', ParagraphStyle('TV', fontName='AppFont-Bold', fontSize=9, leading=11, alignment=2))]], colWidths=[10, 80])
    total_val_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))

    totals_table_data = [
        ['', '', sub_total_p, sub_val_p],
        ['', '', total_lbl, total_val_table]
    ]

    totals_table = Table(totals_table_data, colWidths=[DOC_WIDTH * 0.25, DOC_WIDTH * 0.25, DOC_WIDTH * 0.25, DOC_WIDTH * 0.25])
    totals_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (2,1), (3,1), COLOR_TOTAL_BG),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 10))

    # Total in words
    words_data = [
        [
            Paragraph('Total In Words:', ParagraphStyle('TWL', fontName='AppFont', fontSize=9, leading=11, alignment=2)),
            Paragraph('<b><i>Saudi Riyal One Hundred Fifty</i></b>', ParagraphStyle('TWV', fontName='AppFont-Bold', fontSize=9, leading=11, alignment=0))
        ]
    ]
    words_table = Table(words_data, colWidths=[DOC_WIDTH * 0.65, DOC_WIDTH * 0.35])
    words_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    elements.append(words_table)
    elements.append(Spacer(1, 35))

    # 5. Authorized Signature
    sig_line = HRFlowable(width=150, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
    sig_data = [
        [
            Paragraph('<font name="AppFont" size="10" color="#333333">Authorized Signature</font>', ParagraphStyle('SigL', leading=12)),
            sig_line
        ]
    ]
    sig_table = Table(sig_data, colWidths=[105, 160])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(KeepTogether([sig_table]))

    doc.build(elements, canvasmaker=CleanNumberedCanvas)
    pdf_bytes = buf.getvalue()
    buf.close()

    out_pdf = 'design-reference/output/test_DC-00002_reproduced.pdf'
    with open(out_pdf, 'wb') as f:
        f.write(pdf_bytes)
    print(f'Wrote {out_pdf} ({len(pdf_bytes)} bytes)')

if __name__ == '__main__':
    test_generate_delivery_challan()

