import fitz
import json

doc = fitz.open('design-reference/DC-00002.pdf')
page = doc[0]

print('=== PAGE RECT ===')
print(f'Width: {page.rect.width}, Height: {page.rect.height}')

print('\n=== DRAWINGS / RECTS ===')
drawings = page.get_drawings()
for i, d in enumerate(drawings):
    rect = [round(x, 2) for x in d.get('rect', [])]
    fill = d.get('fill')
    color = d.get('color')
    width = d.get('width')
    items = d.get('items', [])
    print(f'Drawing {i}: rect={rect}, fill={fill}, stroke={color}, width={width}, items_count={len(items)}')
    for it in items[:3]:
        print('   ', it)

print('\n=== IMAGES ON PAGE ===')
for img_info in page.get_images(full=True):
    xref = img_info[0]
    base_image = doc.extract_image(xref)
    print(f'Image xref {xref}: format {base_image["ext"]}, size {base_image["width"]}x{base_image["height"]}')
    # save image
    with open(f'design-reference/extracted_img_{xref}.{base_image["ext"]}', 'wb') as img_f:
        img_f.write(base_image['image'])

print('\n=== TEXT BLOCKS & SPANS ===')
blocks = page.get_text('dict')['blocks']
for b in blocks:
    if 'lines' in b:
        for line in b['lines']:
            for span in line['spans']:
                text = span['text']
                font = span['font']
                size = span['size']
                c = span['color']
                r = (c >> 16) & 255
                g = (c >> 8) & 255
                blue = c & 255
                hex_col = f'#{r:02x}{g:02x}{blue:02x}'
                bbox = [round(x, 2) for x in span['bbox']]
                print(f'{bbox} | {font:20s} | sz={size:5.2f} | {hex_col} | {repr(text)}')
    elif 'image' in b:
        print(f'Image block bbox: {[round(x, 2) for x in b["bbox"]]}')

doc.close()

