with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "if credit_note.reason and credit_note.reason not in ('-', 'None', 'null'):",
    "cn_reason = getattr(credit_note, 'reason', None)\n        if cn_reason and str(cn_reason).strip() not in ('-', 'None', 'null'):"
)
c = c.replace(
    '("Reason", str(credit_note.reason).strip())',
    '("Reason", str(cn_reason).strip())'
)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated credit_note.reason to use getattr safely!")

