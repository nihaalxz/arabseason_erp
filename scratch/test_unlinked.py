import os, sys, django
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from api.models import CashBookEntry, Customer

for cust in Customer.objects.all():
    matches = CashBookEntry.objects.filter(customer__isnull=True).filter(party_name__iexact=cust.name.strip())
    if matches.exists():
        for m in matches:
            print(f'Customer "{cust.name}" (id={cust.id}): unlinked Entry {m.id}, amt={m.amount}, entry_type={m.entry_type}, mode={m.payment_mode}')

