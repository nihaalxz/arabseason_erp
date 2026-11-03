import os, sys, django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from api.models import Customer, JobOrder, Invoice, CustomerPayment, CreditNote, CashBookEntry, CustomerWorkRecord
from api.views import CustomerViewSet
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

print(f"Total customers in DB: {Customer.objects.count()}")

# Test queryset annotation in CustomerViewSet
factory = APIRequestFactory()
wsgi_request = factory.get('/api/customers/?nopage=true')
request = Request(wsgi_request)
view = CustomerViewSet()
view.request = request
view.format_kwarg = None
qs = view.get_queryset()

for c in qs[:10]:
    ser = view.get_serializer(c).data
    print("=" * 60)
    print(f"Customer: '{c.name}' (id={c.id}, company='{c.company_name}')")
    print(f"  API Serializer values:")
    print(f"    total_billed: {ser.get('total_billed')}")
    print(f"    paid_amount: {ser.get('paid_amount')}")
    print(f"    pending_balance / credit_due: {ser.get('pending_balance')}")
    print(f"    payable_amount: {ser.get('payable_amount')}")
    print(f"    remaining_payable: {ser.get('remaining_payable')}")
    print(f"    total_cashed_out: {ser.get('total_cashed_out')}")
    
    # Check underlying records
    jobs = list(JobOrder.objects.filter(customer=c))
    invs = list(Invoice.objects.filter(customer=c))
    cns = list(CreditNote.objects.filter(customer=c))
    pays = list(CustomerPayment.objects.filter(customer=c))
    work_records = list(CustomerWorkRecord.objects.filter(customer=c))
    cb_entries = list(CashBookEntry.objects.filter(customer=c))
    
    print(f"  Underlying Records:")
    print(f"    JobOrders ({len(jobs)}): {[f'{j.order_id}: amt={j.total_amount}, status={j.status}' for j in jobs]}")
    print(f"    Invoices ({len(invs)}): {[f'{i.invoice_number}: amt={i.total_amount}, job_order={i.job_order_id}' for i in invs]}")
    print(f"    CreditNotes ({len(cns)}): {[f'{cn.credit_note_number}: amt={cn.total_amount}, status={cn.status}' for cn in cns]}")
    print(f"    CustomerPayments ({len(pays)}): {[f'id={p.id}, amt={p.amount}, type={p.payment_type}' for p in pays]}")
    print(f"    CustomerWorkRecords ({len(work_records)}): {[f'id={w.id}, amt={w.amount}, work={w.work}' for w in work_records]}")
    print(f"    CashBookEntries linked ({len(cb_entries)}): {[f'id={e.id}, amt={e.amount}, type={e.entry_type}, mode={e.payment_mode}, cat={e.category}' for e in cb_entries]}")
    
    # Also check CashBookEntries that might match by party_name or customer_name or text but have customer_id=None!
    cb_unlinked = list(CashBookEntry.objects.filter(customer__isnull=True).filter(party_name__iexact=c.name))
    if cb_unlinked:
        print(f"    UNLINKED CashBookEntries with party_name='{c.name}' ({len(cb_unlinked)}): {[f'id={e.id}, amt={e.amount}, type={e.entry_type}' for e in cb_unlinked]}")
