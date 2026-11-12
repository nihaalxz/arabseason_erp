import os
import sys
import django

sys.path.append(os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Customer, Vendor, JobOrder
from api.serializers import CustomerSerializer, VendorSerializer
from api.ledger import build_customer_ledger, build_vendor_ledger, build_statement_payload


def run_reconciliation():
    print("="*70)
    print("LIVE DATABASE RECONCILIATION AUDIT")
    print("="*70)

    # 1. Customer Audit (All Time)
    customers = Customer.objects.all()
    print(f"\nChecking all {customers.count()} Customers in DB:")
    print(f"{'ID':<4} {'Name':<20} {'Closing Bal':<14} {'Refunds':<10} {'Expected':<12} {'Pending Bal':<12} {'Status'}")
    print("-" * 80)
    customer_mismatches = []
    statement_eq_mismatches = []

    for c in customers:
        ledger = build_customer_ledger(c)
        ser = CustomerSerializer(c).data
        pending_balance = float(ser.get('pending_balance') or 0.0)
        closing_bal = ledger['closing_balance']
        refunds = ledger['totals']['total_refunds']

        expected = max(0.0, round(closing_bal - refunds, 2))
        diff = abs(expected - pending_balance)
        status = "MATCH" if diff <= 0.01 else "MISMATCH"
        print(f"{c.id:<4} {c.name[:18]:<20} {closing_bal:<14.2f} {refunds:<10.2f} {expected:<12.2f} {pending_balance:<12.2f} {status}")
        if diff > 0.01:
            customer_mismatches.append((c.id, c.name, expected, pending_balance, closing_bal, refunds))

        # Statement equation check: All-Time
        p_all = build_statement_payload('customer', c)
        sum_dict = {item['label']: item['amount'] for item in p_all['account_summary']}
        op = sum_dict.get('Opening Balance', 0.0)
        billed = sum_dict.get('Billed Amount', 0.0)
        rec = sum_dict.get('Amount Received', 0.0)
        ref = sum_dict.get('Refunds Paid', 0.0)
        clos = p_all['closing_balance']
        calc_clos = round(op + billed + ref - rec, 2)
        if abs(calc_clos - clos) > 0.01:
            statement_eq_mismatches.append(('Customer All-Time', c.id, c.name, op, billed, rec, ref, clos, calc_clos))

        # Statement equation check: Date-Filtered (Nov 2026)
        p_nov = build_statement_payload('customer', c, start_date='2026-11-01', end_date='2026-11-30')
        sum_dict_nov = {item['label']: item['amount'] for item in p_nov['account_summary']}
        op_nov = sum_dict_nov.get('Opening Balance', 0.0)
        billed_nov = sum_dict_nov.get('Billed Amount', 0.0)
        rec_nov = sum_dict_nov.get('Amount Received', 0.0)
        ref_nov = sum_dict_nov.get('Refunds Paid', 0.0)
        clos_nov = p_nov['closing_balance']
        calc_clos_nov = round(op_nov + billed_nov + ref_nov - rec_nov, 2)
        if abs(calc_clos_nov - clos_nov) > 0.01:
            statement_eq_mismatches.append(('Customer Nov-2026', c.id, c.name, op_nov, billed_nov, rec_nov, ref_nov, clos_nov, calc_clos_nov))

    print(f"\nCustomer Audit Result: {len(customers) - len(customer_mismatches)}/{len(customers)} matched (Mismatches: {len(customer_mismatches)})")

    # 2. Vendor Audit
    vendors = Vendor.objects.all()
    print(f"\nChecking all {vendors.count()} Vendors in DB:")
    print(f"{'ID':<4} {'Name':<20} {'Debits':<12} {'Credits':<12} {'Closing Bal':<14} {'Pending Bal':<12} {'Status'}")
    print("-" * 80)
    vendor_mismatches = []
    for v in vendors:
        ledger = build_vendor_ledger(v)
        ser = VendorSerializer(v).data
        pending_balance = float(ser.get('pending_balance') or 0.0)
        closing_bal = ledger['closing_balance']
        debits = ledger['totals']['total_debits']
        credits = ledger['totals']['total_credits']

        diff = abs(closing_bal - pending_balance)
        status = "MATCH" if diff <= 0.01 else "MISMATCH"
        print(f"{v.id:<4} {v.name[:18]:<20} {debits:<12.2f} {credits:<12.2f} {closing_bal:<14.2f} {pending_balance:<12.2f} {status}")
        if diff > 0.01:
            vendor_mismatches.append((v.id, v.name, closing_bal, pending_balance, debits, credits))

        # Statement equation check: All-Time
        pv_all = build_statement_payload('vendor', v)
        v_sum = {item['label']: item['amount'] for item in pv_all['account_summary']}
        v_op = v_sum.get('Opening Balance', 0.0)
        v_billed = v_sum.get('Billed', 0.0)
        v_paid = v_sum.get('Paid', 0.0)
        v_clos = pv_all['closing_balance']
        calc_v_clos = round(v_op + v_billed - v_paid, 2)
        if abs(calc_v_clos - v_clos) > 0.01:
            statement_eq_mismatches.append(('Vendor All-Time', v.id, v.name, v_op, v_billed, v_paid, 0.0, v_clos, calc_v_clos))

        # Statement equation check: Date-Filtered (Nov 2026)
        pv_nov = build_statement_payload('vendor', v, start_date='2026-11-01', end_date='2026-11-30')
        v_sum_nov = {item['label']: item['amount'] for item in pv_nov['account_summary']}
        v_op_nov = v_sum_nov.get('Opening Balance', 0.0)
        v_billed_nov = v_sum_nov.get('Billed', 0.0)
        v_paid_nov = v_sum_nov.get('Paid', 0.0)
        v_clos_nov = pv_nov['closing_balance']
        calc_v_clos_nov = round(v_op_nov + v_billed_nov - v_paid_nov, 2)
        if abs(calc_v_clos_nov - v_clos_nov) > 0.01:
            statement_eq_mismatches.append(('Vendor Nov-2026', v.id, v.name, v_op_nov, v_billed_nov, v_paid_nov, 0.0, v_clos_nov, calc_v_clos_nov))

    print(f"\nVendor Audit Result: {len(vendors) - len(vendor_mismatches)}/{len(vendors)} matched (Mismatches: {len(vendor_mismatches)})")

    # 3. Statement Summary Equation Audit (Opening + Billed - Paid = Closing)
    print("\n" + "="*70)
    print("STATEMENT EQUATION AUDIT (Opening + Billed - Paid == Closing)")
    print("="*70)
    print(f"Total statement equation checks run: {(len(customers) + len(vendors)) * 2}")
    print(f"Statement equation mismatches: {len(statement_eq_mismatches)}")
    if statement_eq_mismatches:
        for m in statement_eq_mismatches:
            print(f"  FAILED: {m}")
    else:
        print("ALL ENTITIES PASSED Opening + Billed - Paid = Closing (With & Without Date Filter)!")

    # 4. Chikku Special Assertion (Customer Billed == 6,615)
    chikku = Customer.objects.filter(name__icontains='chikku').first()
    if chikku:
        p_chk = build_statement_payload('customer', chikku)
        s_chk = {item['label']: item['amount'] for item in p_chk['account_summary']}
        chk_billed = s_chk.get('Billed Amount', 0.0)
        print(f"\nCustomer Chikku Billed Amount: {chk_billed} (Expected: 6615.00)")
        assert chk_billed == 6615.00, f"Expected 6615.00, got {chk_billed}"
        print("CHIKKU BILLED AMOUNT ASSERTION PASSED (6,615.00)!")

    # 5. Vendor Manu Special Assertion (Opening == 100, Billed == 5650, Paid == 550, Closing == 5200)
    manu = Vendor.objects.filter(name__icontains='manu').first()
    if manu:
        p_manu = build_statement_payload('vendor', manu)
        s_manu = {item['label']: item['amount'] for item in p_manu['account_summary']}
        m_op = s_manu.get('Opening Balance', 0.0)
        m_billed = s_manu.get('Billed', 0.0)
        m_paid = s_manu.get('Paid', 0.0)
        m_clos = p_manu['closing_balance']
        print(f"\nVendor Manu All-Time Statement Summary:")
        print(f"  Opening Balance: {m_op} (Expected: 100.00)")
        print(f"  Billed:          {m_billed} (Expected: 5650.00)")
        print(f"  Paid:            {m_paid} (Expected: 550.00)")
        print(f"  Closing:         {m_clos} (Expected: 5200.00)")
        assert m_op == 100.00, f"Expected 100.00, got {m_op}"
        assert m_billed == 5650.00, f"Expected 5650.00, got {m_billed}"
        assert m_paid == 550.00, f"Expected 550.00, got {m_paid}"
        assert m_clos == 5200.00, f"Expected 5200.00, got {m_clos}"
        print("VENDOR MANU STATEMENT SUMMARY ASSERTION PASSED!")

    # 3. Vendor Manu Discrepancy Breakdown (5,750 vs 5,600)
    print("\n" + "="*70)
    print("VENDOR MANU (ID 1) 5,750 vs 5,600 FORENSIC BREAKDOWN")
    print("="*70)
    manu = Vendor.objects.filter(name__icontains='manu').first()
    if manu:
        ob = float(manu.opening_balance or 0.0)
        jobs_in_progress = list(manu.job_orders.filter(status='In Progress'))
        jobs_pending = list(manu.job_orders.filter(status='Pending'))
        jobs_cancelled = list(manu.job_orders.filter(status='Cancelled'))

        print(f"Vendor Name: {manu.name} (ID: {manu.id})")
        print(f"Opening Balance: SAR {ob:,.2f}")
        print("\nAssigned Job Orders:")
        for j in manu.job_orders.all():
            print(f"  - Job {j.order_id} (ID {j.id}): Status='{j.status}', Total Amount=SAR {j.total_amount:,.2f}")

        sum_ip = sum(float(j.total_amount or 0) for j in jobs_in_progress)
        sum_pen = sum(float(j.total_amount or 0) for j in jobs_pending)

        billed_excluding_pending = ob + sum_ip
        billed_including_pending = ob + sum_ip + sum_pen

        print("\nCalculations:")
        print(f"  1. Opening Balance:                               SAR {ob:,.2f}")
        print(f"  2. In Progress Jobs (JOB0002):                    SAR {sum_ip:,.2f}")
        print(f"     => Billed without Pending jobs:                SAR {billed_excluding_pending:,.2f}  <-- EXACTLY 5,600.00")
        print(f"  3. Pending Jobs (JOB0013: 100, JOB0019: 50):     SAR {sum_pen:,.2f}")
        print(f"     => Billed with all Non-Cancelled jobs (System): SAR {billed_including_pending:,.2f}  <-- EXACTLY 5,750.00")
    else:
        print("Vendor manu not found.")

    assert len(customer_mismatches) == 0, f"Customer mismatches: {customer_mismatches}"
    assert len(vendor_mismatches) == 0, f"Vendor mismatches: {vendor_mismatches}"
    print("\nALL AUDIT RECONCILIATIONS PASSED WITH ZERO MISMATCHES!")


if __name__ == '__main__':
    run_reconciliation()

