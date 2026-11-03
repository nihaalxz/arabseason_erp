import sys, os
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django; django.setup()

from decimal import Decimal
import pdfplumber
from api.pdf_generator import universal_pdf_generator, FONTS
from api.models import Customer, DeliveryNote, DeliveryNoteItem
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors

# Define new build_reference_header
def new_build_reference_header(self, doc_width, title, doc_number):
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

universal_pdf_generator.__class__.build_reference_header = new_build_reference_header

# Test with Spacer(1, 67.66)
orig_gen_dn = universal_pdf_generator.generate_delivery_note_pdf

# Let's inspect deltas against DC-00002 reference
with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref:
    ref = p_ref.pages[0]
    r_words = ref.extract_words(extra_attrs=['fontname', 'size'])

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

# We temporarily monkey-patch generate_delivery_note_pdf in memory to use 67.66 spacer
import types
def patched_gen_dn(self, delivery_note):
    pdf = orig_gen_dn(delivery_note)
    return pdf

# Let's see what happens if we patch pdf_generator directly
print("Ready to test live!")
