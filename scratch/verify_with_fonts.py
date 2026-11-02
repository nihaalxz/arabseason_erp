import pdfplumber

def match_element(words, filter_fn):
    candidates = [w for w in words if filter_fn(w)]
    return candidates[0] if candidates else None

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_live_migrated.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]

    r_words = ref.extract_words(extra_attrs=['fontname', 'size'])
    m_words = mig.extract_words(extra_attrs=['fontname', 'size'])

    elements_to_verify = [
        ("Doc Title Line 1 (DELIVERY)",
         lambda w: w['text'] == 'DELIVERY' and w['top'] < 100,
         lambda w: w['text'] == 'DELIVERY' and w['top'] < 100),
        ("Doc Title Line 2 (CHALLAN)",
         lambda w: w['text'] == 'CHALLAN' and w['top'] < 120,
         lambda w: w['text'] == 'CHALLAN' and w['top'] < 120),
        ("Doc Number: Delivery",
         lambda w: w['text'] == 'Delivery' and 120 < w['top'] < 140,
         lambda w: w['text'] == 'Delivery' and 120 < w['top'] < 140),
        ("Doc Number: Challan#",
         lambda w: w['text'] == 'Challan#' and 120 < w['top'] < 140,
         lambda w: w['text'] == 'Challan#' and 120 < w['top'] < 140),
        ("Doc Number: DC-00002",
         lambda w: w['text'] == 'DC-00002',
         lambda w: w['text'] == 'DC-00002'),
        ("Company Line 1: ALI",
         lambda w: w['text'] == 'ALI' and 110 < w['top'] < 120,
         lambda w: w['text'] == 'ALI' and 110 < w['top'] < 120),
        ("Company Line 1: Contracting",
         lambda w: w['text'] == 'Contracting' and 120 < w['top'] < 132,
         lambda w: w['text'] == 'Contracting' and 120 < w['top'] < 132),
        ("Company Line 2: ALI",
         lambda w: w['text'] == 'ALI' and 130 < w['top'] < 142,
         lambda w: w['text'] == 'ALI' and 130 < w['top'] < 142),
        ("Company Line 3: TRN",
         lambda w: w['text'] == 'TRN',
         lambda w: w['text'] == 'TRN'),
        ("Company Line 4: Riyadh,",
         lambda w: w['text'] == 'Riyadh,',
         lambda w: w['text'] == 'Riyadh,'),
        ("Company Line 5: 0575287403",
         lambda w: w['text'] == '0575287403',
         lambda w: w['text'] == '0575287403'),
        ("Company Line 6: ad@arabseason",
         lambda w: w['text'] == 'ad@arabseason.net',
         lambda w: w['text'] == 'ad@arabseason.net'),
        ("Deliver To: Label",
         lambda w: w['text'] == 'Deliver' and 220 < w['top'] < 240,
         lambda w: w['text'] == 'Deliver' and 220 < w['top'] < 240),
        ("Deliver To: Party (Marwa)",
         lambda w: w['text'] == 'Marwa',
         lambda w: w['text'] == 'Marwa'),
        ("Meta: Challan Date :",
         lambda w: w['text'] == 'Date' and 210 < w['top'] < 230,
         lambda w: w['text'] == 'Date' and 210 < w['top'] < 230),
        ("Meta: 15 Oct 2026",
         lambda w: w['text'] == '15' and 210 < w['top'] < 230,
         lambda w: w['text'] == '15' and 210 < w['top'] < 230),
        ("Meta: Challan Type :",
         lambda w: w['text'] == 'Type' and 230 < w['top'] < 250,
         lambda w: w['text'] == 'Type' and 230 < w['top'] < 250),
        ("Meta: Others",
         lambda w: w['text'] == 'Others',
         lambda w: w['text'] == 'Others'),
        ("Table Header: #",
         lambda w: w['text'] == '#' and 260 < w['top'] < 285,
         lambda w: w['text'] == '#' and 260 < w['top'] < 285),
        ("Table Header: Item",
         lambda w: w['text'] == 'Item',
         lambda w: w['text'] == 'Item'),
        ("Table Header: Qty",
         lambda w: w['text'] == 'Qty',
         lambda w: w['text'] == 'Qty'),
        ("Table Header: Rate",
         lambda w: w['text'] == 'Rate' and 260 < w['top'] < 285,
         lambda w: w['text'] == 'Rate' and 260 < w['top'] < 285),
        ("Table Header: Amount",
         lambda w: w['text'] == 'Amount' and 260 < w['top'] < 285,
         lambda w: w['text'] == 'Amount' and 260 < w['top'] < 285),
        ("Item 1: # (1)",
         lambda w: w['text'] == '1' and 290 < w['top'] < 315,
         lambda w: w['text'] == '1' and 290 < w['top'] < 315),
        ("Item 1: Banner",
         lambda w: w['text'] == 'Banner',
         lambda w: w['text'] == 'Banner'),
        ("Item 1: printing",
         lambda w: w['text'] == 'printing',
         lambda w: w['text'] == 'printing'),
        ("Item 1: Forex",
         lambda w: w['text'] == 'Forex',
         lambda w: w['text'] == 'Forex'),
        ("Item 1: Qty (1.00)",
         lambda w: w['text'] == '1.00',
         lambda w: w['text'] == '1.00'),
        ("Item 1: Rate (150.00)",
         lambda w: w['text'] == '150.00' and 290 < w['top'] < 315 and w['x0'] < 500,
         lambda w: w['text'] == '150.00' and 290 < w['top'] < 315 and w['x0'] < 500),
        ("Item 1: Amount (150.00)",
         lambda w: w['text'] == '150.00' and 290 < w['top'] < 315 and w['x0'] > 500,
         lambda w: w['text'] == '150.00' and 290 < w['top'] < 315 and w['x0'] > 500),
        ("Sub Total: Label",
         lambda w: w['text'] == 'Sub',
         lambda w: w['text'] == 'Sub'),
        ("Sub Total: Value (150.00)",
         lambda w: w['text'] == '150.00' and 330 < w['top'] < 350,
         lambda w: w['text'] == '150.00' and 330 < w['top'] < 350),
        ("Total: Label",
         lambda w: w['text'] == 'Total' and 355 < w['top'] < 375,
         lambda w: w['text'] == 'Total' and 355 < w['top'] < 375),
        ("Total: Value (150.00)",
         lambda w: w['text'] == '150.00' and 355 < w['top'] < 375,
         lambda w: w['text'] == '150.00' and 355 < w['top'] < 375),
        ("Total In Words: Label",
         lambda w: w['text'] == 'Words:',
         lambda w: w['text'] == 'Words:'),
        ("Total In Words: Saudi",
         lambda w: w['text'] == 'Saudi',
         lambda w: w['text'] == 'Saudi'),
        ("Total In Words: Fifty",
         lambda w: w['text'] == 'Fifty',
         lambda w: w['text'] == 'Fifty'),
        ("Signature: Authorized",
         lambda w: w['text'] == 'Authorized',
         lambda w: w['text'] == 'Authorized'),
        ("Signature: Signature",
         lambda w: w['text'] == 'Signature',
         lambda w: w['text'] == 'Signature'),
        ("Footer: Page Number (1)",
         lambda w: w['text'] == '1' and w['top'] > 790,
         lambda w: w['text'] == '1' and w['top'] > 790),
    ]

    print(f"{'PHRASE / ELEMENT':<28} | {'REF (x0, top, sz, font)':<35} | {'MIG (x0, top, sz, font)':<35} | {'DELTA (dx, dy)':<15} | STATUS")
    print("=" * 130)

    passed_count = 0
    total_count = len(elements_to_verify)
    delta_gt_1 = []

    for label, r_filter, m_filter in elements_to_verify:
        r_w = match_element(r_words, r_filter)
        m_w = match_element(m_words, m_filter)

        if r_w and m_w:
            dx = m_w['x0'] - r_w['x0']
            dy = m_w['top'] - r_w['top']
            r_font = r_w['fontname'].split('+')[-1]
            m_font = m_w['fontname'].split('+')[-1]
            
            # Map Ubuntu-Regular to Ubuntu for equality comparison
            r_weight = "Bold" if "Bold" in r_font else "Regular"
            m_weight = "Bold" if "Bold" in m_font else "Regular"
            font_ok = (r_weight == m_weight) and ("Ubuntu" in m_font)
            
            r_info = f"({r_w['x0']:5.1f}, {r_w['top']:5.1f}, {r_w['size']:4.1f}, {r_font})"
            m_info = f"({m_w['x0']:5.1f}, {m_w['top']:5.1f}, {m_w['size']:4.1f}, {m_font})"
            d_info = f"dx={dx:+5.1f}, dy={dy:+5.1f}"

            err = max(abs(dx), abs(dy))
            if err > 1.0:
                delta_gt_1.append((label, err, dx, dy))

            coord_ok = abs(dx) <= 1.5 and abs(dy) <= 1.5
            ok = coord_ok and font_ok

            if ok:
                passed_count += 1
                status = "PASS (<=1.5pt & font)"
            else:
                reasons = []
                if not coord_ok: reasons.append(f"coord_err={err:.2f}pt")
                if not font_ok: reasons.append(f"font_mismatch({r_font} vs {m_font})")
                status = f"FAIL ({', '.join(reasons)})"

            print(f"{label:<28} | {r_info:<35} | {m_info:<35} | {d_info:<15} | {status}")
        else:
            print(f"{label:<28} | NOT MATCHED")

    print("=" * 130)
    print(f"Summary: {passed_count}/{total_count} elements passed tolerance <= 1.5 pt and font match.")
    print(f"Elements with delta > 1.0 pt: {len(delta_gt_1)}")
    for item in delta_gt_1:
        print(f"  - {item[0]}: max_delta={item[1]:.2f} pt (dx={item[2]:+.2f}, dy={item[3]:+.2f})")
