import os, sys, django
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import UniversalPDFGenerator
from decimal import Decimal
import pymupdf

class MockCustomer:
    def __init__(self, name):
        self.name = name

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
    def __init__(self, doc_num, cust_name, items_list, total_amt, shipping="Others", address=None, notes=None):
        self.id = 1
        self.delivery_note_number = doc_num
        self.customer = MockCustomer(cust_name)
        self.delivery_date = "2026-10-15"
        self.dispatch_date = None
        self.shipping_method = shipping
        self.status = "Delivered"
        self.customer_po_number = "PO-2026-99" if address else None
        self.delivery_address = address
        self.notes = notes
        self.total_amount = Decimal(str(total_amt))
        self.items = MockItemsQuery(items_list)

gen = UniversalPDFGenerator()
os.makedirs('design-reference/output/phaseA', exist_ok=True)

# 1. 20 items (multi-page)
items_20 = [
    MockItem(f"Product Component #{i:02d}\nGrade-A Architectural Material Spec", 1.0, 250.0, 250.0, sort_order=i, id=i)
    for i in range(1, 21)
]
dn_20 = MockDeliveryNote("DC-00020", "Enterprise Construction Partner LLC", items_20, 5000.0, address="Al Olaya, Riyadh")
pdf_20 = gen.generate_delivery_note_pdf(dn_20)
p_20_path = 'design-reference/output/phaseA/robustness_20_items_multipage.pdf'
with open(p_20_path, 'wb') as f:
    f.write(pdf_20)

doc_20 = pymupdf.open(p_20_path)
for pno, p in enumerate(doc_20):
    pix = p.get_pixmap(dpi=150)
    pix.save(f'design-reference/output/phaseA/robustness_20_items_multipage_p{pno+1}.png')
print(f"Rendered 20 items multipage ({len(doc_20)} pages)")

# 2. Arabic party name and description
arabic_party = "شركة الأفق للمقاولات العامة والتجارة المحدودة"
arabic_desc = "لوحة إعلانية مضيئة مع طباعة ستيكر وفوركس عالي الجودة\nهيكل حديد مجلفن مقاوم للعوامل الجوية مع إضاءة ليد كورية"
dn_ar = MockDeliveryNote("DC-00005", arabic_party, [MockItem(arabic_desc, 2.0, 1850.0, 3700.0)], 3700.0, shipping="توريد وتركيب")
pdf_ar = gen.generate_delivery_note_pdf(dn_ar)
p_ar_path = 'design-reference/output/phaseA/robustness_arabic.pdf'
with open(p_ar_path, 'wb') as f:
    f.write(pdf_ar)

doc_ar = pymupdf.open(p_ar_path)
doc_ar[0].get_pixmap(dpi=150).save('design-reference/output/phaseA/robustness_arabic.png')
print("Rendered Arabic test")

# 3. Large amount (1,234,567.89 SAR)
items_large = [
    MockItem("Heavy Structural ASTM A36 Framework Modules\nPrecision engineered architectural beams", 120.0, 8200.0, 984000.0, sort_order=1, id=1),
    MockItem("Double Low-E Safety Glazing Curtain Wall Units\nAcoustic and thermal insulated panels", 450.0, 556.8175, 250567.89, sort_order=2, id=2)
]
dn_lg = MockDeliveryNote("DC-00006", "Saudi Mega Infrastructure Authority", items_large, 1234567.89, shipping="Standard Dispatch", address="KAFD, Riyadh")
pdf_lg = gen.generate_delivery_note_pdf(dn_lg)
p_lg_path = 'design-reference/output/phaseA/robustness_large_amount.pdf'
with open(p_lg_path, 'wb') as f:
    f.write(pdf_lg)

doc_lg = pymupdf.open(p_lg_path)
doc_lg[0].get_pixmap(dpi=150).save('design-reference/output/phaseA/robustness_large_amount.png')
print("Rendered Large Amount test")

