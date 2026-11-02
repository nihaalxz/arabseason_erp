import pdfplumber

def match_element(words, filter_fn):
    candidates = [w for w in words if filter_fn(w)]
    return candidates[0] if candidates else None

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_tuned_pass.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]
    
    r_words = ref.extract_words(extra_attrs=['fontname', 'size'])
    m_words = mig.extract_words(extra_attrs=['fontname', 'size'])
    
    # Define exact filter for each element
    elements_to_verify = [
        # (Label, ref_filter, mig_filter)
        ("Doc Title Line 1 (DELIVERY)",
         lambda w: w['text'] == 'DELIVERY' and w['top'] < 100,
         lambda w: w['text'] == 'DELIVERY' and w['top'] < 100),
        
        ("Doc Title Line 2 (CHALLAN)",
         lambda w: w['text'] == 'CHALLAN' and w['top'] < 120,
         lambda w: w['text'] == 'CHALLAN' and w['top'] < 120),
        
        ("Doc Number: Delivery",
         lambda w: w['text'] == 'Delivery' and w['top'] > 120 and w['top'] < 140,
         lambda w: w['text'] == 'Delivery' and w['top'] > 120 and w['top'] < 140),
        
        ("Doc Number: Challan#",
         lambda w: w['text'] == 'Challan#' and w['top'] > 120 and w['top'] < 140,
         lambda w: w['text'] == 'Challan#' and w['top'] > 120 and w['top'] < 140),
        
        ("Doc Number: DC-00002",
         lambda w: w['text'] == 'DC-00002',
         lambda w: w['text'] == 'DC-00002'),
        
        ("Company Line 1: ALI",
         lambda w: w['text'] == 'ALI' and w['top'] > 110 and w['top'] < 120,
         lambda w: w['text'] == 'ALI' and w['top'] > 110 and w['top'] < 120),
        
        ("Company Line 1: Contracting",
         lambda w: w['text'] == 'Contracting' and w['top'] > 120 and w['top'] < 132,
         lambda w: w['text'] == 'Contracting' and w['top'] > 120 and w['top'] < 132),
        
        ("Company Line 2: ALI",
         lambda w: w['text'] == 'ALI' and w['top'] > 130 and w['top'] < 142,
         lambda w: w['text'] == 'ALI' and w['top'] > 130 and w['top'] < 142),
        
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
         lambda w: w['text'] == 'Deliver' and w['top'] > 220 and w['top'] < 240,
         lambda w: w['text'] == 'Deliver' and w['top'] > 220 and w['top'] < 240),
        
        ("Deliver To: Party Name (Marwa)",
         lambda w: w['text'] == 'Marwa',
         lambda w: w['text'] == 'Marwa'),
        
        ("Meta: Challan Date :",
         lambda w: w['text'] == 'Date' and w['top'] > 210 and w['top'] < 230,
         lambda w: w['text'] == 'Date' and w['top'] > 210 and w['top'] < 230),
        
        ("Meta: 15 Oct 2026",
         lambda w: w['text'] == '15' and w['top'] > 210 and w['top'] < 230,
         lambda w: w['text'] == '15' and w['top'] > 210 and w['top'] < 230),
        
        ("Meta: Challan Type :",
         lambda w: w['text'] == 'Type' and w['top'] > 230 and w['top'] < 250,
         lambda w: w['text'] == 'Type' and w['top'] > 230 and w['top'] < 250),
        
        ("Meta: Others",
         lambda w: w['text'] == 'Others',
         lambda w: w['text'] == 'Others'),
        
        ("Table Header: #",
         lambda w: w['text'] == '#' and w['top'] > 260 and w['top'] < 285,
         lambda w: w['text'] == '#' and w['top'] > 260 and w['top'] < 285),
        
        ("Table Header: Item",
         lambda w: w['text'] == 'Item',
         lambda w: w['text'] == 'Item'),
        
        ("Table Header: Qty",
         lambda w: w['text'] == 'Qty',
         lambda w: w['text'] == 'Qty'),
        
        ("Table Header: Rate",
         lambda w: w['text'] == 'Rate' and w['top'] > 260 and w['top'] < 285,
         lambda w: w['text'] == 'Rate' and w['top'] > 260 and w['top'] < 285),
        
        ("Table Header: Amount",
         lambda w: w['text'] == 'Amount' and w['top'] > 260 and w['top'] < 285,
         lambda w: w['text'] == 'Amount' and w['top'] > 260 and w['top'] < 285),
        
        ("Item 1: # (1)",
         lambda w: w['text'] == '1' and w['top'] > 290 and w['top'] < 315,
         lambda w: w['text'] == '1' and w['top'] > 290 and w['top'] < 315),
        
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
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 315 and w['x0'] < 500,
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 315 and w['x0'] < 500),
        
        ("Item 1: Amount (150.00)",
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 315 and w['x0'] > 500,
         lambda w: w['text'] == '150.00' and w['top'] > 290 and w['top'] < 315 and w['x0'] > 500),
        
        ("Sub Total: Label",
         lambda w: w['text'] == 'Sub',
         lambda w: w['text'] == 'Sub'),
        
        ("Sub Total: Value (150.00)",
         lambda w: w['text'] == '150.00' and w['top'] > 330 and w['top'] < 350,
         lambda w: w['text'] == '150.00' and w['top'] > 330 and w['top'] < 350),
        
        ("Total: Label",
         lambda w: w['text'] == 'Total' and w['top'] > 355 and w['top'] < 375,
         lambda w: w['text'] == 'Total' and w['top'] > 355 and w['top'] < 375),
        
        ("Total: Value (150.00)",
         lambda w: w['text'] == '150.00' and w['top'] > 355 and w['top'] < 375,
         lambda w: w['text'] == '150.00' and w['top'] > 355 and w['top'] < 375),
        
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
    print("=" * 125)
    
    passed_count = 0
    total_count = len(elements_to_verify)
    max_delta = 0.0
    
    for label, r_filter, m_filter in elements_to_verify:
        r_w = match_element(r_words, r_filter)
        m_w = match_element(m_words, m_filter)
        
        if r_w and m_w:
            dx = m_w['x0'] - r_w['x0']
            dy = m_w['top'] - r_w['top']
            r_info = f"({r_w['x0']:5.1f}, {r_w['top']:5.1f}, {r_w['size']:4.1f}, {r_w['fontname'].split('+')[-1]})"
            m_info = f"({m_w['x0']:5.1f}, {m_w['top']:5.1f}, {m_w['size']:4.1f}, {m_w['fontname'].split('+')[-1]})"
            d_info = f"dx={dx:+5.1f}, dy={dy:+5.1f}"
            
            err = max(abs(dx), abs(dy))
            if err > max_delta:
                max_delta = err
                
            ok = abs(dx) <= 1.5 and abs(dy) <= 1.5
            if ok:
                passed_count += 1
                status = "PASS (<=1.5pt)"
            else:
                status = f"FAIL (err={err:.2f}pt)"
                
            print(f"{label:<28} | {r_info:<35} | {m_info:<35} | {d_info:<15} | {status}")
        else:
            print(f"{label:<28} | NOT MATCHED (r={r_w is not None}, m={m_w is not None})")
            
    print("=" * 125)
    print(f"Summary: {passed_count}/{total_count} elements passed tolerance <= 1.5 pt. Max Delta = {max_delta:.2f} pt")

