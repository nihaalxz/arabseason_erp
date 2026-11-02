import sys, os, django
from decimal import Decimal
import pdfplumber
import fitz

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator

out_dir = 'design-reference/output/audit'
os.makedirs(out_dir, exist_ok=True)

# Generate 45 transactions to span multiple pages
transactions = []
running = 5000.00
for i in range(1, 46):
    is_debit = (i % 2 == 1)
    amt = 150.00 + (i * 10.00)
    if is_debit:
        deb = amt
        cred = 0.00
        running += deb
        desc = f"Job Order JOB-{i:04d} Custom Fabrication Services"
    else:
        deb = 0.00
        cred = amt
        running -= cred
        desc = f"Payment Settlement via MADA POS #{i:04d}"
    transactions.append({
        'date': f"2026-10-{(i % 28) + 1:02d}",
        'description': desc,
        'debit': deb,
        'credit': cred,
        'balance': running
    })

statement_data = {
    'voucherType': 'Customer Account Statement',
    'voucherNo': 'CUST-STMT-45TRX',
    'date': '2026-10-31',
    'period': '01 Oct 2026 to 31 Oct 2026',
    'payeeName': 'Saudi Modern Entertainment Co.',
    'payeeRole': 'Customer / Client',
    'openingBalance': 5000.00,
    'closingBalance': running,
    'transactions': transactions,
    'notes': 'Please review your October 2026 transaction ledger.'
}

pdf_bytes = universal_pdf_generator.generate_payment_voucher_pdf(statement_data)
pdf_path = os.path.join(out_dir, 'statement_45_rows.pdf')
with open(pdf_path, 'wb') as f:
    f.write(pdf_bytes)

# Render pages to PNG
doc = fitz.open(pdf_path)
print(f"Statement PDF generated with {len(doc)} pages.")
assert len(doc) >= 2, f"Expected multipage statement, got {len(doc)} pages"

for pno in range(len(doc)):
    page = doc.load_page(pno)
    pix = page.get_pixmap(dpi=150)
    png_path = os.path.join(out_dir, f'statement_page_{pno+1}.png')
    pix.save(png_path)
    print(f"Saved {png_path}")

# Verify with pdfplumber
p1 = pdfplumber.open(pdf_path).pages[0]
p2 = pdfplumber.open(pdf_path).pages[1]

text_p1 = p1.extract_text()
text_p2 = p2.extract_text()

# Check headers
assert 'Statement Period: 01 Oct 2026 to 31 Oct 2026' in text_p1
assert 'Opening Balance: 5,000.00 SAR' in text_p1
assert 'Date Transaction Details Debit (SAR) Credit (SAR) Balance (SAR)' in text_p1

# Check repeated header on page 2
print("Page 2 Text header line check:")
p2_lines = text_p2.split('\n')
print("  Line 0:", p2_lines[0])
print("  Line 1:", p2_lines[1])
assert 'Date Transaction Details Debit (SAR) Credit (SAR) Balance (SAR)' in text_p2, "Repeated header not found on page 2!"
print("[PASS] Statement Ledger Table verified with repeated header on page 2!")

# Copy PNGs to artifact directory
import shutil
artifact_dir = r'C:\Users\nihaa\.gemini\antigravity\brain\640e936d-fef2-4084-9176-90e97a80fb01'
shutil.copy(os.path.join(out_dir, 'statement_page_1.png'), os.path.join(artifact_dir, 'statement_ledger_multipage_p1.png'))
shutil.copy(os.path.join(out_dir, 'statement_page_2.png'), os.path.join(artifact_dir, 'statement_ledger_multipage_p2.png'))
print("[PASS] Multi-page statement PNGs copied to artifacts.")

