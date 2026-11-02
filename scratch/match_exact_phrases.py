import pdfplumber

def extract_phrases(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        p0 = pdf.pages[0]
        words = p0.extract_words(extra_attrs=['fontname', 'size'])
        rects = p0.rects
        images = p0.images
        return words, rects, images

ref_words, ref_rects, ref_images = extract_phrases('design-reference/DC-00002.pdf')
mig_words, mig_rects, mig_images = extract_phrases('design-reference/output/DC-00002_migrated.pdf')

print("=== REFERENCE WORDS ===")
for i, w in enumerate(ref_words):
    print(f"{i:2d}: {w['text']:<25} x0={w['x0']:6.2f}, top={w['top']:6.2f}, x1={w['x1']:6.2f}, bottom={w['bottom']:6.2f}, size={w['size']:4.1f}, font={w['fontname']}")

print("\n=== MIGRATED WORDS ===")
for i, w in enumerate(mig_words):
    print(f"{i:2d}: {w['text']:<25} x0={w['x0']:6.2f}, top={w['top']:6.2f}, x1={w['x1']:6.2f}, bottom={w['bottom']:6.2f}, size={w['size']:4.1f}, font={w['fontname']}")

