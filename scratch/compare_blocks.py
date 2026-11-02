import fitz

def dump_spans(pdf_path):
    doc = fitz.open(pdf_path)
    spans = []
    for b in doc[0].get_text('dict')['blocks']:
        if 'lines' in b:
            for l in b['lines']:
                for s in l['spans']:
                    spans.append((round(s['bbox'][0], 1), round(s['bbox'][1], 1), round(s['size'], 1), s['text'].strip()))
    doc.close()
    return spans

ref_spans = dump_spans('design-reference/DC-00002.pdf')
rep_spans = dump_spans('design-reference/output/DC-00002_migrated.pdf')

print(f"{'TEXT':<30} | {'REF (x, y, size)':<20} | {'REP (x, y, size)':<20}")
print("-" * 75)
for t, rx, ry, rsz in [(s[3], s[0], s[1], s[2]) for s in ref_spans if s[3]]:
    # find matching in rep
    match = [m for m in rep_spans if t.lower() in m[3].lower() or m[3].lower() in t.lower()]
    if match:
        mx, my, msz, mt = match[0]
        print(f"{t[:30]:<30} | ({rx:5.1f}, {ry:5.1f}, {rsz:4.1f}) | ({mx:5.1f}, {my:5.1f}, {msz:4.1f})")
    else:
        print(f"{t[:30]:<30} | ({rx:5.1f}, {ry:5.1f}, {rsz:4.1f}) | NOT FOUND")
