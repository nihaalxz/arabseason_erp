with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Replace format_bidi_text (lines 35 to 49)
start_bidi = None
end_bidi = None
for i, line in enumerate(lines):
    if line.startswith('def format_bidi_text('):
        start_bidi = i
    if start_bidi is not None and line.startswith('class Paragraph('):
        end_bidi = i
        break

new_bidi_code = '''def format_bidi_text(text):
    """
    Reshapes and applies BiDi visual ordering to Arabic script text
    so ReportLab renders Arabic letters connected and right-to-left.
    Wraps Arabic runs in ArabicFont while preserving HTML tags.
    """
    if not text or not HAS_ARABIC_SUPPORT:
        return text
    text_str = str(text)
    if not re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', text_str):
        return text_str

    pattern = r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+'
    def _repl(m):
        chunk = m.group(0)
        if re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', chunk):
            try:
                leading_spaces = chunk[:len(chunk) - len(chunk.lstrip())]
                trailing_spaces = chunk[len(chunk.rstrip()):]
                core = chunk.strip()
                shaped = get_display(arabic_reshaper.reshape(core))
                return f'{leading_spaces}<font name="ArabicFont">{shaped}</font>{trailing_spaces}'
            except Exception:
                return chunk
        return chunk

    return re.sub(pattern, _repl, text_str)

'''

lines[start_bidi:end_bidi] = [new_bidi_code]

# 2. Replace _init_pdf_fonts
start_fonts = None
end_fonts = None
for i, line in enumerate(lines):
    if line.startswith('def _init_pdf_fonts('):
        start_fonts = i
    if start_fonts is not None and line.startswith('FONTS = _init_pdf_fonts()'):
        end_fonts = i
        break

new_fonts_code = '''def _init_pdf_fonts():
    """
    Register reference fonts with full style hierarchy and Unicode/Arabic support.
    Bundled Ubuntu and Arabic TTF files in backend/api/static/fonts/ are prioritized.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    font_dir = os.path.join(base_dir, 'static', 'fonts')

    font_configs = [
        ('Ubuntu', 'Ubuntu-Regular.ttf', [r"C:\\Windows\\Fonts\\segoeui.ttf", r"C:\\Windows\\Fonts\\arial.ttf"]),
        ('Ubuntu-Bold', 'Ubuntu-Bold.ttf', [r"C:\\Windows\\Fonts\\segoeuib.ttf", r"C:\\Windows\\Fonts\\arialbd.ttf"]),
        ('Ubuntu-Italic', 'Ubuntu-Italic.ttf', [r"C:\\Windows\\Fonts\\segoeuii.ttf", r"C:\\Windows\\Fonts\\ariali.ttf"]),
        ('Ubuntu-Light', 'Ubuntu-Light.ttf', [r"C:\\Windows\\Fonts\\segoeuil.ttf", r"C:\\Windows\\Fonts\\segoeui.ttf"]),
        ('ArabicFont', 'ArabicFont-Regular.ttf', [r"C:\\Windows\\Fonts\\arial.ttf", r"C:\\Windows\\Fonts\\segoeui.ttf"]),
        ('ArabicFont-Bold', 'ArabicFont-Bold.ttf', [r"C:\\Windows\\Fonts\\arialbd.ttf", r"C:\\Windows\\Fonts\\segoeuib.ttf"]),
        ('AppFont', 'Ubuntu-Regular.ttf', [r"C:\\Windows\\Fonts\\segoeui.ttf", r"C:\\Windows\\Fonts\\arial.ttf"]),
        ('AppFont-Bold', 'Ubuntu-Bold.ttf', [r"C:\\Windows\\Fonts\\segoeuib.ttf", r"C:\\Windows\\Fonts\\arialbd.ttf"]),
        ('AppFont-Italic', 'Ubuntu-Italic.ttf', [r"C:\\Windows\\Fonts\\segoeuii.ttf", r"C:\\Windows\\Fonts\\ariali.ttf"]),
        ('AppFont-Light', 'Ubuntu-Light.ttf', [r"C:\\Windows\\Fonts\\segoeuil.ttf", r"C:\\Windows\\Fonts\\segoeui.ttf"]),
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

    if 'AppFont' not in registered:
        registered['AppFont'] = 'Helvetica'
    if 'AppFont-Bold' not in registered:
        registered['AppFont-Bold'] = 'Helvetica-Bold'
    if 'AppFont-Italic' not in registered:
        registered['AppFont-Italic'] = 'Helvetica-Oblique'
    if 'AppFont-Light' not in registered:
        registered['AppFont-Light'] = 'Helvetica'

    return registered

'''

lines[start_fonts:end_fonts] = [new_fonts_code]

# 3. Replace NumberedCanvas.draw_page_number
start_num = None
end_num = None
for i, line in enumerate(lines):
    if 'def draw_page_number(self, page_count):' in line:
        start_num = i
    if start_num is not None and line.startswith('class UniversalPDFGenerator:'):
        end_num = i
        break

new_num_code = '''    def draw_page_number(self, page_count):
        self.saveState()
        page_w, page_h = getattr(self, '_pagesize', A4)
        rule_x0 = 39.60
        rule_x1 = 566.63
        footer_y = 50.03  # 841.69 - 791.66 pt

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#adadad"))
        self.setLineWidth(0.75)
        self.line(rule_x0, footer_y, rule_x1, footer_y)

        # Page number font: 8.0 pt Ubuntu #6c718a
        font_name = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        self.setFont(font_name, 8.0)
        self.setFillColor(colors.HexColor("#6c718a"))

        # Right: Page X of Y (or 1 if single page)
        if page_count > 1:
            page_str = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(rule_x1, footer_y - 16.02, page_str)
        else:
            self.drawString(558.34, footer_y - 16.02, str(self._pageNumber))

        # Left: Only for report-type PDFs
        if getattr(self, 'is_report', False):
            self.drawString(rule_x0, footer_y - 16.02, f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        self.restoreState()

'''

lines[start_num:end_num] = [new_num_code]

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Applied replacements cleanly!")

