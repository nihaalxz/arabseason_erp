import sys, os, django
from decimal import Decimal
import fitz

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator
from api.models import Customer, Invoice, InvoiceItem

for count in [18, 19, 20, 21]:
    inv = Invoice(
        invoice_number="INV-2026-088",
        invoice_date="2026-11-02",
        due_date="2026-11-16",
        payment_terms="Net 14 Days",
        subtotal=Decimal('30000.00'),
        tax_rate=Decimal('15.00'),
        tax_amount=Decimal('4425.00'),
        total_amount=Decimal('33925.00'),
        notes="Bank transfer: Riyad Bank IBAN SA0320000001234567890123."
    )
    inv.customer = Customer(name="Saudi Industrial Development Corp", address="Riyadh, KSA", phone="0114567890")
    inv.customer.vat_number = "310987654300003"
    inv.items_list = [
        InvoiceItem(
            description=f"Precision CNC Component Phase #{i:02d}",
            quantity=Decimal('1.00'),
            unit_price=Decimal('1500.00'),
            tax_rate=Decimal('15.00'),
            tax_amount=Decimal('225.00'),
            total=Decimal('1725.00')
        )
        for i in range(1, count + 1)
    ]
    inv.discount_amount = Decimal('500.00')
    pdf_bytes = universal_pdf_generator.generate_tax_invoice_pdf(inv)
    doc = fitz.open(stream=pdf_bytes, filetype='pdf')
    print(f"Items: {count} -> Pages: {len(doc)}")

