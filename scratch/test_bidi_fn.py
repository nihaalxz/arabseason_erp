import re, os
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display
import pymupdf
from PIL import Image
import numpy as np

pdfmetrics.registerFont(TTFont('Ubuntu', 'backend/api/static/fonts/Ubuntu-Regular.ttf'))
pdfmetrics.registerFont(TTFont('ArabicFont', 'backend/api/static/fonts/ArabicFont-Regular.ttf'))

def format_bidi_text(text):
    if not text:
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

test1 = "Banner printing<br/><font color='#727272'>طباعة بنر مع ستيكر</font>"
out1 = format_bidi_text(test1)

doc = SimpleDocTemplate('scratch/test_bidi_build.pdf')
p = Paragraph(out1, ParagraphStyle('Test', fontName='Ubuntu', fontSize=9, leading=12))
doc.build([p])

pdoc = pymupdf.open('scratch/test_bidi_build.pdf')
pix = pdoc[0].get_pixmap(dpi=150)
pix.save('scratch/test_bidi_build.png')

img = Image.open('scratch/test_bidi_build.png').convert('L')
arr = np.array(img)
non_white = np.sum(arr < 250)
print("SUCCESS: test_bidi_build rendered. Non-white pixels:", non_white)
