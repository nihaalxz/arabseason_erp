with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix generate_tax_invoice_pdf so totals_block is only in concluding_flowables
old_tax_totals_append = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )
        elements.append(totals_block)
        elements.append(Spacer(1, 15.00))

        # 5. Bottom Remittance Details"""

new_tax_totals_append = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )

        # 5. Bottom Remittance Details"""

if old_tax_totals_append in code:
    code = code.replace(old_tax_totals_append, new_tax_totals_append, 1)
    print("Fixed tax invoice totals_block duplication.")
else:
    print("Warning: old_tax_totals_append not matched.")

# 2. Update generate_credit_note_pdf
old_cn_qr = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )
        elements.append(totals_block)
        elements.append(Spacer(1, 15.00))

        # 5. Vector ZATCA QR Code & Notes
        settings_data = self._get_site_settings()
        seller_name = settings_data.get('legal_name', 'ALI MOHAMMED MOTAH Establishment For Contracting')
        seller_trn = settings_data.get('tax_number', '301374966800003')
        cn_iso_time = f"{credit_note.credit_note_date}T12:00:00Z" if credit_note.credit_note_date else datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        qr_drawing = self._build_zatca_qr_drawing(
            seller_name=seller_name,
            vat_number=seller_trn,
            invoice_time=cn_iso_time,
            total_amount=total_val,
            vat_amount=vat_amt,
            size=65
        )

        notes_p = Paragraph(f"<b>Notes:</b> {credit_note.notes}" if credit_note.notes else "", ParagraphStyle('CNP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))
        qr_table = Table([[notes_p, qr_drawing]], colWidths=[doc_width - 80, 80])
        qr_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (1,0), (1,0), 'RIGHT'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        elements.append(qr_table)
        elements.append(Spacer(1, 15.00))

        # 6. Single Authorized Signature
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)"""

new_cn_qr = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )

        # 5. Notes & Optional QR (Default OFF per project requirements)
        concluding_flowables = [totals_block, Spacer(1, 14.00)]
        use_qr = getattr(self, 'enable_zatca_qr', ENABLE_ZATCA_QR)
        if use_qr:
            settings_data = self._get_site_settings()
            seller_name = settings_data.get('legal_name', 'ALI MOHAMMED MOTAH Establishment For Contracting')
            seller_trn = settings_data.get('tax_number', '301374966800003')
            cn_iso_time = f"{credit_note.credit_note_date}T12:00:00Z" if credit_note.credit_note_date else datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
            qr_drawing = self._build_zatca_qr_drawing(
                seller_name=seller_name,
                vat_number=seller_trn,
                invoice_time=cn_iso_time,
                total_amount=total_val,
                vat_amount=vat_amt,
                size=65
            )
            notes_p = Paragraph(f"<b>Notes:</b> {credit_note.notes}" if credit_note.notes else "", ParagraphStyle('CNP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))
            qr_table = Table([[notes_p, qr_drawing]], colWidths=[doc_width - 80, 80])
            qr_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ALIGN', (1,0), (1,0), 'RIGHT'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            concluding_flowables.append(qr_table)
            concluding_flowables.append(Spacer(1, 14.00))
        elif credit_note.notes:
            notes_p = Paragraph(f"<b>Notes:</b> {credit_note.notes}", ParagraphStyle('CNP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))
            concluding_flowables.append(notes_p)
            concluding_flowables.append(Spacer(1, 14.00))

        # 6. Single Authorized Signature (Bound together to guarantee no orphan signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        concluding_flowables.extend(sigs)
        elements.append(KeepTogether(concluding_flowables))"""

if old_cn_qr in code:
    code = code.replace(old_cn_qr, new_cn_qr, 1)
    print("Updated credit note QR and orphan prevention successfully.")
else:
    print("Warning: old_cn_qr not matched.")

# 3. Delivery Note orphan prevention
old_dn_sig = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=float(sub_total),
            total=total_val,
            words_text=words_text,
            show_sar_symbol=True
        )
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures and Notes
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=delivery_note.notes,
            signature_style='single'
        )
        elements.extend(sigs)"""

new_dn_sig = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=float(sub_total),
            total=total_val,
            words_text=words_text,
            show_sar_symbol=True
        )

        # 5. Signatures and Notes (Bound together to prevent orphan signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=delivery_note.notes,
            signature_style='single'
        )
        elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

if old_dn_sig in code:
    code = code.replace(old_dn_sig, new_dn_sig, 1)
    print("Updated delivery note orphan prevention.")
else:
    print("Warning: old_dn_sig not matched.")

# 4. Quotation orphan prevention
old_quot_sig = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )
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

new_quot_sig = """        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )

        # 5. Signatures and Notes (Bound together to prevent orphan signature)
        notes_full = quotation.notes or quotation.terms
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=notes_full,
            signature_style='single'
        )
        elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

