with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find start of build_reference_header and end of build_reference_signatures_and_notes
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if line.strip().startswith('def build_reference_header('):
        start_idx = i
    if start_idx is not None and line.strip().startswith('def build_doc_title_banner('):
        end_idx = i
        break

assert start_idx is not None and end_idx is not None, f"Could not find indices: {start_idx}, {end_idx}"

new_methods_code = '''    def build_reference_header(self, doc_width, title, doc_number):
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
        font_light = FONTS.get('Ubuntu-Light', FONTS.get('AppFont-Light', font_reg))

        comp_p1 = Paragraph(
            f"{legal_name}<br/>{legal_name}",
            ParagraphStyle('C1', fontName=font_bold, fontSize=10, leading=11.84, textColor=colors.HexColor('#333333'))
        )
        comp_p2 = Paragraph(
            f"TRN {tax_num}<br/>{addr}<br/>{phone}<br/>{email} - {web}",
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

        title_p = Paragraph(title_html, ParagraphStyle('TDel', fontName=font_light, fontSize=28, leading=32.25, alignment=2, textColor=colors.HexColor('#000000')))
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

    def build_reference_party_and_meta(self, doc_width, party_label, party_name, party_subtext=None, meta_pairs=None):
        """
        Unboxed party on left; unboxed label-value pairs on right.
        Omit any meta row or party row if value is empty or '-'.
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        party_lines = []
        if party_label:
            party_lines.append(f"<font size=10 color='#333333'>{party_label}</font>")
        if party_name and str(party_name).strip() not in ('', '-', 'None', 'null', 'N/A'):
            party_lines.append(f"<font size=9><b>{party_name}</b></font>")
        if party_subtext and str(party_subtext).strip() not in ('', '-', 'None', 'null', 'N/A'):
            clean_sub = str(party_subtext).replace('\\n', '<br/>')
            party_lines.append(f"<font size=9 color='#727272'>{clean_sub}</font>")

        party_p = Paragraph("<br/>".join(party_lines) if party_lines else "", ParagraphStyle('PRef', fontName=font_reg, fontSize=10, leading=11.31, textColor=colors.HexColor('#333333')))
        party_cell = [Spacer(1, 16.70), party_p]

        meta_rows = []
        if meta_pairs:
            for lbl, val in meta_pairs:
                if not val or str(val).strip() in ('', '-', 'None', 'null', 'N/A'):
                    continue
                meta_rows.append([
                    Paragraph(f"{lbl} :", ParagraphStyle('ML', fontName=font_reg, fontSize=10, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
                    Paragraph(str(val), ParagraphStyle('MV', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#333333')))
                ])

        if meta_rows:
            meta_table = Table(meta_rows, colWidths=[140, 110], rowHeights=[19.05] * len(meta_rows))
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
            ('LEFTPADDING', (0,0), (-1,-1), 0.75),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        return party_meta_table

    def build_reference_items_table(self, doc_width, columns, rows, col_widths=None):
        """
        Charcoal header #3c3d3a, white text, clean rows with thin bottom divider #adadad,
        comfortable padding, repeatRows=1, never splits a row.
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        if not col_widths:
            if len(columns) == 5:
                col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
            else:
                num_cols = len(columns)
                col_widths = [doc_width / num_cols] * num_cols

        header_cells = []
        for i, (title, align) in enumerate(columns):
            align_code = 1 if align == 'center' else (2 if align == 'right' else 0)
            th_style = ParagraphStyle(f'TH_{i}_{align}', fontName=font_bold, fontSize=9, textColor=colors.HexColor('#ffffff'), leading=10, alignment=align_code)
            header_cells.append(Paragraph(title, th_style))

        table_data = [header_cells]
        for row in rows:
            formatted_row = []
            for cell_val in row:
                if isinstance(cell_val, _ReportLabParagraph) or hasattr(cell_val, 'draw'):
                    formatted_row.append(cell_val)
                else:
                    formatted_row.append(Paragraph(str(cell_val or ''), ParagraphStyle('TCellDef', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))))
            table_data.append(formatted_row)

        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        t_style = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3c3d3a')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,0), 7.0),
            ('BOTTOMPADDING', (0,0), (-1,0), 7.0),
            ('LEFTPADDING', (0,0), (0,0), 2.1),
            ('RIGHTPADDING', (0,0), (0,-1), 0),
            ('LEFTPADDING', (1,0), (1,-1), 15.0),
            ('RIGHTPADDING', (1,0), (1,-1), 6.0),
            ('LEFTPADDING', (2,0), (-1,-1), 4.0),
            ('RIGHTPADDING', (2,0), (-1,-1), 6.5),
            ('TOPPADDING', (0,1), (-1,-1), 8.83),
            ('BOTTOMPADDING', (0,1), (-1,-1), 8.83),
            ('LINEBELOW', (0,1), (-1,-1), 0.75, colors.HexColor('#adadad')),
        ]
        items_table.setStyle(TableStyle(t_style))
        return items_table

    def build_reference_totals(self, doc_width, sub_total, total, words_text=None, extra_lines=None, show_sar_symbol=True):
        """
        Right-aligned stack:
        Sub Total (regular)
        Optional extra lines (Discount, VAT 15%, etc.)
        Total band (warm-gray #f5f4f3 with bold Total and bold Amount with SAR glyph)
        Total In Words below it
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        tot_lbl_style = ParagraphStyle('TL', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
        tot_val_style = ParagraphStyle('TV', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
        tot_lbl_b = ParagraphStyle('TLB', fontName=font_bold, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
        tot_val_b = ParagraphStyle('TVB', fontName=font_bold, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))

        sar_icon_path = self._resolve_sar_symbol_path()
        sar_icon = Image(sar_icon_path, width=5.96, height=6.75) if (sar_icon_path and show_sar_symbol and os.path.exists(sar_icon_path)) else None

        totals_rows = []
        if sub_total is not None:
            sub_str = f"{sub_total:,.2f}" if isinstance(sub_total, (int, float, Decimal)) else str(sub_total)
            totals_rows.append(['', Paragraph("Sub Total", tot_lbl_style), Paragraph(sub_str, tot_val_style)])

        if extra_lines:
            for el_label, el_val in extra_lines:
                if not el_val or str(el_val).strip() in ('', '-', '0', '0.00'):
                    continue
                v_str = f"{el_val:,.2f}" if isinstance(el_val, (int, float, Decimal)) else str(el_val)
                totals_rows.append(['', Paragraph(el_label, tot_lbl_style), Paragraph(v_str, tot_val_style)])

        tot_str = f"{total:,.2f}" if isinstance(total, (int, float, Decimal)) else str(total)
        total_lbl = Paragraph("Total", tot_lbl_b)

        if sar_icon:
            val_cell = Table([['', sar_icon, '', Paragraph(tot_str, tot_val_b)]], colWidths=[57.00, 5.96, 1.80, 36.49])
            val_cell.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (3,0), (3,0), 7.52),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
        else:
            val_cell = Paragraph(f"SAR {tot_str}", tot_val_b)

        totals_rows.append(['', total_lbl, val_cell])

        band_row_idx = len(totals_rows) - 1
        totals_table = Table(totals_rows, colWidths=[257.51, 156.27, 101.25], rowHeights=[25.38] * band_row_idx + [30.00])
        totals_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BACKGROUND', (1, band_row_idx), (2, band_row_idx), colors.HexColor('#f5f4f3')),
            ('RIGHTPADDING', (1,0), (1,-1), 7.52),
            ('RIGHTPADDING', (2,0), (2,0), 7.52),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))

        flowables = [totals_table]

        if words_text:
            words_data = [
                [
                    '',
                    Paragraph("Total In Words:", ParagraphStyle('TWL', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
                    Paragraph(words_text, ParagraphStyle('TWV', fontName=font_bold, fontSize=9, leading=10.66, alignment=0, textColor=colors.HexColor('#333333')))
                ]
            ]
            words_table = Table(words_data, colWidths=[316.91, 61.59, 136.53])
            words_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (2,0), (2,0), 7.93),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(Spacer(1, 8.83))
            flowables.append(words_table)

        return KeepTogether(flowables)

    def build_reference_signatures_and_notes(self, doc_width, notes=None, signature_style='single'):
        """
        Notes / terms text below totals in small gray text.
        One 'Authorized Signature _______________' line at bottom-left (or double for payment/salary).
        Reports get no signature line.
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        flowables = []

        if notes and str(notes).strip() not in ('', '-', 'None', 'null'):
            clean_notes = str(notes).strip()
            flowables.append(Paragraph(f'<font name="{font_reg}" size="8" color="#727272"><b>Notes:</b> {clean_notes}</font>', ParagraphStyle('NotesRef', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#727272'))))
            flowables.append(Spacer(1, 14))

        if signature_style == 'single':
            sig_line = HRFlowable(width=150, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph("Authorized Signature", ParagraphStyle('SigLRef', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line
                ]
            ]
            sig_table = Table(sig_data, colWidths=[100.61, 155], hAlign='LEFT')
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (0,0), 0),
                ('TOPPADDING', (1,0), (1,0), 7.41),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)
        elif signature_style == 'double':
            sig_line1 = HRFlowable(width=120, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_line2 = HRFlowable(width=120, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph("Authorized Signature", ParagraphStyle('SigL1', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line1,
                    Paragraph("Receiver's Signature", ParagraphStyle('SigL2', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line2
                ]
            ]
            sig_table = Table(sig_data, colWidths=[100, 130, 100, 130], hAlign='LEFT')
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (1,0), (1,0), 7.41),
                ('TOPPADDING', (3,0), (3,0), 7.41),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)

        return flowables

'''

