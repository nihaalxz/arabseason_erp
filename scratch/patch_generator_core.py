import re

pdf_gen_path = 'backend/api/pdf_generator.py'
with open(pdf_gen_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Let's inspect UniversalPDFGenerator class and replace the old tokens & methods
old_class_start = """class UniversalPDFGenerator:
    \"\"\"
    Central controller for all server-generated ERP PDFs.
    Ensures uniform visual hierarchy, typography, colors, and layout standard.
    \"\"\"

    # Harmonious corporate color palette
    COLOR_PRIMARY = colors.HexColor("#0f172a")       # Slate 900
    COLOR_SECONDARY = colors.HexColor("#1e293b")     # Slate 800
    COLOR_MUTED = colors.HexColor("#64748b")         # Slate 500
    COLOR_BORDER = colors.HexColor("#e2e8f0")        # Slate 200
    COLOR_ROW_ALT = colors.HexColor("#f8fafc")       # Slate 50
    COLOR_ACCENT = colors.HexColor("#2563eb")        # Royal Blue
    COLOR_CREDIT = colors.HexColor("#16a34a")        # Green 600
    COLOR_DEBIT = colors.HexColor("#d97706")         # Amber 600
    COLOR_WHITE = colors.HexColor("#ffffff")"""

new_class_start = """class UniversalPDFGenerator:
    \"\"\"
    Central controller for all server-generated ERP PDFs.
    Strictly adheres to the clean, minimal reference layout established by DC-00002.pdf:
    - Pure white A4 page, zero outer borders, zero dark banners, zero boxed panels
    - Top-Left: Colored logo + verified legal company details block
    - Top-Right: 28pt Light uppercase title + 10pt Bold document number
    - Left party block + right-aligned meta pairs (sentence case, plain language)
    - Charcoal (#3c3d3a) table header with white text
    - Thin (#adadad) row dividers, comfortable row padding, repeatRows=1
    - Warm-gray (#f5f4f3) Total band with official SAR symbol
    - Single line "Authorized Signature _______________"
    - Thin rule footer with discreet page numbering
    \"\"\"

    # Exact design tokens from reference DC-00002.pdf
    LEFT_MARGIN = 45.6
    RIGHT_MARGIN = 34.8
    DOC_WIDTH = A4[0] - (45.6 + 34.8) # 515.02 pt

    COLOR_TEXT_PRIMARY = colors.HexColor("#000000")
    COLOR_TEXT_DARK = colors.HexColor("#333333")
    COLOR_TEXT_MUTED = colors.HexColor("#727272")
    COLOR_TEXT_LIGHT = colors.HexColor("#6c718a")
    COLOR_HEADER_BG = colors.HexColor("#3c3d3a")
    COLOR_TOTAL_BG = colors.HexColor("#f5f4f3")
    COLOR_BORDER = colors.HexColor("#adadad")
    COLOR_WHITE = colors.HexColor("#ffffff")

    # Legacy alias compatibility
    COLOR_PRIMARY = colors.HexColor("#000000")
    COLOR_SECONDARY = colors.HexColor("#333333")
    COLOR_MUTED = colors.HexColor("#727272")
    COLOR_ROW_ALT = colors.HexColor("#ffffff")
    COLOR_ACCENT = colors.HexColor("#000000")
    COLOR_CREDIT = colors.HexColor("#000000")
    COLOR_DEBIT = colors.HexColor("#000000")"""

if old_class_start in code:
    code = code.replace(old_class_start, new_class_start)
    print("[OK] Updated UniversalPDFGenerator tokens")
else:
    # Try CRLF
    old_crlf = old_class_start.replace('\n', '\r\n')
    if old_crlf in code:
        code = code.replace(old_crlf, new_class_start)
        print("[OK] Updated UniversalPDFGenerator tokens (CRLF)")
    else:
        print("[FAIL] old_class_start not found")

with open(pdf_gen_path, 'w', encoding='utf-8') as f:
    f.write(code)
print("Saved tokens")

