with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = None
end_idx = None

for i, l in enumerate(lines):
    if l.startswith('    def generate_delivery_note_pdf('):
        start_idx = i
    elif start_idx is not None and l.startswith('    def _build_enquiry_attachment_flowable('):
        end_idx = i
        break

print(f"Found generate_delivery_note_pdf from line {start_idx+1} to {end_idx+1}")

new_func = '''    def generate_delivery_note_pdf(self, delivery_note):
        """
        Generates an official clean-style Delivery Challan / Delivery Note PDF,
        strictly adhering to reference DC-00002.pdf.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.LEFT_MARGIN,
            rightMargin=self.RIGHT_MARGIN,
            topMargin=57.15,
            bottomMargin=65.0
        )
        doc_width = self.DOC_WIDTH
        elements = []

        # 1. Header (Top-Left Logo + Company, Top-Right DELIVERY CHALLAN + Delivery Challan# ...)
        doc_num = delivery_note.delivery_note_number or f"DC-{delivery_note.id:05d}"
        header = self.build_reference_header(doc_width, "DELIVERY CHALLAN", f"Delivery Challan# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 26))

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
        elements.append(Spacer(1, 18))

        # 3. Items Table
        items = list(delivery_note.items.all().order_by('sort_order', 'id'))
        col_widths = [26, 274, 57, 57, 101]
        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Rate", "right"),
            ("Amount", "right")
        ]

        table_rows = []
        sub_total = Decimal('0.00')
        font_reg = FONTS.get('AppFont', 'Helvetica')

        for idx, itm in enumerate(items, 1):
            qty = float(itm.quantity or 0)
            rate = float(itm.unit_price or 0)
            amt = float(itm.total or (qty * rate))
            sub_total += Decimal(str(amt))

            desc_text = str(itm.description or '').strip()
            desc_parts = [p.strip() for p in desc_text.split('\\n') if p.strip()]
            if len(desc_parts) > 1:
                desc_html = f'<font name="{font_reg}" color="#727272" size="9">{desc_parts[0]}</font><br/><font name="{font_reg}" color="#727272" size="9">{"<br/>".join(desc_parts[1:])}</font>'
            elif desc_parts:
                desc_html = f'<font name="{font_reg}" color="#727272" size="9">{desc_parts[0]}</font>'
            else:
                desc_html = f'<font name="{font_reg}" color="#727272" size="9">-</font>'

            table_rows.append([
                Paragraph(str(idx), self.styles['TableCellCenter']),
                Paragraph(desc_html, ParagraphStyle('DescCell', fontName=font_reg, leading=10.5)),
                Paragraph(f"{qty:,.2f}", self.styles['TableCellRight']),
                Paragraph(f"{rate:,.2f}", self.styles['TableCellRight']),
                Paragraph(f"{amt:,.2f}", self.styles['TableCellRight']),
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 10))

        # 4. Totals Block
        total_float = float(sub_total)
        words = self.number_to_words(total_float)
        if words.endswith(" Only"):
            words = words[:-5]
        if not words.startswith("Saudi Riyal"):
            words = f"Saudi Riyal {words}"

        totals_flowable = self.build_reference_totals(
            doc_width,
            sub_total=f"{total_float:,.2f}",
            total=f"{total_float:,.2f}",
            words_text=words
        )
        elements.append(totals_flowable)
        elements.append(Spacer(1, 30))

        # 5. Notes & Authorized Signature
        notes_text = delivery_note.notes or delivery_note.terms_conditions
        sig_flowable = self.build_reference_signatures_and_notes(
            doc_width,
            notes=notes_text,
            signature_style='single'
        )
        elements.append(sig_flowable)

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = False
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        return buffer.getvalue()

'''

new_lines = lines[:start_idx] + [new_func] + lines[end_idx:]

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Updated generate_delivery_note_pdf successfully!")

