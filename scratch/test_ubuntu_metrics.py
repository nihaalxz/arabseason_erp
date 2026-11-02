from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

pdfmetrics.registerFont(TTFont('Ubuntu', 'backend/api/static/fonts/Ubuntu-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Bold', 'backend/api/static/fonts/Ubuntu-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Italic', 'backend/api/static/fonts/Ubuntu-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Ubuntu-Light', 'backend/api/static/fonts/Ubuntu-Light.ttf'))

w_del = pdfmetrics.stringWidth('DELIVERY', 'Ubuntu', 28)
w_cha = pdfmetrics.stringWidth('CHALLAN', 'Ubuntu', 28)
w_num = pdfmetrics.stringWidth('Delivery Challan# DC-00002', 'Ubuntu-Bold', 10)
w_sig = pdfmetrics.stringWidth('Authorized Signature', 'Ubuntu', 10)

print(f"DELIVERY width: {w_del:.2f} (Ref was: {553.37 - 426.60:.2f})")
print(f"CHALLAN width: {w_cha:.2f} (Ref was: {559.85 - 436.13:.2f})")
print(f"Doc Number width: {w_num:.2f} (Ref was: {559.76 - 426.26:.2f})")
print(f"Authorized Signature width: {w_sig:.2f} (Ref was: {142.39 - 45.60:.2f})")

