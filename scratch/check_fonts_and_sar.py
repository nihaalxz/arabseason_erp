import pymupdf

doc_ref = pymupdf.open('design-reference/DC-00002.pdf')
doc_mig = pymupdf.open('design-reference/output/test_live_migrated.pdf')

print("=== REFERENCE PDF (DC-00002.pdf) FONTS ===")
print(f"{'name':<25} {'type':<10} {'encoding':<10} {'embedded':<10} {'subset':<10}")
for f in doc_ref.get_page_fonts(0):
    # f: (xref, ext, type, basefont, name, encoding)
    xref, ext, ftype, basefont, name, enc = f
    is_subset = '+' in basefont
    print(f"{basefont:<25} {ftype:<10} {enc:<10} {'yes':<10} {'yes' if is_subset else 'no':<10}")

print("\n=== MIGRATED PDF (test_live_migrated.pdf) FONTS ===")
print(f"{'name':<25} {'type':<10} {'encoding':<10} {'embedded':<10} {'subset':<10}")
for f in doc_mig.get_page_fonts(0):
    xref, ext, ftype, basefont, name, enc = f
    is_subset = '+' in basefont
    print(f"{basefont:<25} {ftype:<10} {enc:<10} {'yes':<10} {'yes' if is_subset else 'no':<10}")

print("\n=== SAR SYMBOL INSPECTION ===")
print("Reference (DC-00002.pdf) images on page 0:")
for img in doc_ref.get_page_images(0):
    xref = img[0]
    base_img = doc_ref.extract_image(xref)
    print(f"  Image xref={xref}: format={base_img['ext']}, width={base_img['width']}px, height={base_img['height']}px, colorspace={base_img['colorspace']}")

print("\nMigrated (test_live_migrated.pdf) images on page 0:")
for img in doc_mig.get_page_images(0):
    xref = img[0]
    base_img = doc_mig.extract_image(xref)
    print(f"  Image xref={xref}: format={base_img['ext']}, width={base_img['width']}px, height={base_img['height']}px, colorspace={base_img['colorspace']}")

