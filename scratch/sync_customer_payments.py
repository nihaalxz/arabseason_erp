import os, sys, django
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import transaction
from api.models import Customer, CashBookEntry, CustomerPayment, JobOrder, Invoice, CreditNote

print("--- Checking unlinked CashBookEntries ---")
with transaction.atomic():
    # 1. Cash In entries with customer set but no customer_payment
    for cb in CashBookEntry.objects.filter(customer__isnull=False, customer_payment__isnull=True, entry_type='in'):
        cp = CustomerPayment.objects.create(
            customer=cb.customer,
            job_order=cb.job_order,
            amount=cb.amount,
            payment_date=cb.date,
            payment_type='installment',
            notes=f"Cashbook #{cb.cashbook.name if cb.cashbook else 'Cash Ledger'}: {cb.remark or cb.party_name}".strip(),
            created_by=cb.created_by
        )
        cb.customer_payment = cp
        cb.save(update_fields=['customer_payment'])
        print(f"Linked Cash In Entry #{cb.id} ({cb.amount} SAR) to new CustomerPayment #{cp.id} for {cb.customer.name}")

    # 2. Cash Out entries with debit_type='CUSTOMER' or customer set but no customer_payment
    for cb in CashBookEntry.objects.filter(customer__isnull=False, customer_payment__isnull=True, entry_type='out', debit_type='CUSTOMER'):
        cp = CustomerPayment.objects.create(
            customer=cb.customer,
            job_order=cb.job_order,
            amount=cb.amount,
            payment_date=cb.date,
            payment_type='refund',
            notes=f"Cashbook #{cb.cashbook.name if cb.cashbook else 'Cash Ledger'} (Refund): {cb.remark or cb.party_name}".strip(),
            created_by=cb.created_by
        )
        cb.customer_payment = cp
        cb.save(update_fields=['customer_payment'])
        print(f"Linked Cash Out Entry #{cb.id} ({cb.amount} SAR) to new CustomerPayment #{cp.id} for {cb.customer.name}")

    # 3. Check unlinked CashBookEntries by party_name
    for cust in Customer.objects.all():
        for cb in CashBookEntry.objects.filter(customer__isnull=True, party_name__iexact=cust.name.strip()):
            cb.customer = cust
            if cb.entry_type == 'in':
                cp = CustomerPayment.objects.create(
                    customer=cust,
                    job_order=cb.job_order,
                    amount=cb.amount,
                    payment_date=cb.date,
                    payment_type='installment',
                    notes=f"Cashbook #{cb.cashbook.name if cb.cashbook else 'Cash Ledger'}: {cb.remark or cb.party_name}".strip(),
                    created_by=cb.created_by
                )
                cb.customer_payment = cp
                cb.save(update_fields=['customer', 'customer_payment'])
                print(f"Assigned Customer '{cust.name}' and linked Cash In #{cb.id} -> Payment #{cp.id}")
            elif cb.entry_type == 'out' and cb.debit_type == 'CUSTOMER':
                cp = CustomerPayment.objects.create(
                    customer=cust,
                    job_order=cb.job_order,
                    amount=cb.amount,
                    payment_date=cb.date,
                    payment_type='refund',
                    notes=f"Cashbook #{cb.cashbook.name if cb.cashbook else 'Cash Ledger'} (Refund): {cb.remark or cb.party_name}".strip(),
                    created_by=cb.created_by
                )
                cb.customer_payment = cp
                cb.save(update_fields=['customer', 'customer_payment'])
                print(f"Assigned Customer '{cust.name}' and linked Cash Out #{cb.id} -> Payment #{cp.id}")

print("--- Synchronization complete ---")

