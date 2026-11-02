import re

pdf_gen_path = 'backend/api/pdf_generator.py'
with open(pdf_gen_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Let's add the shared methods right after _setup_styles
target = "        styles['TableCellNumber'] = ParagraphStyle(\n            'TableCellNumber',\n            fontName='Helvetica-Bold',\n            fontSize=8,\n            leading=10,\n            alignment=2,\n            textColor=self.COLOR_PRIMARY\n        )\n\n        return styles"
if target not in code:
    target = target.replace('\n', '\r\n')

shared_methods = '''

    # ══════════════════════════════════════════════════════════════════════
    # SHARED REFERENCE LAYOUT COMPONENTS (STRICTLY MATCHING DC-00002.pdf)
    # ══════════════════════════════════════════════════════════════════════

    def build_reference_header(self, doc_width, title, doc_number):
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
        company_lines = [
            f'<font name="{FONTS.get("AppFont-Bold", "Helvetica-Bold")}" size="10" color="#333333">{legal_name}</font>',
            f'<font name="{FONTS.get("AppFont", "Helvetica")}" size="9" color="#333333">{legal_name}</font>',
            f'<font name="{FONTS.get("AppFont", "Helvetica")}" size="9" color="#333333">TRN {settings.get("tax_number", "301374966800003")}</font>',
            f'<font name="{FONTS.get("AppFont", "Helvetica")}" size="9" color="#333333">{settings.get("address", "Riyadh, KSA")}</font>',
            f'<font name="{FONTS.get("AppFont", "Helvetica")}" size="9" color="#333333">{settings.get("phone", "0575287403")}</font>',
            f'<font name="{FONTS.get("AppFont", "Helvetica")}" size="9" color="#333333">{settings.get("email", "ad@arabseason.net")} - {settings.get("website", "www.arabseason.com")}</font>'
        ]
        left_flowables.append(Spacer(1, 4))
        left_flowables.append(Paragraph("<br/>".join(company_lines), ParagraphStyle('CompBlockRef', fontName=FONTS.get('AppFont', 'Helvetica'), fontSize=9, leading=10.5, textColor=self.COLOR_TEXT_DARK)))

        # Right: Title (28pt Light uppercase, split cleanly if multiple words) + Doc Number
        t_clean = (title or '').strip().upper()
        t_words = t_clean.split(' ')
        if len(t_words) == 2:
            title_html = f"{t_words[0]}<br/>{t_words[1]}"
        elif len(t_words) > 2 and len(t_clean) > 14:
            mid = len(t_words) // 2
            title_html = f"{' '.join(t_words[:mid])}<br/>{' '.join(t_words[mid:])}"
        else:
            title_html = t_clean

        font_light = FONTS.get('AppFont-Light', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('AppFont-Bold', 'Helvetica-Bold')

        right_flowables = [
            Paragraph(f'<font name="{font_light}" size="28" color="#000000">{title_html}</font>', ParagraphStyle('DocTitleRef', fontName=font_light, fontSize=28, leading=30, alignment=2, textColor=self.COLOR_TEXT_PRIMARY)),
            Spacer(1, 6),
            Paragraph(f'<font name="{font_bold}" size="10" color="#333333">{doc_number}</font>', ParagraphStyle('DocNumRef', fontName=font_bold, fontSize=10, leading=12, alignment=2, textColor=self.COLOR_TEXT_DARK))
        ]

        hdr_table = Table([[left_flowables, right_flowables]], colWidths=[doc_width * 0.55, doc_width * 0.45])
        hdr_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        return hdr_table

    def build_reference_party_and_meta(self, doc_width, party_label, party_name, party_subtext=None, meta_pairs=None):
        """
        Unboxed party on left; unboxed label-value pairs on right.
        Omit any meta row or party row if value is empty or '-'.
        """
        font_reg = FONTS.get('AppFont', 'Helvetica')
        font_bold = FONTS.get('AppFont-Bold', 'Helvetica-Bold')

        # Left side: party
        left_lines = []
        if party_label:
            left_lines.append(f'<font name="{font_reg}" size="10" color="#333333">{party_label}</font>')
        if party_name and str(party_name).strip() not in ('', '-', 'None', 'null', 'N/A'):
            left_lines.append(f'<font name="{font_bold}" size="9" color="#333333">{party_name}</font>')
        if party_subtext and str(party_subtext).strip() not in ('', '-', 'None', 'null', 'N/A'):
            clean_sub = str(party_subtext).replace('\n', '<br/>')
            left_lines.append(f'<font name="{font_reg}" size="9" color="#727272">{clean_sub}</font>')

        left_p = Paragraph("<br/>".join(left_lines), ParagraphStyle('PartyPRef', fontName=font_reg, leading=12)) if left_lines else Paragraph('', self.styles['Normal'])

        # Right side: meta pairs
        meta_rows = []
        if meta_pairs:
            for lbl, val in meta_pairs:
                if not val or str(val).strip() in ('', '-', 'None', 'null', 'N/A'):
                    continue
                meta_rows.append([
                    Paragraph(f'<font name="{font_reg}" size="10" color="#333333">{lbl} :</font>', ParagraphStyle('MLRef', fontName=font_reg, fontSize=10, leading=12, alignment=0, textColor=self.COLOR_TEXT_DARK)),
                    Paragraph(f'<font name="{font_reg}" size="9" color="#333333">{val}</font>', ParagraphStyle('MVRef', fontName=font_reg, fontSize=9, leading=12, alignment=2, textColor=self.COLOR_TEXT_DARK))
                ])

        if meta_rows:
            meta_table = Table(meta_rows, colWidths=[doc_width * 0.22, doc_width * 0.23])
            meta_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]))
            right_content = meta_table
        else:
            right_content = Paragraph('', self.styles['Normal'])

        party_table = Table([[left_p, right_content]], colWidths=[doc_width * 0.55, doc_width * 0.45])
        party_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        return party_table

    def build_reference_items_table(self, doc_width, columns, rows, col_widths=None):
        """
        Charcoal header #3c3d3a, white text, clean rows with thin bottom divider #adadad,
        comfortable padding, repeatRows=1, never splits a row.
        columns: list of (header_title, align) e.g. [('#', 'center'), ('Item & Description', 'left'), ...]
        """
        font_reg = FONTS.get('AppFont', 'Helvetica')

        if not col_widths:
            num_cols = len(columns)
            col_widths = [doc_width / num_cols] * num_cols

        header_cells = []
        for title, align in columns:
            align_code = 1 if align == 'center' else (2 if align == 'right' else 0)
            th_style = ParagraphStyle(f'TH_{title}_{align}', fontName=font_reg, fontSize=9, textColor=self.COLOR_WHITE, leading=11, alignment=align_code)
            header_cells.append(Paragraph(title, th_style))

        table_data = [header_cells]
        for row in rows:
            formatted_row = []
            for cell_val in row:
                if isinstance(cell_val, _ReportLabParagraph) or hasattr(cell_val, 'draw'):
                    formatted_row.append(cell_val)
                else:
                    formatted_row.append(Paragraph(str(cell_val or ''), ParagraphStyle('TCellDef', fontName=font_reg, fontSize=9, leading=11, textColor=self.COLOR_TEXT_PRIMARY)))
            table_data.append(formatted_row)

        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), self.COLOR_HEADER_BG),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,1), (-1,-1), 7.5),
            ('BOTTOMPADDING', (0,1), (-1,-1), 7.5),
            ('LINEBELOW', (0,1), (-1,-1), 0.75, self.COLOR_BORDER),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        return items_table

    def build_reference_totals(self, doc_width, sub_total, total, words_text=None, extra_lines=None, show_sar_symbol=True):
        """
        Right-aligned stack:
        Sub Total (regular)
        Optional extra lines (Discount, VAT 15%, etc.)
        Total band (warm-gray #f5f4f3 with bold Total and bold Amount with SAR glyph)
        Total In Words below it
        """
        font_reg = FONTS.get('AppFont', 'Helvetica')
        font_bold = FONTS.get('AppFont-Bold', 'Helvetica-Bold')

        sar_icon_path = self._resolve_sar_symbol_path()
        sar_icon = Image(sar_icon_path, width=6, height=7) if (sar_icon_path and show_sar_symbol) else None

        totals_rows = []
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
        ]))

        flowables = [totals_table]

        if words_text:
            words_data = [
                [
                    Paragraph('Total In Words:', ParagraphStyle('TWLRef', fontName=font_reg, fontSize=9, leading=11, alignment=2, textColor=self.COLOR_TEXT_DARK)),
                    Paragraph(f'<b><i>{words_text}</i></b>', ParagraphStyle('TWVRef', fontName=font_bold, fontSize=9, leading=11, alignment=0, textColor=self.COLOR_TEXT_DARK))
                ]
            ]
            words_table = Table(words_data, colWidths=[doc_width * 0.65, doc_width * 0.35])
            words_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 4),
                ('RIGHTPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]))
            flowables.append(Spacer(1, 4))
            flowables.append(words_table)

        return KeepTogether(flowables)

    def build_reference_signatures_and_notes(self, doc_width, notes=None, signature_style='single'):
        \"\"\"
        Notes / terms text below totals in small gray text.
        One 'Authorized Signature _______________' line at bottom-left (or double for payment/salary).
        Reports get no signature line.
        \"\"\"
        font_reg = FONTS.get('AppFont', 'Helvetica')
        flowables = []

        if notes and str(notes).strip() not in ('', '-', 'None', 'null'):
            clean_notes = str(notes).strip()
            flowables.append(Paragraph(f'<font name="{font_reg}" size="8" color="#727272"><b>Notes:</b> {clean_notes}</font>', ParagraphStyle('NotesRef', fontName=font_reg, fontSize=8, leading=11, textColor=self.COLOR_TEXT_MUTED)))
            flowables.append(Spacer(1, 14))

        if signature_style == 'single':
            sig_line = HRFlowable(width=150, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph(f'<font name="{font_reg}" size="10" color="#333333">Authorized Signature</font>', ParagraphStyle('SigLRef', fontName=font_reg, fontSize=10, leading=12, textColor=self.COLOR_TEXT_DARK)),
                    sig_line
                ]
            ]
            sig_table = Table(sig_data, colWidths=[105, 160])
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)
        elif signature_style == 'double':
            sig_line1 = HRFlowable(width=140, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_line2 = HRFlowable(width=140, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph(f'<font name="{font_reg}" size="10" color="#333333">Authorized Signature</font>', ParagraphStyle('SigLRef1', fontName=font_reg, fontSize=10, leading=12, textColor=self.COLOR_TEXT_DARK)),
                    sig_line1,
                    Paragraph(f'<font name="{font_reg}" size="10" color="#333333">Receiver\'s Signature</font>', ParagraphStyle('SigLRef2', fontName=font_reg, fontSize=10, leading=12, textColor=self.COLOR_TEXT_DARK)),
                    sig_line2
                ]
            ]
            sig_table = Table(sig_data, colWidths=[105, 150, 105, 150])
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)

        return KeepTogether(flowables) if flowables else Spacer(1, 1)
'''

if target in code:
    code = code.replace(target, target + shared_methods)
    print("[OK] Injected shared reference layout methods")
else:
    print("[FAIL] target for styles return not found")

with open(pdf_gen_path, 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated pdf_generator.py")

