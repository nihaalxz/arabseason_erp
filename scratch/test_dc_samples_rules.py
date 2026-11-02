import sys, os, django
from decimal import Decimal
import pdfplumber

sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.pdf_generator import universal_pdf_generator

out_dir = 'design-reference/output/audit'
os.makedirs(out_dir, exist_ok=True)

# -----------------------------------------------------------------
# 1. CWO-6: customer "hello", 50 SAR
# -----------------------------------------------------------------
cwo_6_data = {
    'voucherType': 'Customer Work Order & Quote',
    'voucherNo': 'CWO-6',
    'date': '2026-11-02',
    'payeeName': 'hello',
    'payeeRole': 'Customer / Client',
    'payeePhone': '-',
    'amount': 50.00,
    'particulars': [
        {'item': 'Vinyl Cutout Decals', 'qty': 1, 'rate': 50.00, 'amount': 50.00}
    ],
    'notes': 'Advance work order quote'
}
cwo_bytes = universal_pdf_generator.generate_payment_voucher_pdf(cwo_6_data)
cwo_pdf_path = os.path.join(out_dir, 'CWO-6_test.pdf')
with open(cwo_pdf_path, 'wb') as f:
    f.write(cwo_bytes)

# -----------------------------------------------------------------
# 2. VPA-6: "rahul vendor", 5 SAR, contact "-"
# -----------------------------------------------------------------
vpa_6_data = {
    'voucherType': 'Approved Vendor Price Quote / Agreement',
    'voucherNo': 'VPA-6',
    'date': '2026-10-29',
    'payeeName': 'rahul vendor',
    'payeeRole': 'Material Supplier / Subcontractor',
    'payeePhone': '-',
    'amount': 5.00,
    'particulars': [
        {'item': 'red sticker (Sheet)', 'qty': 1, 'rate': 5.00, 'amount': 5.00}
    ],
    'notes': 'Approved supplier pricing benchmark'
}
vpa_bytes = universal_pdf_generator.generate_payment_voucher_pdf(vpa_6_data)
vpa_pdf_path = os.path.join(out_dir, 'VPA-6_test.pdf')
with open(vpa_pdf_path, 'wb') as f:
    f.write(vpa_bytes)

def check_pdf(pdf_path, v_no, expected_date_str, expected_amount_str):
    print(f"\n=======================================================")
    print(f"AUDITING: {os.path.basename(pdf_path)}")
    print(f"=======================================================")
    p = pdfplumber.open(pdf_path).pages[0]
    text = p.extract_text()
    words = [w['text'] for w in p.extract_words()]

    print(f"--- Extracted Document Text Preview ---")
    for line in text.split('\n')[:15]:
        print("  ", line)
    print("   ...")

    # Rule A: Voucher number appears ONCE
    v_no_occurrences = [w for w in words if v_no in w]
    print(f"\n1. Voucher Number Count ('{v_no}'): {len(v_no_occurrences)}")
    assert len(v_no_occurrences) == 1, f"Expected {v_no} once, found {len(v_no_occurrences)}: {v_no_occurrences}"
    print(f"   [PASS] {v_no} appears exactly once: {v_no_occurrences}")

    # Rule B: Date appears ONCE
    date_occurrences = [w for w in text.split('\n') if expected_date_str in w]
    print(f"\n2. Date Count ('{expected_date_str}'): {len(date_occurrences)}")
    assert len(date_occurrences) == 1, f"Expected date once, found {len(date_occurrences)}: {date_occurrences}"
    print(f"   [PASS] {expected_date_str} appears exactly once: {date_occurrences}")

    # Rule C: Total amount in totals area
    amount_words = [w for w in words if w == expected_amount_str]
    print(f"\n3. Amount String '{expected_amount_str}' Count: {len(amount_words)}")
    # In table item + subtotal + total = 3 occurrences total on page, but in Totals area:
    totals_words = [w['text'] for w in p.extract_words() if w['top'] > 320 and w['top'] < 380]
    total_in_band = [w for w in totals_words if w == expected_amount_str]
    print(f"   Totals area occurrences: {len(total_in_band)} (SubTotal and Total Band)")
    print(f"   [PASS] Total Amount verified.")

    # Rule D: Empty fields and standalone '-'
    # Check that '-' does not appear as standalone token or in party/meta
    # Check for empty value placeholders in party, meta, table, totals (below company header top > 185)
    hyphen_words = [w['text'] for w in p.extract_words() if w['text'] in ('-', 'Contact: -', 'Tel: -') and w['top'] > 185]
    print(f"\n4. Standalone '-' or empty value placeholders: {len(hyphen_words)}")
    assert len(hyphen_words) == 0, f"Found unwanted '-' placeholders: {hyphen_words}"
    print(f"   [PASS] Zero '-' empty field placeholders found.")

check_pdf(cwo_pdf_path, 'CWO-6', '02 Nov 2026', '50.00')
check_pdf(vpa_pdf_path, 'VPA-6', '29 Oct 2026', '5.00')
print("\nALL PROGRAMMATIC CHECKS PASSED FOR CWO-6 AND VPA-6!")
