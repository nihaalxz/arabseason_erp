import os, sys, django
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from api.models import Customer
from api.views import CustomerViewSet
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()

# Test 1: Customer list endpoint
view = CustomerViewSet()
view.request = Request(factory.get('/api/customers/?nopage=true'))
view.format_kwarg = None
qs = view.get_queryset()
ser_list = view.get_serializer(qs, many=True).data

print(f"Total customers returned: {len(ser_list)}")
for c in ser_list:
    tb = c.get('total_billed')
    pa = c.get('paid_amount')
    cd = c.get('credit_due')
    pb = c.get('pending_balance')
    rp = c.get('remaining_payable')
    assert pa >= 0, f"Paid amount should not be negative for {c.get('name')}: {pa}"
    assert cd >= 0, f"Credit due should not be negative for {c.get('name')}: {cd}"
    assert cd == pb, f"credit_due ({cd}) should match pending_balance ({pb}) for {c.get('name')}"
    print(f"  {c.get('name'):<22}: Billed={tb:>8.2f}, Collected={pa:>8.2f}, Due={cd:>8.2f}, Payable={rp:>8.2f}")

# Test 2: Customer summary endpoint
summary_res = view.summary(Request(factory.get('/api/customers/summary/'))).data
print("\n--- Summary endpoint results ---")
for k, v in summary_res.items():
    print(f"  {k}: {v}")

sum_billed = sum(c.get('total_billed') for c in ser_list)
sum_collected = sum(c.get('paid_amount') for c in ser_list)
sum_due = sum(c.get('credit_due') for c in ser_list)
sum_payable = sum(c.get('remaining_payable') for c in ser_list)

assert abs(summary_res['total_billed'] - round(sum_billed, 2)) < 0.01, "Summary total_billed mismatch"
assert abs(summary_res['paid_amount'] - round(sum_collected, 2)) < 0.01, "Summary paid_amount mismatch"
assert abs(summary_res['pending_balance'] - round(sum_due, 2)) < 0.01, "Summary pending_balance mismatch"
assert abs(summary_res['total_payable'] - round(sum_payable, 2)) < 0.01, "Summary total_payable mismatch"

print("\nALL ASSERTIONS PASSED! Customer finances are 100% consistent and verified.")

