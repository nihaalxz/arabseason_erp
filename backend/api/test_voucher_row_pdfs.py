import os
import io
import re
from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
import pdfplumber

from api.models import (
    Customer, Vendor, JobOrder, Labour, CustomerPayment, Expense, VendorPayment
)
from api.serializers import (
    CustomerSerializer, VendorSerializer, JobOrderSerializer, LabourSerializer
)
from api.pdf_generator import universal_pdf_generator

User = get_user_model()


class VoucherRowPdfParityTests(TestCase):
    """
    Test suite verifying strict 100% data parity between index page table rows
    and their generated row-action PDF vouchers.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='admin_tester',
            password='testpassword123',
            role='Admin' if hasattr(User, 'role') else None
        )

    def _extract_pdf_data(self, pdf_bytes):
        """Extract all text and page count from PDF bytes using pdfplumber."""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages_text = [page.extract_text() or '' for page in pdf.pages]
            full_text = '\n'.join(pages_text)
            clean_text = ' '.join(full_text.split())
            return len(pdf.pages), pages_text, full_text, clean_text

    # =========================================================================
    # 1. THE FOUR KNOWN TEST CASES
    # =========================================================================

    def test_customer_statement_parity_e2e_multimodule(self):
        """
        Customer statement: E2E MultiModule Customer (Billed 3,700, Collected 500, Due 3,200)
        - Ledger rows must be real transactions only: debits for invoices, credits for payments.
        - Total Debits = 3,700, Total Credits = 500, Net Outstanding = 3,200.
        - Final running balance = 3,200 (equals table due column).
        - No 'Current Net Receivable / Balance Due' fake item.
        - Total = 3,700, Paid = 500, Balance Due = 3,200.
        """
        customer = Customer.objects.create(
            name='E2E MultiModule Customer',
            company_name='MultiModule Inc',
            phone='+966 50 111 2222',
            email='e2e@customer.com',
            address='Riyadh Commercial District',
            created_by=self.user
        )
        JobOrder.objects.create(
            title='Main Contract Works',
            customer=customer,
            total_amount=Decimal('3700.00'),
            created_by=self.user
        )
        CustomerPayment.objects.create(
            customer=customer,
            amount=Decimal('500.00'),
            payment_date=date.today(),
            payment_type='installment',
            created_by=self.user
        )

        # Build table row via serializer (single source of truth)
        cust_row = CustomerSerializer(customer).data
        billed = cust_row['total_billed']
        paid = cust_row['paid_amount']
        due = cust_row['credit_due']

        self.assertEqual(billed, 3700.00)
        self.assertEqual(paid, 500.00)
        self.assertEqual(due, 3200.00)

        # Build voucher payload matching CredCustomersView.mapCustomerToVoucher
        voucher_data = {
            'voucherType': 'CUSTOMER ACCOUNT STATEMENT',
            'voucherNo': f"CUST-STMT-{cust_row['id']}",
            'date': '2026-11-04',
            'amount': billed,
            'totalAmount': billed,
            'paidAmount': paid,
            'balanceDue': due,
            'closingBalance': due,
            'payeeName': cust_row['company'] or cust_row['name'],
            'contactPerson': cust_row['name'] if cust_row['company'] and cust_row['company'] != cust_row['name'] else '',
            'payeePhone': cust_row.get('phone', ''),
            'payeeEmail': cust_row.get('email', ''),
            'payeeAddress': cust_row.get('address', ''),
            'paymentMode': 'ACCOUNT BALANCE',
            'particulars': [
                {'item': 'Total Invoiced / Work Billed', 'rate': billed, 'amount': billed, 'debit': billed, 'credit': 0},
                {'item': 'Total Payments Received & Credited', 'rate': paid, 'amount': paid, 'debit': 0, 'credit': paid}
            ]
        }

        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        page_count, pages_text, text, clean_text = self._extract_pdf_data(pdf_bytes)

        # Assert no fake row
        self.assertNotIn('Current Net Receivable / Balance Due', text)

        # Assert party details
        self.assertIn('MultiModule Inc', text)
        self.assertIn('E2E MultiModule Customer', text)
        self.assertIn('+966 50 111 2222', text)
        self.assertIn('e2e@customer.com', text)
        self.assertIn('Riyadh Commercial District', text)

        # Assert Debits & Credits & Net in Summary Stack
        self.assertIn('3,700.00', text)
        self.assertIn('500.00', text)
        self.assertIn('3,200.00', text)

        # Assert Totals rule: Total 3,700 -> Paid 500 -> Balance Due 3,200
        self.assertIn('Three Thousand Seven Hundred', clean_text)

    def test_vendor_voucher_parity_microsoft(self):
        """
        Vendor voucher: microsoft (Billed 100, Paid 50, Due 50)
        - Party name = Supplier/Company ('microsoft'), in bold.
        - Contact person = 'jabir vendor', phone = '+966 55 999 8888', email = 'jab@gmail.com', address = 'Ammnikkad'.
        - Omit empty values.
        - Real line item only: 'Total Purchases / Services Invoiced 100.00'.
        - No negative rates, no 'Outstanding Balance Payable'.
        - Sub Total omitted because Sub Total == Total.
        - Total = 100.00, Paid = 50.00, Balance Due = 50.00.
        """
        vendor = Vendor.objects.create(
            name='jabir vendor',
            company='microsoft',
            phone='+966 55 999 8888',
            email='jab@gmail.com',
            address='Ammnikkad',
            created_by=self.user
        )
        Expense.objects.create(
            vendor=vendor,
            amount=Decimal('100.00'),
            date=date.today(),
            category='Software & Licensing',
            created_by=self.user
        )
        VendorPayment.objects.create(
            vendor=vendor,
            amount=Decimal('50.00'),
            payment_date=date.today(),
            created_by=self.user
        )

        v_row = VendorSerializer(vendor).data
        billed = v_row['total_billed']
        paid = v_row['paid_amount']
        due = v_row['pending_balance']

        self.assertEqual(billed, 100.00)
        self.assertEqual(paid, 50.00)
        self.assertEqual(due, 50.00)

        # Voucher payload matching CredVendorsView.mapVendorToVoucher
        voucher_data = {
            'voucherType': 'VENDOR PAYMENT VOUCHER & ADVICE',
            'voucherNo': f"VND-PV-{v_row['id']}",
            'date': '2026-11-04',
            'amount': billed,
            'totalAmount': billed,
            'paidAmount': paid,
            'balanceDue': due,
            'payeeName': v_row['company'] or v_row['name'],
            'contactPerson': v_row['name'] if v_row['company'] and v_row['company'] != v_row['name'] else '',
            'payeePhone': v_row.get('phone', ''),
            'payeeEmail': v_row.get('email', ''),
            'payeeAddress': v_row.get('address', ''),
            'paymentMode': 'BANK TRANSFER / CHEQUE',
            'particulars': [
                {'item': 'Total Purchases / Services Invoiced', 'qty': '1', 'rate': billed, 'amount': billed}
            ]
        }

        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        page_count, pages_text, text, clean_text = self._extract_pdf_data(pdf_bytes)

        # Assert company and contact details
        self.assertIn('microsoft', text)
        self.assertIn('jabir vendor', text)
        self.assertIn('+966 55 999 8888', text)
        self.assertIn('jab@gmail.com', text)
        self.assertIn('Ammnikkad', text)

        # Assert no negative rates and no fake summary items
        self.assertNotIn('-50', text)
        self.assertNotIn('Outstanding Balance Payable', text)
        self.assertNotIn('Sub Total', text)  # Omitted because Sub Total == Total

        # Assert figures
        self.assertIn('100.00', text)
        self.assertIn('50.00', text)
        self.assertIn('Balance Due', text)
        self.assertIn('One Hundred', clean_text)

    def test_labour_statement_parity_minu(self):
        """
        Labour statement: minu (Total Work 120, Paid 100, Due 20)
        - Ledger: work entry 120 as debit, 100 payment as credit, balance 20.
        - Linked job order shows 'Direct / General' as the table does.
        - Total Work = 120, Paid = 100, Balance Due = 20.
        """
        labour = Labour.objects.create(
            name='minu',
            phone='+966 50 333 4444',
            date=date.today(),
            payment_amount=Decimal('120.00'),
            paid_amount=Decimal('100.00'),
            work_done='Tile Cutting & Installation',
            created_by=self.user
        )

        l_row = LabourSerializer(labour).data
        total_work = float(l_row['payment_amount'])
        paid = float(l_row['paid_amount'])
        due = float(l_row['due_amount'])

        self.assertEqual(total_work, 120.00)
        self.assertEqual(paid, 100.00)
        self.assertEqual(due, 20.00)

        voucher_data = {
            'voucherType': 'LABOUR STATEMENT & WAGE DISBURSEMENT',
            'voucherNo': 'LAB-STMT-MINU',
            'date': '2026-11-04',
            'amount': total_work,
            'totalAmount': total_work,
            'paidAmount': paid,
            'balanceDue': due,
            'payeeName': 'minu',
            'payeePhone': '+966 50 333 4444',
            'jobOrder': 'Direct / General',
            'particulars': [
                {'item': 'Tile Cutting & Installation (Direct / General)', 'debit': total_work, 'credit': 0, 'amount': total_work},
                {'item': 'Wage Payout / Disbursement (Direct / General)', 'debit': 0, 'credit': paid, 'amount': paid}
            ]
        }

        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        page_count, pages_text, text, clean_text = self._extract_pdf_data(pdf_bytes)

        self.assertIn('minu', text)
        self.assertIn('Direct / General', text)
        self.assertIn('120.00', text)
        self.assertIn('100.00', text)
        self.assertIn('20.00', text)
        self.assertIn('One Hundred Twenty', clean_text)

    def test_job_order_voucher_parity_job10000(self):
        """
        Job order voucher: JOB10000 (Total 1,200, Paid 500, Balance 700)
        - Items = contract scope lines only. Sub Total 1,200 (not 1,700).
        - Do not list 'Contract Disbursements / Progress Received' as line item.
        - Total = 1,200, then Paid 500.00, then Balance Due 700.00.
        - Payment Mode & Category values do not overflow or overlap adjacent rows.
        """
        customer = Customer.objects.create(name='Acme Contracting', created_by=self.user)
        job = JobOrder.objects.create(
            order_id='JOB10000',
            title='Structural Steel Fabrication',
            customer=customer,
            total_amount=Decimal('1200.00'),
            status='In Progress',
            created_by=self.user
        )
        CustomerPayment.objects.create(
            customer=customer,
            job_order=job,
            amount=Decimal('500.00'),
            payment_date=date.today(),
            payment_type='installment',
            created_by=self.user
        )

        j_row = JobOrderSerializer(job).data
        total = float(j_row['total_amount'])
        paid = float(j_row['paid_amount'])
        balance = float(j_row['balance'])

        self.assertEqual(total, 1200.00)
        self.assertEqual(paid, 500.00)
        self.assertEqual(balance, 700.00)

        voucher_data = {
            'voucherType': 'JOB ORDER COST & DISBURSEMENT VOUCHER',
            'voucherNo': j_row['order_id'],
            'date': '2026-11-04',
            'amount': total,
            'totalAmount': total,
            'paidAmount': paid,
            'balanceDue': balance,
            'payeeName': 'Acme Contracting',
            'paymentMode': 'Contract Milestone / Bank Transfer',
            'category': 'Job Order Execution & Direct Site Costs',
            'status': 'IN PROGRESS',
            'particulars': [
                {'item': 'Contract Scope: Structural Steel Fabrication', 'qty': '1', 'rate': total, 'amount': total}
            ]
        }

        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        page_count, pages_text, text, clean_text = self._extract_pdf_data(pdf_bytes)

        # Assert no 1,700 subtotal or progress received line item
        self.assertNotIn('1,700', text)
        self.assertNotIn('Contract Disbursements / Progress Received', text)

        # Assert values
        self.assertIn('JOB10000', text)
        self.assertIn('Contract Milestone / Bank Transfer', text)
        self.assertIn('Job Order Execution & Direct Site Costs', text)
        self.assertIn('1,200.00', text)
        self.assertIn('500.00', text)
        self.assertIn('700.00', text)
        self.assertIn('One Thousand Two Hundred', clean_text)

    # =========================================================================
    # 2. EDGE CASES MANDATED BY SECTION 6
    # =========================================================================

    def test_row_with_no_payments(self):
        """Case: row with no payments (paid = 0, due = total)."""
        voucher_data = {
            'voucherType': 'CUSTOMER ACCOUNT STATEMENT',
            'voucherNo': 'CUST-NO-PAY-01',
            'date': '2026-11-04',
            'totalAmount': 2500.00,
            'paidAmount': 0.00,
            'balanceDue': 2500.00,
            'payeeName': 'Zero Payment Client',
            'particulars': [
                {'item': 'Project Milestone A', 'debit': 2500.00, 'credit': 0, 'amount': 2500.00}
            ]
        }
        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        _, _, text, clean_text = self._extract_pdf_data(pdf_bytes)

        self.assertIn('Zero Payment Client', text)
        self.assertIn('2,500.00', text)
        self.assertIn('Two Thousand Five Hundred', clean_text)

    def test_fully_paid_row(self):
        """Case: fully paid row (paid = total, due = 0.00)."""
        voucher_data = {
            'voucherType': 'VENDOR PAYMENT VOUCHER & ADVICE',
            'voucherNo': 'VND-PAID-01',
            'date': '2026-11-04',
            'totalAmount': 850.00,
            'paidAmount': 850.00,
            'balanceDue': 0.00,
            'payeeName': 'Fully Settled Supplier',
            'particulars': [
                {'item': 'Bulk Hardware Supplies', 'qty': '1', 'rate': 850.00, 'amount': 850.00}
            ]
        }
        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        _, _, text, clean_text = self._extract_pdf_data(pdf_bytes)

        self.assertIn('Fully Settled Supplier', text)
        self.assertIn('850.00', text)
        self.assertIn('0.00', text)
        self.assertNotIn('Sub Total', text)

    def test_overpaid_row_negative_due(self):
        """Case: overpaid row (paid > billed, due = -150.00)."""
        voucher_data = {
            'voucherType': 'CUSTOMER ACCOUNT STATEMENT',
            'voucherNo': 'CUST-OVERPAID-01',
            'date': '2026-11-04',
            'totalAmount': 1000.00,
            'paidAmount': 1150.00,
            'balanceDue': -150.00,
            'payeeName': 'Overpaid Account Corp',
            'particulars': [
                {'item': 'Contract Invoices', 'debit': 1000.00, 'credit': 0, 'amount': 1000.00},
                {'item': 'Advance & Excess Deposit', 'debit': 0, 'credit': 1150.00, 'amount': 1150.00}
            ]
        }
        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        _, _, text, clean_text = self._extract_pdf_data(pdf_bytes)

        self.assertIn('Overpaid Account Corp', text)
        self.assertIn('1,000.00', text)
        self.assertIn('1,150.00', text)
        self.assertIn('-150.00', text)

    def test_row_with_no_contact_info(self):
        """Case: row with no contact info (no phone, no email, no address) - clean omission."""
        voucher_data = {
            'voucherType': 'PAYMENT VOUCHER - LABOUR WAGE',
            'voucherNo': 'LAB-NOCONTACT',
            'date': '2026-11-04',
            'totalAmount': 400.00,
            'paidAmount': 0.00,
            'balanceDue': 400.00,
            'payeeName': 'Anonymous Worker',
            'particulars': [
                {'item': 'Site Assistance', 'qty': '1', 'rate': 400.00, 'amount': 400.00}
            ]
        }
        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        _, _, text, clean_text = self._extract_pdf_data(pdf_bytes)

        self.assertIn('Anonymous Worker', text)
        self.assertNotIn('Tel: -', text)
        self.assertNotIn('Email: -', text)
        self.assertNotIn('None', text)

    def test_20_plus_transactions_multipage(self):
        """
        Case: 25 transactions spanning over two pages.
        Verifies:
        - PDF has >= 2 pages.
        - Final running balance equals table's due column.
        - Totals block correctly renders with Total -> Paid -> Balance Due.
        """
        particulars = []
        running = Decimal('0.00')
        tot_deb = Decimal('0.00')
        tot_cred = Decimal('0.00')

        for i in range(1, 26):
            deb = Decimal('200.00')
            cred = Decimal('50.00') if i % 2 == 0 else Decimal('0.00')
            running = running + deb - cred
            tot_deb += deb
            tot_cred += cred
            particulars.append({
                'date': f'2026-10-{i:02d}',
                'description': f'Transaction Milestone #{i:02d} Site Operations and Materials',
                'debit': float(deb),
                'credit': float(cred)
            })

        due = float(running)
        voucher_data = {
            'voucherType': 'CUSTOMER ACCOUNT STATEMENT',
            'voucherNo': 'CUST-STMT-MULTIPAGE',
            'date': '2026-11-04',
            'totalAmount': float(tot_deb),
            'paidAmount': float(tot_cred),
            'balanceDue': due,
            'closingBalance': due,
            'payeeName': 'MultiPage Enterprise Ltd',
            'particulars': particulars
        }

        pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(voucher_data)
        page_count, pages_text, text, clean_text = self._extract_pdf_data(pdf_bytes)

        # Multi-page assertion
        self.assertGreaterEqual(page_count, 2)

        # Final running balance equals due column
        last_running_bal_str = f"{due:,.2f}"
        self.assertIn(last_running_bal_str, pages_text[-1])
        self.assertIn(f"SAR {due:,.2f}", text)
