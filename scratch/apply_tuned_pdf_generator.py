import re

with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize CRLF to LF for reliable string replacement
crlf_mode = '\r\n' in content
content = content.replace('\r\n', '\n')

old_bidi = '''def format_bidi_text(text):
    """
    Reshapes and applies BiDi visual ordering to Arabic script text
    so ReportLab renders Arabic letters connected and right-to-left.
    """
    if not text or not HAS_ARABIC_SUPPORT:
        return text
    if re.search(r'[\u0600-\u06FF]', str(text)):
        try:
            reshaped = arabic_reshaper.reshape(str(text))
            return get_display(reshaped)
        except Exception:
            return text
    return text'''

new_bidi = r'''def format_bidi_text(text):
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

    return re.sub(pattern, _repl, text_str)'''

assert old_bidi in content, "old_bidi not found"
content = content.replace(old_bidi, new_bidi, 1)

old_fonts = '''def _init_pdf_fonts():
    """
    Register reference fonts with full style hierarchy and Unicode/Arabic support.
    Bundled TTF files in backend/api/static/fonts/ are prioritized.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    font_dir = os.path.join(base_dir, 'static', 'fonts')
    
    font_configs = [
        ('AppFont', 'AppFont-Regular.ttf', [r"C:\\Windows\\Fonts\\segoeui.ttf", r"C:\\Windows\\Fonts\\arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]),
        ('AppFont-Bold', 'AppFont-Bold.ttf', [r"C:\\Windows\\Fonts\\segoeuib.ttf", r"C:\\Windows\\Fonts\\arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]),
        ('AppFont-Italic', 'AppFont-Italic.ttf', [r"C:\\Windows\\Fonts\\segoeuii.ttf", r"C:\\Windows\\Fonts\\ariali.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"]),
        ('AppFont-Light', 'AppFont-Light.ttf', [r"C:\\Windows\\Fonts\\segoeuil.ttf", r"C:\\Windows\\Fonts\\segoeui.ttf", r"C:\\Windows\\Fonts\\arial.ttf"]),
    ]'''

new_fonts = '''def _init_pdf_fonts():
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
    ]'''

assert old_fonts in content, "old_fonts not found"
content = content.replace(old_fonts, new_fonts, 1)

old_num_canvas = '''    def draw_page_number(self, page_count):
        self.saveState()
        page_w, page_h = getattr(self, '_pagesize', A4)
        margin_l = 45.6
        margin_r = 34.8
        footer_y = 50.4

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#adadad"))
        self.setLineWidth(0.75)
        self.line(margin_l, footer_y, page_w - margin_r, footer_y)

        # Page number font
        font_name = FONTS.get('AppFont', 'Helvetica')
        self.setFont(font_name, 8)
        self.setFillColor(colors.HexColor("#6c718a"))

        # Right: Page X of Y (or 1 if single page)
        page_str = str(self._pageNumber) if page_count == 1 else f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_w - margin_r, footer_y - 10.5, page_str)

        # Left: Only for report-type PDFs
        if getattr(self, 'is_report', False):
            self.drawString(margin_l, footer_y - 10.5, f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}")'''

new_num_canvas = '''    def draw_page_number(self, page_count):
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
            self.drawString(rule_x0, footer_y - 16.02, f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}")'''

assert old_num_canvas in content, "old_num_canvas not found"
content = content.replace(old_num_canvas, new_num_canvas, 1)

if crlf_mode:
    content = content.replace('\n', '\r\n')

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated format_bidi_text, _init_pdf_fonts, and NumberedCanvas successfully")
