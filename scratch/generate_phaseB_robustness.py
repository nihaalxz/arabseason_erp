import sys, os, django
from decimal import Decimal
import fitz
import shutil

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator

out_dir = 'design-reference/output/audit'
artifact_dir = r'C:\Users\nihaa\.gemini\antigravity\brain\640e936d-fef2-4084-9176-90e97a80fb01'
os.makedirs(out_dir, exist_ok=True)

def render_and_save(pdf_bytes, base_name):
    pdf_path = os.path.join(out_dir, f"{base_name}.pdf")
    with open(pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    doc = fitz.open(pdf_path)
    page_pngs = []
    for i in range(len(doc)):
        p = doc.load_page(i)
        pix = p.get_pixmap(dpi=150)
        p_name = f"{base_name}_p{i+1}.png" if len(doc) > 1 else f"{base_name}.png"
        p_path = os.path.join(out_dir, p_name)
        pix.save(p_path)
        # copy to artifact dir
        shutil.copy(p_path, os.path.join(artifact_dir, p_name))
        page_pngs.append(p_name)
        print(f"Rendered {p_name} ({pix.width}x{pix.height})")
    return page_pngs

# Base Mock Classes
class MockCustomer:
    def __init__(self, name="Saudi Modern Entertainment Co.", trn="310987654300003", addr="Olaya St, Riyadh 12214, KSA", phone="0114567890"):
        self.name = name
        self.tax_number = trn
        self.address = addr
        self.phone = phone

class MockItem:
    def __init__(self, desc, qty, price, rate=15.0, tax=None, tot=None):
        self.description = desc
        self.quantity = Decimal(str(qty))
        self.unit_price = Decimal(str(price))
        self.tax_rate = Decimal(str(rate))
        t_amt = (self.quantity * self.unit_price * self.tax_rate / Decimal('100.0')) if tax is None else Decimal(str(tax))
        self.tax_amount = t_amt
        self.total = ((self.quantity * self.unit_price) + t_amt) if tot is None else Decimal(str(tot))

class MockInvoice:
    def __init__(self, items, num="INV-2026-TEST", cust=None, notes=None, terms=None):
        self.id = 99
        self.invoice_number = num
        self.customer = cust or MockCustomer()
        self.customer_tax_number = getattr(self.customer, 'tax_number', '')
        self.billing_address = getattr(self.customer, 'address', '')
        self.invoice_date = "2026-11-02"
        self.due_date = "2026-11-16"
        self.supply_date = "2026-11-02"
        self.payment_terms = "Net 14 Days"
        self.reference_number = "PO-9942"
        self.job_order = None
        
        self.subtotal = sum(i.quantity * i.unit_price for i in items)
        self.tax_amount = sum(i.tax_amount for i in items)
        self.total_amount = self.subtotal + self.tax_amount
        self.tax_rate = Decimal('15.0')
        self.bank_account = None
        self.notes = notes or "Payment due within 14 days of issue."
        self.terms = terms or "All goods received in optimal operational order."

        class ItemManager:
            def __init__(self, itms):
                self._items = itms
            def all(self):
                return self._items
        self.items = ItemManager(items)

# Case 1: Tax Invoice 1 Item with Discount/VAT
inv_1 = MockInvoice([
    MockItem("Single Item Procurement: Modular Event Backdrop 6x3m", 1, 4500.00, 15.0)
], num="INV-2026-1ITEM")
render_and_save(universal_pdf_generator.generate_tax_invoice_pdf(inv_1), "phaseB_tax_invoice_1_item")

# Case 2: Tax Invoice 25 Items (Multi-page with Page 1 of 2 and Page 2 of 2)
items_25 = [
    MockItem(f"Exhibition Fabrication Component #{idx:02d}\\nStandard aluminum extrusion frame {idx}m", 2, 250.00, 15.0)
    for idx in range(1, 26)
]
inv_25 = MockInvoice(items_25, num="INV-2026-25ITEMS")
render_and_save(universal_pdf_generator.generate_tax_invoice_pdf(inv_25), "phaseB_tax_invoice_25_items")

# Case 3: Tax Invoice Long Wrapping Description
long_desc = (
    "Custom High-Precision CNC Router Milled Architectural Screen Wall\\n"
    "Manufactured from 25mm marine-grade birch plywood with double-sided oiled walnut veneer. "
    "Features intricate parametric Arabesque geometric perforation pattern with 45% open area. "
    "Includes fully concealed internal galvanized steel structural bracing, powder-coated satin black, "
    "integrated warm-white 3000K IP65 high-CRI LED perimeter channel, and floor-to-ceiling seismic anchoring hardware."
)
inv_long = MockInvoice([
    MockItem(long_desc, 1, 18500.00, 15.0),
    MockItem("On-Site Specialist Rigging & Structural Installation\\nCertified rigging crew with engineering sign-off", 1, 3500.00, 15.0)
], num="INV-2026-LONGDESC")
render_and_save(universal_pdf_generator.generate_tax_invoice_pdf(inv_long), "phaseB_tax_invoice_long_desc")

# Case 4: Tax Invoice Arabic Customer & Description
cust_ar = MockCustomer(
    name="مؤسسة الأفق المتقدم للتجارة والمقاولات",
    trn="300998877600003",
    addr="طريق الملك فهد، حي الصحافة، الرياض، المملكة العربية السعودية",
    phone="0554433221"
)
inv_ar = MockInvoice([
    MockItem("توريد وتركيب لوحات إرشادية وتوجيهية فاخرة\\nأكريليك أسود غير لامع 10 ملم مع حروف بارزة من النحاس المفرش", 4, 1750.00, 15.0),
    MockItem("أعمال الإضاءة المخفية والصيانة الفنية الدورية\\nشريط إضاءة ذكي مع محولات كهربائية معتمدة", 1, 2200.00, 15.0)
], num="INV-2026-ARABIC", cust=cust_ar, notes="شاكرين حسن تعاونكم معنا. يرجى سداد المبلغ إلى الحساب البنكي المعتمد.")
render_and_save(universal_pdf_generator.generate_tax_invoice_pdf(inv_ar), "phaseB_tax_invoice_arabic")

# Case 5: Tax Invoice Large Amount (1,234,567.89 SAR)
large_sub = Decimal('1073537.30')
large_tax = Decimal('161030.59')
inv_large = MockInvoice([
    MockItem("Major EPC Contract Milestone Settlement\\nRiyadh Metro Northern Boulevard Project Package B", 1, large_sub, 15.0, tax=large_tax, tot=Decimal('1234567.89'))
], num="INV-2026-1234567")
render_and_save(universal_pdf_generator.generate_tax_invoice_pdf(inv_large), "phaseB_tax_invoice_large_amount")

# Case 6: Quotation 22 Items Multi-page & Arabic Client
class MockQuoteItem:
    def __init__(self, desc, qty, price):
        self.description = desc
        self.quantity = Decimal(str(qty))
        self.unit_price = Decimal(str(price))
        self.tax_rate = Decimal('15.0')
        self.tax_amount = (self.quantity * self.unit_price * Decimal('0.15'))
        self.total = (self.quantity * self.unit_price) + self.tax_amount

class MockQuotationObj:
    def __init__(self, items, num="QT-2026-MULTI"):
        self.id = 77
        self.quotation_number = num
        self.customer = cust_ar
        self.customer_tax_number = "300998877600003"
        self.billing_address = "طريق الملك فهد، حي الصحافة، الرياض"
        self.quotation_date = "2026-11-02"
        self.valid_until = "2026-12-02"
        self.payment_terms = "50% Advance, 50% On Handover"
        self.job_order = None
        self.subtotal = sum(i.quantity * i.unit_price for i in items)
        self.tax_amount = sum(i.tax_amount for i in items)
        self.total_amount = self.subtotal + self.tax_amount
        self.tax_rate = Decimal('15.0')
        self.notes = "العرض ساري لمدة 30 يوماً من تاريخ الإصدار."
        self.terms = "الأسعار تشمل التوريد والتركيب والضمان لمدة سنة كاملة."

        class ItemManager:
            def __init__(self, itms):
                self._items = itms
            def all(self):
                return self._items
        self.items = ItemManager(items)

q_items = [
    MockQuoteItem(f"بند أعمال الديكور والتشطيبات #{idx:02d}\\nمواصفات قياسية معتمدة", 1, 500.00)
    for idx in range(1, 23)
]
quote_multi = MockQuotationObj(q_items)
render_and_save(universal_pdf_generator.generate_quotation_pdf(quote_multi), "phaseB_quotation_multipage_arabic")

# Case 7: CWO 22 Items Multi-page
cwo_multi_particulars = [
    {'item': f"Event Production Work Order Item #{idx:02d}\\nRigging and staging assembly unit {idx}", 'qty': 1, 'rate': 300.00, 'amount': 300.00}
    for idx in range(1, 23)
]
cwo_multi_data = {
    'voucherType': 'Customer Work Order & Quote',
    'voucherNo': 'CWO-2026-MULTI',
    'date': '2026-11-02',
    'payeeName': 'شركة الدرعية للاحتفالات والمؤتمرات',
    'payeeRole': 'Customer / Client',
    'amount': 6600.00,
    'particulars': cwo_multi_particulars,
    'notes': 'Production schedule confirmed for November festival launch.'
}
render_and_save(universal_pdf_generator.generate_payment_voucher_pdf(cwo_multi_data), "phaseB_cwo_multipage")

# Case 8: Salary Voucher Robustness (Base + OT + Deduction + 18 Timesheets)
class MockTimesheetItem:
    def __init__(self, d, job, reg, ot):
        self.date = d
        self.job_description = job
        self.regular_hours = reg
        self.overtime_hours = ot

class MockFullSalary:
    id = 88
    staff_name = "م. عبد الرحمن الشهري"
    employee_id = "EMP-0088"
    paid_month = "October 2026"
    payment_date = "2026-11-01"
    payment_mode = "Direct Bank Transfer"
    base_salary = Decimal('6000.00')
    overtime_hours = 16.0
    overtime_amount = Decimal('750.00')
    total_salary = Decimal('6750.00')
    amount = Decimal('6450.00') # 300 deduction
    designation = "Lead Production Engineer / مهندس إنتاج رئيسي"
    description = "صرف رواتب شهر أكتوبر 2026 مع ساعات العمل الإضافي بعد اعتماد الحضور."

ts_list = [
    MockTimesheetItem(f"2026-10-{idx:02d}", f"Production Supervision Shift #{idx:02d}", 8.0, 1.0 if idx % 2 == 0 else 0.0)
    for idx in range(1, 19)
]
render_and_save(universal_pdf_generator.generate_salary_voucher_pdf(MockFullSalary(), timesheets=ts_list), "phaseB_salary_voucher_robustness")

print("\nALL PHASE B ROBUSTNESS TEST CASES SUCCESSFULLY GENERATED AND SAVED!")

