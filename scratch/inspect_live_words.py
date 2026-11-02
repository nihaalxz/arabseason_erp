import pdfplumber

with pdfplumber.open('design-reference/output/test_live_migrated.pdf') as p:
    words = p.pages[0].extract_words()
    print('Words count:', len(words))
    for w in words:
        if any(k in w['text'] for k in ['Sub', 'Total', '150', 'Saudi', 'Authorized', 'Signature', 'Page', 'Words']):
            print(f"{w['text']:<15} x0={w['x0']:<6.1f} top={w['top']:<6.1f}")

