import os, sys, django
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from api.models import Customer, JobOrder, Invoice, CreditNote, CustomerPayment
from django.db.models import OuterRef, Subquery, Sum, DecimalField, F
from django.db.models.functions import Coalesce
from decimal import Decimal

jobs_sub = JobOrder.objects.filter(customer=OuterRef('pk')).exclude(status='Cancelled').values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
invs_sub = Invoice.objects.filter(customer=OuterRef('pk'), job_order__isnull=True).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
cns_sub = CreditNote.objects.filter(customer=OuterRef('pk')).exclude(status__in=['Draft', 'Cancelled']).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
pays_sub = CustomerPayment.objects.filter(customer=OuterRef('pk')).exclude(payment_type='refund').values('customer').annotate(total=Sum('amount')).values('total')[:1]
adv_sub = CustomerPayment.objects.filter(customer=OuterRef('pk'), payment_type='advance').values('customer').annotate(total=Sum('amount')).values('total')[:1]

qs = Customer.objects.annotate(
    total_billed=Coalesce(Subquery(jobs_sub), Decimal('0'), output_field=DecimalField()) + Coalesce(Subquery(invs_sub), Decimal('0'), output_field=DecimalField()) - Coalesce(Subquery(cns_sub), Decimal('0'), output_field=DecimalField()),
    paid_amount=Coalesce(Subquery(pays_sub), Decimal('0'), output_field=DecimalField()),
    advance_paid=Coalesce(Subquery(adv_sub), Decimal('0'), output_field=DecimalField())
).select_related('created_by').order_by('name').distinct()

print(f"{'Customer':<25} | {'Billed':<10} | {'Collected':<10} | {'Credit Due':<10} | {'Payable':<10}")
print("-" * 75)

tot_b = 0
tot_c = 0
tot_d = 0
tot_p = 0

for c in qs:
    tb = max(0.0, round(float(c.total_billed), 2))
    pa = max(0.0, round(float(c.paid_amount), 2))
    credit_due = max(0.0, round(tb - pa, 2))
    
    refund_sum = sum(float(p.amount) for p in c.payments.all() if getattr(p, 'payment_type', None) == 'refund')
    base_payable = float(c.payable_amount or 0)
    customer_overpayment = max(0.0, round(pa - tb, 2))
    gross_payable = base_payable + customer_overpayment
    remaining_payable = max(0.0, round(gross_payable - refund_sum, 2))
    
    tot_b += tb
    tot_c += pa
    tot_d += credit_due
    tot_p += remaining_payable
    
    print(f"{c.name:<25} | {tb:<10.2f} | {pa:<10.2f} | {credit_due:<10.2f} | {remaining_payable:<10.2f}")

print("=" * 75)
print(f"{'TOTALS':<25} | {tot_b:<10.2f} | {tot_c:<10.2f} | {tot_d:<10.2f} | {tot_p:<10.2f}")

