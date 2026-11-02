import os, sys

target_file = 'backend/api/pdf_generator.py'
with open(target_file, 'r', encoding='utf-8') as f:
    code = f.read()

# -------------------------------------------------------------------------
# 1. Add build_reference_summary_stack to UniversalPDFGenerator
# -------------------------------------------------------------------------
summary_stack_def = '''    def build_reference_summary_stack(self, doc_width, summary_items):
        """
        A clean, quiet summary stack above report tables to replace legacy KPI cards.
        summary_items: list of tuples [('Label', 'Value'), ...] or list of dicts [{'label': '...', 'value': '...'}]
        Renders as a 2-column or 3-column borderless, unboxed table with bold values.
        """
        if not summary_items:
            return Spacer(1, 1)

        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        pairs = []
        for itm in summary_items:
            if isinstance(itm, dict):
                lbl = itm.get('label') or itm.get('name') or itm.get('title')
                val = itm.get('value')
            elif isinstance(itm, (list, tuple)) and len(itm) >= 2:
                lbl, val = itm[0], itm[1]
            else:
                continue
            if val is None or str(val).strip() in ('', '-', 'None', 'null'):
                continue
            pairs.append((str(lbl), str(val)))

        if not pairs:
            return Spacer(1, 1)

        cols = 3 if doc_width > 600 or len(pairs) >= 6 else 2
        col_w = doc_width / cols

        rows = []
        curr_row = []
        lbl_style = ParagraphStyle('SSLbl', fontName=font_reg, fontSize=8.5, leading=11, textColor=colors.HexColor('#555555'))

        for lbl, val in pairs:
            cell_p = Paragraph(f"{lbl}: <b>{val}</b>", lbl_style)
            curr_row.append(cell_p)
            if len(curr_row) == cols:
                rows.append(curr_row)
                curr_row = []
        if curr_row:
            while len(curr_row) < cols:
                curr_row.append(Paragraph("", lbl_style))
            rows.append(curr_row)

        t = Table(rows, colWidths=[col_w] * cols)
        t.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        return t
'''

# -------------------------------------------------------------------------
# 2. Complete Phase C Report Generators
# -------------------------------------------------------------------------

