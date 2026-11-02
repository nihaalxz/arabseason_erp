from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display

pdfmetrics.registerFont(TTFont('Ubuntu', 'backend/api/static/fonts/Ubuntu-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SegoeUI', r'C:\Windows\Fonts\segoeui.ttf'))
pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))

c = canvas.Canvas('scratch/test_arabic.pdf')
ar_text = get_display(arabic_reshaper.reshape("شركة الأفق للتجارة"))

try:
    c.setFont('Ubuntu', 12)
    c.drawString(100, 700, ar_text)
    print("Ubuntu rendered Arabic without crash")
except Exception as e:
    print("Ubuntu failed on Arabic:", e)

try:
    c.setFont('Arial', 12)
    c.drawString(100, 650, ar_text)
    print("Arial rendered Arabic without crash")
except Exception as e:
    print("Arial failed on Arabic:", e)

c.save()
print("Saved scratch/test_arabic.pdf")
