import os
import pymupdf
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
import re, arabic_reshaper
from bidi.algorithm import get_display

os.makedirs('design-reference/output/phaseA', exist_ok=True)

# Register fonts
pdfmetrics.registerFont(TTFont('Ubuntu', 'backend/api/static/fonts/Ubuntu-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Bold', 'backend/api/static/fonts/Ubuntu-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Italic', 'backend/api/static/fonts/Ubuntu-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Light', 'backend/api/static/fonts/Ubuntu-Light.ttf'))
pdfmetrics.registerFont(TTFont('ArabicFont', 'backend/api/static/fonts/ArabicFont-Regular.ttf'))
pdfmetrics.registerFont(TTFont('ArabicFont-Bold', 'backend/api/static/fonts/ArabicFont-Bold.ttf'))

class RobustNumberedCanvas(canvas.Canvas):
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

        # Page number: 8pt Ubuntu #6c718a
        self.setFont('Ubuntu', 8.0)
        self.setFillColor(colors.HexColor('#6c718a'))
        if page_count > 1:
            page_str = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(566.63, 841.69 - 807.65, page_str)
        else:
            self.drawString(558.34, 841.69 - 807.65, str(self._pageNumber))
        self.restoreState()

def format_bidi(text):
    if not text:
        return ""
    text_str = str(text)
    if not re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', text_str):
        return text_str
    pattern = r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+'
    def _repl(m):
        chunk = m.group(0)
        if re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', chunk):
            try:
                leading = chunk[:len(chunk) - len(chunk.lstrip())]
                trailing = chunk[len(chunk.rstrip()):]
                core = chunk.strip()
                shaped = get_display(arabic_reshaper.reshape(core))
                return f'{leading}<font name="ArabicFont">{shaped}</font>{trailing}'
            except Exception:
                return chunk
        return chunk
    return re.sub(pattern, _repl, text_str)

