import pdfplumber

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_live_migrated.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]

    r_words = ref.extract_words(extra_attrs=['fontname', 'size'])
    m_words = mig.extract_words(extra_attrs=['fontname', 'size'])

    # Let's check each of the user's 8 specific items:
    # 1. Title
    r_del = [w for w in r_words if w['text'] == 'DELIVERY'][0]
    m_del = [w for w in m_words if w['text'] == 'DELIVERY'][0]
    print(f"1. Title (DELIVERY): Ref=({r_del['x0']:.1f}, {r_del['top']:.1f}), Mig=({m_del['x0']:.1f}, {m_del['top']:.1f}), Delta=(dx={m_del['x0']-r_del['x0']:+.1f}, dy={m_del['top']-r_del['top']:+.1f})")

    r_chal = [w for w in r_words if w['text'] == 'CHALLAN'][0]
    m_chal = [w for w in m_words if w['text'] == 'CHALLAN'][0]
    print(f"   Title (CHALLAN):  Ref=({r_chal['x0']:.1f}, {r_chal['top']:.1f}), Mig=({m_chal['x0']:.1f}, {m_chal['top']:.1f}), Delta=(dx={m_chal['x0']-r_chal['x0']:+.1f}, dy={m_chal['top']-r_chal['top']:+.1f})")

    # 2. Doc number
    r_dn = [w for w in r_words if w['text'] == 'Delivery' and w['top'] > 120][0]
    m_dn = [w for w in m_words if w['text'] == 'Delivery' and w['top'] > 120][0]
    print(f"2. Doc Number (Delivery): Ref=({r_dn['x0']:.1f}, {r_dn['top']:.1f}), Mig=({m_dn['x0']:.1f}, {m_dn['top']:.1f}), Delta=(dx={m_dn['x0']-r_dn['x0']:+.1f}, dy={m_dn['top']-r_dn['top']:+.1f})")

    # 3. Company legal name & TRN
    r_comp = [w for w in r_words if w['text'] == 'ALI' and w['top'] < 120][0]
    m_comp = [w for w in m_words if w['text'] == 'ALI' and w['top'] < 120][0]
    print(f"3. Company Name y: Ref top={r_comp['top']:.1f}, Mig top={m_comp['top']:.1f}, dy={m_comp['top']-r_comp['top']:+.1f}")

    r_trn = [w for w in r_words if w['text'] == 'TRN'][0]
    m_trn = [w for w in m_words if w['text'] == 'TRN'][0]
    print(f"   TRN y:          Ref top={r_trn['top']:.1f}, Mig top={m_trn['top']:.1f}, dy={m_trn['top']-r_trn['top']:+.1f}")

    # 4. Deliver To & Party name
    r_dto = [w for w in r_words if w['text'] == 'Deliver'][0]
    m_dto = [w for w in m_words if w['text'] == 'Deliver'][0]
    print(f"4. Deliver To y:  Ref top={r_dto['top']:.1f}, Mig top={m_dto['top']:.1f}, dy={m_dto['top']-r_dto['top']:+.1f}")

    r_pty = [w for w in r_words if w['text'] == 'Marwa'][0]
    m_pty = [w for w in m_words if w['text'] == 'Marwa'][0]
    print(f"   Party Name y:   Ref top={r_pty['top']:.1f}, Mig top={m_pty['top']:.1f}, dy={m_pty['top']-r_pty['top']:+.1f}")

    # 5. Table header
    r_th = [w for w in r_words if w['text'] == 'Item'][0]
    m_th = [w for w in m_words if w['text'] == 'Item'][0]
    print(f"5. Table Header y: Ref top={r_th['top']:.1f}, Mig top={m_th['top']:.1f}, dy={m_th['top']-r_th['top']:+.1f}")

    # 6. Line item
    r_li = [w for w in r_words if w['text'] == 'Banner'][0]
    m_li = [w for w in m_words if w['text'] == 'Banner'][0]
    print(f"6. Line Item:     Ref=({r_li['x0']:.1f}, {r_li['top']:.1f}), Mig=({m_li['x0']:.1f}, {m_li['top']:.1f}), Delta=(dx={m_li['x0']-r_li['x0']:+.1f}, dy={m_li['top']-r_li['top']:+.1f})")

    # 7. Total In Words
    r_tw = [w for w in r_words if w['text'] == 'Saudi'][0]
    m_tw = [w for w in m_words if w['text'] == 'Saudi'][0]
    print(f"7. Total In Words: Ref=({r_tw['x0']:.1f}, {r_tw['top']:.1f}), Mig=({m_tw['x0']:.1f}, {m_tw['top']:.1f}), Delta=(dx={m_tw['x0']-r_tw['x0']:+.1f}, dy={m_tw['top']-r_tw['top']:+.1f})")

    # 8. Authorized Signature
    r_sig = [w for w in r_words if w['text'] == 'Authorized'][0]
    m_sig = [w for w in m_words if w['text'] == 'Authorized'][0]
    print(f"8. Authorized Sig: Ref x0={r_sig['x0']:.1f}, Mig x0={m_sig['x0']:.1f}, dx={m_sig['x0']-r_sig['x0']:+.1f}")

