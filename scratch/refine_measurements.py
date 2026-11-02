with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix totals_rows and colWidths in build_reference_totals
old_totals_block = """        totals_rows = []
        if sub_total is not None:
            totals_rows.append([
                '', '',
                Paragraph('Sub Total', ParagraphStyle('SubTLbl', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY)),
                Paragraph(str(sub_total), ParagraphStyle('SubTVal', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))
            ])

        if extra_lines:
            for el_label, el_val in extra_lines:
                if not el_val or str(el_val).strip() in ('', '-', '0', '0.00'):
                    continue
                totals_rows.append([
                    '', '',
                    Paragraph(el_label, ParagraphStyle('ExTLbl', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY)),
                    Paragraph(str(el_val), ParagraphStyle('ExTVal', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))
                ])

        # Total warm-gray band
        total_lbl = Paragraph('<b>Total</b>', ParagraphStyle('TotLbl', fontName=font_bold, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))
        val_p = Paragraph(f'<b>{total}</b>', ParagraphStyle('TotVal', fontName=font_bold, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))

        if sar_icon:
            val_cell = Table([[sar_icon, val_p]], colWidths=[10, doc_width * 0.25 - 10])
            val_cell.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
        else:
            val_cell = Paragraph(f'<b>SAR {total}</b>', ParagraphStyle('TotValSar', fontName=font_bold, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))

        totals_rows.append(['', '', total_lbl, val_cell])

        band_row_idx = len(totals_rows) - 1
        totals_table = Table(totals_rows, colWidths=[doc_width * 0.25, doc_width * 0.25, doc_width * 0.25, doc_width * 0.25])
        totals_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('BACKGROUND', (2, band_row_idx), (3, band_row_idx), self.COLOR_TOTAL_BG),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
        ]))"""

new_totals_block = """        totals_rows = []
        if sub_total is not None:
            totals_rows.append([
                '',
                Paragraph('Sub Total', ParagraphStyle('SubTLbl', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY)),
                Paragraph(str(sub_total), ParagraphStyle('SubTVal', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))
            ])

        if extra_lines:
            for el_label, el_val in extra_lines:
                if not el_val or str(el_val).strip() in ('', '-', '0', '0.00'):
                    continue
                totals_rows.append([
                    '',
                    Paragraph(el_label, ParagraphStyle('ExTLbl', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY)),
                    Paragraph(str(el_val), ParagraphStyle('ExTVal', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))
                ])

        # Total warm-gray band
        total_lbl = Paragraph('<b>Total</b>', ParagraphStyle('TotLbl', fontName=font_bold, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))
        val_p = Paragraph(f'<b>{total}</b>', ParagraphStyle('TotVal', fontName=font_bold, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))

        if sar_icon:
            val_cell = Table([[sar_icon, val_p]], colWidths=[10, 91.25])
            val_cell.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
        else:
            val_cell = Paragraph(f'<b>SAR {total}</b>', ParagraphStyle('TotValSar', fontName=font_bold, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_PRIMARY))

        totals_rows.append(['', total_lbl, val_cell])

        band_row_idx = len(totals_rows) - 1
        totals_table = Table(totals_rows, colWidths=[257.5, 156.3, 101.2])
        totals_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('BACKGROUND', (1, band_row_idx), (2, band_row_idx), self.COLOR_TOTAL_BG),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
        ]))"""

# 2. Fix words table widths
old_words = "words_table = Table(words_data, colWidths=[doc_width * 0.65, doc_width * 0.35])"
new_words = "words_table = Table(words_data, colWidths=[385, 130])"

# 3. Fix sig_table alignment
old_sig1 = "sig_table = Table(sig_data, colWidths=[105, 160])"
new_sig1 = "sig_table = Table(sig_data, colWidths=[101, 150], hAlign='LEFT')"

old_sig2 = "sig_table = Table(sig_data, colWidths=[105, 150, 105, 150])"
new_sig2 = "sig_table = Table(sig_data, colWidths=[101, 150, 105, 150], hAlign='LEFT')"

code = code.replace(old_totals_block, new_totals_block)
code = code.replace(old_words, new_words)
code = code.replace(old_sig1, new_sig1)
code = code.replace(old_sig2, new_sig2)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated measurements successfully")

