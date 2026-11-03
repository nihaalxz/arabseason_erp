import os
from decimal import Decimal
import fitz
from django.test import TestCase

from api.pdf_generator import universal_pdf_generator
from api.models import (
    Customer, Invoice, InvoiceItem,
    Quotation, QuotationItem,
    DeliveryNote, DeliveryNoteItem,
    Estimation, EstimationItem,
    CreditNote, CreditNoteItem
)

class PDFGeneratorSmokeTests(TestCase):
    """
    Comprehensive smoke tests for all generated PDF document types.
    Asserts page count > 0 and verifies that key strings (doc number, party, totals) are rendered.
    """

    def setUp(self):
        self.gen = universal_pdf_generator

    def _extract_pdf_text(self, pdf_bytes):
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        return len(doc), text

    def test_smoke_delivery_note_pdf(self):
        dn = DeliveryNote(
            delivery_note_number="DC-00002",
            delivery_date="2026-10-15",
            shipping_method="Others",
            notes="Handle with care."
        )
        dn.total_amount = Decimal('150.00')
        dn.customer = Customer(name="Marwa Contracting", phone="0575287403")
        dn.items_list = [
            DeliveryNoteItem(
                description="Banner printing\nForex with sticker",
                quantity=Decimal('1.00'),
                unit_price=Decimal('150.00'),
                total=Decimal('150.00')
            )
        ]
        pdf_bytes = self.gen.generate_delivery_note_pdf(dn)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("DC-00002", text)
        self.assertIn("Marwa", text)
        self.assertIn("150.00", text)

    def test_smoke_tax_invoice_pdf(self):
        inv = Invoice(
            invoice_number="INV-2026-901",
            invoice_date="2026-11-02",
            due_date="2026-11-16",
            subtotal=Decimal('10000.00'),
            tax_rate=Decimal('15.00'),
            tax_amount=Decimal('1500.00'),
            total_amount=Decimal('11500.00'),
            notes="Payment via Riyad Bank."
        )
        inv.customer = Customer(name="Saudi Horizon Trading", phone="0112345678")
        inv.customer.vat_number = "300123456700003"
        inv.items_list = [
            InvoiceItem(
                description="Custom Steel Fabrication Phase 1",
                quantity=Decimal('1.00'),
                unit_price=Decimal('10000.00'),
                tax_rate=Decimal('15.00'),
                tax_amount=Decimal('1500.00'),
                total=Decimal('11500.00')
            )
        ]
        pdf_bytes = self.gen.generate_tax_invoice_pdf(inv)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("INV-2026-901", text)
        self.assertIn("Saudi Horizon Trading", text)
        self.assertIn("11,500.00", text)

    def test_smoke_quotation_pdf(self):
        quot = Quotation(
            quotation_number="QUOT-2026-555",
            quotation_date="2026-11-02",
            valid_until="2026-12-02",
            subtotal=Decimal('25000.00'),
            tax_amount=Decimal('3750.00'),
            total_amount=Decimal('28750.00'),
            notes="Valid for 30 days."
        )
        quot.customer = Customer(name="Al-Fahad Construction", phone="0559876543")
        quot.items_list = [
            QuotationItem(
                description="Perimeter Security Fencing",
                quantity=Decimal('100.00'),
                unit_price=Decimal('250.00'),
                total=Decimal('25000.00')
            )
        ]
        pdf_bytes = self.gen.generate_quotation_pdf(quot)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("QUOT-2026-555", text)
        self.assertIn("Al-Fahad Construction", text)
        self.assertIn("28,750.00", text)

    def test_smoke_credit_note_pdf(self):
        cn = CreditNote(
            credit_note_number="CN-2026-012",
            credit_note_date="2026-11-02",
            subtotal=Decimal('2000.00'),
            tax_rate=Decimal('15.00'),
            tax_amount=Decimal('300.00'),
            total_amount=Decimal('2300.00'),
            notes="Credit adjustment for damaged goods."
        )
        cn.customer = Customer(name="Metro Civil Works", phone="0119876543")
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
        pdf_bytes = self.gen.generate_credit_note_pdf(cn)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("CN-2026-012", text)
        self.assertIn("Metro Civil Works", text)
        self.assertIn("2,300.00", text)

    def test_smoke_payment_voucher_pdf(self):
        pv_data = {
            'voucherType': 'Payment Voucher',
            'voucherNo': 'PV-2026-888',
            'date': '2026-11-02',
            'payeeName': 'National Cement Industries',
            'amount': 4500.00,
            'particulars': [
                {'item': 'Portland Cement Bags', 'description': '100 bags type 1', 'amount': 4500.00}
            ]
        }
        pdf_bytes = self.gen.generate_payment_voucher_pdf(pv_data)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("PV-2026-888", text)
        self.assertIn("National Cement Industries", text)
        self.assertIn("4,500.00", text)

    def test_smoke_receipt_voucher_pdf(self):
        rv_data = {
            'voucherType': 'Receipt Voucher',
            'voucherNo': 'RV-2026-777',
            'date': '2026-11-02',
            'payeeName': 'Apex Real Estate',
            'amount': 12000.00,
            'particulars': [
                {'item': 'Project Advance Payment', 'description': 'Advance for phase 2', 'amount': 12000.00}
            ]
        }
        pdf_bytes = self.gen.generate_payment_voucher_pdf(rv_data)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("RV-2026-777", text)
        self.assertIn("Apex Real Estate", text)
        self.assertIn("12,000.00", text)

    def test_smoke_salary_voucher_pdf(self):
        sal_data = {
            'voucherType': 'Salary Voucher',
            'voucherNo': 'SAL-2026-001',
            'date': '2026-10-31',
            'payeeName': 'Tariq Al-Harbi',
            'employeeId': 'EMP-2044',
            'amount': 9500.00,
            'particulars': [
                {'item': 'Basic Salary', 'amount': 7000.00},
                {'item': 'Housing Allowance', 'amount': 2500.00}
            ]
        }
        pdf_bytes = self.gen.generate_payment_voucher_pdf(sal_data)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("SAL-2026-001", text)
        self.assertIn("Tariq Al-Harbi", text)
        self.assertIn("9,500.00", text)

    def test_smoke_customer_work_order_quote_pdf(self):
        cwo_data = {
            'voucherType': 'Customer Work Order & Quote',
            'voucherNo': 'CWO-2026-006',
            'date': '2026-11-02',
            'payeeName': 'hello client',
            'amount': 50.00,
            'particulars': [
                {'item': 'Vinyl Cutout Decals', 'qty': 1.0, 'rate': 50.0, 'amount': 50.00}
            ]
        }
        pdf_bytes = self.gen.generate_payment_voucher_pdf(cwo_data)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("CWO-2026-006", text)
        self.assertIn("hello client", text)
        self.assertIn("50.00", text)

    def test_smoke_approved_vendor_quote_pdf(self):
        vpa_data = {
            'voucherType': 'Approved Vendor Price Quote / Agreement',
            'voucherNo': 'VPA-2026-006',
            'date': '2026-10-29',
            'payeeName': 'rahul vendor',
            'amount': 5.00,
            'particulars': [
                {'item': 'Standard Hardware Screws', 'qty': 1.0, 'rate': 5.0, 'amount': 5.00}
            ]
        }
        pdf_bytes = self.gen.generate_payment_voucher_pdf(vpa_data)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("VPA-2026-006", text)
        self.assertIn("rahul vendor", text)
        self.assertIn("5.00", text)

    def test_smoke_statement_ledger_pdf(self):
        stmt_data = {
            'voucherType': 'Customer Account Statement',
            'voucherNo': 'STMT-2026-01',
            'date': '2026-11-02',
            'payeeName': 'Saudi Modern Logistics',
            'openingBalance': 1000.00,
            'closingBalance': 3500.00,
            'particulars': [
                {'date': '2026-10-01', 'item': 'Invoice INV-100', 'debit': 5000.00, 'credit': 0},
                {'date': '2026-10-15', 'item': 'Bank Transfer Payment', 'debit': 0, 'credit': 2500.00}
            ]
        }
        pdf_bytes = self.gen.generate_payment_voucher_pdf(stmt_data)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("STMT-2026-01", text)
        self.assertIn("Saudi Modern Logistics", text)
        self.assertIn("3,500.00", text)

    def test_smoke_admin_estimation_pdf(self):
        est = Estimation(
            estimate_number="EST-2026-09",
            date="2026-11-02",
            margin_percentage=Decimal('25.00'),
            subtotal_cost=Decimal('40000.00'),
            total_price=Decimal('50000.00'),
            notes="Internal engineering review."
        )
        est.customer = Customer(name="Kingdom Tower Management", phone="0115554433")
        est.items_list = [
            EstimationItem(
                item_name="HVAC Ducting Structural Bracing",
                quantity=Decimal('1.00'),
                unit_price=Decimal('50000.00'),
                total_price=Decimal('50000.00')
            )
        ]
        pdf_bytes = self.gen.generate_admin_estimation_pdf(est)
        pages, text = self._extract_pdf_text(pdf_bytes)
        self.assertGreater(pages, 0)
        self.assertIn("EST-2026-09", text)
        self.assertIn("Kingdom Tower Management", text)
        self.assertIn("50,000.00", text)

    def test_smoke_reports(self):
        # 1. Universal Table PDF
        pdf_uni = self.gen.generate_universal_table_pdf(
            "Monthly Operations Summary",
            ["ID", "Date", "Party", "Amount"],
            [["TRX-01", "2026-11-01", "Vendor Corp", "1,200.00"]],
            kpis=[("Total", "1,200.00 SAR")]
        )
        p_uni, t_uni = self._extract_pdf_text(pdf_uni)
        self.assertGreater(p_uni, 0)
        self.assertIn("MONTHLY", t_uni)
        self.assertIn("Vendor Corp", t_uni)

        # 2. Timesheet Report PDF
        pdf_ts = self.gen.generate_timesheet_report_pdf([
            {
                'date': '2026-11-01',
                'staff_name': 'Ali Mansoor',
                'job_description': 'Site Survey',
                'clock_in': '08:00',
                'clock_out': '17:00',
                'regular_hours': 8.0,
                'overtime_hours': 1.0,
                'status': 'Approved'
            }
        ])
        p_ts, t_ts = self._extract_pdf_text(pdf_ts)
        self.assertGreater(p_ts, 0)
        self.assertIn("TIMESHEET", t_ts)
        self.assertIn("Ali Mansoor", t_ts)


