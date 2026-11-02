with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

target = "UNICODE_FONT = FONTS.get('AppFont', 'Helvetica')"
replacement = "UNICODE_FONT = FONTS.get('AppFont', 'Helvetica')\nENABLE_ZATCA_QR = False  # Disabled by default per project requirements; set True to re-enable ZATCA Phase 1 QR codes"

if target in c:
    c = c.replace(target, replacement, 1)
    with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Added ENABLE_ZATCA_QR definition!")
else:
    print("target not found")

