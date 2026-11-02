with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace build_reference_header implementation
old_header_start = text.find('    def build_reference_header(')
old_header_end = text.find('    def build_reference_party_and_meta(')

new_header = '''    def build_reference_header(self, doc_width, title, doc_number):
        """
        Reference Header layout (matching DC-00002.pdf):
        Top-Left: Logo (colored wordmark, 177x54) + Company Block
        Top-Right: Document Title (28pt Light uppercase) + Document Number (10pt Bold)
        """
        settings = self._get_site_settings()
        logo_path = self._resolve_logo_path()

        left_flowables = []
        if logo_path and os.path.exists(logo_path):
            try:
                left_flowables.append(Image(logo_path, width=177, height=54))
            except Exception:
                pass

        legal_name = settings.get("legal_name") or "ALI MOHAMMED MOTAH Establishment For Contracting"
        tax_num = settings.get("tax_number", "301374966800003")
        addr = settings.get("address", "Riyadh, KSA")
        phone = settings.get("phone", "0575287403")
        email = settings.get("email", "ad@arabseason.net")
        web = settings.get("website", "www.arabseason.com")

        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        if len(legal_name) > 30 and ' ' in legal_name:
            last_space = legal_name.rfind(' ')
            comp_p1_text = f"{legal_name[:last_space]}<br/>{legal_name[last_space+1:]}"
        else:
            comp_p1_text = legal_name

        comp_p1 = Paragraph(
            comp_p1_text,
            ParagraphStyle('C1', fontName=font_bold, fontSize=10, leading=11.84, textColor=colors.HexColor('#333333'))
        )
        comp_p2 = Paragraph(
            f"{legal_name}<br/>"
            f"TRN {tax_num}<br/>"
            f"{addr}<br/>"
            f"{phone}<br/>"
            f"{email} - {web}",
            ParagraphStyle('C2', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))
        )
        left_flowables.extend([Spacer(1, 3.21), comp_p1, comp_p2])

        # Right: Title + Number
        t_clean = (title or '').strip().upper()
        t_words = t_clean.split(' ')
        if len(t_words) == 2:
            title_html = f"{t_words[0]}&nbsp;<br/>{t_words[1]}"
        elif len(t_words) > 2 and len(t_clean) > 14:
            mid = len(t_words) // 2
            title_html = f"{' '.join(t_words[:mid])}&nbsp;<br/>{' '.join(t_words[mid:])}"
        else:
            title_html = t_clean

        title_p = Paragraph(title_html, ParagraphStyle('TDel', fontName=font_reg, fontSize=28, leading=32.25, alignment=2, textColor=colors.HexColor('#000000')))
        docnum_p = Paragraph(doc_number, ParagraphStyle('TNum', fontName=font_bold, fontSize=10, leading=12, alignment=2, textColor=colors.HexColor('#333333')))
        right_flowables = [Spacer(1, 0.4), title_p, Spacer(1, 1.59), docnum_p]

        hdr_table = Table([[left_flowables, right_flowables]], colWidths=[280, doc_width - 280])
        hdr_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (0,0), 0.75),
            ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        return hdr_table

'''

text = text[:old_header_start] + new_header + text[old_header_end:]

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated build_reference_header in pdf_generator.py successfully")

