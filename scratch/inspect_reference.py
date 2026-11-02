import pdfplumber
import subprocess

print("=== PDF FONTS (REFERENCE) ===")
try:
    res = subprocess.run(["pdffonts", "design-reference/DC-00002.pdf"], capture_output=True, text=True)
    print(res.stdout)
except Exception as e:
    print("pdffonts CLI error:", e)

with pdfplumber.open('design-reference/DC-00002.pdf') as pdf:
    p0 = pdf.pages[0]
    print(f"Page dimensions: width={p0.width}, height={p0.height}")
    print("\n=== WORDS IN REFERENCE (top-left origin) ===")
    words = p0.extract_words(extra_attrs=['fontname', 'size'])
    for w in words:
        print(f"{w['text']:<32} | x0={w['x0']:6.2f}, top={w['top']:6.2f}, x1={w['x1']:6.2f}, bottom={w['bottom']:6.2f}, size={w['size']:4.1f}, font={w['fontname']}")

    print("\n=== RECTS IN REFERENCE ===")
    for r in p0.rects:
        print(f"Rect: x0={r['x0']:6.2f}, top={r['top']:6.2f}, x1={r['x1']:6.2f}, bottom={r['bottom']:6.2f}, w={r['width']:6.2f}, h={r['height']:6.2f}, fill={r.get('fill')}, non_stroking_color={r.get('non_stroking_color')}")

    print("\n=== LINES IN REFERENCE ===")
    for l in p0.lines:
        print(f"Line: x0={l['x0']:6.2f}, top={l['top']:6.2f}, x1={l['x1']:6.2f}, bottom={l['bottom']:6.2f}, stroke={l.get('stroke')}")

    print("\n=== IMAGES IN REFERENCE ===")
    for img in p0.images:
        print(f"Image: x0={img['x0']:6.2f}, top={img['top']:6.2f}, x1={img['x1']:6.2f}, bottom={img['bottom']:6.2f}, w={img['width']:6.2f}, h={img['height']:6.2f}")
