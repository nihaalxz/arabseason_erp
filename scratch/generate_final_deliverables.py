
import sys, os, django
from decimal import Decimal
import fitz
import shutil

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator
from api.models import (
    Customer, DeliveryNote, DeliveryNoteItem,
    Invoice, InvoiceItem,
    Quotation, QuotationItem,
    CreditNote, CreditNoteItem
)

out_dir = 'design-reference/output/verification_pngs'
artifact_dir = r'C:\Users\nihaa\.gemini\antigravity\brain\640e936d-fef2-4084-9176-90e97a80fb01'
os.makedirs(out_dir, exist_ok=True)
os.makedirs(artifact_dir, exist_ok=True)

def render_and_save(pdf_bytes, filename_base, dpi=150):
    pdf_path = os.path.join(out_dir, f"{filename_base}.pdf")
    with open(pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    page_w = doc[0].rect.width
    page_h = doc[0].rect.height
    print(f"[{filename_base}] Pages: {page_count}, Page Size: {page_w:.2f} x {page_h:.2f} pt")
    
    # Save page 1 as PNG
    p0 = doc.load_page(0)
    pix = p0.get_pixmap(dpi=dpi)
    png_name = f"{filename_base}.png"
    out_png_path = os.path.join(out_dir, png_name)
    pix.save(out_png_path)
    art_png_path = os.path.join(artifact_dir, png_name)
    shutil.copy(out_png_path, art_png_path)
    print(f" -> Saved {art_png_path} ({pix.width}x{pix.height})")
    return art_png_path

# 1. Delivery Challan (DC-00002)
c_dn = Customer(name='Marwa Contracting', phone='0575287403')
dn = DeliveryNote(delivery_note_number='DC-00002', delivery_date='2026-10-15', shipping_method='Others', notes='')
dn.total_amount = Decimal('150.00')
dn.customer = c_dn
dn.items_list = [DeliveryNoteItem(description='Banner printing\nForex with sticker', quantity=Decimal('1.00'), unit_price=Decimal('150.00'), total=Decimal('150.00'))]
render_and_save(universal_pdf_generator.generate_delivery_note_pdf(dn), 'verify_delivery_challan')

# 2. CWO (Customer Work Order & Quote CWO-7)
cwo_data = {
    'voucherType': 'Customer Work Order & Quote',
    'voucherNo': 'CWO-7',
    'date': '2026-11-03',
    'payeeName': 'Al-Bawani General Contracting Co.',
    'amount': 50.00,
    'paymentMode': 'QUOTED RATE / AGREEMENT',
    'particulars': [
        {'item': 'Vinyl Cutout Decals with UV Lamination', 'qty': 1.0, 'rate': 50.0, 'amount': 50.00}
    ]
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(cwo_data), 'verify_cwo_7')

# 3. Labour Work Order (LWR-4)
lwr_data = {
    'voucherType': 'Labour Work Order & Rate Agreement',
    'voucherNo': 'LWR-4',
    'date': '2026-11-03',
    'payeeName': 'Saudi Binladin Group - Specialized Division',
    'amount': 1200.00,
    'paymentMode': 'Direct Wire Transfer',
    'particulars': [
        {'item': 'Certified Structural Welding & Rigging', 'qty': 10.0, 'rate': 120.0, 'amount': 1200.00}
    ]
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(lwr_data), 'verify_lwr_4')

# 4. VPA (Approved Vendor Price Quote / Agreement VPA-7)
vpa_data = {
    'voucherType': 'Approved Vendor Price Quote / Agreement',
    'voucherNo': 'VPA-7',
    'date': '2026-11-03',
    'payeeName': 'Rawabi Holding Industrial Supplies',
    'amount': 3450.00,
    'paymentMode': 'Commercial Credit 30 Days',
    'particulars': [
        {'item': 'Grade 8.8 Galvanized Heavy Hex Bolts M16x60', 'qty': 500.0, 'rate': 6.90, 'amount': 3450.00}
    ]
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(vpa_data), 'verify_vpa_7')

# 5. Tax Invoice (INV-2026-901)
inv = Invoice(
    invoice_number="INV-2026-901",
    invoice_date="2026-11-03",
    due_date="2026-11-17",
    payment_terms="Net 14 Days",
    subtotal=Decimal('15000.00'),
    tax_rate=Decimal('15.00'),
    tax_amount=Decimal('2250.00'),
    total_amount=Decimal('17250.00'),
    notes="Bank: Al Rajhi Bank | IBAN: SA4480000456608010099888. Thank you for your business."
)
c_inv = Customer(name="Red Sea Global Development", phone="0112345678")
c_inv.vat_number = "300998877600003"
inv.customer = c_inv
inv.items_list = [
    InvoiceItem(description="Architectural Metal Facade Paneling", quantity=Decimal('30.00'), unit_price=Decimal('500.00'), total=Decimal('15000.00'))
]
render_and_save(universal_pdf_generator.generate_tax_invoice_pdf(inv), 'verify_tax_invoice')

# 6. Credit Note (CN-2026-012)
cn = CreditNote(
    credit_note_number="CN-2026-012",
    credit_note_date="2026-11-03",
    subtotal=Decimal('2000.00'),
    tax_rate=Decimal('15.00'),
    tax_amount=Decimal('300.00'),
    total_amount=Decimal('2300.00'),
    notes="Credit adjustment for damaged goods during transit."
)
cn.customer = Customer(name="Metro Civil Works Co.", phone="0119876543")
cn.items_list = [
    CreditNoteItem(
        description="Defective Surface Cladding Panels",
        quantity=Decimal('2.00'),
        unit_price=Decimal('1000.00'),
        tax_rate=Decimal('15.00'),
        tax_amount=Decimal('300.00'),
        total=Decimal('2300.00')
    )
]
render_and_save(universal_pdf_generator.generate_credit_note_pdf(cn), 'verify_credit_note')

# 7. Quotation (QUOT-2026-555)
quot = Quotation(
    quotation_number="QUOT-2026-555",
    quotation_date="2026-11-03",
    valid_until="2026-12-03",
    subtotal=Decimal('25000.00'),
    tax_amount=Decimal('3750.00'),
    total_amount=Decimal('28750.00'),
    notes="Quotation valid for 30 calendar days from issue date."
)
quot.customer = Customer(name="Al-Fahad Contracting & Engineering", phone="0559876543")
quot.items_list = [
    QuotationItem(description="Perimeter Security Fencing & Gates", quantity=Decimal('100.00'), unit_price=Decimal('250.00'), total=Decimal('25000.00'))
]
render_and_save(universal_pdf_generator.generate_quotation_pdf(quot), 'verify_quotation')

# 8. Widest index table export with 50+ rows (10 columns, 55 rows, Arabic text, None/empty cells)
table_cols = [
    {'header': 'ID', 'dataKey': 'col1', 'align': 'center'},
    {'header': 'Date', 'dataKey': 'col2'},
    {'header': 'Client / Beneficiary', 'dataKey': 'col3'},
    {'header': 'Scope of Works / Description', 'dataKey': 'col4'},
    {'header': 'Shift In', 'dataKey': 'col5'},
    {'header': 'Shift Out', 'dataKey': 'col6'},
    {'header': 'Reg Hrs', 'dataKey': 'col7', 'align': 'right'},
    {'header': 'OT Hrs', 'dataKey': 'col8', 'align': 'right'},
    {'header': 'Total SAR', 'dataKey': 'col9', 'align': 'right'},
    {'header': 'Status', 'dataKey': 'col10', 'align': 'center'},
]
rows = []
rows.append({
    'col1': '1',
    'col2': '2026-11-03',
    'col3': 'شركة البناء المتقدمة للمقاولات العامة (ذ.م.م)',
    'col4': 'تركيب هياكل حديدية مسبقة الصنع مع العوازل الحرارية والمقاومة للحريق للمستودع رقم 4 بالرياض',
    'col5': '08:00',
    'col6': '17:00',
    'col7': '8.0',
    'col8': '2.0',
    'col9': '1,450.00',
    'col10': 'Approved'
})
rows.append({
    'col1': '2',
    'col2': '2026-11-04',
    'col3': None,
    'col4': '',
    'col5': None,
    'col6': '',
    'col7': '0.0',
    'col8': '0.0',
    'col9': '0.00',
    'col10': 'Pending'
})
for i in range(3, 56):
    rows.append({
        'col1': str(i),
        'col2': '2026-11-05',
        'col3': f'Subcontractor Division {i} - Special Works Unit',
        'col4': f'Routine maintenance and structural inspection for section #{i}',
        'col5': '07:30',
        'col6': '16:30',
        'col7': '8.0',
        'col8': '1.5',
        'col9': f'{i * 125}.50',
        'col10': 'Completed'
    })

wide_table_pdf = universal_pdf_generator.generate_universal_table_pdf(
    title='Master Multi-Page Operational Audit Register',
    columns=table_cols,
    rows=rows,
    totals={'col4': 'Grand Audit Total', 'col9': '245,670.00'},
    period_text='Audit Period: Nov 2026'
)
render_and_save(wide_table_pdf, 'verify_wide_table_50plus')
print("\nAll 8 verification renders completed successfully!")
