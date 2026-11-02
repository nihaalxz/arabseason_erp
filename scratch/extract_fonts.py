import fitz

doc = fitz.open('design-reference/DC-00002.pdf')
for f in doc[0].get_fonts():
    xref = f[0]
    font_name = f[3]
    try:
        res = doc.extract_font(xref)
        basename, ext, ftype, buf = res
        clean_name = basename.split('+')[-1]
        out_path = f'design-reference/{clean_name}.{ext}'
        with open(out_path, 'wb') as fp:
            fp.write(buf)
        print(f'Extracted font {basename} -> {out_path} ({len(buf)} bytes)')
    except Exception as e:
        print('Error extracting font:', e)

doc.close()
