import os, sys

target_file = 'backend/api/pdf_generator.py'
with open(target_file, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Ensure ZATCA QR helper exists in UniversalPDFGenerator
zatca_helper = '''    def _build_zatca_qr_drawing(self, seller_name, vat_number, invoice_time, total_amount, vat_amount, size=65):
        """Generates a ZATCA Phase 1 compliant Base64 TLV QR Code as a ReportLab Drawing."""
        import base64
        from reportlab.graphics.barcode.qr import QrCodeWidget
        from reportlab.graphics.shapes import Drawing

        tags = [
            (1, str(seller_name).encode('utf-8')),
            (2, str(vat_number).encode('utf-8')),
            (3, str(invoice_time).encode('utf-8')),
            (4, f"{float(total_amount):.2f}".encode('utf-8')),
            (5, f"{float(vat_amount):.2f}".encode('utf-8'))
        ]
        tlv = bytearray()
        for tag, val in tags:
            tlv.append(tag)
            tlv.append(len(val))
            tlv.extend(val)
        b64_str = base64.b64encode(tlv).decode('ascii')

        qr = QrCodeWidget(b64_str)
        bounds = qr.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        d = Drawing(size, size, transform=[size/w, 0, 0, size/h, 0, 0])
        d.add(qr)
        return d
'''

if 'def _build_zatca_qr_drawing' not in code:
    idx_styles = code.find('    def _setup_styles(self):')
    code = code[:idx_styles] + zatca_helper + '\n' + code[idx_styles:]
    print("Added _build_zatca_qr_drawing helper.")

# 2. Update build_reference_signatures_and_notes to support 'internal' signature
old_sig_notes = '''        elif signature_style == 'double':'''
new_sig_notes = '''        elif signature_style == 'internal':
            flowables.append(Paragraph('<font name="' + font_reg + '" size="8" color="#727272"><b>INTERNAL CONFIDENTIAL RECORD</b> • For company administrative & audit review only.</font>', ParagraphStyle('IntConf', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#727272'))))
            flowables.append(Spacer(1, 10))
            sig_line = HRFlowable(width=160, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph("Approved By (Management)", ParagraphStyle('SigLInt', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line
                ]
            ]
            sig_table = Table(sig_data, colWidths=[140, 165], hAlign='LEFT')
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (0,0), 0),
                ('TOPPADDING', (1,0), (1,0), 7.41),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)
        elif signature_style == 'double':'''

if old_sig_notes in code and 'signature_style == \'internal\'' not in code:
    code = code.replace(old_sig_notes, new_sig_notes, 1)
    print("Updated build_reference_signatures_and_notes with internal style.")

# 3. Update build_reference_party_and_meta to strictly enforce the empty-field rule
old_party_meta_start = '''    def build_reference_party_and_meta(self, doc_width, party_label, party_name, party_subtext=None, meta_pairs=None):'''
idx_pm = code.find(old_party_meta_start)
idx_pm_end = code.find('    def build_reference_items_table', idx_pm)

new_party_meta = '''    def build_reference_party_and_meta(self, doc_width, party_label, party_name, party_subtext=None, meta_pairs=None):
        """
        Unboxed party on left; unboxed label-value pairs on right.
        Strict empty-field rule: Omit any row, line, or subtext if value is empty, '-', 'None', or 'N/A'.
        Never displays raw hyphens or empty labels to user.
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        party_lines = []
        if party_label:
            party_lines.append(f"<font size=10 color='#333333'>{party_label}</font>")
        if party_name and str(party_name).strip() not in ('', '-', 'None', 'null', 'N/A'):
            party_lines.append(f'<font name="{font_bold}" size="9"><b>{party_name}</b></font>')
        if party_subtext and str(party_subtext).strip() not in ('', '-', 'None', 'null', 'N/A'):
            # Filter individual subtext lines so no line is '-' or 'Tel: -'
            sub_raw = str(party_subtext).split('\\n')
            clean_lines = []
            for sl in sub_raw:
                s = sl.strip()
                if not s or s in ('-', 'None', 'null', 'N/A', 'Tel: -', 'Contact: -', 'Tel: - | Email: -'):
                    continue
                clean_lines.append(s)
            if clean_lines:
                clean_sub = '<br/>'.join(clean_lines)
                party_lines.append(f"<font size=9 color='#727272'>{clean_sub}</font>")

        party_p = Paragraph("<br/>".join(party_lines) if party_lines else "", ParagraphStyle('PRef', fontName=font_reg, fontSize=10, leading=11.31, textColor=colors.HexColor('#333333')))
        party_cell = [Spacer(1, 16.70), party_p]

        meta_rows = []
        if meta_pairs:
            for lbl, val in meta_pairs:
                if not val:
                    continue
                v_str = str(val).strip()
                if v_str in ('', '-', 'None', 'null', 'N/A', 'Tel: -', 'Contact: -'):
                    continue
                meta_rows.append([
                    Paragraph(f"{lbl} :", ParagraphStyle('ML', fontName=font_reg, fontSize=10, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
                    Paragraph(v_str, ParagraphStyle('MV', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#333333')))
                ])

        if meta_rows:
            rhs = [19.05] * 2 if len(meta_rows) == 2 else None
            meta_table = Table(meta_rows, colWidths=[140, 110], rowHeights=rhs)
            meta_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
            ]))
            meta_cell = meta_table
        else:
            meta_cell = Paragraph("", self.styles['Normal'])

        party_meta_table = Table([[party_cell, meta_cell]], colWidths=[265.03, doc_width - 265.03])
        party_meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        return party_meta_table
'''

code = code[:idx_pm] + new_party_meta + '\n' + code[idx_pm_end:]
print("Updated build_reference_party_and_meta with strict empty-field filter.")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved first round of updates.")
