with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Quotation
target_quot = """        # 5. Signatures and Notes (Bound together to prevent orphan signature)
        notes_full = quotation.notes or quotation.terms
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=notes_full,
            signature_style='single'
        )
        elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

replacement_quot = """        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures and Notes
        notes_full = quotation.notes or quotation.terms
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=notes_full,
            signature_style='single'
        )
        elements.extend(sigs)"""

c = c.replace(target_quot, replacement_quot, 1)

# 2. Credit Note
target_cn = """        # 6. Single Authorized Signature (Bound together to guarantee no orphan signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        concluding_flowables.extend(sigs)
        elements.append(KeepTogether(concluding_flowables))"""

replacement_cn = """        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 14.00))

        if credit_note.notes:
            notes_p = Paragraph(f"<b>Notes:</b> {credit_note.notes}", ParagraphStyle('CNP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))
            notes_p.keepWithNext = True
            elements.append(notes_p)
            elements.append(Spacer(1, 14.00))

        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)"""

c = c.replace(target_cn, replacement_cn, 1)

# 3. Tax Invoice
target_tax = """        # 6. Single Authorized Signature (Bound together to guarantee no orphan signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        concluding_flowables.extend(sigs)
        elements.append(KeepTogether(concluding_flowables))"""

replacement_tax = """        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 14.00))

        if remittance_lines:
            remittance_p.keepWithNext = True
            elements.append(remittance_p)
            elements.append(Spacer(1, 14.00))

        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)"""

c = c.replace(target_tax, replacement_tax, 1)

# 4. Payment Voucher Statement
target_pvs = """            # 3A.4 Single Signature (Bound together to prevent orphan signature)
            notes_text = voucher_data.get('notes') or voucher_data.get('narration')
            sigs = self.build_reference_signatures_and_notes(doc_width, notes=notes_text, signature_style='single')
            elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

replacement_pvs = """            totals_block.keepWithNext = True
            elements.append(totals_block)
            elements.append(Spacer(1, 23.00))

            notes_text = voucher_data.get('notes') or voucher_data.get('narration')
            sigs = self.build_reference_signatures_and_notes(doc_width, notes=notes_text, signature_style='single')
            elements.extend(sigs)"""

c = c.replace(target_pvs, replacement_pvs, 1)

# 5. Payment Voucher Transactional
target_pvt = """            # 5. Signatures and Notes (Bound together to prevent orphan signature)
            sig_style = 'double' if any(k in v_type_upper for k in ['PAYMENT', 'RECEIPT', 'SALARY']) else 'single'
            notes_text = voucher_data.get('notes') or voucher_data.get('narration') or voucher_data.get('terms')
            sigs = self.build_reference_signatures_and_notes(
                doc_width,
                notes=notes_text,
                signature_style=sig_style
            )
            elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

replacement_pvt = """            totals_block.keepWithNext = True
            elements.append(totals_block)
            elements.append(Spacer(1, 23.00))

            sig_style = 'double' if any(k in v_type_upper for k in ['PAYMENT', 'RECEIPT', 'SALARY']) else 'single'
            notes_text = voucher_data.get('notes') or voucher_data.get('narration') or voucher_data.get('terms')
            sigs = self.build_reference_signatures_and_notes(
                doc_width,
                notes=notes_text,
                signature_style=sig_style
            )
            elements.extend(sigs)"""

c = c.replace(target_pvt, replacement_pvt, 1)

# 6. Admin Estimation
target_est = """        # 5. Signatures (Internal management signature, strictly NO customer signature; bound together)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=estimation.notes or estimation.scope_of_work,
            signature_style='internal'
        )
        elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

replacement_est = """        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=estimation.notes or estimation.scope_of_work,
            signature_style='internal'
        )
        elements.extend(sigs)"""

c = c.replace(target_est, replacement_est, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Applied keepWithNext across all generators!")

