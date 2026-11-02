import re
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image
import numpy as np
import pymupdf

pdfmetrics.registerFont(TTFont('Ubuntu', 'backend/api/static/fonts/Ubuntu-Regular.ttf'))
pdfmetrics.registerFont(TTFont('ArabicFont', r'C:\Windows\Fonts\arial.ttf'))

def format_arabic_html(text):
    if not text:
        return ""
    text = str(text)
    # Match contiguous Arabic words/characters
    pattern = r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+'
    def repl(m):
        raw = m.group(0).strip()
        if not raw or not re.search(r'[\u0600-\u06FF]', raw):
            return m.group(0)
        shaped = get_display(arabic_reshaper.reshape(raw))
        return f'<font name="ArabicFont">{shaped}</font>'
    return re.sub(pattern, repl, text)

doc = SimpleDocTemplate('scratch/test_arabic_paragraph.pdf')
p_style = ParagraphStyle('Test', fontName='Ubuntu', fontSize=10, leading=12)

party_name = "شركة الأفق للتجارة (Horizon Trading LLC)"
html_text = f"Deliver To: <b>{format_arabic_html(party_name)}</b>"

p = Paragraph(html_text, p_style)
doc.build([p])

# Render and test pixels
pdoc = pymupdf.open('scratch/test_arabic_paragraph.pdf')
pix = pdoc[0].get_pixmap(dpi=150)
pix.save('scratch/test_arabic_paragraph.png')

img = Image.open('scratch/test_arabic_paragraph.png').convert('L')
arr = np.array(img)
non_white = np.sum(arr < 250)
print("Non-white pixels in test_arabic_paragraph.png:", non_white)

