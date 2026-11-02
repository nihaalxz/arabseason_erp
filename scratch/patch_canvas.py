import re

pdf_gen_path = 'backend/api/pdf_generator.py'
with open(pdf_gen_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update NumberedCanvas
old_numbered_canvas = '''class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render \'Page X of Y\' 
    along with corporate confidentiality notice and generation timestamp.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont(UNICODE_FONT, 7.5)
        self.setFillColor(colors.HexColor("#64748b"))

        page_w, page_h = getattr(self, \'_pagesize\', A4)
        margin = 12 * mm

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.6)
        self.line(margin, margin + 6 * mm, page_w - margin, margin + 6 * mm)

        # Left: Confidential notice & company name
        company_name = getattr(self, \'company_name\', \'Arab Season\')
        self.drawString(
            margin, 
            margin + 2 * mm, 
            f"CONFIDENTIAL • {company_name} • Generated: {datetime.now().strftime(\'%d/%m/%Y %H:%M\')}"
        )

        # Right: Page X of Y
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_w - margin, margin + 2 * mm, page_text)

        # Optional crisp outer border around the PDF
        if getattr(self, \'draw_outer_border\', False):
            border_margin = getattr(self, \'outer_border_margin\', 7 * mm)
            self.setStrokeColor(colors.HexColor("#0f172a"))
            self.setLineWidth(0.85)
            self.roundRect(
                border_margin,
                border_margin,
                page_w - 2 * border_margin,
                page_h - 2 * border_margin,
                radius=3.5 * mm,
                stroke=1,
                fill=0
            )

        self.restoreState()'''

new_numbered_canvas = '''class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas matching reference DC-00002 layout:
    - Thin rule (#adadad, 0.75pt) at footer
    - Page number at right ("Page X of Y" for multi-page, bare "1" for single-page)
    - Optional generation timestamp at left ONLY for report-type PDFs (is_report=True)
    - Zero outer borders, zero dark banners, clean whitespace
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.is_report = False

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
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
            self.drawString(margin_l, footer_y - 10.5, f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}")

        self.restoreState()'''

if old_numbered_canvas in code:
    code = code.replace(old_numbered_canvas, new_numbered_canvas)
    print("[OK] Replaced NumberedCanvas")
else:
    # Try normalizing newlines
    old_crlf = old_numbered_canvas.replace('\n', '\r\n')
    if old_crlf in code:
        code = code.replace(old_crlf, new_numbered_canvas)
        print("[OK] Replaced NumberedCanvas (CRLF)")
    else:
        print("[FAIL] NumberedCanvas not found")

with open(pdf_gen_path, 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated pdf_generator.py")

