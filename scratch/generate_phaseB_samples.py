import sys, os, django
from decimal import Decimal
import fitz # PyMuPDF

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator

out_dir = 'design-reference/output/phaseB'
os.makedirs(out_dir, exist_ok=True)

def render_pdf_to_png(pdf_bytes, pdf_name, png_name):
    pdf_path = os.path.join(out_dir, pdf_name)
    png_path = os.path.join(out_dir, png_name)
    with open(pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    
    doc = fitz.open(pdf_path)
    page = doc.load_page(0)
    pix = page.get_pixmap(dpi=150)
    pix.save(png_path)
    print(f"Generated {pdf_name} -> {png_name} ({pix.width}x{pix.height})")

# -------------------------------------------------------------
# 1. CWO (Customer Work Order & Quote)
# -------------------------------------------------------------
cwo_data = {
    'voucherType': 'Customer Work Order & Quote',
    'voucherNo': 'CWO-00002',
    'date': '2026-10-31',
    'payeeName': 'Test Customer Advance',
    'payeeRole': 'Customer / Client',
    'payeePhone': '0500000000',
    'paymentMode': 'QUOTED RATE / AGREEMENT',
    'category': 'Project Order',
    'amount': 2500.00,
    'particulars': [
        {'item': 'Exhibition Booth Fabrication\nCustom 3x3m branded wooden booth', 'qty': 1, 'rate': 2000.00, 'amount': 2000.00},
        {'item': 'Spotlight Installation\nLED track lights 50W', 'qty': 4, 'rate': 125.00, 'amount': 500.00}
    ],
    'notes': 'Quoted prices include delivery, installation, and dismantling post-event.'
}
cwo_bytes = universal_pdf_generator.generate_payment_voucher_pdf(cwo_data)
render_pdf_to_png(cwo_bytes, 'cwo.pdf', 'cwo.png')

# -------------------------------------------------------------
# 2. VPA (Approved Vendor Price Quote / Agreement)
# -------------------------------------------------------------
vpa_data = {
    'voucherType': 'Approved Vendor Price Quote / Agreement',
    'voucherNo': 'VPA-00006',
    'date': '2026-10-29',
    'payeeName': 'rahul vendor',
    'payeeRole': 'Material Supplier / Subcontractor',
    'payeePhone': '-',
    'paymentMode': 'APPROVED QUOTE RATE',
    'category': 'Sheet',
    'amount': 5.00,
    'particulars': [
        {'item': 'red sticker (Sheet)\nStandard adhesive vinyl red roll', 'qty': 1, 'rate': 5.00, 'amount': 5.00}
    ],
    'notes': 'Rates approved for FY 2026-2027 procurement.'
}
vpa_bytes = universal_pdf_generator.generate_payment_voucher_pdf(vpa_data)
render_pdf_to_png(vpa_bytes, 'vpa.pdf', 'vpa.png')

# -------------------------------------------------------------
# 3. Customer Account Statement
# -------------------------------------------------------------
cust_stmt_data = {
    'voucherType': 'Customer Account Statement',
    'voucherNo': 'CUST-STMT-00008',
    'date': '2026-11-01',
    'payeeName': 'Yahya Trading Est.',
    'payeeRole': 'Customer / Client',
    'payeePhone': '0551234567',
    'paymentMode': 'ACCOUNT BALANCE',
    'accountName': 'Accounts Receivable',
    'category': 'Statement Settlement',
    'amount': 1850.00,
    'particulars': [
        {'item': 'Invoice INV-00102 Settlement\nFabrication and printing works', 'qty': 1, 'rate': 1500.00, 'amount': 1500.00},
        {'item': 'Late Delivery Penalty Adjustment\nAgreed commercial discount', 'qty': 1, 'rate': 350.00, 'amount': 350.00}
    ],
    'notes': 'Monthly statement closing balance as of 01 November 2026.'
}
cust_stmt_bytes = universal_pdf_generator.generate_payment_voucher_pdf(cust_stmt_data)
render_pdf_to_png(cust_stmt_bytes, 'customer_statement.pdf', 'customer_statement.png')

# -------------------------------------------------------------
# 4. Vendor Account Statement
# -------------------------------------------------------------
vend_stmt_data = {
    'voucherType': 'Vendor Account Statement',
    'voucherNo': 'VEND-STMT-00012',
    'date': '2026-11-01',
    'payeeName': 'Al-Waseet Raw Materials Co.',
    'payeeRole': 'Vendor / Supplier',
    'payeePhone': '0112345678',
    'paymentMode': 'VENDOR BALANCE',
    'accountName': 'Accounts Payable',
    'category': 'Supplier Balance',
    'amount': 4200.00,
    'particulars': [
        {'item': 'Wood & Acrylic Procurement Batch #44\n18mm MDF Sheets x 20', 'qty': 20, 'rate': 120.00, 'amount': 2400.00},
        {'item': '3mm Clear Acrylic Sheets x 15', 'qty': 15, 'rate': 120.00, 'amount': 1800.00}
    ],
    'notes': 'Net payable balance due within 30 days.'
}
vend_stmt_bytes = universal_pdf_generator.generate_payment_voucher_pdf(vend_stmt_data)
render_pdf_to_png(vend_stmt_bytes, 'vendor_statement.pdf', 'vendor_statement.png')

# -------------------------------------------------------------
# 5. Payment Voucher
# -------------------------------------------------------------
pay_vch_data = {
    'voucherType': 'Payment Voucher',
    'voucherNo': 'PV-20261102-01',
    'date': '2026-11-02',
    'payeeName': 'Express Logistics Saudi',
    'payeeRole': 'Courier / Logistics Provider',
    'payeePhone': '0598765432',
    'paymentMode': 'Bank Transfer',
    'accountName': 'Riyad Bank Main',
    'category': 'Shipping & Freight',
    'amount': 750.00,
    'particulars': [
        {'item': 'Urgent Site Delivery to Dammam\nJob Order JOB0012 items', 'qty': 1, 'rate': 750.00, 'amount': 750.00}
    ],
    'notes': 'Disbursement verified against commercial freight consignment bill.'
}
pay_vch_bytes = universal_pdf_generator.generate_payment_voucher_pdf(pay_vch_data)
render_pdf_to_png(pay_vch_bytes, 'payment_voucher.pdf', 'payment_voucher.png')

# -------------------------------------------------------------
# 6. Receipt Voucher
# -------------------------------------------------------------
rec_vch_data = {
    'voucherType': 'Receipt Voucher',
    'voucherNo': 'RV-20261102-05',
    'date': '2026-11-02',
    'payeeName': 'Horizon Retail Holdings',
    'payeeRole': 'Customer / Client',
    'payeePhone': '0543219876',
    'paymentMode': 'MADA POS Transfer',
    'accountName': 'Main Cash Ledger',
    'category': 'Client Advance',
    'amount': 5000.00,
    'particulars': [
        {'item': 'Advance Payment for Contract #2026-CT-09\nEvent Signage Project', 'qty': 1, 'rate': 5000.00, 'amount': 5000.00}
    ],
    'notes': 'Received with thanks. Advance credited toward project milestone 1.'
}
rec_vch_bytes = universal_pdf_generator.generate_payment_voucher_pdf(rec_vch_data)
render_pdf_to_png(rec_vch_bytes, 'receipt_voucher.pdf', 'receipt_voucher.png')

# -------------------------------------------------------------
# 7. Salary Voucher
# -------------------------------------------------------------
class MockSalary:
    id = 14
    staff_name = "Tariq Mansoor"
    paid_month = "October 2026"
    payment_date = "2026-11-01"
    payment_mode = "Direct Bank Transfer"
    base_salary = Decimal('4500.00')
    overtime_hours = 12.0
    overtime_amount = Decimal('450.00')
    total_salary = Decimal('4950.00')
    amount = Decimal('4950.00')
    designation = "Senior Production Craftsman"
    description = "Monthly payroll disbursement after attendance review."

sal_bytes = universal_pdf_generator.generate_salary_voucher_pdf(MockSalary())
render_pdf_to_png(sal_bytes, 'salary_voucher.pdf', 'salary_voucher.png')

# -------------------------------------------------------------
# 8. Tax Invoice
# -------------------------------------------------------------
class MockCustomer:
    name = "Saudi Modern Entertainment Co."
    tax_number = "310987654300003"
    address = "Olaya St, Riyadh 12214, KSA"
    phone = "0114567890"

class MockInvoiceItem:
    def __init__(self, desc, qty, price, rate, tax, tot):
        self.description = desc
        self.quantity = Decimal(str(qty))
        self.unit_price = Decimal(str(price))
        self.tax_rate = Decimal(str(rate))
        self.tax_amount = Decimal(str(tax))
        self.total = Decimal(str(tot))

class MockJob:
    order_id = "JOB0015"
    title = "Riyadh Season Outdoor Pavilions"

class MockBankAccount:
    bank_name = "Riyad Bank"
    account_name = "ALI MOHAMMED MOTAH Est"
    iban = "SA4420000001234567890123"

class MockInvoice:
    id = 105
    invoice_number = "INV-2026-00105"
    customer = MockCustomer()
    customer_tax_number = "310987654300003"
    billing_address = "Olaya St, Riyadh 12214, KSA"
    invoice_date = "2026-11-02"
    due_date = "2026-11-16"
    supply_date = "2026-11-02"
    payment_terms = "Net 14 Days"
    reference_number = "PO-SA-9901"
    job_order = MockJob()
    subtotal = Decimal('12000.00')
    tax_rate = Decimal('15.0')
    tax_amount = Decimal('1800.00')
    total_amount = Decimal('13800.00')
    bank_account = MockBankAccount()
    notes = "Thank you for your business. Remit payment to the indicated bank account."
    terms = "Goods received in good condition."

    class MockItemManager:
        def all(self):
            return [
                MockInvoiceItem("Custom Acrylic Backlit Signboard\n5x2m with Samsung High-Output LEDs", 1, 8000.00, 15, 1200.00, 9200.00),
                MockInvoiceItem("Structural Steel Support Brackets\nHeavy duty galvanised steel frame", 2, 2000.00, 15, 600.00, 4600.00)
            ]
    items = MockItemManager()

inv_bytes = universal_pdf_generator.generate_tax_invoice_pdf(MockInvoice())
render_pdf_to_png(inv_bytes, 'tax_invoice.pdf', 'tax_invoice.png')

# -------------------------------------------------------------
# 9. Quotation
# -------------------------------------------------------------
class MockQuotationItem:
    def __init__(self, desc, qty, price, rate, tax, tot):
        self.description = desc
        self.quantity = Decimal(str(qty))
        self.unit_price = Decimal(str(price))
        self.tax_rate = Decimal(str(rate))
        self.tax_amount = Decimal(str(tax))
        self.total = Decimal(str(tot))

class MockQuotation:
    id = 42
    quotation_number = "QT-2026-00042"
    customer = MockCustomer()
    customer_tax_number = "310987654300003"
    billing_address = "Olaya St, Riyadh 12214, KSA"
    quotation_date = "2026-11-02"
    valid_until = "2026-12-02"
    payment_terms = "50% Advance, 50% On Completion"
    job_order = None
    subtotal = Decimal('6500.00')
    tax_rate = Decimal('15.0')
    tax_amount = Decimal('975.00')
    total_amount = Decimal('7475.00')
    notes = "Quotation valid for 30 calendar days from issue date."
    terms = "Production begins upon receipt of formal purchase order and advance."

    class MockItemManager:
        def all(self):
            return [
                MockQuotationItem("Modular Stage Platform 6x4m\nHeavy-duty aluminium extrusion frame with carpet", 1, 5000.00, 15, 750.00, 5750.00),
                MockQuotationItem("Stage Access Steps & Safety Handrails", 2, 750.00, 15, 225.00, 1725.00)
            ]
    items = MockItemManager()

qt_bytes = universal_pdf_generator.generate_quotation_pdf(MockQuotation())
render_pdf_to_png(qt_bytes, 'quotation.pdf', 'quotation.png')

# -------------------------------------------------------------
# 10. Credit Note
# -------------------------------------------------------------
class MockOrigInvoice:
    invoice_number = "INV-2026-00105"

class MockCreditNoteItem:
    def __init__(self, desc, qty, price, rate, tax, tot):
        self.description = desc
        self.quantity = Decimal(str(qty))
        self.unit_price = Decimal(str(price))
        self.tax_rate = Decimal(str(rate))
        self.tax_amount = Decimal(str(tax))
        self.total = Decimal(str(tot))

class MockCreditNote:
    id = 8
    credit_note_number = "CN-2026-00008"
    customer = MockCustomer()
    customer_tax_number = "310987654300003"
    billing_address = "Olaya St, Riyadh 12214, KSA"
    credit_note_date = "2026-11-02"
    invoice = MockOrigInvoice()
    reason = "Commercial Discount & Quantity Variance Adjustment"
    subtotal = Decimal('1000.00')
    tax_rate = Decimal('15.0')
    tax_amount = Decimal('150.00')
    total_amount = Decimal('1150.00')
    notes = "Credit note issued against INV-2026-00105 as agreed."

    class MockItemManager:
        def all(self):
            return [
                MockCreditNoteItem("Credit Adjustment for Scope Reduction", 1, 1000.00, 15, 150.00, 1150.00)
            ]
    items = MockItemManager()

cn_bytes = universal_pdf_generator.generate_credit_note_pdf(MockCreditNote())
render_pdf_to_png(cn_bytes, 'credit_note.pdf', 'credit_note.png')

# -------------------------------------------------------------
# 11. Client Estimation Checklist
# -------------------------------------------------------------
class MockEstItem:
    def __init__(self, name, room, qty, unit, specs, width=None, height=None, cost=100, price=150, shop='Al-Haram'):
        self.item_name = name
        self.section_room = room
        self.quantity = Decimal(str(qty))
        self.unit = unit
        self.specifications = specs
        self.width = width
        self.height = height
        self.dimension_unit = 'cm'
        self.unit_cost = Decimal(str(cost))
        self.total_cost = Decimal(str(cost * qty))
        self.selling_price = Decimal(str(price * qty))
        self.supplier_shop = shop
        self.sort_order = 1
        self.id = 1

class MockEstimation:
    id = 19
    estimate_number = "EST-00019"
    title = "VIP Lounge Interior Fitting"
    client_name = "Royal Falcon Hospitality"
    client_contact = "Eng. Fahad Al-Otaibi (0555551234)"
    date = "2026-11-02"
    valid_until = "2026-11-30"
    status = "Approved"
    total_price = Decimal('8500.00')
    notes = "All dimensions field-verified by survey team on 30 Oct 2026."
    scope_of_work = "Supply and fabrication of decorative wall panelling and reception desk."

    class MockItemQuery:
        def __init__(self, itms):
            self.itms = itms
        def all(self):
            return self
        def order_by(self, *args):
            return self.itms

    def __init__(self):
        self.items = self.MockItemQuery([
            MockEstItem("Fluted Oak Wood Panelling", "VIP Reception", 12, "sqm", "Fire-rated Class 1 MDF with natural oak veneer", 240, 60, cost=200, price=350),
            MockEstItem("Brushed Brass Edge Trim", "VIP Reception", 18, "m", "Solid extruded brass 20x20mm L-profile", None, None, cost=45, price=80),
            MockEstItem("Acoustic Felt Backing", "Conference Room", 25, "sqm", "9mm recycled polyester dark charcoal felt", 120, 60, cost=60, price=110)
        ])

est_obj = MockEstimation()
cl_est_bytes = universal_pdf_generator.generate_client_estimation_checklist_pdf(est_obj)
render_pdf_to_png(cl_est_bytes, 'client_estimation_checklist.pdf', 'client_estimation_checklist.png')

# -------------------------------------------------------------
# 12. Admin Estimation
# -------------------------------------------------------------
adm_est_bytes = universal_pdf_generator.generate_admin_estimation_pdf(est_obj)
render_pdf_to_png(adm_est_bytes, 'admin_estimation.pdf', 'admin_estimation.png')

# -------------------------------------------------------------
# 13. Customer Enquiry
# -------------------------------------------------------------
class MockSalesperson:
    name = "Sami Al-Harbi"

class MockEnquiry:
    id = 31
    enquiry_number = "ENQ-2026-00031"
    customer = None
    customer_name = "Diriyah Heritage Foundation"
    contact_person = "Noura Al-Dosari"
    phone = "0567891234"
    email = "n.dosari@diriyah.sa"
    enquiry_date = "2026-11-02"
    created_at = "2026-11-02"
    status = "Under Review"
    priority = "High"
    source = "Exhibition Referral"
    salesperson = MockSalesperson()
    title = "Historical Souq Wayfinding Signage"
    project_name = "Diriyah Gate District 4"
    location = "Diriyah Historic Quarter"
    estimated_budget = Decimal('45000.00')
    requirements = "Handcrafted corten steel and carved wood direction totem signs.\\nMust resist outdoor weather and match UNESCO heritage standards."
    notes = "Site walkthrough scheduled for Thursday 10:00 AM with preservation consultant."

enq_bytes = universal_pdf_generator.generate_enquiry_pdf(MockEnquiry())
render_pdf_to_png(enq_bytes, 'enquiry.pdf', 'enquiry.png')

print("All Phase B sample PDFs and PNGs successfully generated!")