def build_delivery_note(filename, doc_num, party_name, party_sub, meta_pairs, items, total_amount, words_text, notes=None):
    doc_path = os.path.join('design-reference/output/phaseA', filename)
    doc = BaseDocTemplate(
        doc_path,
        pagesize=A4,
        leftMargin=45.60,
        rightMargin=34.79,
        topMargin=55.15,
        bottomMargin=50.03
    )
    frame = Frame(
        45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
        id='normal',
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    template = PageTemplate(id='all_pages', frames=frame)
    doc.addPageTemplates([template])

    elements = []

    # 1. Header
    logo_img = Image('backend/api/static/logo_colored_wordmark.png', width=177, height=54)
    comp_p1 = Paragraph(
        "ALI MOHAMMED MOTAH Establishment For Contracting<br/>"
        "ALI MOHAMMED MOTAH Establishment For Contracting",
        ParagraphStyle('C1', fontName='Ubuntu-Bold', fontSize=10, leading=11.84, textColor=colors.HexColor('#333333'))
    )
    comp_p2 = Paragraph(
        "TRN 301374966800003<br/>"
        "Riyadh, KSA<br/>"
        "0575287403<br/>"
        "ad@arabseason.net - www.arabseason.com",
        ParagraphStyle('C2', fontName='Ubuntu', fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))
    )
    left_header = [logo_img, Spacer(1, 3.21), comp_p1, comp_p2]

    title_p = Paragraph("DELIVERY&nbsp;<br/>CHALLAN", ParagraphStyle('TDel', fontName='Ubuntu', fontSize=28, leading=32.25, alignment=2, textColor=colors.HexColor('#000000')))
    docnum_p = Paragraph(f"Delivery Challan# {doc_num}", ParagraphStyle('TNum', fontName='Ubuntu-Bold', fontSize=10, leading=12, alignment=2, textColor=colors.HexColor('#333333')))
    right_header = [Spacer(1, 0.4), title_p, Spacer(1, 1.59), docnum_p]

    header_table = Table([[left_header, right_header]], colWidths=[280, 515.03 - 280])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (0,0), 0.75),
        ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 23.20))

    # 2. Party & Meta
    party_lines = []
    if party_name:
        party_lines.append("<font size=10 color='#333333'>Deliver To</font>")
        party_lines.append(f"<font size=9><b>{format_bidi(party_name)}</b></font>")
    if party_sub:
        party_lines.append(f"<font size=9 color='#727272'>{format_bidi(party_sub)}</font>")

    party_p = Paragraph("<br/>".join(party_lines) if party_lines else "", ParagraphStyle('PRef', fontName='Ubuntu', fontSize=10, leading=11.31, textColor=colors.HexColor('#333333')))
    party_cell = [Spacer(1, 16.70), party_p]

    meta_rows = []
    if meta_pairs:
        for lbl, val in meta_pairs:
            if not val or str(val).strip() in ('', '-', 'None', 'null'):
                continue
            meta_rows.append([
                Paragraph(f"{lbl} :", ParagraphStyle('ML', fontName='Ubuntu', fontSize=10, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
                Paragraph(str(val), ParagraphStyle('MV', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#333333')))
            ])

    if meta_rows:
        meta_table = Table(meta_rows, colWidths=[140, 110], rowHeights=[19.05] * len(meta_rows))
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
        ]))
        meta_cell = meta_table
    else:
        meta_cell = Paragraph("", ParagraphStyle('Def'))

    party_meta_table = Table([[party_cell, meta_cell]], colWidths=[265.03, 250])
    party_meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0.75),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(party_meta_table)
    elements.append(Spacer(1, 15.10))

    # 3. Line Items Table
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
        ]
    ]

    for itm in items:
        # itm: (num, desc_html, qty_str, rate_str, amt_str)
        table_data.append([
            Paragraph(str(itm[0]), tb_center),
            Paragraph(format_bidi(itm[1]), tb_left),
            Paragraph(str(itm[2]), tb_right),
            Paragraph(str(itm[3]), tb_right),
            Paragraph(str(itm[4]), tb_right),
        ])

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    t_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3c3d3a')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,0), 7.0),
        ('BOTTOMPADDING', (0,0), (-1,0), 7.0),
        ('LEFTPADDING', (0,0), (0,0), 2.1),
        ('RIGHTPADDING', (0,0), (0,-1), 0),
        ('LEFTPADDING', (1,0), (1,-1), 15.0),
        ('RIGHTPADDING', (1,0), (1,-1), 6.0),
        ('LEFTPADDING', (2,0), (-1,-1), 4.0),
        ('RIGHTPADDING', (2,0), (-1,-1), 6.5),
        ('TOPPADDING', (0,1), (-1,-1), 8.83),
        ('BOTTOMPADDING', (0,1), (-1,-1), 8.83),
        ('LINEBELOW', (0,1), (-1,-1), 0.75, colors.HexColor('#adadad')),
    ]
    items_table.setStyle(TableStyle(t_style))
    elements.append(items_table)
    elements.append(Spacer(1, 0.75))

    # 4. Totals Block
    tot_lbl_style = ParagraphStyle('TL', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
    tot_val_style = ParagraphStyle('TV', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
    tot_lbl_b = ParagraphStyle('TLB', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
    tot_val_b = ParagraphStyle('TVB', fontName='Ubuntu-Bold', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))

    sar_img = Image('backend/api/static/sar_symbol.png', width=5.96, height=6.75)
    amt_formatted = f"{total_amount:,.2f}" if isinstance(total_amount, (int, float)) else str(total_amount)
    
    val_cell = Table([['', sar_img, '', Paragraph(amt_formatted, tot_val_b)]], colWidths=[57.00, 5.96, 1.80, 36.49])
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
        ['', Paragraph("Sub Total", tot_lbl_style), Paragraph(amt_formatted, tot_val_style)],
        ['', Paragraph("Total", tot_lbl_b), val_cell]
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

    words_data = [
        [
            '',
            Paragraph("Total In Words:", ParagraphStyle('TWL', fontName='Ubuntu', fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
            Paragraph(words_text, ParagraphStyle('TWV', fontName='Ubuntu-Bold', fontSize=9, leading=10.66, alignment=0, textColor=colors.HexColor('#333333')))
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

    # Signature line
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
        ('TOPPADDING', (1,0), (1,0), 7.41),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))

    bottom_stack = [
        totals_table,
        Spacer(1, 8.83),
        words_table,
        Spacer(1, 23.00),
        sig_table
    ]
    elements.append(KeepTogether(bottom_stack))

    doc.build(elements, canvasmaker=RobustNumberedCanvas)
    print(f"Generated {doc_path} successfully")

    # Render to PNG at 150 DPI
    pdoc = pymupdf.open(doc_path)
    for pno, page in enumerate(pdoc):
        pix = page.get_pixmap(dpi=150)
        p_name = filename.replace('.pdf', f'_p{pno+1}.png' if len(pdoc) > 1 else '.png')
        p_path = os.path.join('design-reference/output/phaseA', p_name)
        pix.save(p_path)
        print(f"Rendered {p_path} (page {pno+1} of {len(pdoc)})")

# 1. Single Item
build_delivery_note(
    'robustness_1_item.pdf',
    'DC-00001',
    'Marwa',
    None,
    [("Challan Date", "15 Oct 2026"), ("Challan Type", "Others")],
    [(1, "Banner printing<br/><font color='#727272'>Forex with sticker</font>", "1.00", "150.00", "150.00")],
    150.00,
    "Saudi Riyal One Hundred<br/>Fifty"
)

# 2. 20 Items (Multi-Page)
items_20 = []
for i in range(1, 21):
    items_20.append((i, f"Product & Service Specification #{i:02d}<br/><font color='#727272'>Grade-A Architectural Material Component</font>", f"{i}.00", "250.00", f"{i*250:,.2f}"))
total_20 = sum(i * 250 for i in range(1, 21)) # 52,500.00
build_delivery_note(
    'robustness_20_items_multipage.pdf',
    'DC-00020',
    'Enterprise Construction Partner LLC',
    'Al Olaya District, Riyadh, Saudi Arabia',
    [("Challan Date", "15 Oct 2026"), ("Challan Type", "Standard Delivery")],
    items_20,
    total_20,
    "Saudi Riyals Fifty Two<br/>Thousand Five Hundred"
)

# 3. Long Wrapping Description
long_desc = (
    "Comprehensive Corporate Headquarters Exhibition Stand Fabrication<br/>"
    "<font color='#727272'>Custom engineered high-durability acrylic partition panels with seamless CNC-routed aluminum internal perimeter framing, integrated indirect 4000K daylight-white LED edge backlighting, fire-rated acoustic fabric interior infill, high-gloss polyurethane clear surface protective sealing, and custom CNC fabricated locking structural joinery compliant with Saudi Building Code requirements.</font>"
)
build_delivery_note(
    'robustness_long_description.pdf',
    'DC-00003',
    'Kingdom Exhibition Projects Co.',
    'Diplomatic Quarter, Riyadh',
    [("Challan Date", "15 Oct 2026"), ("Challan Type", "Custom Fabrication")],
    [(1, long_desc, "1.00", "45,000.00", "45,000.00")],
    45000.00,
    "Saudi Riyals Forty Five<br/>Thousand Only"
)

# 4. Empty Optional Fields
build_delivery_note(
    'robustness_empty_optional_fields.pdf',
    'DC-00004',
    'Walk-in Retail Customer',
    None,  # No address / subtext
    None,  # No meta pairs (empty)
    [(1, "Standard Print Sheet A3", "5.00", "10.00", "50.00")],
    50.00,
    "Saudi Riyals Fifty Only"
)

# 5. Arabic Party Name and Description (Shaped + RTL)
arabic_party = "شركة الأفق للمقاولات العامة والتجارة المحدودة"
arabic_party_sub = "الرياض - حي الملز - طريق صلاح الدين الأيوبي"
arabic_desc = "لوحة إعلانية خارجية مضيئة مع طباعة ستيكر وفوركس عالي الجودة<br/><font color='#727272'>هيكل حديد مجلفن مقاوم للعوامل الجوية مع إضاءة ليد كورية أصلية وضمان شامل لمدة سنتين</font>"
build_delivery_note(
    'robustness_arabic.pdf',
    'DC-00005',
    arabic_party,
    arabic_party_sub,
    [("Challan Date", "15 Oct 2026"), ("Challan Type", "توريد وتركيب")],
    [(1, arabic_desc, "2.00", "1,850.00", "3,700.00")],
    3700.00,
    "Saudi Riyals Three Thousand<br/>Seven Hundred Only"
)

# 6. Large Amount (1,234,567.89 SAR) with Total In Words
build_delivery_note(
    'robustness_large_amount.pdf',
    'DC-00006',
    'Saudi Mega Infrastructure Authority',
    'King Abdullah Financial District (KAFD), Riyadh',
    [("Challan Date", "15 Oct 2026"), ("Challan Type", "Infrastructure Phase 1")],
    [
        (1, "Structural Steel Framework Modular Columns<br/><font color='#727272'>Heavy Grade ASTM A36 Steel</font>", "120.00", "8,200.00", "984,000.00"),
        (2, "Curtain Wall Glazing Units Double Low-E<br/><font color='#727272'>Thermal Acoustic Safety Glass</font>", "450.00", "556.8175", "250,567.89"),
    ],
    1234567.89,
    "One Million Two Hundred Thirty Four<br/>Thousand Five Hundred Sixty Seven<br/>and 89/100 Saudi Riyals"
)
