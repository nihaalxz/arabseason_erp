import pdfplumber

def get_page_data(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        p = pdf.pages[0]
        words = p.extract_words(extra_attrs=['fontname', 'size'])
        rects = p.rects
        images = p.images
        return {
            'width': p.width,
            'height': p.height,
            'words': words,
            'rects': rects,
            'images': images
        }

ref = get_page_data('design-reference/DC-00002.pdf')
mig = get_page_data('design-reference/output/DC-00002_migrated.pdf')

print(f"{'TEXT':<25} | {'REF (x0, top, size)':<24} | {'MIG (x0, top, size)':<24} | {'DELTA (dx, dy)'}")
print("-" * 90)

key_phrases = [
    "DELIVERY", "CHALLAN", "DC-00002", "ALI MOHAMMED", "Contracting",
    "TRN 301374966800003", "Riyadh,", "0575287403", "ad@arabseason.net",
    "Deliver", "Marwa", "Challan Date", "15 Oct 2026", "Challan Type", "Others",
    "#", "Item & Description", "Qty", "Rate", "Amount",
    "Banner printing", "Forex with sticker",
    "Sub Total", "Total", "Total In Words:", "Saudi Riyal One Hundred", "Fifty",
    "Authorized", "Signature", "1"
]

for phrase in key_phrases:
    r_matches = [w for w in ref['words'] if phrase.lower() in w['text'].lower()]
    m_matches = [w for w in mig['words'] if phrase.lower() in w['text'].lower()]
    
    r_w = r_matches[0] if r_matches else None
    m_w = m_matches[0] if m_matches else None
    
    r_str = f"({r_w['x0']:5.1f}, {r_w['top']:5.1f}, {r_w['size']:4.1f})" if r_w else "MISSING"
    m_str = f"({m_w['x0']:5.1f}, {m_w['top']:5.1f}, {m_w['size']:4.1f})" if m_w else "MISSING"
    
    if r_w and m_w:
        dx = m_w['x0'] - r_w['x0']
        dy = m_w['top'] - r_w['top']
        delta_str = f"dx={dx:+5.1f}, dy={dy:+5.1f}"
    else:
        delta_str = "N/A"
        
    print(f"{phrase:<25} | {r_str:<24} | {m_str:<24} | {delta_str}")

