import re, os

code_path = 'backend/api/pdf_generator.py'
with open(code_path, 'r', encoding='utf-8') as f:
    code = f.read()

# -------------------------------------------------------------
# 1. NEW generate_payment_voucher_pdf
# -------------------------------------------------------------
new_payment_voucher_pdf = '''    def generate_payment_voucher_pdf(self, voucher_data):
        """
        Generates an official corporate Payment / Receipt / Agreement Voucher PDF
        strictly adhering to reference DC-00002.pdf design.
        Handles: Customer Work Order (CWO), Vendor Price Agreement (VPA),
        Customer/Vendor Account Statements, Payment Vouchers, Receipt Vouchers.
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

        v_type = voucher_data.get('voucherType') or 'Payment Voucher'
        v_no = voucher_data.get('voucherNo') or f"VCH-{datetime.now().strftime('%Y%m%d%H%M')}"
        v_date = voucher_data.get('date') or datetime.now().strftime('%Y-%m-%d')

        # 1. Header
        title_clean = v_type.upper()
        ref_label = f"{v_type}# {v_no}"
        header = self.build_reference_header(doc_width, title_clean, ref_label)
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        payee_name = (
            voucher_data.get('payeeName') or 
            voucher_data.get('partyName') or 
            voucher_data.get('customer_name') or 
            voucher_data.get('vendor_name') or 
            'N/A'
        )
        payee_role = voucher_data.get('payeeRole') or ''
        payee_phone = voucher_data.get('payeePhone') or ''
        account_name = voucher_data.get('accountName') or ''
        pay_mode = voucher_data.get('paymentMode') or ''
        category = voucher_data.get('category') or ''

        v_type_upper = v_type.upper()
        if 'CUSTOMER' in v_type_upper or 'CWO' in v_type_upper:
            party_label = "Bill To"
        elif 'VENDOR' in v_type_upper or 'VPA' in v_type_upper:
            party_label = "Vendor"
        elif 'RECEIPT' in v_type_upper:
            party_label = "Received From"
        elif 'PAYMENT' in v_type_upper:
            party_label = "Pay To"
        else:
            party_label = "Beneficiary"

        subtext_parts = []
        if payee_role and payee_role not in ('-', 'Beneficiary / Recipient', 'Customer / Client', 'Vendor / Supplier'):
            subtext_parts.append(payee_role)
        if payee_phone and payee_phone != '-':
            subtext_parts.append(f"Tel: {payee_phone}")
        if voucher_data.get('payeeAddress') and voucher_data.get('payeeAddress') != '-':
            subtext_parts.append(voucher_data.get('payeeAddress'))
        party_subtext = '\\n'.join(subtext_parts) if subtext_parts else None

        meta_pairs = [
            ("Date", format_doc_date(v_date))
        ]
        if pay_mode and pay_mode not in ('-', 'None'):
            meta_pairs.append(("Payment Mode", pay_mode))
        if category and category not in ('-', 'General', 'None'):
            meta_pairs.append(("Category", category))
        if account_name and account_name not in ('-', 'None'):
            meta_pairs.append(("Account", account_name))
        if voucher_data.get('reference') and str(voucher_data.get('reference')).strip() not in ('', '-'):
            meta_pairs.append(("Reference", str(voucher_data.get('reference'))))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label=party_label,
            party_name=payee_name,
            party_subtext=party_subtext,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items / Particulars Table
        raw_amt = voucher_data.get('amount', 0)
        try:
            amt = float(str(raw_amt).replace(',', '').replace('SAR', '').strip())
        except (ValueError, TypeError):
            amt = 0.0

        particulars = voucher_data.get('particulars') or []
        if not particulars:
            desc = voucher_data.get('description') or voucher_data.get('narration') or f"{v_type} Settlement"
            particulars = [{'item': desc, 'qty': '1.00', 'rate': f"{amt:,.2f}", 'amount': f"{amt:,.2f}"}]

        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Rate", "right"),
            ("Amount", "right")
        ]
        col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        computed_subtotal = Decimal('0.00')

        for idx, p in enumerate(particulars, 1):
            item_desc = p.get('item') or p.get('description') or '-'
            qty_raw = p.get('qty', 1)
            rate_raw = p.get('rate', amt)
            amt_raw = p.get('amount', amt)

            try:
                qty_val = float(str(qty_raw).replace(',', ''))
            except (ValueError, TypeError):
                qty_val = 1.0

            try:
                rate_val = float(str(rate_raw).replace(',', '').replace('SAR', '').strip())
            except (ValueError, TypeError):
                rate_val = amt

            try:
                line_amt = float(str(amt_raw).replace(',', '').replace('SAR', '').strip())
            except (ValueError, TypeError):
                line_amt = qty_val * rate_val

            computed_subtotal += Decimal(str(line_amt))

            desc_parts = [prt.strip() for prt in str(item_desc).split('\\n') if prt.strip()]
            if len(desc_parts) > 1:
                desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
            elif desc_parts:
                desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
            else:
                desc_html = '<font color="#727272">-</font>'

            table_rows.append([
                str(idx),
                Paragraph(desc_html, ParagraphStyle('PDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                f"{qty_val:.2f}",
                f"{rate_val:,.2f}",
                f"{line_amt:,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        total_val = float(amt) if amt > 0 else float(computed_subtotal)
        words_text = voucher_data.get('amountWords') or self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=float(computed_subtotal),
            total=total_val,
            words_text=words_text,
            show_sar_symbol=True
        )
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures and Notes
        sig_style = 'double' if any(k in v_type_upper for k in ['PAYMENT', 'RECEIPT']) else 'single'
        notes_text = voucher_data.get('notes') or voucher_data.get('narration') or voucher_data.get('terms')
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=notes_text,
            signature_style=sig_style
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------
# 2. NEW generate_salary_voucher_pdf
# -------------------------------------------------------------
new_salary_voucher_pdf = '''    def generate_salary_voucher_pdf(self, salary, timesheets=None):
        """
        Generates an official corporate Payroll Disbursement Voucher PDF
        strictly adhering to reference DC-00002.pdf design.
        Includes salary breakdown, monthly attendance summary, and double signature.
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

        staff_name = getattr(salary, 'staff_name', '') if hasattr(salary, 'staff_name') else (salary.get('staff_name', '') if isinstance(salary, dict) else '')
        paid_month = getattr(salary, 'paid_month', '') or getattr(salary, 'payment_date', '') if hasattr(salary, 'paid_month') else (salary.get('paid_month', '') or salary.get('payment_date', '') if isinstance(salary, dict) else '')
        sal_id = getattr(salary, 'id', 1) if hasattr(salary, 'id') else (salary.get('id', 1) if isinstance(salary, dict) else 1)
        pay_date = str(getattr(salary, 'payment_date', '')) if hasattr(salary, 'payment_date') else str(salary.get('payment_date', ''))
        pay_mode = getattr(salary, 'payment_mode', 'Cash') if hasattr(salary, 'payment_mode') else salary.get('payment_mode', 'Cash')
        desc = getattr(salary, 'description', '') if hasattr(salary, 'description') else salary.get('description', '')

        # Auto-query timesheets if not provided
        if timesheets is None:
            try:
                from .models import StaffTimesheet
                from django.db.models import Q
                dt = None
                if paid_month:
                    try:
                        dt = datetime.strptime(str(paid_month).strip(), '%B %Y')
                    except Exception:
                        pass
                if not dt and pay_date:
                    try:
                        dt = datetime.strptime(str(pay_date)[:10], '%Y-%m-%d')
                    except Exception:
                        pass

                if dt and staff_name:
                    timesheets = list(StaffTimesheet.objects.filter(
                        date__year=dt.year,
                        date__month=dt.month
                    ).filter(
                        Q(staff_name__iexact=staff_name) | Q(staff_name__icontains=staff_name)
                    ).order_by('date', 'id'))
                else:
                    timesheets = []
            except Exception:
                timesheets = []

        # 1. Header
        header = self.build_reference_header(doc_width, "PAYROLL DISBURSEMENT", f"Salary Voucher# VCH-SAL-{sal_id:05d}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        designation = getattr(salary, 'designation', None) or (salary.get('designation') if isinstance(salary, dict) else None)
        meta_pairs = [
            ("Pay Period", paid_month or "Current Month"),
            ("Payment Date", format_doc_date(pay_date)),
            ("Payment Mode", pay_mode or "Cash")
        ]
        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Employee",
            party_name=staff_name,
            party_subtext=designation,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table (Salary Breakdown)
        base_sal = Decimal(str(getattr(salary, 'base_salary', 0) or getattr(salary, 'amount', 0) or 0)) if hasattr(salary, 'base_salary') else Decimal(str(salary.get('base_salary', 0) or salary.get('amount', 0) or 0))
        ot_hrs = getattr(salary, 'overtime_hours', 0) or (salary.get('overtime_hours', 0) if isinstance(salary, dict) else 0) or 0
        ot_amt = Decimal(str(getattr(salary, 'overtime_amount', 0) or 0)) if hasattr(salary, 'overtime_amount') else Decimal(str(salary.get('overtime_amount', 0) or 0))
        tot_sal = Decimal(str(getattr(salary, 'total_salary', 0) or (base_sal + ot_amt) or 0)) if hasattr(salary, 'total_salary') else Decimal(str(salary.get('total_salary', 0) or (base_sal + ot_amt) or 0))
        net_paid = Decimal(str(getattr(salary, 'amount', 0) or tot_sal or 0)) if hasattr(salary, 'amount') else Decimal(str(salary.get('amount', 0) or tot_sal or 0))
        deductions = tot_sal - net_paid if tot_sal > net_paid else Decimal('0.00')

        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Rate", "right"),
            ("Amount", "right")
        ]
        col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        # Row 1: Base Salary
        table_rows.append([
            "1",
            Paragraph('<font color="#333333">Base Monthly Salary</font><br/><font color="#727272">Regular monthly payroll allocation</font>', ParagraphStyle('ItmDesc1', fontName=font_reg, fontSize=9, leading=10.39)),
            "1.00",
            f"{base_sal:,.2f}",
            f"{base_sal:,.2f}"
        ])

        # Row 2: Overtime (if any)
        if ot_amt > 0 or float(ot_hrs) > 0:
            ot_rate = (ot_amt / Decimal(str(ot_hrs))) if float(ot_hrs) > 0 else ot_amt
            table_rows.append([
                str(len(table_rows) + 1),
                Paragraph(f'<font color="#333333">Overtime Compensation</font><br/><font color="#727272">{float(ot_hrs):.1f} authorized OT hours</font>', ParagraphStyle('ItmDesc2', fontName=font_reg, fontSize=9, leading=10.39)),
                f"{float(ot_hrs):.2f}",
                f"{ot_rate:,.2f}",
                f"{ot_amt:,.2f}"
            ])

        # Row 3: Deductions (if any)
        if deductions > 0:
            table_rows.append([
                str(len(table_rows) + 1),
                Paragraph('<font color="#333333">Payroll Deductions / Advances</font><br/><font color="#727272">Authorized statutory or advance deduction</font>', ParagraphStyle('ItmDesc3', fontName=font_reg, fontSize=9, leading=10.39)),
                "1.00",
                f"-{deductions:,.2f}",
                f"-{deductions:,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        total_val = float(net_paid)
        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=float(tot_sal) if tot_sal != net_paid else None,
            total=total_val,
            words_text=words_text,
            show_sar_symbol=True
        )
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Timesheets table (if attached)
        if timesheets:
            ts_cols = [
                ("#", "center"),
                ("Date", "left"),
                ("Job / Description", "left"),
                ("Regular Hrs", "right"),
                ("OT Hrs", "right")
            ]
            ts_widths = [25.73, 85.00, 260.00, 72.00, 72.30]
            ts_rows = []
            for t_idx, ts in enumerate(timesheets[:25], 1):
                t_date = format_doc_date(getattr(ts, 'date', ''))
                t_job = str(getattr(ts, 'job_description', '') or getattr(ts, 'notes', '') or 'Work Shift')
                t_reg = float(getattr(ts, 'regular_hours', 8) or 8)
                t_ot = float(getattr(ts, 'overtime_hours', 0) or 0)
                ts_rows.append([
                    str(t_idx),
                    Paragraph(t_date, ParagraphStyle('TSD', fontName=font_reg, fontSize=8, leading=9)),
                    Paragraph(t_job, ParagraphStyle('TSJ', fontName=font_reg, fontSize=8, leading=9)),
                    f"{t_reg:.1f}",
                    f"{t_ot:.1f}"
                ])
            elements.append(Paragraph(f'<font name="{font_reg}" size="9" color="#333333"><b>Attendance & Timesheet Log ({len(timesheets)} Records)</b></font>', ParagraphStyle('TSH', fontName=font_reg, fontSize=9, leading=12)))
            elements.append(Spacer(1, 6))
            elements.append(self.build_reference_items_table(doc_width, ts_cols, ts_rows, col_widths=ts_widths))
            elements.append(Spacer(1, 15))

        # 6. Signatures (Double: Authorized + Receiver's Signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=desc,
            signature_style='double'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------
# 3. NEW generate_tax_invoice_pdf
# -------------------------------------------------------------
new_tax_invoice_pdf = '''    def generate_tax_invoice_pdf(self, invoice):
        """
        Generates an official corporate Tax Invoice PDF strictly adhering to reference DC-00002.pdf design.
        Compliant with Saudi standard VAT fields, itemized table, quiet single signature.
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
        doc_num = invoice.invoice_number or f"INV-{invoice.id:05d}"
        header = self.build_reference_header(doc_width, "TAX INVOICE", f"Invoice# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        cust = invoice.customer
        cust_name = cust.name if cust else "N/A"
        cust_tax = invoice.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = invoice.billing_address or getattr(cust, 'address', '') or ''
        cust_phone = getattr(cust, 'phone', '') or ''

        sub_parts = []
        if cust_tax and cust_tax != 'N/A':
            sub_parts.append(f"VAT / TRN: {cust_tax}")
        if cust_address and cust_address != 'N/A':
            sub_parts.append(cust_address)
        if cust_phone and cust_phone != 'N/A':
            sub_parts.append(f"Tel: {cust_phone}")
        party_sub = '\\n'.join(sub_parts) if sub_parts else None

        inv_date = format_doc_date(invoice.invoice_date)
        due_date = format_doc_date(invoice.due_date) if invoice.due_date else None
        supply_date = format_doc_date(invoice.supply_date) if invoice.supply_date else inv_date

        meta_pairs = [
            ("Invoice Date", inv_date),
            ("Due Date", due_date or inv_date),
            ("Supply Date", supply_date),
            ("Payment Terms", invoice.payment_terms or "Due on Receipt")
        ]
        if invoice.reference_number:
            meta_pairs.append(("PO / Reference", invoice.reference_number))
        if invoice.job_order:
            meta_pairs.append(("Job Order", invoice.job_order.order_id or invoice.job_order.title))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Bill To",
            party_name=cust_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = list(invoice.items.all())
        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Unit Price", "right"),
            ("VAT %", "right"),
            ("VAT Amount", "right"),
            ("Total", "right")
        ]
        # Sum of col_widths must be 515.03 pt
        col_widths = [25.73, 194.30, 45.00, 65.00, 45.00, 55.00, 85.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        if items:
            for idx, itm in enumerate(items, 1):
                qty = float(itm.quantity or 0)
                rate = float(itm.unit_price or 0)
                tax_rate = float(itm.tax_rate or 0)
                tax_amt = float(itm.tax_amount or 0)
                tot = float(itm.total or 0)

                desc_text = str(itm.description or '').strip()
                desc_parts = [p.strip() for p in desc_text.split('\\n') if p.strip()]
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#727272">-</font>'

                table_rows.append([
                    str(idx),
                    Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                    f"{qty:.2f}",
                    f"{rate:,.2f}",
                    f"{tax_rate:.1f}%",
                    f"{tax_amt:,.2f}",
                    f"{tot:,.2f}"
                ])
        else:
            table_rows.append([
                "1",
                Paragraph(invoice.notes or "General Services as per Contract", ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                "1.00",
                f"{float(invoice.subtotal):,.2f}",
                f"{float(invoice.tax_rate or 15):.1f}%",
                f"{float(invoice.tax_amount):,.2f}",
                f"{float(invoice.total_amount):,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        sub_total = float(invoice.subtotal)
        total_val = float(invoice.total_amount)
        vat_amt = float(invoice.tax_amount)
        extra_lines = []
        if vat_amt > 0:
            extra_lines.append((f"VAT ({float(invoice.tax_rate or 15):.1f}%):", vat_amt))

        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Bank / Remittance info + Signatures
        bank = getattr(invoice, 'bank_account', None)
        notes_parts = []
        if bank:
            notes_parts.append(f"Remittance Account: {bank.bank_name} | Account Name: {bank.account_name} | IBAN: {bank.iban}")
        if invoice.notes:
            notes_parts.append(invoice.notes)
        if invoice.terms:
            notes_parts.append(invoice.terms)
        notes_full = ' • '.join(notes_parts) if notes_parts else None

        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=notes_full,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------
# 4. NEW generate_quotation_pdf
# -------------------------------------------------------------
new_quotation_pdf = '''    def generate_quotation_pdf(self, quotation):
        """
        Generates an official corporate Quotation / Proforma PDF
        strictly adhering to reference DC-00002.pdf design.
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
        doc_num = quotation.quotation_number or f"QT-{quotation.id:05d}"
        header = self.build_reference_header(doc_width, "QUOTATION", f"Quotation# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        cust = quotation.customer
        cust_name = cust.name if cust else (getattr(quotation, 'client_name', '') or 'Customer')
        cust_tax = quotation.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = quotation.billing_address or getattr(cust, 'address', '') or ''
        cust_phone = getattr(cust, 'phone', '') or ''

        sub_parts = []
        if cust_tax and cust_tax != 'N/A':
            sub_parts.append(f"VAT / TRN: {cust_tax}")
        if cust_address and cust_address != 'N/A':
            sub_parts.append(cust_address)
        if cust_phone and cust_phone != 'N/A':
            sub_parts.append(f"Tel: {cust_phone}")
        party_sub = '\\n'.join(sub_parts) if sub_parts else None

        q_date = format_doc_date(quotation.quotation_date)
        v_date = format_doc_date(quotation.valid_until) if quotation.valid_until else None

        meta_pairs = [
            ("Quote Date", q_date),
            ("Valid Until", v_date or "30 Days"),
            ("Payment Terms", quotation.payment_terms or "Due on Receipt")
        ]
        if quotation.job_order:
            meta_pairs.append(("Job Order", quotation.job_order.order_id or quotation.job_order.title))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Quotation For",
            party_name=cust_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = list(quotation.items.all())
        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Unit Price", "right"),
            ("VAT %", "right"),
            ("VAT Amount", "right"),
            ("Total", "right")
        ]
        col_widths = [25.73, 194.30, 45.00, 65.00, 45.00, 55.00, 85.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        if items:
            for idx, itm in enumerate(items, 1):
                qty = float(itm.quantity or 0)
                rate = float(itm.unit_price or 0)
                tax_rate = float(itm.tax_rate or 0)
                tax_amt = float(itm.tax_amount or 0)
                tot = float(itm.total or 0)

                desc_text = str(itm.description or '').strip()
                desc_parts = [p.strip() for p in desc_text.split('\\n') if p.strip()]
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#727272">-</font>'

                table_rows.append([
                    str(idx),
                    Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                    f"{qty:.2f}",
                    f"{rate:,.2f}",
                    f"{tax_rate:.1f}%",
                    f"{tax_amt:,.2f}",
                    f"{tot:,.2f}"
                ])
        else:
            table_rows.append([
                "1",
                Paragraph(quotation.notes or "Quoted Services and Deliverables", ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                "1.00",
                f"{float(quotation.subtotal):,.2f}",
                f"{float(quotation.tax_rate or 15):.1f}%",
                f"{float(quotation.tax_amount):,.2f}",
                f"{float(quotation.total_amount):,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        sub_total = float(quotation.subtotal)
        total_val = float(quotation.total_amount)
        vat_amt = float(quotation.tax_amount)
        extra_lines = []
        if vat_amt > 0:
            extra_lines.append((f"VAT ({float(quotation.tax_rate or 15):.1f}%):", vat_amt))

        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
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
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------
# 5. NEW generate_credit_note_pdf
# -------------------------------------------------------------
new_credit_note_pdf = '''    def generate_credit_note_pdf(self, credit_note):
        """
        Generates an official corporate Credit Note PDF
        strictly adhering to reference DC-00002.pdf design.
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
        doc_num = credit_note.credit_note_number or f"CN-{credit_note.id:05d}"
        header = self.build_reference_header(doc_width, "CREDIT NOTE", f"Credit Note# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        cust = credit_note.customer
        cust_name = cust.name if cust else (getattr(credit_note, 'client_name', '') or 'Customer')
        cust_tax = credit_note.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = credit_note.billing_address or getattr(cust, 'address', '') or ''

        sub_parts = []
        if cust_tax and cust_tax != 'N/A':
            sub_parts.append(f"VAT / TRN: {cust_tax}")
        if cust_address and cust_address != 'N/A':
            sub_parts.append(cust_address)
        party_sub = '\\n'.join(sub_parts) if sub_parts else None

        cn_date = format_doc_date(credit_note.credit_note_date)
        meta_pairs = [
            ("Credit Date", cn_date)
        ]
        if credit_note.invoice:
            meta_pairs.append(("Original Invoice", credit_note.invoice.invoice_number))
        if credit_note.reason:
            meta_pairs.append(("Credit Reason", credit_note.reason))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Credited To",
            party_name=cust_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = list(credit_note.items.all())
        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Unit Price", "right"),
            ("VAT %", "right"),
            ("VAT Amount", "right"),
            ("Total", "right")
        ]
        col_widths = [25.73, 194.30, 45.00, 65.00, 45.00, 55.00, 85.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        if items:
            for idx, itm in enumerate(items, 1):
                qty = float(itm.quantity or 0)
                rate = float(itm.unit_price or 0)
                tax_rate = float(itm.tax_rate or 0)
                tax_amt = float(itm.tax_amount or 0)
                tot = float(itm.total or 0)

                desc_text = str(itm.description or '').strip()
                desc_parts = [p.strip() for p in desc_text.split('\\n') if p.strip()]
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#727272">-</font>'

                table_rows.append([
                    str(idx),
                    Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                    f"{qty:.2f}",
                    f"{rate:,.2f}",
                    f"{tax_rate:.1f}%",
                    f"{tax_amt:,.2f}",
                    f"{tot:,.2f}"
                ])
        else:
            table_rows.append([
                "1",
                Paragraph(credit_note.notes or "Credit Adjustment as agreed", ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                "1.00",
                f"{float(credit_note.subtotal):,.2f}",
                f"{float(credit_note.tax_rate or 15):.1f}%",
                f"{float(credit_note.tax_amount):,.2f}",
                f"{float(credit_note.total_amount):,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        sub_total = float(credit_note.subtotal)
        total_val = float(credit_note.total_amount)
        vat_amt = float(credit_note.tax_amount)
        extra_lines = []
        if vat_amt > 0:
            extra_lines.append((f"VAT ({float(credit_note.tax_rate or 15):.1f}%):", vat_amt))

        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
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
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=credit_note.notes,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------
# 6. NEW generate_client_estimation_checklist_pdf & generate_admin_estimation_pdf
# -------------------------------------------------------------
new_estimations_pdf = '''    def generate_client_estimation_checklist_pdf(self, estimation):
        """
        Generates a publication-grade client-facing Production Checklist & Material Estimation PDF.
        Cost/price/supplier columns are STRICTLY HIDDEN.
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
        doc_num = estimation.estimate_number or f"EST-{estimation.id:05d}"
        header = self.build_reference_header(doc_width, "PRODUCTION CHECKLIST", f"Estimate# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        client_name = estimation.client_name or (estimation.customer.name if estimation.customer else "Valued Client")
        c_date = format_doc_date(estimation.date)
        v_date = format_doc_date(estimation.valid_until) if estimation.valid_until else "Upon Request"

        meta_pairs = [
            ("Date", c_date),
            ("Valid Until", v_date),
            ("Project", estimation.title or "Production Estimate")
        ]
        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Client",
            party_name=client_name,
            party_subtext=estimation.client_contact,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table (Prices strictly hidden)
        items = list(estimation.items.all().order_by('section_room', 'sort_order', 'id'))
        columns = [
            ("#", "center"),
            ("Item Description & Specifications", "left"),
            ("Section / Room", "left"),
            ("Qty", "right"),
            ("Unit", "center")
        ]
        col_widths = [25.73, 260.00, 110.00, 60.00, 59.30]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        for idx, itm in enumerate(items, 1):
            desc = itm.item_name or 'Production Material Item'
            specs = []
            if itm.specifications:
                specs.append(itm.specifications)
            if itm.width and itm.height:
                specs.append(f"Size: {itm.width} x {itm.height} {itm.dimension_unit or 'cm'}")
            spec_str = ' • '.join(specs)

            if spec_str:
                desc_html = f'<font color="#333333">{desc}</font><br/><font color="#727272">{spec_str}</font>'
            else:
                desc_html = f'<font color="#333333">{desc}</font>'

            table_rows.append([
                str(idx),
                Paragraph(desc_html, ParagraphStyle('EstDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                Paragraph(str(itm.section_room or 'General Area'), ParagraphStyle('EstSec', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#727272'))),
                f"{float(itm.quantity or 1):.2f}",
                str(itm.unit or 'pcs')
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 23.00))

        # 4. Signatures
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=estimation.notes or estimation.scope_of_work,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_admin_estimation_pdf(self, estimation):
        """
        Generates an internal Admin Material Pricing & Margin Analysis PDF
        strictly adhering to reference DC-00002.pdf design.
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
        doc_num = estimation.estimate_number or f"EST-{estimation.id:05d}"
        header = self.build_reference_header(doc_width, "MATERIAL ESTIMATE", f"Estimate# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        client_name = estimation.client_name or (estimation.customer.name if estimation.customer else "Valued Client")
        c_date = format_doc_date(estimation.date)

        meta_pairs = [
            ("Date", c_date),
            ("Status", estimation.status or "Draft"),
            ("Project", estimation.title or "Estimate")
        ]
        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Client",
            party_name=client_name,
            party_subtext=estimation.client_contact,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = list(estimation.items.all().order_by('sort_order', 'id'))
        columns = [
            ("#", "center"),
            ("Item & Specs", "left"),
            ("Qty", "right"),
            ("Cost / Unit", "right"),
            ("Total Cost", "right"),
            ("Quoted Price", "right")
        ]
        col_widths = [25.73, 214.30, 45.00, 75.00, 75.00, 80.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        tot_cost = Decimal('0.00')

        for idx, itm in enumerate(items, 1):
            desc = itm.item_name or 'Material Item'
            sub = itm.supplier_shop or itm.specifications or ''
            qty = float(itm.quantity or 1)
            cost_u = float(itm.unit_cost or 0)
            c_tot = float(itm.total_cost or (qty * cost_u))
            q_price = float(itm.selling_price or 0)
            tot_cost += Decimal(str(c_tot))

            if sub:
                desc_html = f'<font color="#333333">{desc}</font><br/><font color="#727272">{sub}</font>'
            else:
                desc_html = f'<font color="#333333">{desc}</font>'

            table_rows.append([
                str(idx),
                Paragraph(desc_html, ParagraphStyle('EstDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                f"{qty:.2f}",
                f"{cost_u:,.2f}",
                f"{c_tot:,.2f}",
                f"{q_price:,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        total_val = float(estimation.total_price)
        sub_total = float(tot_cost)
        margin_amt = total_val - sub_total
        margin_pct = (margin_amt / total_val * 100) if total_val > 0 else 0
        extra_lines = [
            ("Estimated Total Cost:", sub_total),
            (f"Target Margin ({margin_pct:.1f}%):", margin_amt)
        ]
        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=None,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=estimation.notes or estimation.scope_of_work,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------
# 7. NEW generate_enquiry_pdf
# -------------------------------------------------------------
new_enquiry_pdf = '''    def generate_enquiry_pdf(self, enquiry):
        """
        Generates an official corporate Customer Enquiry Document PDF
        strictly adhering to reference DC-00002.pdf design.
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
        doc_num = enquiry.enquiry_number or f"ENQ-{enquiry.id:05d}"
        header = self.build_reference_header(doc_width, "CUSTOMER ENQUIRY", f"Enquiry# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        cust = enquiry.customer
        c_name = cust.name if cust else (enquiry.customer_name or 'Prospect Client')
        c_contact = enquiry.contact_person or getattr(cust, 'contact_person', '') or ''
        c_phone = enquiry.phone or getattr(cust, 'phone', '') or ''
        c_email = enquiry.email or getattr(cust, 'email', '') or ''

        sub_parts = []
        if c_contact and c_contact != c_name:
            sub_parts.append(f"Attn: {c_contact}")
        if c_phone:
            sub_parts.append(f"Tel: {c_phone}")
        if c_email:
            sub_parts.append(f"Email: {c_email}")
        party_sub = '\\n'.join(sub_parts) if sub_parts else None

        enq_date = format_doc_date(enquiry.enquiry_date or enquiry.created_at)
        sp_name = enquiry.salesperson.name if enquiry.salesperson else None

        meta_pairs = [
            ("Enquiry Date", enq_date),
            ("Status", enquiry.status or "Active"),
            ("Priority", enquiry.priority or "Medium")
        ]
        if sp_name:
            meta_pairs.append(("Sales Rep", sp_name))
        if enquiry.source:
            meta_pairs.append(("Source", enquiry.source))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Enquiry From",
            party_name=c_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Requirements Table
        columns = [
            ("#", "center"),
            ("Item / Requirement Description", "left"),
            ("Scope / Location", "left"),
            ("Est. Budget (SAR)", "right")
        ]
        col_widths = [25.73, 269.30, 120.00, 100.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        budget_val = float(enquiry.estimated_budget or 0)
        req_text = enquiry.requirements or enquiry.title or "General Project Inquiry & Scope"
        req_parts = [p.strip() for p in str(req_text).split('\\n') if p.strip()]
        if len(req_parts) > 1:
            req_html = f'<font color="#333333">{req_parts[0]}</font><br/><font color="#727272">{req_parts[1]}</font>'
        else:
            req_html = f'<font color="#333333">{req_parts[0]}</font>'

        table_rows.append([
            "1",
            Paragraph(req_html, ParagraphStyle('EnqDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
            Paragraph(enquiry.project_name or enquiry.location or "Standard Scope", ParagraphStyle('EnqLoc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#727272'))),
            f"{budget_val:,.2f}" if budget_val > 0 else "-"
        ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 23.00))

        # 4. Signatures and Notes
        notes_full = enquiry.notes
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=notes_full,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

print("Ready to apply updates to backend/api/pdf_generator.py")

# Apply replacements from back to front to preserve earlier offsets!

# 1. generate_payment_voucher_pdf and generate_enquiry_pdf
idx_pv = code.find('    def generate_payment_voucher_pdf')
idx_end = code.find('universal_pdf_generator = UniversalPDFGenerator()')
assert idx_pv != -1 and idx_end != -1, 'Payment voucher bounds not found'
code = code[:idx_pv] + new_payment_voucher_pdf + '\n\n' + new_enquiry_pdf + '\n\n' + code[idx_end:]

# 2. generate_credit_note_pdf
idx_cn = code.find('    def generate_credit_note_pdf')
idx_dn = code.find('    def generate_delivery_note_pdf')
assert idx_cn != -1 and idx_dn != -1, 'Credit note bounds not found'
code = code[:idx_cn] + new_credit_note_pdf + '\n\n' + code[idx_dn:]

# 3. generate_quotation_pdf
idx_qt = code.find('    def generate_quotation_pdf')
idx_cn2 = code.find('    def generate_credit_note_pdf')
assert idx_qt != -1 and idx_cn2 != -1, 'Quotation bounds not found'
code = code[:idx_qt] + new_quotation_pdf + '\n\n' + code[idx_cn2:]

# 4. generate_client_estimation_checklist_pdf & generate_admin_estimation_pdf
idx_est = code.find('    def generate_client_estimation_checklist_pdf')
idx_qt2 = code.find('    def generate_quotation_pdf')
assert idx_est != -1 and idx_qt2 != -1, 'Estimation bounds not found'
code = code[:idx_est] + new_estimations_pdf + '\n\n' + code[idx_qt2:]

# 5. generate_tax_invoice_pdf
idx_ti = code.find('    def generate_tax_invoice_pdf')
idx_est2 = code.find('    def generate_client_estimation_checklist_pdf')
assert idx_ti != -1 and idx_est2 != -1, 'Tax invoice bounds not found'
code = code[:idx_ti] + new_tax_invoice_pdf + '\n\n' + code[idx_est2:]

# 6. generate_salary_voucher_pdf
idx_sal = code.find('    def generate_salary_voucher_pdf')
idx_fin = code.find('    def generate_financial_report_pdf')
assert idx_sal != -1 and idx_fin != -1, 'Salary voucher bounds not found'
code = code[:idx_sal] + new_salary_voucher_pdf + '\n\n' + code[idx_fin:]

with open(code_path, 'w', encoding='utf-8') as f:
    f.write(code)

print('SUCCESSFULLY APPLIED ALL PHASE B UPDATES TO pdf_generator.py!')
