import sys, os, django
from decimal import Decimal
import fitz
import shutil

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator
from api.models import (
    Customer, Invoice, InvoiceItem,
    Quotation, QuotationItem
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
    text = "".join([p.get_text() for p in doc])
    
    assert "Notes:" not in text, f"Notes: found in {filename_base}"
    assert "Terms & Notes" not in text, f"Terms & Notes found in {filename_base}"
    
    p0 = doc.load_page(0)
    pix = p0.get_pixmap(dpi=dpi)
    png_name = f"{filename_base}.png"
    out_png_path = os.path.join(out_dir, png_name)
    pix.save(out_png_path)
    art_png_path = os.path.join(artifact_dir, png_name)
    shutil.copy(out_png_path, art_png_path)
    print(f"[{filename_base}] Pages: {len(doc)}, Size: {doc[0].rect.width:.2f}x{doc[0].rect.height:.2f} pt -> Saved {art_png_path} ({pix.width}x{pix.height})")
    return art_png_path

# 1. CWO (Customer Work Order & Quote CWO-7)
cwo_data = {
    'voucherType': 'Customer Work Order & Quote',
    'voucherNo': 'CWO-7',
    'date': '2026-11-03',
    'payeeName': 'Al-Bawani General Contracting Co.',
    'amount': 50.00,
    'paymentMode': 'QUOTED RATE / AGREEMENT',
    'particulars': [
        {'item': 'Vinyl Cutout Decals with UV Lamination', 'qty': 1.0, 'rate': 50.0, 'amount': 50.00}
    ],
    'notes': 'Agreed work specifications and quotation. Valid for 30 days from issuance.'
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(cwo_data), 'verify_cwo_no_notes')

# 2. LWR (Labour Work Order & Rate Agreement LWR-4)
lwr_data = {
    'voucherType': 'Labour Work Order & Rate Agreement',
    'voucherNo': 'LWR-4',
    'date': '2026-11-03',
    'payeeName': 'Saudi Binladin Group - Specialized Division',
    'amount': 1200.00,
    'paymentMode': 'Direct Wire Transfer',
    'particulars': [
        {'item': 'Certified Structural Welding & Rigging', 'qty': 10.0, 'rate': 120.0, 'amount': 1200.00}
    ],
    'notes': 'Terms & Notes: Work completed to company quality standard. Rate valid as agreed.'
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(lwr_data), 'verify_lwr_no_notes')

# 3. VPA (Approved Vendor Price Quote / Agreement VPA-7)
vpa_data = {
    'voucherType': 'Approved Vendor Price Quote / Agreement',
    'voucherNo': 'VPA-7',
    'date': '2026-11-03',
    'payeeName': 'Rawabi Holding Industrial Supplies',
    'amount': 3450.00,
    'paymentMode': 'Commercial Credit 30 Days',
    'particulars': [
        {'item': 'Grade 8.8 Galvanized Heavy Hex Bolts M16x60', 'qty': 500.0, 'rate': 6.90, 'amount': 3450.00}
    ],
    'notes': 'Approved supplier pricing benchmark for estimation & procurement.'
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(vpa_data), 'verify_vpa_no_notes')

# 4. A payment voucher
pv_data = {
    'voucherType': 'PAYMENT VOUCHER',
    'voucherNo': 'PV-2026-104',
    'date': '2026-11-03',
    'payeeName': 'Tamimi Global Commercial Co.',
    'payeeRole': 'Subcontractor / Payee',
    'paymentMode': 'Electronic Bank Transfer (SNB)',
    'category': 'Site Operations & Subcontractors',
    'amount': 8500.00,
    'particulars': [
        {'item': 'Progress Payment #3 - HVAC Ductwork Installation', 'qty': 1.0, 'rate': 8500.0, 'amount': 8500.00}
    ],
    'notes': 'Certified vendor payment advice. Signature confirms receipt of settlement amount.'
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(pv_data), 'verify_payment_voucher_no_notes')

# 5. A bank/cash ledger transaction voucher
tx_data = {
    'voucherType': 'Petty Cash Transaction Voucher',
    'voucherNo': 'TX-8042',
    'date': '2026-11-03',
    'payeeName': 'Al-Madina Office Supplies',
    'accountName': 'Khuair',
    'paymentMode': 'Petty Cash (Khuair)',
    'amount': 150.00,
    'particulars': [
        {'item': 'Consumables & Technical Drafting Supplies', 'qty': 1.0, 'rate': 150.0, 'amount': 150.00}
    ],
    'notes': 'Account: Khuair | Running Balance after TX: SAR 35.00. Formal bank & cash ledger transaction record.'
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(tx_data), 'verify_bank_tx_voucher_no_notes')

# 6. A project cost sign-off (with Paid/Balance Due)
job_signoff_data = {
    'voucherType': 'JOB ORDER COST & DISBURSEMENT VOUCHER',
    'voucherNo': 'JOB-2026-052',
    'date': '2026-11-03',
    'payeeName': 'Al-Bawani Contracting - Riyadh Metro Station 3',
    'amount': 500.00,
    'paymentMode': 'Contract Milestone / Wire Transfer',
    'category': 'Direct Project Costs & Site Execution',
    'particulars': [
        {'item': 'Structural Steel Canopy Fabrication Scope', 'qty': 1.0, 'rate': 500.00, 'amount': 500.00}
    ],
    'notes': 'Status: In Progress. Total: SAR 500.00 | Paid: SAR 350.00 | Balance Due: SAR 150.00. Formal project cost sign-off.'
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(job_signoff_data), 'verify_project_cost_signoff')

# 7. Quotation
quot = Quotation(
    quotation_number="QUOT-2026-789",
    quotation_date="2026-11-03",
    valid_until="2026-12-03",
    subtotal=Decimal('25000.00'),
    tax_amount=Decimal('3750.00'),
    total_amount=Decimal('28750.00'),
    notes="Valid for 30 calendar days. Scope excludes civil foundation works."
)
quot.customer = Customer(name="Saudi Aramco Base Operations", phone="0138720115")
quot.items_list = [
    QuotationItem(description="Fabrication of Industrial Pipe Racks (Grade 316L)", quantity=Decimal('10.00'), unit_price=Decimal('2500.00'), total=Decimal('25000.00'))
]
render_and_save(universal_pdf_generator.generate_quotation_pdf(quot), 'verify_quotation_no_notes')

# 8. Tax Invoice
inv = Invoice(
    invoice_number="INV-2026-902",
    invoice_date="2026-11-03",
    due_date="2026-11-17",
    payment_terms="Net 14 Days",
    subtotal=Decimal('15000.00'),
    tax_rate=Decimal('15.00'),
    tax_amount=Decimal('2250.00'),
    total_amount=Decimal('17250.00'),
    notes="Bank remittance due upon receipt. Subject to standard supply agreement terms."
)
c_inv = Customer(name="Red Sea Global Development", phone="0112345678")
c_inv.vat_number = "300998877600003"
inv.customer = c_inv
inv.items_list = [
    InvoiceItem(description="Architectural Metal Facade Paneling", quantity=Decimal('30.00'), unit_price=Decimal('500.00'), total=Decimal('15000.00'))
]
render_and_save(universal_pdf_generator.generate_tax_invoice_pdf(inv), 'verify_tax_invoice_no_notes')

# 9. One report (Universal Table Report)
table_cols = [
    {'header': 'Ref #', 'dataKey': 'ref', 'align': 'center'},
    {'header': 'Date', 'dataKey': 'date'},
    {'header': 'Customer / Beneficiary', 'dataKey': 'customer'},
    {'header': 'Transaction Description', 'dataKey': 'desc'},
    {'header': 'Category', 'dataKey': 'cat'},
    {'header': 'Debit', 'dataKey': 'deb', 'align': 'right'},
    {'header': 'Credit', 'dataKey': 'cred', 'align': 'right'},
]
rows = [
    {'ref': 'CB-101', 'date': '2026-11-01', 'customer': 'Saudi Aramco', 'desc': 'Contract Milestone Advance Payment', 'cat': 'Operations', 'deb': '0.00', 'cred': '85,000.00'},
    {'ref': 'CB-102', 'date': '2026-11-02', 'customer': 'Rawabi Supplies', 'desc': 'Raw Steel Raw Materials Purchase', 'cat': 'Procurement', 'deb': '42,500.00', 'cred': '0.00'},
    {'ref': 'CB-103', 'date': '2026-11-03', 'customer': 'Site Staff', 'desc': 'Bi-weekly Direct Labour Wages Disbursement', 'cat': 'Payroll', 'deb': '18,200.00', 'cred': '0.00'},
]
rep_pdf = universal_pdf_generator.generate_universal_table_pdf(
    title='Cashbook Operations Ledger Report',
    columns=table_cols,
    rows=rows,
    totals={'desc': 'Period Totals', 'deb': '60,700.00', 'cred': '85,000.00'},
    period_text='Reporting Period: 01 Nov 2026 - 03 Nov 2026'
)
render_and_save(rep_pdf, 'verify_report_no_notes')
print("\nAll 9 verification renders generated and saved successfully!")

