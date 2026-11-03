import sys, os
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django; django.setup()

import pdfplumber
with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref:
    page = p_ref.pages[0]
    for w in page.extract_words()[:25]:
        t = w['text']
        print(f"{t:25} top={w['top']} x0={w['x0']}")

