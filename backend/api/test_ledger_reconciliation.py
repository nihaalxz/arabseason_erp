from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import Customer, Vendor, JobOrder
from .serializers import CustomerSerializer, VendorSerializer
from .ledger import build_customer_ledger, build_vendor_ledger


class LedgerReconciliationTestCase(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.filter(is_superuser=True).first()
        if not self.user:
            self.user = User.objects.create_superuser('testadmin', 'test@example.com', 'pass1234')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_all_customers_ledger_reconciliation(self):
        customers = Customer.objects.all()
        print(f"\n--- Testing {customers.count()} Customers Reconciliation ---")
        mismatches = []
        for c in customers:
            ledger = build_customer_ledger(c)
            ser = CustomerSerializer(c).data
            pending_balance = float(ser.get('pending_balance') or 0.0)
            closing_bal = ledger['closing_balance']
            refunds = ledger['totals']['total_refunds']

            # Formula: max(0, customer closing - refunds) == pending_balance
            expected = max(0.0, round(closing_bal - refunds, 2))
            diff = abs(expected - pending_balance)
            if diff > 0.01:
                mismatches.append(
                    f"Customer {c.id} ({c.name}): expected {expected} != pending_balance {pending_balance} (closing: {closing_bal}, refunds: {refunds})"
                )

        if mismatches:
            for m in mismatches:
                print(f"MISMATCH: {m}")
        self.assertEqual(len(mismatches), 0, f"Customer mismatches found: {mismatches}")

    def test_all_vendors_ledger_reconciliation(self):
        vendors = Vendor.objects.all()
        print(f"\n--- Testing {vendors.count()} Vendors Reconciliation ---")
        mismatches = []
        for v in vendors:
            ledger = build_vendor_ledger(v)
            ser = VendorSerializer(v).data
            pending_balance = float(ser.get('pending_balance') or 0.0)
            closing_bal = ledger['closing_balance']

            diff = abs(closing_bal - pending_balance)
            if diff > 0.01:
                mismatches.append(
                    f"Vendor {v.id} ({v.name}): closing {closing_bal} != pending_balance {pending_balance}"
                )

        if mismatches:
            for m in mismatches:
                print(f"MISMATCH: {m}")
        self.assertEqual(len(mismatches), 0, f"Vendor mismatches found: {mismatches}")

    def test_manu_vendor_billed_discrepancy_explanation(self):
        """
        Explains and verifies why vendor 'manu' (ID 1) billed shows 5,750 in VendorSerializer
        and ledger, while 5,600 appears when Pending jobs are excluded.
        """
        manu = Vendor.objects.filter(name__icontains='manu').first()
        if not manu:
            self.skipTest("Vendor 'manu' not found in test database")

        ledger = build_vendor_ledger(manu)
        ser = VendorSerializer(manu).data

        # 1. Official Serializer & Ledger total_billed (includes all non-cancelled jobs)
        total_billed_full = float(ser.get('total_billed'))
        self.assertEqual(total_billed_full, 5750.0, "Vendor manu total_billed must be 5,750.00")

        # 2. Breakdown:
        # Opening balance = 100.00
        # JOB0002 (In Progress) = 5,500.00
        # JOB0013 (Pending) = 100.00
        # JOB0019 (Pending) = 50.00
        ob = float(manu.opening_balance or 0.0)
        jobs_in_progress = [j for j in manu.job_orders.all() if j.status == 'In Progress']
        jobs_pending = [j for j in manu.job_orders.all() if j.status == 'Pending']

        sum_in_progress = sum(float(j.total_amount or 0) for j in jobs_in_progress)
        sum_pending = sum(float(j.total_amount or 0) for j in jobs_pending)

        billed_excluding_pending = ob + sum_in_progress
        billed_including_pending = ob + sum_in_progress + sum_pending

        print("\n--- Vendor Manu 5,750 vs 5,600 Investigation ---")
        print(f"Vendor: {manu.name} (ID {manu.id})")
        print(f"Opening Balance: SAR {ob:,.2f}")
        print(f"In Progress Jobs ({len(jobs_in_progress)}): SAR {sum_in_progress:,.2f}")
        print(f"Pending Jobs ({len(jobs_pending)}): SAR {sum_pending:,.2f}")
        print(f"Billed excluding Pending jobs: SAR {billed_excluding_pending:,.2f} -> exactly 5,600.00!")
        print(f"Billed including Pending jobs (current system): SAR {billed_including_pending:,.2f} -> exactly 5,750.00!")

        self.assertEqual(billed_excluding_pending, 5600.0)
        self.assertEqual(billed_including_pending, 5750.0)

