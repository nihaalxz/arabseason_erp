with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """            ('BOTTOMPADDING', (0,1), (-1,-1), 3.57),"""
replacement = """            ('BOTTOMPADDING', (0,1), (-1,-1), 6.57),"""

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Set bottom padding to 6.57 successfully")
