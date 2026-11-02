import pdfplumber

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_live_migrated.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]

    print("=== RECTANGLES & LINES EXTRACTION ===")
    print("MIG RECTS:")
    for r in mig.rects:
        print(f"Rect: x0={r['x0']:.2f}, top={r['top']:.2f}, w={r['width']:.2f}, h={r['height']:.2f}, color={r.get('non_stroking_color')}")
    print("MIG LINES:")
    for l in mig.lines:
        print(f"Line: x0={l['x0']:.2f}, top={l['top']:.2f}, x1={l['x1']:.2f}, h={l['height']:.2f}")
    print("MIG IMAGES:")
    for img in mig.images:
        print(f"Image: x0={img['x0']:.2f}, top={img['top']:.2f}, w={img['width']:.2f}, h={img['height']:.2f}")

