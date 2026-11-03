import pdfplumber

with pdfplumber.open('scratch/test_dn_header.pdf') as p_mig:
    page = p_mig.pages[0]
    for w in page.extract_words():
        if w['text'] in ['DELIVERY', 'CHALLAN', 'DC-00002', 'Deliver', 'Marwa', 'Rate', 'Amount', 'Total', 'Authorized']:
            print(f"{w['text']:20} top={w['top']} x0={w['x0']}")
