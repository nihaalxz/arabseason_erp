import os, sys, django
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import UniversalPDFGenerator
from decimal import Decimal

class MockCustomer:
    name = "Marwa"

class MockItem:
    def __init__(self, desc, qty, rate, total, sort_order=1, id=1):
        self.description = desc
        self.quantity = Decimal(str(qty))
        self.unit_price = Decimal(str(rate))
        self.total = Decimal(str(total))
        self.sort_order = sort_order
        self.id = id

class MockItemsQuery:
    def __init__(self, items):
        self._items = items
    def all(self):
        return self
    def order_by(self, *args):
        return self._items

class MockDeliveryNote:
    id = 2
    delivery_note_number = "DC-00002"
    customer = MockCustomer()
    delivery_date = "2026-10-15"
    dispatch_date = None
    shipping_method = "Others"
    status = "Delivered"
    customer_po_number = None
    delivery_address = None
    notes = None
    total_amount = Decimal('150.00')
    items = MockItemsQuery([
        MockItem("Banner printing\nForex with sticker", 1.00, 150.00, 150.00)
    ])

gen = UniversalPDFGenerator()
pdf_bytes = gen.generate_delivery_note_pdf(MockDeliveryNote())

out_path = 'design-reference/output/test_live_migrated.pdf'
with open(out_path, 'wb') as f:
    f.write(pdf_bytes)

print(f"Generated {out_path} ({len(pdf_bytes)} bytes)")

