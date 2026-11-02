import pdfplumber

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_live_migrated.pdf') as p_mig:
    print("REF WORDS in 380-420:")
    for w in [w for w in p_ref.pages[0].extract_words(extra_attrs=['fontname', 'size']) if 380 < w['top'] < 420]:
        print(f"  {w['text']:<15} x0={w['x0']:<6.1f} top={w['top']:<6.1f} x1={w['x1']:<6.1f} font={w['fontname']}")

    print("\nMIG WORDS in 380-420:")
    for w in [w for w in p_mig.pages[0].extract_words(extra_attrs=['fontname', 'size']) if 380 < w['top'] < 420]:
        print(f"  {w['text']:<15} x0={w['x0']:<6.1f} top={w['top']:<6.1f} x1={w['x1']:<6.1f} font={w['fontname']}")

