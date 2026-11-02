with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

target = """        if invoice.notes:
            remittance_lines.append(f"<b>Notes:</b> {invoice.notes}")
        if invoice.terms:
            remittance_lines.append(f"<b>Terms:</b> {invoice.terms}")"""

replacement = """        inv_notes = getattr(invoice, 'notes', None)
        if inv_notes:
            remittance_lines.append(f"<b>Notes:</b> {inv_notes}")
        inv_terms = getattr(invoice, 'terms', None)
        if inv_terms:
            remittance_lines.append(f"<b>Terms:</b> {inv_terms}")"""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Replaced invoice notes/terms with getattr.")
else:
    print("Target not found.")

