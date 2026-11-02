import os, sys

target_file = 'backend/api/pdf_generator.py'
with open(target_file, 'r', encoding='utf-8') as f:
    code = f.read()

# -------------------------------------------------------------------------
# NEW generate_payment_voucher_pdf (with specialized statement ledger table)
# -------------------------------------------------------------------------
new_payment_voucher = '''    def generate_payment_voucher_pdf(self, voucher_data):
        """
        Generates an official corporate Payment / Receipt / Agreement Voucher PDF
        strictly adhering to reference DC-00002.pdf design.
        Handles:
        1. Statements (Customer Account Statement, Vendor Account Statement):
           Uses specialized ledger table (Date / Description / Debit / Credit / Balance)
           with summary stack, running balances, and repeatRows=1.
        2. Transactional Vouchers (CWO, VPA, Payment Voucher, Receipt Voucher):
           Uses clean itemized particulars table, single signature on CWO/VPA,
           double signature on Payment/Receipt vouchers.
        Strictly enforces: no '-' fields, voucher number once, date once, total once.
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
        v_type_upper = v_type.upper()
        is_statement = ('STATEMENT' in v_type_upper)

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
            'Valued Client'
        )
        payee_role = voucher_data.get('payeeRole') or ''
        payee_phone = voucher_data.get('payeePhone') or ''
        account_name = voucher_data.get('accountName') or ''
        pay_mode = voucher_data.get('paymentMode') or ''
        category = voucher_data.get('category') or ''

        if 'CUSTOMER' in v_type_upper or 'CWO' in v_type_upper:
            party_label = "Bill To" if not is_statement else "Customer"
        elif 'VENDOR' in v_type_upper or 'VPA' in v_type_upper:
            party_label = "Vendor"
        elif 'RECEIPT' in v_type_upper:
            party_label = "Received From"
        elif 'PAYMENT' in v_type_upper:
            party_label = "Pay To"
        else:
            party_label = "Beneficiary"

        subtext_parts = []
        if payee_role and payee_role not in ('-', 'Beneficiary / Recipient', 'Customer / Client', 'Vendor / Supplier', 'Customer', 'Vendor'):
            subtext_parts.append(payee_role)
        if payee_phone and payee_phone not in ('-', 'None', 'null', 'N/A'):
            subtext_parts.append(f"Tel: {payee_phone}")
        addr_val = voucher_data.get('payeeAddress')
        if addr_val and str(addr_val).strip() not in ('-', 'None', 'null', 'N/A'):
            subtext_parts.append(str(addr_val).strip())
        party_subtext = '\\n'.join(subtext_parts) if subtext_parts else None

        meta_pairs = [
            ("Date", format_doc_date(v_date))
        ]
        period_val = voucher_data.get('period') or voucher_data.get('period_text')
        if is_statement and period_val:
            meta_pairs.append(("Period", str(period_val)))
        if pay_mode and pay_mode not in ('-', 'None', 'null', 'ACCOUNT BALANCE', 'VENDOR BALANCE'):
            meta_pairs.append(("Payment Mode", pay_mode))
        if category and category not in ('-', 'General', 'None', 'null', 'Customer Statement', 'Supplier Balance', 'Statement Settlement'):
            meta_pairs.append(("Category", category))
        if account_name and account_name not in ('-', 'None', 'null', 'Main Cash Ledger', 'Accounts Receivable', 'Accounts Payable'):
            meta_pairs.append(("Account", account_name))
        ref_val = voucher_data.get('reference')
        if ref_val and str(ref_val).strip() not in ('', '-', 'None', 'null'):
            meta_pairs.append(("Reference", str(ref_val).strip()))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label=party_label,
            party_name=payee_name,
            party_subtext=party_subtext,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        # =========================================================================
        # 3A. STATEMENT CASE: LEDGER TABLE WITH SUMMARY STACK
        # =========================================================================
        if is_statement:
            opening_bal = float(voucher_data.get('openingBalance') or 0.0)
            transactions = voucher_data.get('transactions') or voucher_data.get('particulars') or []

            # 3A.1 Summary Stack Above Ledger Table
            tot_debits = Decimal('0.00')
            tot_credits = Decimal('0.00')
            curr_running = Decimal(str(opening_bal))

            # Pre-compute totals and build ledger rows
            ledger_rows = []
            for t in transactions:
                t_date = format_doc_date(t.get('date') or v_date)
                t_desc = t.get('description') or t.get('item') or t.get('details') or 'Transaction Entry'
                raw_deb = t.get('debit', 0)
                raw_cred = t.get('credit', 0)
                try:
                    deb_val = Decimal(str(raw_deb).replace(',', '').replace('SAR', '').strip() or '0')
                except Exception:
                    deb_val = Decimal('0.00')
                try:
                    cred_val = Decimal(str(raw_cred).replace(',', '').replace('SAR', '').strip() or '0')
                except Exception:
                    cred_val = Decimal('0.00')

                # In case caller passed line-item amount
                if deb_val == 0 and cred_val == 0 and 'amount' in t:
                    amt_t = Decimal(str(t.get('amount', 0)).replace(',', '').replace('SAR', '').strip() or '0')
                    if amt_t >= 0:
                        deb_val = amt_t
                    else:
                        cred_val = abs(amt_t)

                tot_debits += deb_val
                tot_credits += cred_val
                curr_running = curr_running + deb_val - cred_val

                desc_parts = [prt.strip() for prt in str(t_desc).split('\\n') if prt.strip() and prt.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Transaction Record</font>'

                deb_str = f"{deb_val:,.2f}" if deb_val > 0 else ""
                cred_str = f"{cred_val:,.2f}" if cred_val > 0 else ""
                bal_str = f"{curr_running:,.2f}"

                ledger_rows.append([
                    Paragraph(t_date, ParagraphStyle('LD', fontName=font_reg, fontSize=8.5, leading=10, alignment=1, textColor=colors.HexColor('#333333'))),
                    Paragraph(desc_html, ParagraphStyle('LX', fontName=font_reg, fontSize=8.5, leading=10.5, textColor=colors.HexColor('#333333'))),
                    deb_str,
                    cred_str,
                    bal_str
                ])

            closing_bal = float(voucher_data.get('closingBalance') or voucher_data.get('amount') or curr_running)

            # Render Summary Stack
            summary_p = ParagraphStyle('SSP', fontName=font_reg, fontSize=8.5, leading=11, textColor=colors.HexColor('#333333'))
            summary_b = ParagraphStyle('SSB', fontName=font_bold, fontSize=8.5, leading=11, textColor=colors.HexColor('#000000'))
            period_display = period_val or f"As of {format_doc_date(v_date)}"

            stack_data = [
                [
                    Paragraph(f"<b>Statement Period:</b> {period_display}", summary_p),
                    Paragraph(f"<b>Opening Balance:</b> {opening_bal:,.2f} SAR", summary_p)
                ],
                [
                    Paragraph(f"<b>Total Debits:</b> {float(tot_debits):,.2f} SAR  •  <b>Total Credits:</b> {float(tot_credits):,.2f} SAR", summary_p),
                    Paragraph(f"<b>Net Outstanding Balance:</b> {closing_bal:,.2f} SAR", summary_b)
                ]
            ]
            stack_table = Table(stack_data, colWidths=[270, 245.03])
            stack_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]))
            elements.append(stack_table)
            elements.append(Spacer(1, 10.00))

            # 3A.2 Ledger Table (repeatRows=1)
            ledger_cols = [
                ("Date", "center"),
                ("Transaction Details", "left"),
                ("Debit (SAR)", "right"),
                ("Credit (SAR)", "right"),
                ("Balance (SAR)", "right")
            ]
            ledger_widths = [70.00, 205.03, 80.00, 80.00, 80.00]
            ledger_table = self.build_reference_items_table(doc_width, ledger_cols, ledger_rows, col_widths=ledger_widths)
            elements.append(ledger_table)
            elements.append(Spacer(1, 0.75))

            # 3A.3 Closing Totals Block
            words_text = self.number_to_words(closing_bal)
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
            elements.extend(sigs)

        # =========================================================================
        # 3B. TRANSACTIONAL CASE: CWO, VPA, PAYMENT VOUCHER, RECEIPT VOUCHER
        # =========================================================================
        else:
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
            computed_subtotal = Decimal('0.00')

            for idx, p in enumerate(particulars, 1):
                item_desc = p.get('item') or p.get('description') or 'Item'
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

                desc_parts = [prt.strip() for prt in str(item_desc).split('\\n') if prt.strip() and prt.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Item</font>'

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

            # 4. Totals Block (Total amount appears ONCE in totals area)
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
            # Single for CWO and VPA; double for Payment and Receipt vouchers
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

# -------------------------------------------------------------------------
# NEW generate_salary_voucher_pdf (with employee ID and breakdown parity)
# -------------------------------------------------------------------------
new_salary_voucher = '''    def generate_salary_voucher_pdf(self, salary, timesheets=None):
        """
        Generates an official corporate Payroll Disbursement Voucher PDF
        strictly adhering to reference DC-00002.pdf design.
        Includes Employee ID, Pay Period, earnings and deductions breakdown,
        net pay in words, timesheet attendance log, and double signature.
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
        emp_id = getattr(salary, 'employee_id', None) or (salary.get('employee_id') if isinstance(salary, dict) else None) or f"EMP-{sal_id:04d}"
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
            ("Employee ID", emp_id),
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

        # 3. Items Table (Earnings & Deductions Breakdown)
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
                Paragraph('<font color="#333333">Payroll Deductions / Advances</font><br/><font color="#727272">Authorized statutory or advance recovery</font>', ParagraphStyle('ItmDesc3', fontName=font_reg, fontSize=9, leading=10.39)),
                "1.00",
                f"-{deductions:,.2f}",
                f"-{deductions:,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block (Net pay in words)
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

# -------------------------------------------------------------------------
# NEW generate_tax_invoice_pdf (with bilingual labels and ZATCA QR code)
# -------------------------------------------------------------------------
new_tax_invoice = '''    def generate_tax_invoice_pdf(self, invoice):
        """
        Generates an official corporate Tax Invoice PDF strictly adhering to reference DC-00002.pdf design.
        Includes bilingual Arabic/English headers, ZATCA Phase 1 Vector QR code, seller/buyer TRN,
        taxable amount, VAT breakdown, and single authorized signature.
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

        # 1. Header (Bilingual invoice title)
        doc_num = invoice.invoice_number or f"INV-{invoice.id:05d}"
        header = self.build_reference_header(doc_width, "TAX INVOICE / فاتورة ضريبية", f"Invoice# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta (Buyer details with VAT/TRN)
        cust = invoice.customer
        cust_name = cust.name if cust else "Valued Client"
        cust_tax = invoice.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = invoice.billing_address or getattr(cust, 'address', '') or ''
        cust_phone = getattr(cust, 'phone', '') or ''

        sub_parts = []
        if cust_tax and cust_tax not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(f"Buyer TRN / الرقم الضريبي: {cust_tax}")
        if cust_address and cust_address not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(cust_address)
        if cust_phone and cust_phone not in ('-', 'None', 'null', 'N/A'):
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
            party_label="Bill To / العميل",
            party_name=cust_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table (Bilingual headers, Taxable Amount, VAT rate & amount)
        items = list(invoice.items.all())
        columns = [
            ("#", "center"),
            ("Description / الوصف", "left"),
            ("Qty", "right"),
            ("Price", "right"),
            ("VAT %", "right"),
            ("VAT Amt", "right"),
            ("Total (SAR)", "right")
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
                desc_parts = [p.strip() for p in desc_text.split('\\n') if p.strip() and p.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Item</font>'

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

        # 4. Totals Block (Taxable Amount, VAT, Net Total with SAR glyph, Total in Words)
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
        elements.append(Spacer(1, 15.00))

        # 5. Bottom Remittance Details & Vector ZATCA QR Code
        bank = getattr(invoice, 'bank_account', None)
        remittance_lines = []
        if bank:
            remittance_lines.append(f"<b>Remittance Bank:</b> {bank.bank_name}")
            remittance_lines.append(f"<b>Account Name:</b> {bank.account_name}")
            remittance_lines.append(f"<b>IBAN:</b> {bank.iban}")
        if invoice.notes:
            remittance_lines.append(f"<b>Notes:</b> {invoice.notes}")
        if invoice.terms:
            remittance_lines.append(f"<b>Terms:</b> {invoice.terms}")

        remittance_p = Paragraph("<br/>".join(remittance_lines) if remittance_lines else "", ParagraphStyle('RemP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))

        # Vector ZATCA Phase 1 QR Code
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
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------------------
# NEW generate_credit_note_pdf (with bilingual labels and ZATCA QR code)
# -------------------------------------------------------------------------
new_credit_note = '''    def generate_credit_note_pdf(self, credit_note):
        """
        Generates an official corporate Credit Note PDF
        strictly adhering to reference DC-00002.pdf design.
        Includes bilingual Arabic/English title, original invoice reference,
        credit reason, vector ZATCA QR code, and single authorized signature.
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

        # 1. Header (Bilingual Credit Note title)
        doc_num = credit_note.credit_note_number or f"CN-{credit_note.id:05d}"
        header = self.build_reference_header(doc_width, "CREDIT NOTE / إشعار دائن", f"Credit Note# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 23.20))

        # 2. Party & Meta
        cust = credit_note.customer
        cust_name = cust.name if cust else (getattr(credit_note, 'client_name', '') or 'Valued Client')
        cust_tax = credit_note.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = credit_note.billing_address or getattr(cust, 'address', '') or ''

        sub_parts = []
        if cust_tax and cust_tax not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(f"Buyer TRN / الرقم الضريبي: {cust_tax}")
        if cust_address and cust_address not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(cust_address)
        party_sub = '\\n'.join(sub_parts) if sub_parts else None

        cn_date = format_doc_date(credit_note.credit_note_date)
        meta_pairs = [
            ("Credit Date", cn_date)
        ]
        if credit_note.invoice:
            meta_pairs.append(("Original Invoice", credit_note.invoice.invoice_number))
        if credit_note.reason and credit_note.reason not in ('-', 'None', 'null'):
            meta_pairs.append(("Credit Reason", credit_note.reason))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Credited To / إشعار دائن إلى",
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
            ("Description / الوصف", "left"),
            ("Qty", "right"),
            ("Price", "right"),
            ("VAT %", "right"),
            ("VAT Amt", "right"),
            ("Total (SAR)", "right")
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
                desc_parts = [p.strip() for p in desc_text.split('\\n') if p.strip() and p.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Item</font>'

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
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------------------
# NEW generate_admin_estimation_pdf (with marked internal and no customer sig)
# -------------------------------------------------------------------------
new_admin_estimation = '''    def generate_admin_estimation_pdf(self, estimation):
        """
        Generates an internal Admin Material Pricing & Margin Analysis PDF
        strictly adhering to reference DC-00002.pdf design.
        Marked INTERNAL CONFIDENTIAL with no customer signature.
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
            ("Classification", "INTERNAL USE ONLY"),
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

            if sub and sub not in ('-', 'None', 'null'):
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

        # 4. Totals Block (Margin analysis)
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

        # 5. Signatures (Internal management signature, strictly NO customer signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=estimation.notes or estimation.scope_of_work,
            signature_style='internal'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes'''

# -------------------------------------------------------------------------
# Replace methods in code
# -------------------------------------------------------------------------
# Replace generate_payment_voucher_pdf
idx_pv = code.find('    def generate_payment_voucher_pdf')
idx_enq = code.find('    def generate_enquiry_pdf')
code = code[:idx_pv] + new_payment_voucher + '\n\n' + code[idx_enq:]

# Replace generate_salary_voucher_pdf
idx_sal = code.find('    def generate_salary_voucher_pdf')
idx_fin = code.find('    def generate_financial_report_pdf')
code = code[:idx_sal] + new_salary_voucher + '\n\n' + code[idx_fin:]

# Replace generate_tax_invoice_pdf
idx_ti = code.find('    def generate_tax_invoice_pdf')
idx_cl = code.find('    def generate_client_estimation_checklist_pdf')
code = code[:idx_ti] + new_tax_invoice + '\n\n' + code[idx_cl:]

# Replace generate_admin_estimation_pdf
idx_adm = code.find('    def generate_admin_estimation_pdf')
idx_qt = code.find('    def generate_quotation_pdf')
code = code[:idx_adm] + new_admin_estimation + '\n\n' + code[idx_qt:]

# Replace generate_credit_note_pdf
idx_cn = code.find('    def generate_credit_note_pdf')
idx_dn = code.find('    def generate_delivery_note_pdf')
code = code[:idx_cn] + new_credit_note + '\n\n' + code[idx_dn:]

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESSFULLY APPLIED ROUND 2 UPDATES TO pdf_generator.py")

