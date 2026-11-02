with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "items = list(estimation.items.all().order_by('sort_order', 'id'))",
    "items = getattr(estimation, 'items_list', None)\n        if items is None:\n            try:\n                items = list(estimation.items.all().order_by('sort_order', 'id'))\n            except Exception:\n                items = []"
)

c = c.replace(
    "items = list(delivery_note.items.all().order_by('sort_order', 'id'))",
    "items = getattr(delivery_note, 'items_list', None)\n        if items is None:\n            try:\n                items = list(delivery_note.items.all().order_by('sort_order', 'id'))\n            except Exception:\n                items = []"
)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated estimation and delivery_note items fetching!")