lines[start_idx:end_idx] = [new_methods_code]

# Also update generate_delivery_note_pdf
start_dn = None
end_dn = None
for i, line in enumerate(lines):
    if line.strip().startswith('def generate_delivery_note_pdf('):
        start_dn = i
    if start_dn is not None and i > start_dn and line.startswith('    def '):
        end_dn = i
        break

new_dn_code = '''    def generate_delivery_note_pdf(self, delivery_note):
        """
        Generates an official clean-style Delivery Challan / Delivery Note PDF,
        strictly adhering to reference DC-00002.pdf.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header
        doc_num = delivery_note.delivery_note_number or f"DC-{delivery_note.id:05d}"
        header = self.build_reference_header(doc_width, "DELIVERY CHALLAN", f"Delivery Challan# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta Block
        cust = delivery_note.customer
        cust_name = cust.name if cust else "N/A"

        deliv_date = format_doc_date(delivery_note.delivery_date or delivery_note.dispatch_date)
        meta_pairs = [
            ("Challan Date", deliv_date),
            ("Challan Type", delivery_note.shipping_method or delivery_note.status or "Others")
        ]
        if delivery_note.customer_po_number:
            meta_pairs.append(("Customer PO #", delivery_note.customer_po_number))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Deliver To",
            party_name=cust_name,
            party_subtext=delivery_note.delivery_address if delivery_note.delivery_address and delivery_note.delivery_address != cust_name else None,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = list(delivery_note.items.all().order_by('sort_order', 'id'))
        col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Rate", "right"),
            ("Amount", "right")
        ]

        table_rows = []
        sub_total = Decimal('0.00')
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        for idx, itm in enumerate(items, 1):
            qty = float(itm.quantity or 0)
            rate = float(itm.unit_price or 0)
            amt = float(itm.total or (qty * rate))
            sub_total += Decimal(str(amt))

            desc_text = str(itm.description or '').strip()
            desc_parts = [p.strip() for p in desc_text.split('\\n') if p.strip()]
            if len(desc_parts) > 1:
                desc_html = f'<font name="{font_reg}" color="#333333" size="9">{desc_parts[0]}</font><br/><font name="{font_reg}" color="#727272" size="9">{"<br/>".join(desc_parts[1:])}</font>'
            elif desc_parts:
                desc_html = f'<font name="{font_reg}" color="#333333" size="9">{desc_parts[0]}</font>'
            else:
                desc_html = f'<font name="{font_reg}" color="#727272" size="9">-</font>'

            table_rows.append([
                str(idx),
                Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                f"{qty:.2f}",
                f"{rate:,.2f}",
                f"{amt:,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        total_val = float(delivery_note.total_amount or sub_total)
        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=float(sub_total),
            total=total_val,
            words_text=words_text,
            show_sar_symbol=True
        )

        # 5. Signatures and Notes
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=delivery_note.notes,
            signature_style='single'
        )

        bottom_stack = [totals_block, Spacer(1, 23.00)] + sigs
        elements.append(KeepTogether(bottom_stack))

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_data = buffer.getvalue()
        buffer.close()
        return pdf_data

'''

lines[start_dn:end_dn] = [new_dn_code]

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Applied reference methods and generate_delivery_note_pdf cleanly!")

