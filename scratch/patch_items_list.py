with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Tax Invoice
c = c.replace(
    "        items = list(invoice.items.all())",
    "        items = getattr(invoice, 'items_list', None)\n        if items is None:\n            try:\n                items = list(invoice.items.all())\n            except Exception:\n                items = []"
)

# Quotation
c = c.replace(
    "        items = list(quotation.items.all())",
    "        items = getattr(quotation, 'items_list', None)\n        if items is None:\n            try:\n                items = list(quotation.items.all())\n            except Exception:\n                items = []"
)

# Delivery Note
c = c.replace(
    "        items = list(delivery_note.items.all())",
    "        items = getattr(delivery_note, 'items_list', None)\n        if items is None:\n            try:\n                items = list(delivery_note.items.all())\n            except Exception:\n                items = []"
)

# Credit Note
c = c.replace(
    "        items = list(credit_note.items.all())",
    "        items = getattr(credit_note, 'items_list', None)\n        if items is None:\n            try:\n                items = list(credit_note.items.all())\n            except Exception:\n                items = []"
)

# Estimation
c = c.replace(
    "        items = list(estimation.items.all())",
    "        items = getattr(estimation, 'items_list', None)\n        if items is None:\n            try:\n                items = list(estimation.items.all())\n            except Exception:\n                items = []"
)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated items fetching to gracefully support in-memory items_list!")

