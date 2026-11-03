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

# 1. New build_reference_header
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

# 2. Patch generate_delivery_note_pdf spacer
orig_gen_dn = universal_pdf_generator.__class__.generate_delivery_note_pdf
import inspect, textwrap, api.pdf_generator
src = textwrap.dedent(inspect.getsource(orig_gen_dn))
src = src.replace("Spacer(1, 23.20)", "Spacer(1, 23.20 + 44.46)")
scope = dict(api.pdf_generator.__dict__)
exec(src, scope)
universal_pdf_generator.__class__.generate_delivery_note_pdf = scope['generate_delivery_note_pdf']

c_dn = Customer(name='Marwa Contracting', phone='0575287403')
dn = DeliveryNote(
    delivery_note_number='DC-00002',
    delivery_date='2026-10-15',
    shipping_method='Others',
    notes=''
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

pdf_bytes = universal_pdf_generator.generate_delivery_note_pdf(dn)
with open('scratch/test_tuned_reflow.pdf', 'wb') as f:
    f.write(pdf_bytes)

def match_element(words, filter_fn):
    candidates = [w for w in words if filter_fn(w)]
    return candidates[0] if candidates else None

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('scratch/test_tuned_reflow.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]
    
    r_words = ref.extract_words(extra_attrs=['fontname', 'size'])
    m_words = mig.extract_words(extra_attrs=['fontname', 'size'])
    
    # Elements to verify (excluding the removed company lines 1-3)
    elements_to_verify = [
        ("Doc Title Line 1 (DELIVERY)",
         lambda w: w['text'] == 'DELIVERY' and w['top'] < 100,
         lambda w: w['text'] == 'DELIVERY' and w['top'] < 100),
        
        ("Doc Title Line 2 (CHALLAN)",
         lambda w: w['text'] == 'CHALLAN' and w['top'] < 120,
         lambda w: w['text'] == 'CHALLAN' and w['top'] < 120),
        
        ("Doc Number: Delivery",
         lambda w: w['text'] == 'Delivery' and w['top'] > 120 and w['top'] < 140,
         lambda w: w['text'] == 'Delivery' and w['top'] > 120 and w['top'] < 140),
        
        ("Doc Number: Challan#",
         lambda w: w['text'] == 'Challan#' and w['top'] > 120 and w['top'] < 140,
         lambda w: w['text'] == 'Challan#' and w['top'] > 120 and w['top'] < 140),
        
        ("Doc Number: DC-00002",
         lambda w: w['text'] == 'DC-00002',
         lambda w: w['text'] == 'DC-00002'),
        
        ("Deliver To: Label",
         lambda w: w['text'] == 'Deliver' and w['top'] > 220 and w['top'] < 240,
         lambda w: w['text'] == 'Deliver' and w['top'] > 220 and w['top'] < 240),
        
        ("Deliver To: Party Name (Marwa)",
         lambda w: w['text'] == 'Marwa',
         lambda w: w['text'] == 'Marwa'),
        
        ("Meta: Challan Date :",
         lambda w: w['text'] == 'Date' and w['top'] > 210 and w['top'] < 230,
         lambda w: w['text'] == 'Date' and w['top'] > 210 and w['top'] < 230),
        
        ("Meta: 15 Oct 2026",
         lambda w: w['text'] == '15',
         lambda w: w['text'] == '15'),
        
        ("Meta: Challan Type :",
         lambda w: w['text'] == 'Type' and w['top'] > 230 and w['top'] < 245,
         lambda w: w['text'] == 'Type' and w['top'] > 230 and w['top'] < 245),
        
        ("Meta: Others",
         lambda w: w['text'] == 'Others',
         lambda w: w['text'] == 'Others'),
        
        ("Table Header: #",
         lambda w: w['text'] == '#' and w['top'] > 260 and w['top'] < 280,
         lambda w: w['text'] == '#' and w['top'] > 260 and w['top'] < 280),
        
        ("Table Header: Item",
         lambda w: w['text'] == 'Item' and w['top'] > 260 and w['top'] < 280,
         lambda w: w['text'] == 'Item' and w['top'] > 260 and w['top'] < 280),
        
        ("Table Header: Qty",
         lambda w: w['text'] == 'Qty' and w['top'] > 260 and w['top'] < 280,
         lambda w: w['text'] == 'Qty' and w['top'] > 260 and w['top'] < 280),
        
        ("Table Header: Rate",
         lambda w: w['text'] == 'Rate' and w['top'] > 260 and w['top'] < 280,
         lambda w: w['text'] == 'Rate' and w['top'] > 260 and w['top'] < 280),
        
        ("Table Header: Amount",
         lambda w: w['text'] == 'Amount' and w['top'] > 260 and w['top'] < 280,
         lambda w: w['text'] == 'Amount' and w['top'] > 260 and w['top'] < 280),
        
        ("Item 1: # (1)",
         lambda w: w['text'] == '1' and w['top'] > 290 and w['top'] < 310,
         lambda w: w['text'] == '1' and w['top'] > 290 and w['top'] < 310),
        
        ("Item 1: Banner",
         lambda w: w['text'] == 'Banner',
         lambda w: w['text'] == 'Banner'),
        
        ("Item 1: printing",
         lambda w: w['text'] == 'printing',
         lambda w: w['text'] == 'printing'),
        
        ("Item 1: Forex",
         lambda w: w['text'] == 'Forex',
         lambda w: w['text'] == 'Forex'),
        
        ("Item 1: Qty (1.00)",
         lambda w: w['text'] == '1.00',
         lambda w: w['text'] == '1.00'),
        
        ("Item 1: Rate (150.00)",
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 310 and w['x0'] < 460,
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 310 and w['x0'] < 460),
        
        ("Item 1: Amount (150.00)",
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 310 and w['x0'] > 500,
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 310 and w['x0'] > 500),
        
        ("Sub Total: Label",
         lambda w: w['text'] == 'Sub' and w['top'] > 330 and w['top'] < 345,
         lambda w: w['text'] == 'Sub' and w['top'] > 330 and w['top'] < 345),
        
        ("Sub Total: Value (150.00)",
         lambda w: w['text'] == '150.00' and w['top'] > 330 and w['top'] < 345,
         lambda w: w['text'] == '150.00' and w['top'] > 330 and w['top'] < 345),
        
        ("Total: Label",
         lambda w: w['text'] == 'Total' and w['top'] > 360 and w['top'] < 370,
         lambda w: w['text'] == 'Total' and w['top'] > 360 and w['top'] < 370),
        
        ("Total: Value (150.00)",
         lambda w: w['text'] == '150.00' and w['top'] > 360 and w['top'] < 370,
         lambda w: w['text'] == '150.00' and w['top'] > 360 and w['top'] < 370),
        
        ("Total In Words: Label",
         lambda w: w['text'] == 'Words:' and w['top'] > 385 and w['top'] < 400,
         lambda w: w['text'] == 'Words:' and w['top'] > 385 and w['top'] < 400),
        
        ("Total In Words: Saudi",
         lambda w: w['text'] == 'Saudi' and w['top'] > 385 and w['top'] < 400,
         lambda w: w['text'] == 'Saudi' and w['top'] > 385 and w['top'] < 400),
        
        ("Total In Words: Fifty",
         lambda w: w['text'] == 'Fifty' and w['top'] > 395 and w['top'] < 410,
         lambda w: w['text'] == 'Fifty' and w['top'] > 395 and w['top'] < 410),
        
        ("Signature: Authorized",
         lambda w: w['text'] == 'Authorized' and w['top'] > 430 and w['top'] < 450,
         lambda w: w['text'] == 'Authorized' and w['top'] > 430 and w['top'] < 450),
        
        ("Signature: Signature",
         lambda w: w['text'] == 'Signature' and w['top'] > 430 and w['top'] < 450,
         lambda w: w['text'] == 'Signature' and w['top'] > 430 and w['top'] < 450),
        
        ("Footer: Page Number (1)",
         lambda w: w['text'] == '1' and w['top'] > 790,
         lambda w: w['text'] == '1' and w['top'] > 790),
    ]

    print(f"{'PHRASE / ELEMENT':<28} | {'REF (x0, top, sz, font)':<35} | {'MIG (x0, top, sz, font)':<35} | {'DELTA (dx, dy)':<15} | STATUS")
    print("=" * 125)
    
    passed = 0
    max_delta = 0.0
    for label, r_filter, m_filter in elements_to_verify:
        r_w = match_element(r_words, r_filter)
        m_w = match_element(m_words, m_filter)
        
        if not r_w or not m_w:
            print(f"{label:<28} | {'MISSING IN REF' if not r_w else 'FOUND':<35} | {'MISSING IN MIG' if not m_w else 'FOUND':<35} | {'N/A':<15} | MISSING")
            continue
            
        dx = m_w['x0'] - r_w['x0']
        dy = m_w['top'] - r_w['top']
        err = max(abs(dx), abs(dy))
        max_delta = max(max_delta, err)
        
        status = "PASS (<=1.5pt)" if err <= 1.5 else f"FAIL (err={err:.1f}pt)"
        if err <= 1.5:
            passed += 1
            
        r_str = f"({r_w['x0']:5.1f}, {r_w['top']:5.1f}, {r_w.get('size', 0):4.1f}, {r_w.get('fontname', '')[:10]})"
        m_str = f"({m_w['x0']:5.1f}, {m_w['top']:5.1f}, {m_w.get('size', 0):4.1f}, {m_w.get('fontname', '')[:14]})"
        d_str = f"dx={dx:+5.1f}, dy={dy:+5.1f}"
        print(f"{label:<28} | {r_str:<35} | {m_str:<35} | {d_str:<15} | {status}")
        
    print("=" * 125)
    print(f"Summary: {passed}/{len(elements_to_verify)} elements passed tolerance <= 1.5 pt. Max Delta = {max_delta:.2f} pt")