reports_code = '''    def generate_universal_table_pdf(self, title, columns, rows, kpis=None, ref_number=None, period_text=None, totals=None, filename_prefix='report', orientation='portrait'):
        """
        Universal corporate report PDF matching reference DC-00002 design standard.
        Charcoal header, thin #adadad row dividers, quiet summary stack, no alternating colors,
        footer timestamp and page count.
        """
        from reportlab.lib.pagesizes import A4, landscape
        buffer = BytesIO()
        is_landscape = (orientation == 'landscape' or len(columns) > 6)
        psize = landscape(A4) if is_landscape else A4
        page_w, page_h = psize

        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        # 1. Header
        ref = ref_number or f"Report# {datetime.now().strftime('%Y%m%d')}"
        elements.append(self.build_reference_header(doc_w, title.upper(), ref))
        elements.append(Spacer(1, 15.00))

        # 2. Summary Stack (Replacing KPI cards)
        summary_items = []
        if period_text:
            summary_items.append(("Report Period", str(period_text)))
        if kpis:
            if isinstance(kpis, list):
                summary_items.extend(kpis)
            elif isinstance(kpis, dict):
                summary_items.extend(kpis.items())

        if summary_items:
            elements.append(self.build_reference_summary_stack(doc_w, summary_items))
            elements.append(Spacer(1, 12.00))

        # 3. Table
        # Columns format
        cols_formatted = []
        col_w = doc_w / len(columns) if columns else doc_w
        for c in columns:
            c_name = c if isinstance(c, str) else (c.get('header') or c.get('title') or c.get('name') or 'Column')
            align = 'right' if any(k in c_name.lower() for k in ['amount', 'total', 'debit', 'credit', 'balance', 'inflow', 'outflow', 'rate', 'price', 'sar']) else 'left'
            cols_formatted.append((c_name, align))

        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []
        for r in rows:
            row_cells = []
            for idx, c in enumerate(columns):
                val = r[idx] if isinstance(r, (list, tuple)) and idx < len(r) else (r.get(c) if isinstance(r, dict) else (r.get(c.get('key')) if isinstance(c, dict) else ''))
                val_str = str(val) if val is not None else ''
                align = cols_formatted[idx][1]
                p_align = 2 if align == 'right' else 0
                row_cells.append(Paragraph(val_str, ParagraphStyle('TRow', fontName=font_reg, fontSize=8.0 if is_landscape else 8.5, leading=10.5, alignment=p_align, textColor=colors.HexColor('#333333'))))
            table_rows.append(row_cells)

        items_table = self.build_reference_items_table(doc_w, cols_formatted, table_rows, col_widths=[col_w] * len(columns))
        elements.append(items_table)

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_cashbook_ledger_pdf(self, book_data, summary, entries, filters=None):
        """
        Generates official Cashbook Statement & Transaction Ledger PDF in landscape.
        Charcoal table header, thin dividers, summary stack, no alternating rows.
        """
        from reportlab.lib.pagesizes import A4, landscape
        buffer = BytesIO()
        psize = landscape(A4)
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        book_name = book_data.get('name', 'Main Cashbook') if isinstance(book_data, dict) else getattr(book_data, 'name', 'Main Cashbook')
        header = self.build_reference_header(doc_w, "CASHBOOK LEDGER REPORT", f"Book# {book_name}")
        elements.append(header)
        elements.append(Spacer(1, 15.00))

        # Summary Stack
        open_b = float(summary.get('opening_balance', 0) if isinstance(summary, dict) else getattr(summary, 'opening_balance', 0))
        tot_in = float(summary.get('total_inflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_inflow', 0))
        tot_out = float(summary.get('total_outflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_outflow', 0))
        close_b = float(summary.get('closing_balance', 0) if isinstance(summary, dict) else getattr(summary, 'closing_balance', 0))
        net_f = tot_in - tot_out

        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        summary_items = [
            ("Ledger Period", p_str),
            ("Opening Balance", f"{open_b:,.2f} SAR"),
            ("Total Inflow", f"{tot_in:,.2f} SAR"),
            ("Total Outflow", f"{tot_out:,.2f} SAR"),
            ("Net Cash Movement", f"{net_f:,.2f} SAR"),
            ("Closing Book Balance", f"{close_b:,.2f} SAR")
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        # Ledger Table
        cols = [
            ("#", "center"),
            ("Date", "center"),
            ("Ref #", "left"),
            ("Account / Category", "left"),
            ("Description / Narration", "left"),
            ("Inflow (SAR)", "right"),
            ("Outflow (SAR)", "right"),
            ("Balance (SAR)", "right")
        ]
        col_w = [25.00, 70.00, 75.00, 120.00, 231.30, 80.00, 80.00, 80.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        running = open_b
        for idx, e in enumerate(entries, 1):
            e_date = format_doc_date(e.get('date') or e.get('entry_date')) if isinstance(e, dict) else format_doc_date(getattr(e, 'date', ''))
            e_ref = str(e.get('reference') or e.get('ref_no') or f"EN-{idx:04d}") if isinstance(e, dict) else str(getattr(e, 'reference', f"EN-{idx:04d}"))
            e_cat = str(e.get('category') or e.get('account') or 'General') if isinstance(e, dict) else str(getattr(e, 'category', 'General'))
            e_desc = str(e.get('description') or e.get('narration') or 'Cash Transaction') if isinstance(e, dict) else str(getattr(e, 'description', 'Cash Transaction'))
            e_in = float(e.get('inflow', 0) or e.get('debit', 0)) if isinstance(e, dict) else float(getattr(e, 'inflow', 0) or 0)
            e_out = float(e.get('outflow', 0) or e.get('credit', 0)) if isinstance(e, dict) else float(getattr(e, 'outflow', 0) or 0)
            running = running + e_in - e_out

            table_rows.append([
                str(idx),
                e_date,
                Paragraph(e_ref, ParagraphStyle('CR', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(e_cat, ParagraphStyle('CC', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(e_desc, ParagraphStyle('CD', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                f"{e_in:,.2f}" if e_in > 0 else "",
                f"{e_out:,.2f}" if e_out > 0 else "",
                f"{running:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_cashbook_bank_flow_pdf(self, summary, transactions, filters=None):
        """
        Generates Consolidated Bank Flow & Transaction Ledger PDF in landscape.
        """
        from reportlab.lib.pagesizes import A4, landscape
        buffer = BytesIO()
        psize = landscape(A4)
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        elements.append(self.build_reference_header(doc_w, "CONSOLIDATED BANK FLOW REPORT", f"Flow# {datetime.now().strftime('%Y%m%d')}"))
        elements.append(Spacer(1, 15.00))

        tot_in = float(summary.get('total_inflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_inflow', 0))
        tot_out = float(summary.get('total_outflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_outflow', 0))
        net_m = tot_in - tot_out
        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        summary_items = [
            ("Flow Period", p_str),
            ("Total Inflow Transferred", f"{tot_in:,.2f} SAR"),
            ("Total Outflow Disbursed", f"{tot_out:,.2f} SAR"),
            ("Net Inter-Bank Flow", f"{net_m:,.2f} SAR"),
            ("Total Transactions", str(len(transactions)))
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("#", "center"),
            ("Date", "center"),
            ("From Bank Account", "left"),
            ("To Bank Account", "left"),
            ("Description / Purpose", "left"),
            ("Transfer Amount (SAR)", "right")
        ]
        col_w = [25.00, 75.00, 160.00, 160.00, 221.30, 120.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        for idx, t in enumerate(transactions, 1):
            t_date = format_doc_date(t.get('date') if isinstance(t, dict) else getattr(t, 'date', ''))
            f_bank = str(t.get('from_bank') or t.get('from_account') or 'Main Account') if isinstance(t, dict) else str(getattr(t, 'from_bank', ''))
            to_bank = str(t.get('to_bank') or t.get('to_account') or 'Beneficiary') if isinstance(t, dict) else str(getattr(t, 'to_bank', ''))
            desc = str(t.get('description') or t.get('notes') or 'Bank Funds Transfer') if isinstance(t, dict) else str(getattr(t, 'description', ''))
            amt = float(t.get('amount', 0) if isinstance(t, dict) else getattr(t, 'amount', 0))

            table_rows.append([
                str(idx),
                t_date,
                Paragraph(f_bank, ParagraphStyle('FB', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(to_bank, ParagraphStyle('TB', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(desc, ParagraphStyle('TD', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                f"{amt:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_bank_statement_pdf(self, bank, summary, transactions, filters=None):
        """
        Generates official Bank Statement PDF in portrait layout matching DC-00002.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(buffer, pagesize=A4, leftMargin=45.60, rightMargin=34.79, topMargin=55.15, bottomMargin=50.03)
        doc_w = 515.03
        frame = Frame(45.60, 50.03, doc_w, 841.69 - 55.15 - 50.03, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        bank_name = getattr(bank, 'bank_name', str(bank))
        acct_no = getattr(bank, 'account_number', '') or ''
        iban = getattr(bank, 'iban', '') or ''

        elements.append(self.build_reference_header(doc_w, "BANK STATEMENT", f"Account# {acct_no or 'BANK'}"))
        elements.append(Spacer(1, 15.00))

        open_b = float(summary.get('opening_balance', 0) if isinstance(summary, dict) else getattr(summary, 'opening_balance', 0))
        tot_dep = float(summary.get('total_deposits', 0) if isinstance(summary, dict) else getattr(summary, 'total_deposits', 0))
        tot_wth = float(summary.get('total_withdrawals', 0) if isinstance(summary, dict) else getattr(summary, 'total_withdrawals', 0))
        close_b = float(summary.get('closing_balance', 0) if isinstance(summary, dict) else getattr(summary, 'closing_balance', 0))

        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        summary_items = [
            ("Bank & Account", f"{bank_name} • {acct_no}"),
            ("Statement Period", p_str),
            ("Opening Balance", f"{open_b:,.2f} SAR"),
            ("Total Deposits", f"{tot_dep:,.2f} SAR"),
            ("Total Withdrawals", f"{tot_wth:,.2f} SAR"),
            ("Closing Book Balance", f"{close_b:,.2f} SAR")
        ]
        if iban:
            summary_items.insert(1, ("IBAN", str(iban)))

        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("Date", "center"),
            ("Description / Reference", "left"),
            ("Withdrawal (SAR)", "right"),
            ("Deposit (SAR)", "right"),
            ("Balance (SAR)", "right")
        ]
        col_w = [70.00, 205.03, 80.00, 80.00, 80.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        running = open_b
        for t in transactions:
            t_date = format_doc_date(t.get('date') if isinstance(t, dict) else getattr(t, 'date', ''))
            t_desc = str(t.get('description') or t.get('details') or 'Bank Transaction') if isinstance(t, dict) else str(getattr(t, 'description', ''))
            deb = float(t.get('withdrawal', 0) or t.get('debit', 0)) if isinstance(t, dict) else float(getattr(t, 'withdrawal', 0) or 0)
            cred = float(t.get('deposit', 0) or t.get('credit', 0)) if isinstance(t, dict) else float(getattr(t, 'deposit', 0) or 0)
            running = running + cred - deb

            table_rows.append([
                Paragraph(t_date, ParagraphStyle('BD', fontName=font_reg, fontSize=8, leading=10, alignment=1, textColor=colors.HexColor('#333333'))),
                Paragraph(t_desc, ParagraphStyle('BX', fontName=font_reg, fontSize=8, leading=10.5, textColor=colors.HexColor('#333333'))),
                f"{deb:,.2f}" if deb > 0 else "",
                f"{cred:,.2f}" if cred > 0 else "",
                f"{running:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_employee_ledger_pdf(self, employee_ledger):
        """
        Generates official Employee Payroll Ledger & Balance Statement PDF.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(buffer, pagesize=A4, leftMargin=45.60, rightMargin=34.79, topMargin=55.15, bottomMargin=50.03)
        doc_w = 515.03
        frame = Frame(45.60, 50.03, doc_w, 841.69 - 55.15 - 50.03, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        staff_name = employee_ledger.get('staff_name', 'Employee') if isinstance(employee_ledger, dict) else getattr(employee_ledger, 'staff_name', 'Employee')
        elements.append(self.build_reference_header(doc_w, "EMPLOYEE LEDGER", f"Employee# {staff_name}"))
        elements.append(Spacer(1, 15.00))

        summary = employee_ledger.get('summary', {}) if isinstance(employee_ledger, dict) else getattr(employee_ledger, 'summary', {})
        tot_earn = float(summary.get('total_earnings', 0))
        tot_adv = float(summary.get('total_advances', 0))
        tot_paid = float(summary.get('total_paid', 0))
        net_bal = float(summary.get('net_balance', 0))

        summary_items = [
            ("Employee Name", str(staff_name)),
            ("Total Accrued Earnings", f"{tot_earn:,.2f} SAR"),
            ("Total Advances / Deductions", f"{tot_adv:,.2f} SAR"),
            ("Total Disbursed", f"{tot_paid:,.2f} SAR"),
            ("Net Outstanding Balance", f"{net_bal:,.2f} SAR")
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("Date", "center"),
            ("Transaction / Shift Details", "left"),
            ("Accrued (SAR)", "right"),
            ("Paid (SAR)", "right"),
            ("Balance (SAR)", "right")
        ]
        col_w = [70.00, 205.03, 80.00, 80.00, 80.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        entries = employee_ledger.get('entries', []) if isinstance(employee_ledger, dict) else getattr(employee_ledger, 'entries', [])
        for e in entries:
            e_date = format_doc_date(e.get('date'))
            e_desc = str(e.get('description') or e.get('details') or 'Payroll Item')
            acc = float(e.get('accrued', 0) or e.get('debit', 0))
            paid = float(e.get('paid', 0) or e.get('credit', 0))
            bal = float(e.get('balance', 0))

            table_rows.append([
                Paragraph(e_date, ParagraphStyle('ED', fontName=font_reg, fontSize=8, leading=10, alignment=1, textColor=colors.HexColor('#333333'))),
                Paragraph(e_desc, ParagraphStyle('EX', fontName=font_reg, fontSize=8, leading=10.5, textColor=colors.HexColor('#333333'))),
                f"{acc:,.2f}" if acc > 0 else "",
                f"{paid:,.2f}" if paid > 0 else "",
                f"{bal:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_timesheet_report_pdf(self, timesheets, filters=None):
        """
        Generates official Staff Timesheet and Attendance Audit Report PDF in landscape.
        """
        from reportlab.lib.pagesizes import A4, landscape
        buffer = BytesIO()
        psize = landscape(A4)
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        elements.append(self.build_reference_header(doc_w, "TIMESHEET AUDIT REPORT", f"Audit# {datetime.now().strftime('%Y%m%d')}"))
        elements.append(Spacer(1, 15.00))

        tot_shifts = len(timesheets)
        tot_reg = sum(float(getattr(t, 'regular_hours', 8) or 8) if not isinstance(t, dict) else float(t.get('regular_hours', 8) or 8) for t in timesheets)
        tot_ot = sum(float(getattr(t, 'overtime_hours', 0) or 0) if not isinstance(t, dict) else float(t.get('overtime_hours', 0) or 0) for t in timesheets)
        tot_hrs = tot_reg + tot_ot

        summary_items = [
            ("Audit Period", (filters.get('month') if filters else None) or f"As of {datetime.now().strftime('%d/%m/%Y')}"),
            ("Total Shift Records", str(tot_shifts)),
            ("Total Regular Hours", f"{tot_reg:,.1f} hrs"),
            ("Total Overtime Hours", f"{tot_ot:,.1f} hrs"),
            ("Combined Total Hours", f"{tot_hrs:,.1f} hrs")
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("#", "center"),
            ("Date", "center"),
            ("Staff Name", "left"),
            ("Job Order / Work Shift", "left"),
            ("Clock In", "center"),
            ("Clock Out", "center"),
            ("Reg Hrs", "right"),
            ("OT Hrs", "right"),
            ("Total Hrs", "right"),
            ("Status", "center")
        ]
        col_w = [25.00, 65.00, 130.00, 231.30, 60.00, 60.00, 50.00, 50.00, 50.00, 40.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        for idx, ts in enumerate(timesheets, 1):
            t_date = format_doc_date(getattr(ts, 'date', '')) if not isinstance(ts, dict) else format_doc_date(ts.get('date'))
            s_name = str(getattr(ts, 'staff_name', '')) if not isinstance(ts, dict) else str(ts.get('staff_name', ''))
            job = str(getattr(ts, 'job_description', '') or getattr(ts, 'notes', '') or 'General Shift') if not isinstance(ts, dict) else str(ts.get('job_description', '') or ts.get('notes', '') or 'General Shift')
            cin = str(getattr(ts, 'clock_in', '') or '08:00') if not isinstance(ts, dict) else str(ts.get('clock_in', '08:00'))
            cout = str(getattr(ts, 'clock_out', '') or '17:00') if not isinstance(ts, dict) else str(ts.get('clock_out', '17:00'))
            r_hrs = float(getattr(ts, 'regular_hours', 8) or 8) if not isinstance(ts, dict) else float(ts.get('regular_hours', 8) or 8)
            o_hrs = float(getattr(ts, 'overtime_hours', 0) or 0) if not isinstance(ts, dict) else float(ts.get('overtime_hours', 0) or 0)
            t_sum = r_hrs + o_hrs
            st = str(getattr(ts, 'status', 'Approved') or 'Approved') if not isinstance(ts, dict) else str(ts.get('status', 'Approved') or 'Approved')

            table_rows.append([
                str(idx),
                t_date,
                Paragraph(s_name, ParagraphStyle('TN', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(job, ParagraphStyle('TJ', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                cin,
                cout,
                f"{r_hrs:.1f}",
                f"{o_hrs:.1f}",
                f"{t_sum:.1f}",
                st
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_financial_report_pdf(self, report_type, data, filters=None):
        """
        Generates uniform corporate Financial Report PDF matching DC-00002 standard.
        """
        from reportlab.lib.pagesizes import A4, landscape
        buffer = BytesIO()
        psize = landscape(A4)
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        rep_title = f"FINANCIAL REPORT ({report_type.upper()})"
        elements.append(self.build_reference_header(doc_w, rep_title, f"FinReport# {datetime.now().strftime('%Y%m%d')}"))
        elements.append(Spacer(1, 15.00))

        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        kpi_list = data.get('kpis', []) if isinstance(data, dict) else []
        summary_items = [("Reporting Period", p_str)]
        for k in kpi_list:
            lbl = k.get('label') or k.get('title') or 'Metric'
            val = k.get('value')
            if val is not None:
                summary_items.append((lbl, str(val)))

        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        # Records Table
        records = data.get('records', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
        if records:
            first = records[0]
            if isinstance(first, dict):
                col_keys = list(first.keys())[:7] # take first 7 fields
            else:
                col_keys = [f"Col {i}" for i in range(len(first))]
        else:
            col_keys = ["#", "Item", "Details", "Amount (SAR)"]

        cols = []
        for k in col_keys:
            align = 'right' if any(w in k.lower() for w in ['amount', 'total', 'debit', 'credit', 'balance', 'price', 'sar']) else 'left'
            cols.append((k.replace('_', ' ').title(), align))

        col_w = doc_w / len(cols) if cols else doc_w
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        for r in records[:100]:
            r_cells = []
            for idx, c in enumerate(col_keys):
                v = r.get(c) if isinstance(r, dict) else (r[idx] if idx < len(r) else '')
                v_str = str(v) if v is not None else ''
                p_align = 2 if cols[idx][1] == 'right' else 0
                r_cells.append(Paragraph(v_str, ParagraphStyle('FCR', fontName=font_reg, fontSize=8, leading=10, alignment=p_align, textColor=colors.HexColor('#333333'))))
            table_rows.append(r_cells)

        if not table_rows:
            table_rows.append([Paragraph("No records found for specified financial criteria", ParagraphStyle('FCE', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#727272')))] * len(cols))

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=[col_w] * len(cols)))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
'''