from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.models import JobOrder, Customer

class JobOrderSequenceTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='testseqadmin', password='password123', is_staff=True, is_superuser=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = Customer.objects.create(name='Test Customer Sequence', created_by=self.user)

    def test_next_order_id_generation(self):
        # Create JOB0001, JOB0002
        JobOrder.objects.create(order_id='JOB0001', title='Job 1', customer=self.customer, created_by=self.user)
        JobOrder.objects.create(order_id='JOB0002', title='Job 2', customer=self.customer, created_by=self.user)

        res = self.client.get('/api/job-orders/next-order-id/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['prefix'], 'JOB')
        self.assertEqual(res.data['number'], '0003')
        self.assertEqual(res.data['order_id'], 'JOB0003')

    def test_auto_generate_order_id_on_create_if_blank_or_duplicate(self):
        JobOrder.objects.create(order_id='JOB0010', title='Job 10', customer=self.customer, created_by=self.user)

        # Blank order_id
        res = self.client.post('/api/job-orders/', {
            'title': 'Job 11 auto',
            'customer': self.customer.id,
            'status': 'In Progress',
            'order_id': ''
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['order_id'], 'JOB0011')

        # Duplicate order_id submitted (should auto-increment)
        res2 = self.client.post('/api/job-orders/', {
            'title': 'Job 12 duplicate conflict',
            'customer': self.customer.id,
            'status': 'In Progress',
            'order_id': 'JOB0011'
        })
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(res2.data['order_id'], 'JOB0012')


from api.models import Vendor, VendorPayment

class CommonVendorTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='admin_vnd', password='password123', is_staff=True, is_superuser=True)
        self.staff1 = User.objects.create_user(username='staff_vnd1', password='password123', is_staff=False, is_superuser=False)
        self.staff2 = User.objects.create_user(username='staff_vnd2', password='password123', is_staff=False, is_superuser=False)

        # Vendors created by different users
        self.v1 = Vendor.objects.create(name='Al-Futtaim Supplies', created_by=self.admin)
        self.v2 = Vendor.objects.create(name='Bin Laden Steel', created_by=self.staff1)

    def test_vendors_are_common_and_visible_to_all_staff(self):
        client = APIClient()
        client.force_authenticate(user=self.staff2)

        res = client.get('/api/vendors/?nopage=true')
        self.assertEqual(res.status_code, 200)
        vendor_names = [v['name'] for v in res.data]
        self.assertIn('Al-Futtaim Supplies', vendor_names)
        self.assertIn('Bin Laden Steel', vendor_names)
        self.assertEqual(len(vendor_names), 2)

    def test_vendor_payments_accessible_by_vendor_id_for_staff(self):
        vp = VendorPayment.objects.create(
            vendor=self.v1,
            amount=Decimal('500.00'),
            payment_date='2026-11-01',
            created_by=self.admin
        )
        client = APIClient()
        client.force_authenticate(user=self.staff2)

        res = client.get(f'/api/vendor-payments/?vendor={self.v1.id}')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(float(results[0]['amount']), 500.0)


class CashbookExportTablePdfSmokeTests(TestCase):
    """
    Smoke tests for all 11 index table PDF exports calling /api/cashbook/export-table-pdf/.
    Asserts HTTP 200, Content-Type application/pdf, and page_count > 0.
    """
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='pdf_export_tester', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.endpoint = '/api/cashbook/export-table-pdf/'

    def _assert_valid_pdf_response(self, response):
        self.assertEqual(response.status_code, 200, f"Expected 200, got {response.status_code}: {getattr(response, 'data', response.content)}")
        self.assertEqual(response['Content-Type'], 'application/pdf')
        doc = fitz.open(stream=response.content, filetype='pdf')
        self.assertGreater(len(doc), 0)
        # Assert A4 portrait dimensions (595.28 x 841.89 pt within 1.5 pt tolerance)
        first_page = doc[0]
        self.assertLess(first_page.rect.width, first_page.rect.height, "PDF must be in portrait orientation")
        self.assertAlmostEqual(first_page.rect.width, 595.28, delta=1.5, msg="Width must match A4 portrait (595.28 pt)")
        self.assertAlmostEqual(first_page.rect.height, 841.89, delta=1.5, msg="Height must match A4 portrait (841.89 pt)")
        # Assert no obsolete 'Report#' number line appears
        extracted_text = first_page.get_text()
        self.assertNotIn("Report#", extracted_text, "Report# line must not appear in report header")

    def test_smoke_export_customer_chart(self):
        payload = {
            'title': 'Customer Price Chart',
            'filename_prefix': 'customer_price_chart',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Item / Category', 'dataKey': 'item_name'},
                {'header': 'Customer', 'dataKey': 'customer_name'},
                {'header': 'Quoted Rate', 'dataKey': 'quoted_rate', 'align': 'right'},
                {'header': 'Market Benchmark', 'dataKey': 'benchmark_rate', 'align': 'right'},
                {'header': 'Variance', 'dataKey': 'variance', 'align': 'right'},
            ],
            'rows': [
                {'sl': 1, 'item_name': 'Steel Rebar 12mm', 'customer_name': 'Saudi Aramco / أرامكو', 'quoted_rate': '2,450.00', 'benchmark_rate': '2,400.00', 'variance': '+2.08%'},
                {'sl': 2, 'item_name': 'Concrete C35', 'customer_name': 'Sabic EPC', 'quoted_rate': '240.00', 'benchmark_rate': '245.00', 'variance': '-2.04%'}
            ]
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_vendor_price_chart(self):
        payload = {
            'title': 'Vendor Price Chart',
            'filename_prefix': 'vendor_price_chart',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Item / Category', 'dataKey': 'item_name'},
                {'header': 'Vendor', 'dataKey': 'vendor_name'},
                {'header': 'Quoted Rate', 'dataKey': 'quoted_rate', 'align': 'right'},
                {'header': 'Benchmark Rate', 'dataKey': 'benchmark_rate', 'align': 'right'},
                {'header': 'Status', 'dataKey': 'status', 'align': 'center'},
            ],
            'rows': [
                {'sl': 1, 'item_name': 'Portland Cement Type I', 'vendor_name': 'Al-Yamama Cement', 'quoted_rate': '18.50', 'benchmark_rate': '19.00', 'status': 'Approved'},
                {'sl': 2, 'item_name': 'Hollow Block 20cm', 'vendor_name': 'Riyadh Precast Co.', 'quoted_rate': '3.20', 'benchmark_rate': '3.20', 'status': 'Benchmark Match'}
            ]
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_vendors(self):
        payload = {
            'title': 'Vendors Directory',
            'filename_prefix': 'vendors_directory',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Vendor Name', 'dataKey': 'name'},
                {'header': 'Contact Person', 'dataKey': 'contact_person'},
                {'header': 'Phone', 'dataKey': 'phone'},
                {'header': 'Total Orders', 'dataKey': 'total_orders', 'align': 'right'},
                {'header': 'Total Spend (SAR)', 'dataKey': 'total_spend', 'align': 'right'},
            ],
            'rows': [
                {'sl': 1, 'name': 'Al-Futtaim Heavy Equipment', 'contact_person': 'Rashid Al-Hassan', 'phone': '+966 50 111 2233', 'total_orders': 14, 'total_spend': '145,200.00'},
                {'sl': 2, 'name': 'Rawabi Contracting & Services', 'contact_person': 'Mahmoud Saeed', 'phone': '+966 55 444 7788', 'total_orders': 8, 'total_spend': '89,500.00'}
            ],
            'totals': {'name': 'Total Spend', 'total_spend': '234,700.00'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_customers(self):
        payload = {
            'title': 'Customers Directory',
            'filename_prefix': 'customers_directory',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Customer Name', 'dataKey': 'name'},
                {'header': 'Contact Person', 'dataKey': 'contact_person'},
                {'header': 'Phone', 'dataKey': 'phone'},
                {'header': 'Total Projects', 'dataKey': 'total_projects', 'align': 'right'},
                {'header': 'Total Invoiced (SAR)', 'dataKey': 'total_invoiced', 'align': 'right'},
            ],
            'rows': [
                {'sl': 1, 'name': 'Saudi Electricity Company (SEC)', 'contact_person': 'Eng. Khalid', 'phone': '+966 51 234 5678', 'total_projects': 5, 'total_invoiced': '380,000.00'},
                {'sl': 2, 'name': 'Red Sea Global', 'contact_person': 'Fahad Al-Zahrani', 'phone': '+966 54 987 6543', 'total_projects': 3, 'total_invoiced': '520,000.00'}
            ],
            'totals': {'name': 'Total Invoiced', 'total_invoiced': '900,000.00'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_expenses(self):
        payload = {
            'title': 'Expenses Register',
            'filename_prefix': 'expenses_register',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Date', 'dataKey': 'date'},
                {'header': 'Category', 'dataKey': 'category'},
                {'header': 'Description', 'dataKey': 'description'},
                {'header': 'Paid Via', 'dataKey': 'paid_via'},
                {'header': 'Amount (SAR)', 'dataKey': 'amount', 'align': 'right'},
            ],
            'rows': [
                {'sl': 1, 'date': '2026-11-01', 'category': 'Fuel & Transport', 'description': 'Site Diesel Supply 2000L', 'paid_via': 'Petty Cash', 'amount': '2,400.00'},
                {'sl': 2, 'date': '2026-11-02', 'category': 'Office Utilities', 'description': 'Electricity & Water Bill', 'paid_via': 'Al Rajhi Bank', 'amount': '1,150.00'}
            ],
            'totals': {'description': 'Total Expenses', 'amount': '3,550.00'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_labour_chart(self):
        payload = {
            'title': 'Labour Price Chart',
            'filename_prefix': 'labour_price_chart',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Labour Type', 'dataKey': 'labour_type'},
                {'header': 'Skill / Category', 'dataKey': 'category'},
                {'header': 'Daily Rate (SAR)', 'dataKey': 'daily_rate', 'align': 'right'},
                {'header': 'Overtime Rate (SAR/h)', 'dataKey': 'ot_rate', 'align': 'right'},
                {'header': 'Active Count', 'dataKey': 'active_count', 'align': 'right'},
            ],
            'rows': [
                {'sl': 1, 'labour_type': 'Certified Welder (6G)', 'category': 'Mechanical', 'daily_rate': '320.00', 'ot_rate': '45.00', 'active_count': 12},
                {'sl': 2, 'labour_type': 'Civil Mason', 'category': 'Civil', 'daily_rate': '180.00', 'ot_rate': '25.00', 'active_count': 25}
            ]
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_bank_accounts(self):
        payload = {
            'title': 'Bank & Cash Accounts Directory',
            'filename_prefix': 'accounts_directory',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Account Name', 'dataKey': 'name'},
                {'header': 'Account Type', 'dataKey': 'account_type'},
                {'header': 'Account Number', 'dataKey': 'account_no'},
                {'header': 'Bank Name', 'dataKey': 'bank_name'},
                {'header': 'Current Balance (SAR)', 'dataKey': 'balance', 'align': 'right'},
            ],
            'rows': [
                {'sl': 1, 'name': 'Corporate Operating', 'account_type': 'Bank Current', 'account_no': 'SA0380000000608010167519', 'bank_name': 'Al Rajhi Bank', 'balance': '450,210.50'},
                {'sl': 2, 'name': 'Site Petty Cash', 'account_type': 'Cash Vault', 'account_no': 'PETTY-01', 'bank_name': 'On-Site Safe', 'balance': '12,500.00'}
            ],
            'totals': {'bank_name': 'Total Liquid Funds', 'balance': '462,710.50'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_books(self):
        payload = {
            'title': 'Books & Registers',
            'filename_prefix': 'books_registers',
            'columns': [
                {'header': 'SL', 'dataKey': 'sl', 'align': 'center'},
                {'header': 'Book Name', 'dataKey': 'name'},
                {'header': 'Type', 'dataKey': 'type'},
                {'header': 'Total Transactions', 'dataKey': 'tx_count', 'align': 'right'},
                {'header': 'Total Inflow (SAR)', 'dataKey': 'inflow', 'align': 'right'},
                {'header': 'Total Outflow (SAR)', 'dataKey': 'outflow', 'align': 'right'},
                {'header': 'Net Balance (SAR)', 'dataKey': 'net_balance', 'align': 'right'},
            ],
            'rows': [
                {'sl': 1, 'name': 'Main Operations Cashbook', 'type': 'Primary Cash', 'tx_count': 142, 'inflow': '520,000.00', 'outflow': '310,400.00', 'net_balance': '209,600.00'},
                {'sl': 2, 'name': 'Dammam Project Petty Cash', 'type': 'Petty Cash', 'tx_count': 64, 'inflow': '50,000.00', 'outflow': '42,100.00', 'net_balance': '7,900.00'}
            ],
            'totals': {'name': 'Overall Books Total', 'inflow': '570,000.00', 'outflow': '352,500.00', 'net_balance': '217,500.00'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_cash_ledger(self):
        payload = {
            'title': 'Cash Ledger Report',
            'filename_prefix': 'cash_ledger_report',
            'columns': [
                {'header': 'Date', 'dataKey': 'date'},
                {'header': 'Voucher#', 'dataKey': 'voucher_no'},
                {'header': 'Description / Narration', 'dataKey': 'narration'},
                {'header': 'Account / Mode', 'dataKey': 'account'},
                {'header': 'Debit (Inflow)', 'dataKey': 'debit', 'align': 'right'},
                {'header': 'Credit (Outflow)', 'dataKey': 'credit', 'align': 'right'},
                {'header': 'Balance (SAR)', 'dataKey': 'balance', 'align': 'right'},
            ],
            'rows': [
                {'date': '2026-11-01', 'voucher_no': 'RCV-0012', 'narration': 'Customer Advance Payment', 'account': 'Al Rajhi Bank', 'debit': '50,000.00', 'credit': '0.00', 'balance': '50,000.00'},
                {'date': '2026-11-02', 'voucher_no': 'PV-0045', 'narration': 'Vendor Materials Settlement', 'account': 'Al Rajhi Bank', 'debit': '0.00', 'credit': '18,500.00', 'balance': '31,500.00'}
            ],
            'totals': {'narration': 'Net Ledger Movement', 'debit': '50,000.00', 'credit': '18,500.00', 'balance': '31,500.00'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_job_orders(self):
        payload = {
            'title': 'Job Orders Register',
            'filename_prefix': 'job_orders_register',
            'columns': [
                {'header': 'Job Order#', 'dataKey': 'order_no'},
                {'header': 'Customer', 'dataKey': 'customer_name'},
                {'header': 'Project / Scope', 'dataKey': 'project_name'},
                {'header': 'Status', 'dataKey': 'status'},
                {'header': 'Start Date', 'dataKey': 'start_date'},
                {'header': 'Contract Value (SAR)', 'dataKey': 'contract_value', 'align': 'right'},
            ],
            'rows': [
                {'order_no': 'JO-2026-001', 'customer_name': 'Arabian Drilling Co.', 'project_name': 'Rig Site Piping Fabrication', 'status': 'In Progress', 'start_date': '2026-10-10', 'contract_value': '340,000.00'},
                {'order_no': 'JO-2026-002', 'customer_name': 'Nesma & Partners', 'project_name': 'Structural Steel Assembly', 'status': 'Completed', 'start_date': '2026-09-15', 'contract_value': '195,000.00'}
            ],
            'totals': {'project_name': 'Total Contract Value', 'contract_value': '535,000.00'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_labour(self):
        payload = {
            'title': 'Labour Directory & Timesheet',
            'filename_prefix': 'labour_directory',
            'columns': [
                {'header': 'Emp ID', 'dataKey': 'emp_id'},
                {'header': 'Full Name', 'dataKey': 'name'},
                {'header': 'Trade / Role', 'dataKey': 'role'},
                {'header': 'Nationality', 'dataKey': 'nationality'},
                {'header': 'Daily Wage (SAR)', 'dataKey': 'daily_wage', 'align': 'right'},
                {'header': 'Status', 'dataKey': 'status'},
            ],
            'rows': [
                {'emp_id': 'EMP-101', 'name': 'Mohammed Iqbal', 'role': 'Lead Fabricator', 'nationality': 'Pakistani', 'daily_wage': '250.00', 'status': 'Active'},
                {'emp_id': 'EMP-102', 'name': 'Ali Hassan', 'role': 'Electrician', 'nationality': 'Egyptian', 'daily_wage': '220.00', 'status': 'Active'}
            ]
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)

    def test_smoke_export_widest_table_edge_cases(self):
        """
        Verify extreme edge cases on 10-column widest table:
        - 55 rows spanning multiple pages
        - Arabic text shaping
        - None / empty cell values
        - Extra long wrapping text
        - Portrait layout integrity without overflow
        """
        columns = [
            {'header': 'ID', 'dataKey': 'col1', 'align': 'center'},
            {'header': 'Date', 'dataKey': 'col2'},
            {'header': 'Client / Beneficiary', 'dataKey': 'col3'},
            {'header': 'Detailed Project Scope / Scope of Works', 'dataKey': 'col4'},
            {'header': 'Shift In', 'dataKey': 'col5'},
            {'header': 'Shift Out', 'dataKey': 'col6'},
            {'header': 'Reg Hrs', 'dataKey': 'col7', 'align': 'right'},
            {'header': 'OT Hrs', 'dataKey': 'col8', 'align': 'right'},
            {'header': 'Total SAR', 'dataKey': 'col9', 'align': 'right'},
            {'header': 'Status', 'dataKey': 'col10', 'align': 'center'},
        ]
        rows = []
        # Row 1: Arabic text & long descriptions
        rows.append({
            'col1': '1',
            'col2': '2026-11-03',
            'col3': 'شركة البناء المتقدمة للمقاولات العامة (ذ.م.م)',
            'col4': 'تركيب هياكل حديدية مسبقة الصنع مع العوازل الحرارية والمقاومة للحريق للمستودع رقم 4 في المنطقة الصناعية الثانية بالرياض',
            'col5': '08:00',
            'col6': '17:00',
            'col7': '8.0',
            'col8': '2.0',
            'col9': '1,450.00',
            'col10': 'Approved'
        })
        # Row 2: None and empty values
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
        # 53 additional rows to guarantee multi-page rendering (55 total)
        for i in range(3, 56):
            rows.append({
                'col1': str(i),
                'col2': '2026-11-05',
                'col3': f'Subcontractor Division {i} - Special Works Unit',
                'col4': f'Routine maintenance, inspection, and verification of mechanical systems for sector #{i}',
                'col5': '07:30',
                'col6': '16:30',
                'col7': '8.0',
                'col8': '1.5',
                'col9': f'{i * 125}.50',
                'col10': 'Completed'
            })

        payload = {
            'title': 'Master Multi-Page Operational Audit Register',
            'filename_prefix': 'master_audit_register',
            'columns': columns,
            'rows': rows,
            'totals': {'col4': 'Grand Audit Total', 'col9': '245,670.00'}
        }
        res = self.client.post(self.endpoint, data=payload, format='json')
        self._assert_valid_pdf_response(res)
        doc = fitz.open(stream=res.content, filetype='pdf')
        self.assertGreater(len(doc), 1, "55 rows must span across multiple pages")
