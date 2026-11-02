import pdfplumber

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_tuned_pass.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]
    print('--- RECTS ---')
    print('REF RECTS:', len(ref.rects))
    for r in ref.rects:
        print(f"REF: x0={r['x0']:.2f}, top={r['top']:.2f}, w={r['width']:.2f}, h={r['height']:.2f}, color={r.get('non_stroking_color')}")
    print('MIG RECTS:', len(mig.rects))
    for r in mig.rects:
        print(f"MIG: x0={r['x0']:.2f}, top={r['top']:.2f}, w={r['width']:.2f}, h={r['height']:.2f}, color={r.get('non_stroking_color')}")
    print('--- LINES ---')
    print('REF LINES:', len(ref.lines))
    for l in ref.lines:
        print(f"REF LINE: x0={l['x0']:.2f}, top={l['top']:.2f}, x1={l['x1']:.2f}, h={l['height']:.2f}")
    print('MIG LINES:', len(mig.lines))
    for l in mig.lines:
        print(f"MIG LINE: x0={l['x0']:.2f}, top={l['top']:.2f}, x1={l['x1']:.2f}, h={l['height']:.2f}")