# -------------------------------------------------------------------------
# 3. Apply changes and remove legacy helpers completely
# -------------------------------------------------------------------------
# Find the start of report methods (where generate_bank_statement_pdf begins)
idx_rep_start = code.find('    def generate_bank_statement_pdf')
# Find where generate_tax_invoice_pdf begins
idx_ti = code.find('    def generate_tax_invoice_pdf')

# Check if build_reference_summary_stack is already present
if 'def build_reference_summary_stack' not in code:
    idx_styles = code.find('    def _setup_styles(self):')
    code = code[:idx_styles] + summary_stack_def + '\n' + code[idx_styles:]
    # Recalculate offsets after insertion
    idx_rep_start = code.find('    def generate_bank_statement_pdf')
    idx_ti = code.find('    def generate_tax_invoice_pdf')

# Replace everything from generate_bank_statement_pdf up to generate_tax_invoice_pdf
# (This includes the definitions of build_kpi_cards_flowable, build_doc_title_banner, build_signatures_flowable!)
code = code[:idx_rep_start] + reports_code + '\n\n' + code[idx_ti:]

# Also remove any leftover definition of build_doc_title_banner, build_kpi_cards_flowable, build_signatures_flowable if they were above generate_bank_statement_pdf
import re
for old_helper in ['build_kpi_cards_flowable', 'build_doc_title_banner', 'build_signatures_flowable', 'build_header_flowable']:
    pattern = rf'    def {old_helper}\(self[^\n]*\):.*?(?=\n    def |\Z)'
    code = re.sub(pattern, '', code, flags=re.DOTALL)

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESSFULLY APPLIED PHASE C REPORTS MIGRATION AND REMOVED OLD HELPERS!")

