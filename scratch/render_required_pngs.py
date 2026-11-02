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

out_dir = 'design-reference/output/req_pngs'
artifact_dir = r'C:\Users\nihaa\.gemini\antigravity\brain\640e936d-fef2-4084-9176-90e97a80fb01'
os.makedirs(out_dir, exist_ok=True)

def render_and_copy(pdf_bytes, prefix):
    pdf_path = os.path.join(out_dir, f"{prefix}.pdf")
    with open(pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    doc = fitz.open(pdf_path)
    png_names = []
    for i in range(len(doc)):
        p = doc.load_page(i)
        pix = p.get_pixmap(dpi=150)
        p_name = f"{prefix}_p{i+1}.png" if len(doc) > 1 else f"{prefix}.png"
        p_path = os.path.join(out_dir, p_name)
        pix.save(p_path)
        shutil.copy(p_path, os.path.join(artifact_dir, p_name))
        png_names.append(p_name)
        print(f"Saved & copied {p_name} ({pix.width}x{pix.height}) - Page {i+1} of {len(doc)}")
    return png_names

# -------------------------------------------------------------------------
# 1. Tax Invoice: 20 items over EXACTLY 2 pages with a discount and VAT (NO QR)
# -------------------------------------------------------------------------
print("\n--- 1. Generating Tax Invoice (20 items, discount + VAT, exactly 2 pages) ---")
inv = Invoice(
    invoice_number="INV-2026-088",
    invoice_date="2026-11-02",
    due_date="2026-11-16",
    payment_terms="Net 14 Days",
    subtotal=Decimal('30000.00'),
    tax_rate=Decimal('15.00'),
    tax_amount=Decimal('4425.00'),  # (30000 - 500) * 0.15 = 4425.00
    total_amount=Decimal('33925.00'),
    notes="Bank transfer: Riyad Bank IBAN SA0320000001234567890123. Thank you for your business."
)
inv.customer = Customer(
    name="Saudi Industrial Development Corp",
    address="King Fahd Road, Al Olaya, Riyadh, KSA",
    phone="0114567890",
    custom_fields={'trn': '310987654300003'}
)
inv.customer.vat_number = "310987654300003"
inv.items_list = []
for i in range(1, 21):
    item = InvoiceItem(
        description=f"Precision CNC Component Phase #{i:02d}",
        quantity=Decimal('1.00'),
        unit_price=Decimal('1500.00'),
        tax_rate=Decimal('15.00'),
        tax_amount=Decimal('225.00'),
        total=Decimal('1725.00')
    )
    inv.items_list.append(item)

inv.discount_amount = Decimal('500.00')

pdf_inv = universal_pdf_generator.generate_tax_invoice_pdf(inv)
render_and_copy(pdf_inv, "req_tax_invoice_20items_2pages_discount_vat")

# -------------------------------------------------------------------------
# 2. Quotation with Arabic customer and long description
# -------------------------------------------------------------------------
print("\n--- 2. Generating Quotation (Arabic customer + long description) ---")
quot = Quotation(
    quotation_number="QUOT-2026-042",
    quotation_date="2026-11-02",
    valid_until="2026-12-02",
    subtotal=Decimal('85000.00'),
    tax_amount=Decimal('12750.00'),
    total_amount=Decimal('97750.00'),
    notes="الدفع: 50% دفعة مقدمة عند التعميد و 50% عند التوريد النهائي.\nPayment: 50% Advance upon order confirmation, 50% upon final delivery.",
    terms_conditions="جميع الهياكل الإنشائية مشمولة بضمان لمدة 5 سنوات ضد عيوب التصنيع.\nAll structural elements carry a 5-year warranty against manufacturing defects."
)
quot.customer = Customer(
    name="مؤسسة الأفق للمقاولات العامة والتوريدات الصناعية",
    address="حي الملز، طريق صلاح الدين الأيوبي، الرياض",
    phone="0501234567",
    custom_fields={'trn': '300998877600003'}
)
quot.customer.vat_number = "300998877600003"

long_desc_1 = (
    "توريد وتركيب هياكل معدنية مخصصة للأجنحة والمعارض وفق المخططات الهندسية المعتمدة مع المعالجة الحرارية ومقاومة الصدأ\n"
    "Supply, precision fabrication, sandblasting, and epoxy electrostatic powder coating of architectural structural trusses "
    "according to engineering specifications and approved seismic load calculations. Includes all stainless steel anchor fasteners."
)
long_desc_2 = (
    "تصنيع وتثبيت ألواح الألمنيوم المعزولة مع أعمال الإضاءة الخطية المدمجة\n"
    "Fabrication and flush mounting of thermal insulated architectural aluminum composite claddings with recessed 4000K warm-white LED channel profiles."
)
quot.items_list = [
    QuotationItem(description=long_desc_1, quantity=Decimal('1.00'), unit_price=Decimal('55000.00'), total=Decimal('55000.00')),
    QuotationItem(description=long_desc_2, quantity=Decimal('1.00'), unit_price=Decimal('30000.00'), total=Decimal('30000.00'))
]
pdf_quot = universal_pdf_generator.generate_quotation_pdf(quot)
render_and_copy(pdf_quot, "req_quotation_arabic_long_desc")

# -------------------------------------------------------------------------
# 3. Salary Voucher (Breakdown & Timesheet)
# -------------------------------------------------------------------------
print("\n--- 3. Generating Salary Voucher ---")
sal_data = {
    'voucherType': 'Salary Voucher',
    'voucherNo': 'SAL-2026-104',
    'date': '2026-10-31',
    'payeeName': 'Eng. Tareq Al-Hassan',
    'payeeRole': 'Senior Site Project Engineer',
    'period': 'October 2026',
    'employeeId': 'EMP-1042',
    'amount': 14250.00,
    'paymentMode': 'WPS Direct Bank Transfer',
    'accountName': 'Riyad Bank Payroll Account',
    'notes': 'Monthly salary disbursed in accordance with KSA Labor Law through WPS.',
    'particulars': [
        {'item': 'Basic Salary', 'description': 'Monthly basic contract compensation', 'amount': 10000.00},
        {'item': 'Housing Allowance', 'description': 'Monthly standard accommodation provision', 'amount': 2500.00},
        {'item': 'Transport Allowance', 'description': 'Field transportation allowance', 'amount': 1000.00},
        {'item': 'Overtime Compensation', 'description': '18 approved field project overtime hours', 'amount': 1250.00},
        {'item': 'GOSI Contribution Deduction', 'description': 'Employee statutory pension deduction (9.75%)', 'amount': -500.00}
    ]
}
pdf_sal = universal_pdf_generator.generate_payment_voucher_pdf(sal_data)
render_and_copy(pdf_sal, "req_salary_voucher")

# -------------------------------------------------------------------------
# 4. CWO with 1,234,567.89 SAR
# -------------------------------------------------------------------------
print("\n--- 4. Generating CWO (1,234,567.89 SAR) ---")
cwo_data = {
    'voucherType': 'Customer Work Order & Quote',
    'voucherNo': 'CWO-2026-999',
    'date': '2026-11-02',
    'payeeName': 'Saudi Entertainment & Tourism Mega Projects Co.',
    'payeeRole': 'Master Concessionaire & Project Operator',
    'payeePhone': '0112345678',
    'payeeAddress': 'King Salman Park District, Riyadh, KSA',
    'amount': 1234567.89,
    'particulars': [
        {
            'item': 'Turnkey Pavilion Structural Shell & Interior Fitout',
            'description': 'Full procurement, structural steel framing, composite cladding, fire-rated partitions, and HVAC ducting as per RFP-2026-09',
            'qty': 1.0,
            'rate': 1234567.89,
            'amount': 1234567.89
        }
    ],
    'terms': 'Progress payments: 30% mobilization, 40% completion of steel structure, 30% testing & handover.'
}
pdf_cwo = universal_pdf_generator.generate_payment_voucher_pdf(cwo_data)
render_and_copy(pdf_cwo, "req_cwo_large_amount")

# -------------------------------------------------------------------------
# 5. Landscape Report with an Arabic Row
# -------------------------------------------------------------------------
print("\n--- 5. Generating Landscape Report with Arabic Row ---")
cols_rep = ["ID", "Transaction Date", "Entity / Client", "Category", "Payment Method", "Amount (SAR)", "Status"]
rows_rep = [
    ["TRX-101", "2026-11-01", "مؤسسة الأفق للتجارة والتوريدات", "Vendor Material", "Bank Transfer", "38,500.00", "Settled"],
    ["TRX-102", "2026-11-01", "شركة المشاريع السعودية الكبرى", "Civil Contracting", "Bank Transfer", "125,000.00", "Verified"],
    ["TRX-103", "2026-11-02", "Riyadh Commercial Glass Factory", "Glass & Glazing", "MADA POS", "14,200.00", "Settled"],
    ["TRX-104", "2026-11-02", "مكتب الفهد للاستشارات الهندسية", "Consulting", "Direct Debit", "12,000.00", "Verified"],
    ["TRX-105", "2026-11-02", "Modern Petrochemical Services", "Industrial Lubricants", "Petty Cash", "4,350.00", "Settled"]
]
kpis_rep = [
    ("Total Disbursed", "194,050.00 SAR"),
    ("Verified Records", "5 Entries"),
    ("Report Scope", "Arabic & English Bidi Operations")
]
pdf_rep = universal_pdf_generator.generate_universal_table_pdf(
    "Disbursement & Operations Journal",
    cols_rep,
    rows_rep,
    kpis=kpis_rep,
    period_text="01 Nov 2026 to 02 Nov 2026",
    orientation="landscape"
)
render_and_copy(pdf_rep, "req_landscape_report_arabic_row")

# -------------------------------------------------------------------------
# 6. Dense 8 pt Table (Timesheet Audit Report)
# -------------------------------------------------------------------------
print("\n--- 6. Generating Dense 8 pt Table (Timesheet Audit) ---")
ts_data = []
for i in range(1, 16):
    ts_data.append({
        'date': f"2026-11-{i:02d}",
        'staff_name': "Mohammad Al-Otaibi" if i % 2 == 0 else "Eng. Khalid Mansoor",
        'job_description': f"JOB-{2000+i} (Structure Fabrication & Quality Inspection)",
        'clock_in': "08:00 AM",
        'clock_out': "05:30 PM",
        'regular_hours': 8.0,
        'overtime_hours': 1.5,
        'status': "Approved"
    })
pdf_dense = universal_pdf_generator.generate_timesheet_report_pdf(ts_data, filters={'month': 'November 2026'})
render_and_copy(pdf_dense, "req_dense_8pt_timesheet_table")

print("\nALL 6 REQUIRED TEST DOCUMENTS SUCCESSFULLY GENERATED AND RENDERED!")
