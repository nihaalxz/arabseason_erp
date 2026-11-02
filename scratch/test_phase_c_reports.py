import sys, os, django
from decimal import Decimal
import fitz
import shutil

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator

out_dir = 'design-reference/output/phaseC'
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
        shutil.copy(p_path, os.path.join(artifact_dir, p_name))
        page_pngs.append(p_name)
        print(f"Rendered {p_name} ({pix.width}x{pix.height})")
    return page_pngs

# -------------------------------------------------------------
# 1. Universal Table PDF (1-page and 35-row multi-page + Arabic)
# -------------------------------------------------------------
cols_uni = ["ID", "Transaction Date", "Entity / Client", "Category", "Payment Method", "Amount (SAR)", "Status"]
rows_uni_1page = [
    [f"TRX-001", "2026-11-01", "مؤسسة الأفق للتجارة", "Vendor Material", "Bank Transfer", "15,400.00", "Settled"],
    [f"TRX-002", "2026-11-02", "Saudi Mega Infrastructure", "Consulting", "MADA POS", "8,250.00", "Verified"],
    [f"TRX-003", "2026-11-02", "Yahya Trading Est.", "Client Advance", "Cash", "5,000.00", "Settled"]
]
kpis_uni = [
    ("Total Records", "3"),
    ("Total Disbursed", "28,650.00 SAR"),
    ("Audit Period", "November 2026")
]
pdf_uni_1 = universal_pdf_generator.generate_universal_table_pdf("Universal Cashbook Export", cols_uni, rows_uni_1page, kpis=kpis_uni, period_text="01 Nov 2026 to 02 Nov 2026", orientation="landscape")
render_and_save(pdf_uni_1, "phaseC_universal_table_1page")

rows_uni_35 = []
for i in range(1, 36):
    is_ar = (i % 5 == 0)
    entity = "شركة الرياض للفعاليات العالمية" if is_ar else f"Client Entity #{i:03d} Saudi Corp"
    rows_uni_35.append([f"TRX-{i:04d}", f"2026-10-{(i%28)+1:02d}", entity, "Project Operations", "Bank Transfer", f"{1000 + i*50:,.2f}", "Verified"])

pdf_uni_35 = universal_pdf_generator.generate_universal_table_pdf("Universal Cashbook Export", cols_uni, rows_uni_35, kpis=[("Total Entries", "35"), ("Total Inflow", "65,400.00 SAR")], period_text="October 2026", orientation="landscape")
render_and_save(pdf_uni_35, "phaseC_universal_table_multipage")

# -------------------------------------------------------------
# 2. Cashbook Ledger PDF (1-page and 35-row multi-page + Arabic)
# -------------------------------------------------------------
book_data = {'name': 'Riyadh Main Operations Book'}
summary_cb = {'opening_balance': 15000.0, 'total_inflow': 54000.0, 'total_outflow': 32000.0, 'closing_balance': 37000.0}
entries_1 = [
    {'date': '2026-11-01', 'reference': 'REF-001', 'category': 'Client Invoice', 'description': 'دفعة مشروع البوليفارد', 'inflow': 25000.0, 'outflow': 0.0},
    {'date': '2026-11-02', 'reference': 'REF-002', 'category': 'Materials', 'description': 'Procurement of Acrylic & Steel', 'inflow': 0.0, 'outflow': 8500.0}
]
pdf_cb_1 = universal_pdf_generator.generate_cashbook_ledger_pdf(book_data, summary_cb, entries_1, filters={'start_date': '2026-11-01', 'end_date': '2026-11-02'})
render_and_save(pdf_cb_1, "phaseC_cashbook_ledger_1page")

entries_35 = []
for i in range(1, 36):
    is_ar = (i % 4 == 0)
    desc = "شراء مواد خام وألواح خشبية للمشروع" if is_ar else f"Operational Procurement Batch #{i:02d}"
    inf = 500.0 if i % 3 == 0 else 0.0
    outf = 300.0 if inf == 0.0 else 0.0
    entries_35.append({'date': f"2026-10-{(i%28)+1:02d}", 'reference': f"REF-{i:04d}", 'category': 'Operations', 'description': desc, 'inflow': inf, 'outflow': outf})

