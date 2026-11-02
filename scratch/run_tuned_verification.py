import pdfplumber

with pdfplumber.open('design-reference/DC-00002.pdf') as p_ref, pdfplumber.open('design-reference/output/test_zero_padding.pdf') as p_mig:
    ref = p_ref.pages[0]
    mig = p_mig.pages[0]
    
    r_words = ref.extract_words(extra_attrs=['fontname', 'size'])
    m_words = mig.extract_words(extra_attrs=['fontname', 'size'])
    
    print(f"{'PHRASE / ELEMENT':<28} | {'REF (x0, top, sz, font)':<35} | {'MIG (x0, top, sz, font)':<35} | {'DELTA (dx, dy)':<15} | STATUS")
    print("=" * 125)
    
    test_elements = [
        ('Doc Title Line 1 (DELIVERY)', 'DELIVERY', 0),
        ('Doc Title Line 2 (CHALLAN)', 'CHALLAN', 0),
        ('Doc Number: Delivery', 'Delivery', 1), # index 1: 'Delivery' in 'Delivery Challan# DC-00002'
        ('Doc Number: Challan#', 'Challan#', 0),
        ('Doc Number: DC-00002', 'DC-00002', 0),
        ('Company Line 1: ALI', 'ALI', 0),
        ('Company Line 1: Contracting', 'Contracting', 0),
        ('Company Line 2: ALI', 'ALI', 1),
        ('Company Line 3: TRN', 'TRN', 0),
        ('Company Line 4: Riyadh,', 'Riyadh,', 0),
        ('Company Line 5: 0575287403', '0575287403', 0),
        ('Company Line 6: ad@arabseason', 'ad@arabseason.net', 0),
        ('Deliver To: Label', 'Deliver', 0), # 'Deliver' in 'Deliver To'
        ('Deliver To: Party Name', 'Marwa', 0),
        ('Meta: Challan Date :', 'Date', 0),
        ('Meta: 15 Oct 2026', '15', 0),
        ('Meta: Challan Type :', 'Type', 0),
        ('Meta: Others', 'Others', 0),
        ('Table Header: #', '#', 0),
        ('Table Header: Item', 'Item', 0),
        ('Table Header: Qty', 'Qty', 0),
        ('Table Header: Rate', 'Rate', 0),
        ('Table Header: Amount', 'Amount', 0),
        ('Item 1: # (1)', '1', 1),
        ('Item 1: Banner', 'Banner', 0),
        ('Item 1: printing', 'printing', 0),
        ('Item 1: Forex', 'Forex', 0),
        ('Item 1: Qty (1.00)', '1.00', 0),
        ('Item 1: Rate (150.00)', '150.00', 0),
        ('Item 1: Amount (150.00)', '150.00', 1),
        ('Sub Total: Label', 'Sub', 0),
        ('Sub Total: Value (150.00)', '150.00', 2),
        ('Total: Label', 'Total', 1),
        ('Total: Value (150.00)', '150.00', 3),
        ('Total In Words: Label', 'Words:', 0),
        ('Total In Words: Saudi', 'Saudi', 0),
        ('Total In Words: Fifty', 'Fifty', 0),
        ('Signature: Authorized', 'Authorized', 0),
        ('Signature: Signature', 'Signature', 0),
        ('Footer: Page Number (1)', '1', 0),
    ]
    
    passed_count = 0
    total_count = 0
    max_delta = 0.0
    
    for label, text, occ in test_elements:
        r_matches = [w for w in r_words if text.lower() == w['text'].lower() or (len(text) > 4 and text.lower() in w['text'].lower())]
        m_matches = [w for w in m_words if text.lower() == w['text'].lower() or (len(text) > 4 and text.lower() in w['text'].lower())]
        
        r_w = r_matches[occ] if len(r_matches) > occ else (r_matches[0] if r_matches else None)
        m_w = m_matches[occ] if len(m_matches) > occ else (m_matches[0] if m_matches else None)
        
        if r_w and m_w:
            total_count += 1
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
                status = f"FAIL (err={err:.1f}pt)"
                
            print(f"{label:<28} | {r_info:<35} | {m_info:<35} | {d_info:<15} | {status}")
        else:
            print(f"{label:<28} | NOT MATCHED (r={r_w is not None}, m={m_w is not None})")
            
    print("=" * 125)
    print(f"Summary: {passed_count}/{total_count} elements passed tolerance <= 1.5 pt. Max Delta = {max_delta:.2f} pt")
