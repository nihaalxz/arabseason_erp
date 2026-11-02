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
