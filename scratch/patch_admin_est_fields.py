with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

target = """        for idx, itm in enumerate(items, 1):
            desc = itm.item_name or 'Material Item'
            sub = itm.supplier_shop or itm.specifications or ''
            qty = float(itm.quantity or 1)
            cost_u = float(itm.unit_cost or 0)
            c_tot = float(itm.total_cost or (qty * cost_u))
            q_price = float(itm.selling_price or 0)"""

replacement = """        for idx, itm in enumerate(items, 1):
            desc = getattr(itm, 'item_name', None) or getattr(itm, 'description', 'Material Item')
            sub = getattr(itm, 'supplier_shop', None) or getattr(itm, 'selected_shop_name', None) or getattr(itm, 'specifications', None) or getattr(itm, 'notes', '')
            qty = float(getattr(itm, 'quantity', 1) or 1)
            cost_u = float(getattr(itm, 'unit_cost', 0) or 0)
            c_tot = float(getattr(itm, 'total_cost', 0) or (qty * cost_u))
            q_price = float(getattr(itm, 'selling_price', None) or getattr(itm, 'unit_price', 0) or 0)"""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Patched admin estimation item fields safely!")
else:
    print("target not found")