pdf_cb_35 = universal_pdf_generator.generate_cashbook_ledger_pdf(book_data, summary_cb, entries_35, filters={'start_date': '2026-10-01', 'end_date': '2026-10-31'})
render_and_save(pdf_cb_35, "phaseC_cashbook_ledger_multipage")

# -------------------------------------------------------------
# 3. Bank Statement PDF (1-page and 35-row multi-page + Arabic)
# -------------------------------------------------------------
class MockBank:
    bank_name = "Riyad Bank Main Branch"
    account_number = "1080099887766"
    iban = "SA4420000001080099887766"

sum_bank = {'opening_balance': 25000.0, 'total_deposits': 45000.0, 'total_withdrawals': 20000.0, 'closing_balance': 50000.0}
trx_bank_1 = [
    {'date': '2026-11-01', 'description': 'تحويل بنكي وارد من عميل', 'withdrawal': 0, 'deposit': 15000.0},
    {'date': '2026-11-02', 'description': 'Commercial Supplier Remittance', 'withdrawal': 4500.0, 'deposit': 0}
]
pdf_bank_1 = universal_pdf_generator.generate_bank_statement_pdf(MockBank(), sum_bank, trx_bank_1, filters={'start_date': '2026-11-01', 'end_date': '2026-11-02'})
render_and_save(pdf_bank_1, "phaseC_bank_statement_1page")

trx_bank_35 = []
for i in range(1, 36):
    is_ar = (i % 6 == 0)
    desc = "سداد مستحقات مقاول من الباطن" if is_ar else f"Interbank Automated Clearance #{i:04d}"
    dep = 1200.0 if i % 2 == 1 else 0
    wth = 800.0 if dep == 0 else 0
    trx_bank_35.append({'date': f"2026-10-{(i%28)+1:02d}", 'description': desc, 'withdrawal': wth, 'deposit': dep})

pdf_bank_35 = universal_pdf_generator.generate_bank_statement_pdf(MockBank(), sum_bank, trx_bank_35, filters={'start_date': '2026-10-01', 'end_date': '2026-10-31'})
render_and_save(pdf_bank_35, "phaseC_bank_statement_multipage")

# -------------------------------------------------------------
# 4. Timesheet Report PDF (1-page and 35-row multi-page + Arabic)
# -------------------------------------------------------------
class MockTS:
    def __init__(self, d, name, job, reg=8.0, ot=0.0):
        self.date = d
        self.staff_name = name
        self.job_description = job
        self.clock_in = "08:00"
        self.clock_out = "17:00"
        self.regular_hours = reg
        self.overtime_hours = ot
        self.status = "Approved"

ts_1 = [
    MockTS("2026-11-01", "أحمد إبراهيم المري", "إشراف على الموقع وتجهيز الهياكل", 8.0, 2.0),
    MockTS("2026-11-02", "Zaid Al-Mansoor", "CNC Router Operations Shift", 8.0, 0.0)
]
pdf_ts_1 = universal_pdf_generator.generate_timesheet_report_pdf(ts_1, filters={'month': 'November 2026'})
render_and_save(pdf_ts_1, "phaseC_timesheet_report_1page")

ts_35 = []
for i in range(1, 36):
    is_ar = (i % 4 == 0)
    s_name = "سالم عبد الله القحطاني" if is_ar else f"Staff Member #{i:02d}"
    j_name = "أعمال الدهان والتثبيت الموقعي" if is_ar else f"Production Workshop Task #{i:02d}"
    ts_35.append(MockTS(f"2026-10-{(i%28)+1:02d}", s_name, j_name, 8.0, 1.5 if i % 3 == 0 else 0.0))

pdf_ts_35 = universal_pdf_generator.generate_timesheet_report_pdf(ts_35, filters={'month': 'October 2026'})
render_and_save(pdf_ts_35, "phaseC_timesheet_report_multipage")

