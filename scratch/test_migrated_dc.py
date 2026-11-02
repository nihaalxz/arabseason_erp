import os, sys, django

sys.path.insert(0, os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import DeliveryNote
from api.pdf_generator import universal_pdf_generator
import fitz
from PIL import Image

dn = DeliveryNote.objects.filter(delivery_note_number='DC-00002').first()
if not dn:
    print('DC-00002 not found in DB')
    sys.exit(1)

pdf_bytes = universal_pdf_generator.generate_delivery_note_pdf(dn)
out_pdf = 'design-reference/output/DC-00002_migrated.pdf'
with open(out_pdf, 'wb') as f:
    f.write(pdf_bytes)
print(f'Generated {out_pdf} ({len(pdf_bytes)} bytes)')

# Rasterize both to PNG at 150 DPI for visual comparison
doc_orig = fitz.open('design-reference/DC-00002.pdf')
pix_orig = doc_orig[0].get_pixmap(dpi=150)
orig_png = 'design-reference/output/DC-00002_reference.png'
pix_orig.save(orig_png)
doc_orig.close()

doc_mig = fitz.open(out_pdf)
pix_mig = doc_mig[0].get_pixmap(dpi=150)
mig_png = 'design-reference/output/DC-00002_migrated.png'
pix_mig.save(mig_png)
doc_mig.close()

print(f'Saved reference PNG: {orig_png}')
print(f'Saved migrated PNG: {mig_png}')

