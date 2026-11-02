with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """            ('TOPPADDING', (0,1), (-1,-1), 8.83),
            ('BOTTOMPADDING', (0,1), (-1,-1), 8.83),"""
replacement = """            ('TOPPADDING', (0,1), (-1,-1), 8.83),"""

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Removed bottom padding successfully")

