import sys, os
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django; django.setup()

from decimal import Decimal
import pdfplumber
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from api.pdf_generator import universal_pdf_generator, FONTS
from api.models import Customer, DeliveryNote, DeliveryNoteItem

# Test new build_reference_header without legal name and TRN
def test_build_ref_header(self, doc_width, title, doc_number):
    settings = self._get_site_settings()
    logo_path = self._resolve_logo_path()

    left_flowables = []
    if logo_path and os.path.exists(logo_path):
        try:
            left_flowables.append(Image(logo_path, width=177, height=54, mask='auto'))
        except Exception:
            pass

    addr = settings.get("address", "Riyadh, KSA")
    phone = settings.get("phone", "0575287403")
    email = settings.get("email", "ad@arabseason.net")
    web = settings.get("website", "www.arabseason.club")

    font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))
    font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

    comp_p = Paragraph(
        f"{addr}<br/>"
        f"{phone}<br/>"
        f"{email} - {web}",
        ParagraphStyle('C2', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))
    )
    # Exact spacer before logo (top=57.15) and before company block (immediately after logo, no gap)
    left_flowables = [Spacer(1, 1.80)] + left_flowables + [Spacer(1, 1.41), comp_p]

    # Right: Adaptive Title + Shortened Document Number (if doc_number provided)
    t_clean = (title or '').strip().upper()
    right_col_w = doc_width - 280.0
    title_sz, title_ld, title_html = self._compute_adaptive_title(t_clean, right_col_w, font_reg)

    title_p = Paragraph(title_html, ParagraphStyle('TDel', fontName=font_reg, fontSize=title_sz, leading=title_ld, alignment=2, textColor=colors.HexColor('#000000')))
    right_flowables = [Spacer(1, 0.4), title_p]
    if doc_number and str(doc_number).strip():
        docnum_p = Paragraph(str(doc_number).strip(), ParagraphStyle('TNum', fontName=font_bold, fontSize=10, leading=12, alignment=2, textColor=colors.HexColor('#333333')))
        right_flowables.extend([Spacer(1, 1.59), docnum_p])

    hdr_table = Table([[left_flowables, right_flowables]], colWidths=[280, doc_width - 280])
    hdr_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (0,0), 0.75),
        ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    return hdr_table

# Patch method onto universal_pdf_generator
universal_pdf_generator.__class__.build_reference_header = test_build_ref_header

# Test delivery note generation with adjusted spacer
old_gen_dn = universal_pdf_generator.__class__.generate_delivery_note_pdf

def test_gen_dn(self, delivery_note):
    # Same as generate_delivery_note_pdf but with Spacer(1, 23.20 + 44.46)
    from io import BytesIO
    from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame
    from reportlab.lib.pagesizes import A4
    from api.pdf_generator import format_doc_date, NumberedCanvas

    buffer = BytesIO()
    doc = BaseDocTemplate(
        buffer,
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
    doc_width = 515.03
    elements = []

    # 1. Header
    doc_num = delivery_note.delivery_note_number or f"DC-{delivery_note.id:05d}"
    header = self.build_reference_header(doc_width, "DELIVERY CHALLAN", f"Delivery Challan# {doc_num}")
    elements.append(header)
    elements.append(Spacer(1, 23.20 + 44.46))

    # 2. Party & Meta Block
    cust = delivery_note.customer
    cust_name = cust.name if cust else "N/A"
    deliv_date = format_doc_date(delivery_note.delivery_date or delivery_note.dispatch_date)
    meta_pairs = [
        ("Challan Date", deliv_date),
        ("Challan Type", delivery_note.shipping_method or delivery_note.status or "Others")
    ]
    if delivery_note.customer_po_number:
        meta_pairs.append(("Customer PO #", delivery_note.customer_po_number))

    party_meta = self.build_reference_party_and_meta(
        doc_width,
        party_label="Deliver To",
        party_name=cust_name,
        party_subtext=None,
        meta_pairs=meta_pairs
    )
    elements.append(party_meta)
    elements.append(Spacer(1, 21.08))

    # Items Table
    raw_items = getattr(delivery_note, 'items_list', None)
    if raw_items is None:
        raw_items = list(delivery_note.items.all()) if hasattr(delivery_note, 'items') else []

    items = []
    for itm in raw_items:
        desc = itm.description or getattr(itm, 'item_name', '')
        qty = float(itm.quantity or 1.0)
        rate = float(itm.unit_price or 0.0)
        amt = float(itm.total or (qty * rate))
        items.append({'desc': desc, 'qty': qty, 'rate': rate, 'amount': amt})

    items_table = self.build_reference_items_table(doc_width, items)
    elements.append(items_table)
    elements.append(Spacer(1, 14.00))

    # Totals Block
    tot_val = float(delivery_note.total_amount or sum(i['amount'] for i in items))
    sub_val = tot_val
    vat_val = 0.0

    totals_block = self.build_reference_totals_block(
        doc_width,
        subtotal=sub_val,
        vat=vat_val,
        total=tot_val,
        show_vat=False
    )
    elements.append(totals_block)
    elements.append(Spacer(1, 14.00))

    sigs = self.build_reference_signatures_and_notes(
        doc_width,
        notes=None,
        signature_style='single'
    )
    elements.extend(sigs)

    doc.build(elements, canvasmaker=NumberedCanvas)
    return buffer.getvalue()

c_dn = Customer(name='Marwa Contracting', phone='0575287403')
dn = DeliveryNote(
    delivery_note_number='DC-00002',
    delivery_date='2026-10-15',
    shipping_method='Others',
    notes='Handle with care.'
)
dn.total_amount = Decimal('150.00')
dn.customer = c_dn
dn.items_list = [
    DeliveryNoteItem(
        description='Banner printing\nForex with sticker',
        quantity=Decimal('1.00'),
        unit_price=Decimal('150.00'),
        total=Decimal('150.00')
    )
]

pdf_bytes = test_gen_dn(universal_pdf_generator, dn)
with open('scratch/test_dn_tuned.pdf', 'wb') as f:
    f.write(pdf_bytes)

with pdfplumber.open('scratch/test_dn_tuned.pdf') as p_mig:
    page = p_mig.pages[0]
    for w in page.extract_words():
        if w['text'] in ['DELIVERY', 'CHALLAN', 'DC-00002', 'Riyadh,', '0575287403', 'Deliver', 'Marwa', 'Rate', 'Amount', 'Total', 'Authorized']:
            print(f"{w['text']:20} top={w['top']} x0={w['x0']}")

