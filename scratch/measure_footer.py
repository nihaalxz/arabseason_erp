import pdfplumber

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_live_migrated.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]

    # Page height
    ref_h = ref.height  # 841.69 pt
    mig_h = mig.height  # 841.69 pt

    # Footer rule
    # In ref: rect at top=791.29 to 792.04 with h < 2
    r_rules = [r for r in ref.rects if r['top'] > 780 and r['width'] > 500 and r['height'] < 2.0]
    m_lines = [l for l in mig.lines if l['top'] > 780 and (l['x1'] - l['x0']) > 500]

    r_rule = r_rules[0]
    m_rule = m_lines[0]

    # Page number '1'
    r_pno = [w for w in ref.extract_words() if w['text'] == '1' and w['top'] > 790][0]
    m_pno = [w for w in mig.extract_words() if w['text'] == '1' and w['top'] > 790][0]

    print("=== FOOTER RULE ===")
    print(f"Reference Rule:")
    print(f"  x0: {r_rule['x0']:.2f} pt, x1: {r_rule['x0']+r_rule['width']:.2f} pt, width: {r_rule['width']:.2f} pt, thickness: {r_rule['height']:.2f} pt")
    print(f"  y-from-top:    {r_rule['top']:.2f} pt (baseline/bottom: {r_rule['bottom']:.2f} pt, center: {(r_rule['top']+r_rule['bottom'])/2:.2f} pt)")
    print(f"  y-from-bottom: {ref_h - r_rule['bottom']:.2f} pt (top edge: {ref_h - r_rule['top']:.2f} pt, center: {ref_h - (r_rule['top']+r_rule['bottom'])/2:.2f} pt)")

    print(f"Migrated Rule:")
    print(f"  x0: {m_rule['x0']:.2f} pt, x1: {m_rule['x1']:.2f} pt, width: {m_rule['x1']-m_rule['x0']:.2f} pt, thickness: 0.75 pt")
    print(f"  y-from-top:    {m_rule['top']:.2f} pt")
    print(f"  y-from-bottom: {mig_h - m_rule['top']:.2f} pt")
    print(f"  Delta: dy-from-top = {m_rule['top'] - (r_rule['top']+r_rule['bottom'])/2:+.2f} pt")

    print("\n=== PAGE NUMBER '1' ===")
    print(f"Reference Page Number:")
    print(f"  x0: {r_pno['x0']:.2f} pt, x1: {r_pno['x1']:.2f} pt, width: {r_pno['x1']-r_pno['x0']:.2f} pt")
    print(f"  y-from-top:    {r_pno['top']:.2f} pt (bottom: {r_pno['bottom']:.2f} pt)")
    print(f"  y-from-bottom: {ref_h - r_pno['bottom']:.2f} pt (top edge: {ref_h - r_pno['top']:.2f} pt)")

    print(f"Migrated Page Number:")
    print(f"  x0: {m_pno['x0']:.2f} pt, x1: {m_pno['x1']:.2f} pt, width: {m_pno['x1']-m_pno['x0']:.2f} pt")
    print(f"  y-from-top:    {m_pno['top']:.2f} pt (bottom: {m_pno['bottom']:.2f} pt)")
    print(f"  y-from-bottom: {mig_h - m_pno['bottom']:.2f} pt (top edge: {mig_h - m_pno['top']:.2f} pt)")
    print(f"  Delta: dx = {m_pno['x0'] - r_pno['x0']:+.2f} pt, dy-from-top = {m_pno['top'] - r_pno['top']:+.2f} pt, dy-from-bottom = {(mig_h - m_pno['bottom']) - (ref_h - r_pno['bottom']):+.2f} pt")