# -------------------------------------------------------------
# 5. Employee Ledger PDF (1-page and 35-row multi-page + Arabic)
# -------------------------------------------------------------
emp_ledger_1 = {
    'staff_name': 'مهندس فيصل المطيري',
    'summary': {'total_earnings': 12000.0, 'total_advances': 1500.0, 'total_paid': 10500.0, 'net_balance': 0.0},
    'entries': [
        {'date': '2026-10-01', 'description': 'راتب شهر أكتوبر الأساسي مع البدلات', 'accrued': 6000.0, 'paid': 0, 'balance': 6000.0},
        {'date': '2026-10-15', 'description': 'Mid-Month Advance Payment Transfer', 'accrued': 0, 'paid': 1500.0, 'balance': 4500.0},
        {'date': '2026-10-31', 'description': 'Final Month Salary Settlement', 'accrued': 0, 'paid': 4500.0, 'balance': 0.0}
    ]
}
pdf_el_1 = universal_pdf_generator.generate_employee_ledger_pdf(emp_ledger_1)
render_and_save(pdf_el_1, "phaseC_employee_ledger_1page")

emp_ledger_35 = {
    'staff_name': 'طارق منصور الزهراني',
    'summary': {'total_earnings': 35000.0, 'total_advances': 4000.0, 'total_paid': 31000.0, 'net_balance': 0.0},
    'entries': [
        {'date': f"2026-{(i%10)+1:02d}-01", 'description': f"صرف مستحقات مناوبة أو مكافأة شهرية #{i:02d}" if i % 5 == 0 else f"Monthly Shift & Allowance Allocation #{i:02d}", 'accrued': 1000.0, 'paid': 900.0, 'balance': 100.0 * i}
        for i in range(1, 36)
    ]
}
pdf_el_35 = universal_pdf_generator.generate_employee_ledger_pdf(emp_ledger_35)
render_and_save(pdf_el_35, "phaseC_employee_ledger_multipage")

# -------------------------------------------------------------
# 6. Financial Report PDF (1-page and 35-row multi-page + Arabic)
# -------------------------------------------------------------
fin_data_1 = {
    'kpis': [{'label': 'Total Revenue', 'value': '150,000.00 SAR'}, {'label': 'Total Expenses', 'value': '85,000.00 SAR'}, {'label': 'Net Profit', 'value': '65,000.00 SAR'}],
    'records': [
        {'date': '2026-11-01', 'entity': 'مؤسسة الرياض للديكور', 'category': 'Direct Revenue', 'amount_sar': '45,000.00', 'status': 'Cleared'},
        {'date': '2026-11-02', 'entity': 'National Raw Materials Co.', 'category': 'Wood Supplies', 'amount_sar': '12,500.00', 'status': 'Paid'}
    ]
}
pdf_fin_1 = universal_pdf_generator.generate_financial_report_pdf('overview', fin_data_1, filters={'start_date': '2026-11-01', 'end_date': '2026-11-02'})
render_and_save(pdf_fin_1, "phaseC_financial_report_1page")

fin_data_35 = {
    'kpis': [{'label': 'Fiscal Year', 'value': '2026'}, {'label': 'Consolidated Volume', 'value': '485,000.00 SAR'}],
    'records': [
        {'record_id': f"REC-{i:04d}", 'date': f"2026-10-{(i%28)+1:02d}", 'party': "شركة المشاريع السعودية" if i % 4 == 0 else f"Commercial Partner #{i:02d}", 'cost_center': "Events Division", 'amount_sar': f"{2500 + i*150:,.2f}"}
        for i in range(1, 36)
    ]
}
pdf_fin_35 = universal_pdf_generator.generate_financial_report_pdf('revenue', fin_data_35, filters={'start_date': '2026-10-01', 'end_date': '2026-10-31'})
render_and_save(pdf_fin_35, "phaseC_financial_report_multipage")

print("\nALL PHASE C REPORT TESTS SUCCESSFULLY GENERATED AND RENDERED!")