if old_quot_sig in code:
    code = code.replace(old_quot_sig, new_quot_sig, 1)
    print("Updated quotation orphan prevention.")
else:
    print("Warning: old_quot_sig not matched.")

# 5. Payment voucher / CWO / VPA / Statement orphan prevention
old_pv_sig = """            words_text = self.number_to_words(closing_bal)
            totals_block = self.build_reference_totals(
                doc_width,
                sub_total=None,
                total=closing_bal,
                words_text=words_text,
                show_sar_symbol=True
            )
            elements.append(totals_block)
            elements.append(Spacer(1, 23.00))

            # 3A.4 Single Signature
            notes_text = voucher_data.get('notes') or voucher_data.get('narration')
            sigs = self.build_reference_signatures_and_notes(doc_width, notes=notes_text, signature_style='single')
            elements.extend(sigs)"""

new_pv_sig = """            words_text = self.number_to_words(closing_bal)
            totals_block = self.build_reference_totals(
                doc_width,
                sub_total=None,
                total=closing_bal,
                words_text=words_text,
                show_sar_symbol=True
            )

            # 3A.4 Single Signature (Bound together to prevent orphan signature)
            notes_text = voucher_data.get('notes') or voucher_data.get('narration')
            sigs = self.build_reference_signatures_and_notes(doc_width, notes=notes_text, signature_style='single')
            elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

if old_pv_sig in code:
    code = code.replace(old_pv_sig, new_pv_sig, 1)
    print("Updated statement orphan prevention.")
else:
    print("Warning: old_pv_sig not matched.")

old_trans_sig = """            elements.append(totals_block)
            elements.append(Spacer(1, 23.00))

            # 5. Signatures and Notes
            # Single for CWO and VPA; double for Payment and Receipt vouchers
            sig_style = 'double' if any(k in v_type_upper for k in ['PAYMENT', 'RECEIPT']) else 'single'
            notes_text = voucher_data.get('notes') or voucher_data.get('narration') or voucher_data.get('terms')
            sigs = self.build_reference_signatures_and_notes(
                doc_width,
                notes=notes_text,
                signature_style=sig_style
            )
            elements.extend(sigs)"""

new_trans_sig = """            # 5. Signatures and Notes (Bound together to prevent orphan signature)
            sig_style = 'double' if any(k in v_type_upper for k in ['PAYMENT', 'RECEIPT']) else 'single'
            notes_text = voucher_data.get('notes') or voucher_data.get('narration') or voucher_data.get('terms')
            sigs = self.build_reference_signatures_and_notes(
                doc_width,
                notes=notes_text,
                signature_style=sig_style
            )
            elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

if old_trans_sig in code:
    code = code.replace(old_trans_sig, new_trans_sig, 1)
    print("Updated transactional voucher orphan prevention.")
else:
    print("Warning: old_trans_sig not matched.")

# 6. Admin Estimation orphan prevention
old_est_sig = """        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures (Internal management signature, strictly NO customer signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=estimation.notes or estimation.scope_of_work,
            signature_style='internal'
        )
        elements.extend(sigs)"""

new_est_sig = """        # 5. Signatures (Internal management signature, strictly NO customer signature; bound together)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=estimation.notes or estimation.scope_of_work,
            signature_style='internal'
        )
        elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

if old_est_sig in code:
    code = code.replace(old_est_sig, new_est_sig, 1)
    print("Updated admin estimation orphan prevention.")
else:
    print("Warning: old_est_sig not matched.")

# 7. Salary voucher orphan prevention
old_sal_sig = """        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures (Double: Authorized + Receiver)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=salary_voucher.notes,
            signature_style='double'
        )
        elements.extend(sigs)"""

new_sal_sig = """        # 5. Signatures (Double: Authorized + Receiver; bound together to prevent orphan signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=salary_voucher.notes,
            signature_style='double'
        )
        elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

if old_sal_sig in code:
    code = code.replace(old_sal_sig, new_sal_sig, 1)
    print("Updated salary voucher orphan prevention.")
else:
    print("Warning: old_sal_sig not matched.")

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("ALL REFINEMENTS WRITTEN TO pdf_generator.py!")

