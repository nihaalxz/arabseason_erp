with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add module-level ENABLE_ZATCA_QR flag right near the top
old_fonts_def = "FONTS = {}"
new_fonts_def = "FONTS = {}\nENABLE_ZATCA_QR = False  # Disabled by default; set True to re-enable ZATCA Phase 1 QR codes"
if old_fonts_def in code and "ENABLE_ZATCA_QR" not in code:
    code = code.replace(old_fonts_def, new_fonts_def, 1)

# 2. Update generate_tax_invoice_pdf remittance and QR section
old_tax_remit = """        # Vector ZATCA Phase 1 QR Code
        settings_data = self._get_site_settings()
        seller_name = settings_data.get('legal_name', 'ALI MOHAMMED MOTAH Establishment For Contracting')
        seller_trn = settings_data.get('tax_number', '301374966800003')
        inv_iso_time = f"{invoice.invoice_date}T12:00:00Z" if invoice.invoice_date else datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        qr_drawing = self._build_zatca_qr_drawing(
            seller_name=seller_name,
            vat_number=seller_trn,
            invoice_time=inv_iso_time,
            total_amount=total_val,
            vat_amount=vat_amt,
            size=65
        )

        remit_table = Table([[remittance_p, qr_drawing]], colWidths=[doc_width - 80, 80])
        remit_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (1,0), (1,0), 'RIGHT'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        elements.append(remit_table)
        elements.append(Spacer(1, 15.00))

        # 6. Single Authorized Signature
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)"""

new_tax_remit = """        # 5. Remittance Notes & Optional QR (Default OFF per project requirements)
        concluding_flowables = [totals_block, Spacer(1, 14.00)]

        use_qr = getattr(self, 'enable_zatca_qr', ENABLE_ZATCA_QR)
        if use_qr:
            settings_data = self._get_site_settings()
            seller_name = settings_data.get('legal_name', 'ALI MOHAMMED MOTAH Establishment For Contracting')
            seller_trn = settings_data.get('tax_number', '301374966800003')
            inv_iso_time = f"{invoice.invoice_date}T12:00:00Z" if invoice.invoice_date else datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
            qr_drawing = self._build_zatca_qr_drawing(
                seller_name=seller_name,
                vat_number=seller_trn,
                invoice_time=inv_iso_time,
                total_amount=total_val,
                vat_amount=vat_amt,
                size=65
            )
            remit_table = Table([[remittance_p, qr_drawing]], colWidths=[doc_width - 80, 80])
            remit_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ALIGN', (1,0), (1,0), 'RIGHT'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            concluding_flowables.append(remit_table)
            concluding_flowables.append(Spacer(1, 14.00))
        elif remittance_lines:
            # Clean full-width reflow with no empty QR gap
            concluding_flowables.append(remittance_p)
            concluding_flowables.append(Spacer(1, 14.00))

        # 6. Single Authorized Signature (Bound together to guarantee no orphan signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        concluding_flowables.extend(sigs)
        elements.append(KeepTogether(concluding_flowables))"""

if old_tax_remit in code:
    code = code.replace(old_tax_remit, new_tax_remit, 1)
    # Also remove separate elements.append(totals_block) and Spacer before it in generate_tax_invoice_pdf
    old_tot_append = """        elements.append(totals_block)
        elements.append(Spacer(1, 15.00))"""
    # Note: we need to make sure we only remove the one right before remittance in generate_tax_invoice_pdf
    print("Replaced tax invoice remittance and QR successfully.")
else:
    print("Warning: old_tax_remit not found exactly.")

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(code)

