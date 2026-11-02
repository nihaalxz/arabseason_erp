import re
import os

pdf_gen_path = 'backend/api/pdf_generator.py'
with open(pdf_gen_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update font initialization and helper at the top
old_font_init = """def _init_pdf_font():
    font_candidates = [
        r"C:\\Windows\\Fonts\\arial.ttf",
        r"C:\\Windows\\Fonts\\tahoma.ttf",
        r"C:\\Windows\\Fonts\\segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for fp in font_candidates:
        if os.path.exists(fp):
            try:
                pdfmetrics.registerFont(TTFont('UnicodeFont', fp))
                return 'UnicodeFont'
            except Exception:
                continue
    return 'Helvetica'

UNICODE_FONT = _init_pdf_font()"""

new_font_init = """def _init_pdf_fonts():
    \"\"\"
    Register reference fonts with full style hierarchy and Unicode/Arabic support.
    Bundled TTF files in backend/api/static/fonts/ are prioritized.
    \"\"\"
    base_dir = os.path.dirname(os.path.abspath(__file__))
    font_dir = os.path.join(base_dir, 'static', 'fonts')
    
    font_configs = [
        ('AppFont', 'AppFont-Regular.ttf', [r"C:\\Windows\\Fonts\\segoeui.ttf", r"C:\\Windows\\Fonts\\arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]),
        ('AppFont-Bold', 'AppFont-Bold.ttf', [r"C:\\Windows\\Fonts\\segoeuib.ttf", r"C:\\Windows\\Fonts\\arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]),
        ('AppFont-Italic', 'AppFont-Italic.ttf', [r"C:\\Windows\\Fonts\\segoeuii.ttf", r"C:\\Windows\\Fonts\\ariali.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"]),
        ('AppFont-Light', 'AppFont-Light.ttf', [r"C:\\Windows\\Fonts\\segoeuil.ttf", r"C:\\Windows\\Fonts\\segoeui.ttf", r"C:\\Windows\\Fonts\\arial.ttf"]),
    ]
    
    registered = {}
    for fname, local_file, fallbacks in font_configs:
        target = os.path.join(font_dir, local_file)
        if not os.path.exists(target):
            target = None
            for fb in fallbacks:
                if os.path.exists(fb):
                    target = fb
                    break
        if target:
            try:
                pdfmetrics.registerFont(TTFont(fname, target))
                registered[fname] = fname
            except Exception:
                pass
    
    # Fallback to standard Helvetica if not registered
    if 'AppFont' not in registered:
        registered['AppFont'] = 'Helvetica'
    if 'AppFont-Bold' not in registered:
        registered['AppFont-Bold'] = 'Helvetica-Bold'
    if 'AppFont-Italic' not in registered:
        registered['AppFont-Italic'] = 'Helvetica-Oblique'
    if 'AppFont-Light' not in registered:
        registered['AppFont-Light'] = 'Helvetica'
        
    return registered

FONTS = _init_pdf_fonts()
UNICODE_FONT = FONTS.get('AppFont', 'Helvetica')

def format_doc_date(dt_val):
    \"\"\"Format any date into clean reference style: '15 Oct 2026'\"\"\"
    if not dt_val:
        return ''
    if isinstance(dt_val, str):
        try:
            clean_str = dt_val.split('T')[0].split(' ')[0]
            if '-' in clean_str:
                parts = clean_str.split('-')
                if len(parts) == 3:
                    if len(parts[0]) == 4:
                        d = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                    else:
                        d = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                    return d.strftime('%d %b %Y')
            elif '/' in clean_str:
                parts = clean_str.split('/')
                if len(parts) == 3:
                    if len(parts[0]) == 4:
                        d = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                    else:
                        d = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                    return d.strftime('%d %b %Y')
        except Exception:
            return str(dt_val)
    elif hasattr(dt_val, 'strftime'):
        return dt_val.strftime('%d %b %Y')
    return str(dt_val)"""

if old_font_init in code:
    code = code.replace(old_font_init, new_font_init)
    print("[OK] Replaced font initialization and added format_doc_date")
else:
    print("[FAIL] old_font_init not found exactly")

with open(pdf_gen_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated pdf_generator.py")
