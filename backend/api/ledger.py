import datetime
from decimal import Decimal
from django.db.models import Q
from .models import (
    Customer, Vendor, JobOrder, Invoice, CustomerPayment, VendorPayment,
    CreditNote, Expense, Labour
)


def _parse_date(d):
    if not d:
        return None
    if isinstance(d, datetime.date):
        return d
    if isinstance(d, datetime.datetime):
        return d.date()
    try:
        return datetime.date.fromisoformat(str(d).strip()[:10])
    except Exception:
        return None


def build_customer_ledger(customer_or_id, start_date=None, end_date=None, search=None):
    """
    Builds a unified, chronological, signed accounting ledger for a customer.
    Follows forensic rules:
      Debits:
        - Non-cancelled JobOrders (date=created_at.date())
        - Standalone Invoices (job_order is null, status not in ['Draft', 'Cancelled'])
        - Refund payments (CustomerPayment where payment_type == 'refund')
      Credits:
        - Customer payments where payment_type not in ['refund', 'credit_note']
        - CreditNotes with status in ['Issued', 'Applied', 'Refunded']
      Reference rows:
        - Invoices linked to a job: zero-amount reference rows (debit=0, credit=0)
      Running balance:
        - Signed running balance, no clamping.
      Date-filtered statements:
        - opening = debits_before_start - credits_before_start.
    """
    if isinstance(customer_or_id, Customer):
        customer = customer_or_id
    else:
        customer = Customer.objects.get(pk=customer_or_id)

    s_date = _parse_date(start_date)
    e_date = _parse_date(end_date)

    all_items = []

    # 1. Non-cancelled Job Orders (Debit)
    job_orders = customer.job_orders.exclude(status='Cancelled').select_related('customer')
    for j in job_orders:
        j_date = j.created_at.date() if j.created_at else datetime.date.today()
        amt = round(float(j.total_amount or 0), 2)
        all_items.append({
            'raw_id': j.id,
            'id': f"job-{j.id}",
            'date': j_date,
            'ref': j.order_id or f"JOB-{j.id}",
            'type': 'job_order',
            'type_label': 'Job Order',
            'type_priority': 1,
            'description': j.title or f"Job Order {j.order_id}",
            'debit': amt,
            'credit': 0.0,
            'status': j.status,
            'job_order_id': j.id,
        })

    # 2. Invoices
    # Standalone Invoices (status not Draft/Cancelled) -> Debit
    # Linked Invoices -> Zero-amount reference rows
    invoices = customer.invoices.all().select_related('job_order')
    for inv in invoices:
        inv_date = inv.invoice_date or (inv.created_at.date() if inv.created_at else datetime.date.today())
        if inv.job_order_id:
            # Reference row (0 amount)
            all_items.append({
                'raw_id': inv.id,
                'id': f"inv-ref-{inv.id}",
                'date': inv_date,
                'ref': inv.invoice_number or f"INV-{inv.id}",
                'type': 'invoice_ref',
                'type_label': 'Tax Invoice (Ref)',
                'type_priority': 3,
                'description': f"Tax Invoice for Job {inv.job_order.order_id if inv.job_order else ''}".strip(),
                'debit': 0.0,
                'credit': 0.0,
                'status': inv.status,
                'invoice_id': inv.id,
                'job_order_id': inv.job_order_id,
            })
        else:
            # Standalone Invoice
            if inv.status not in ['Draft', 'Cancelled']:
                amt = round(float(inv.total_amount or 0), 2)
                all_items.append({
                    'raw_id': inv.id,
                    'id': f"inv-{inv.id}",
                    'date': inv_date,
                    'ref': inv.invoice_number or f"INV-{inv.id}",
                    'type': 'invoice',
                    'type_label': 'Tax Invoice',
                    'type_priority': 2,
                    'description': f"Standalone Invoice {inv.invoice_number}",
                    'debit': amt,
                    'credit': 0.0,
                    'status': inv.status,
                    'invoice_id': inv.id,
                })

    # 3. Customer Payments
    payments = customer.payments.all().select_related('job_order', 'invoice')
    for p in payments:
        p_date = p.payment_date or (p.created_at.date() if p.created_at else datetime.date.today())
        p_amt = round(float(p.amount or 0), 2)
        p_type = getattr(p, 'payment_type', None)

        if p_type == 'refund':
            # Refund payment is a DEBIT (cash returned to customer increases customer debt/lowers company collections)
            all_items.append({
                'raw_id': p.id,
                'id': f"ref-{p.id}",
                'date': p_date,
                'ref': f"REF-{p.id}",
                'type': 'refund',
                'type_label': 'Refund',
                'type_priority': 4,
                'description': p.notes or f"Customer Refund (PMT-{p.id})",
                'debit': p_amt,
                'credit': 0.0,
                'status': 'Paid Out',
                'payment_id': p.id,
            })
        elif p_type != 'credit_note':
            # Regular inflow payment is a CREDIT
            notes_str = (p.notes or '').strip()
            desc = notes_str if notes_str else f"Payment Received ({p_type or 'payment'})"
            all_items.append({
                'raw_id': p.id,
                'id': f"pay-{p.id}",
                'date': p_date,
                'ref': f"REC-{p.id}",
                'type': 'payment',
                'type_label': 'Payment',
                'type_priority': 5,
                'description': desc,
                'debit': 0.0,
                'credit': p_amt,
                'status': 'Received',
                'payment_id': p.id,
            })

    # 4. Credit Notes (Credit)
    credit_notes = customer.credit_notes.all()
    for cn in credit_notes:
        if cn.status in ['Issued', 'Applied', 'Refunded']:
            cn_date = cn.credit_note_date or (cn.created_at.date() if cn.created_at else datetime.date.today())
            cn_amt = round(float(cn.total_amount or 0), 2)
            all_items.append({
                'raw_id': cn.id,
                'id': f"cn-{cn.id}",
                'date': cn_date,
                'ref': cn.credit_note_number or f"CN-{cn.id}",
                'type': 'credit_note',
                'type_label': 'Credit Note',
                'type_priority': 6,
                'description': cn.notes or f"Credit Note {cn.credit_note_number}",
                'debit': 0.0,
                'credit': cn_amt,
                'status': cn.status,
                'credit_note_id': cn.id,
            })

    # Sort strictly by date, then type priority, then id
    all_items.sort(key=lambda x: (x['date'], x['type_priority'], x['raw_id']))

    # Split between prior items (for opening balance) and in-period items
    opening_balance = 0.0
    period_items = []

    for item in all_items:
        i_date = item['date']
        if s_date and i_date < s_date:
            opening_balance += (item['debit'] - item['credit'])
        elif e_date and i_date > e_date:
            continue
        else:
            period_items.append(item)

    opening_balance = round(opening_balance, 2)

    # Compute running balance over period items
    running = opening_balance
    total_debits = 0.0
    total_credits = 0.0
    total_refunds = 0.0

    final_rows = []
    for item in period_items:
        deb = item['debit']
        cred = item['credit']
        running = round(running + deb - cred, 2)
        total_debits = round(total_debits + deb, 2)
        total_credits = round(total_credits + cred, 2)
        if item['type'] == 'refund':
            total_refunds = round(total_refunds + deb, 2)

        row = dict(item)
        row['date'] = str(item['date'])
        row['running_balance'] = running
        final_rows.append(row)

    closing_balance = running

    # Search filter: if search query is provided, filter rows while preserving true historical running balances
    if search:
        q = str(search).strip().lower()
        final_rows = [
            r for r in final_rows
            if q in r['ref'].lower()
            or q in r['description'].lower()
            or q in r['type_label'].lower()
            or q in str(r['debit'])
            or q in str(r['credit'])
            or q in str(r['running_balance'])
        ]

    return {
        'customer': {
            'id': customer.id,
            'name': customer.name,
            'company_name': customer.company_name,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'tax_number': getattr(customer, 'tax_number', '') or '',
        },
        'period': {
            'start_date': str(s_date) if s_date else None,
            'end_date': str(e_date) if e_date else None,
        },
        'opening_balance': opening_balance,
        'rows': final_rows,
        'totals': {
            'total_debits': total_debits,
            'total_credits': total_credits,
            'net_movement': round(total_debits - total_credits, 2),
            'total_refunds': total_refunds,
        },
        'closing_balance': closing_balance,
    }


def build_vendor_ledger(vendor_or_id, start_date=None, end_date=None, search=None):
    """
    Builds a unified, chronological, signed accounting ledger for a vendor.
    Follows forensic rules:
      Opening Balance:
        - First row = Vendor.opening_balance (when no start_date).
        - Date-filtered statements: opening = opening_balance + everything before start_date.
      Debits:
        - All vendor Expenses (exclude is_opening_balance=True)
        - Labour payment_amount for vendor-linked labour
        - Per assigned non-cancelled job: a row "Job order contract allowance" =
          max(0, job.total_amount - vendor expenses on that job) when > 0.
      Credits:
        - VendorPayment
        - Labour.paid_amount for vendor-linked labour
      Running balance:
        - Signed running balance, no clamping: balance = previous_balance + debit - credit.
    """
    if isinstance(vendor_or_id, Vendor):
        vendor = vendor_or_id
    else:
        vendor = Vendor.objects.get(pk=vendor_or_id)

    s_date = _parse_date(start_date)
    e_date = _parse_date(end_date)
    base_ob = round(float(vendor.opening_balance or 0.0), 2)

    all_items = []

    # 1. Opening Balance item (if base_ob != 0)
    # Date assigned as vendor created_at date or early epoch
    ob_date = vendor.created_at.date() if vendor.created_at else datetime.date(2026, 1, 1)
    if base_ob != 0.0:
        all_items.append({
            'raw_id': 0,
            'id': f"ob-{vendor.id}",
            'date': ob_date,
            'ref': 'OPENING-BAL',
            'type': 'opening_balance',
            'type_label': 'Opening Balance',
            'type_priority': 0,
            'description': 'Vendor Opening Balance',
            'debit': base_ob,
            'credit': 0.0,
            'status': 'Confirmed',
        })

    # 2. All Vendor Expenses (exclude is_opening_balance=True) (Debit)
    expenses = vendor.expenses.filter(is_opening_balance=False).select_related('job_order')
    for exp in expenses:
        exp_date = exp.date or (exp.created_at.date() if exp.created_at else datetime.date.today())
        amt = round(float(exp.amount or 0), 2)
        desc_parts = [exp.description or f"Expense ({exp.category})"]
        if exp.job_order:
            desc_parts.append(f"Job: {exp.job_order.order_id}")
        all_items.append({
            'raw_id': exp.id,
            'id': f"exp-{exp.id}",
            'date': exp_date,
            'ref': f"EXP-{exp.id:04d}",
            'type': 'expense',
            'type_label': 'Expense Bill',
            'type_priority': 2,
            'description': ' - '.join(desc_parts),
            'debit': amt,
            'credit': 0.0,
            'status': 'Incurred',
            'expense_id': exp.id,
            'job_order_id': exp.job_order_id,
        })

    # 3. Labour payment_amount for vendor-linked labour (Debit)
    # AND Labour paid_amount for vendor-linked labour (Credit)
    labours = vendor.labours.all().select_related('job_order')
    for lab in labours:
        lab_date = lab.date or (lab.created_at.date() if lab.created_at else datetime.date.today())
        cost = round(float(lab.payment_amount or 0), 2)
        paid = round(float(lab.paid_amount or 0), 2)

        if cost > 0:
            all_items.append({
                'raw_id': lab.id,
                'id': f"lab-{lab.id}",
                'date': lab_date,
                'ref': f"LAB-{lab.id:04d}",
                'type': 'labour',
                'type_label': 'Labour Work',
                'type_priority': 3,
                'description': f"Labour Work: {lab.name} - {lab.work_done or 'Services'}",
                'debit': cost,
                'credit': 0.0,
                'status': lab.status,
                'labour_id': lab.id,
            })

        if paid > 0:
            all_items.append({
                'raw_id': lab.id,
                'id': f"lab-pay-{lab.id}",
                'date': lab_date,
                'ref': f"LAB-DISB-{lab.id:04d}",
                'type': 'labour_payment',
                'type_label': 'Labour Disbursement',
                'type_priority': 5,
                'description': f"Labour Payment Disbursed: {lab.name}",
                'debit': 0.0,
                'credit': paid,
                'status': 'Disbursed',
                'labour_id': lab.id,
            })

    # 4. Job order contract allowance per assigned non-cancelled job (Debit)
    # max(0, job.total_amount - vendor expenses on that job) when > 0
    assigned_jobs = vendor.job_orders.exclude(status='Cancelled').prefetch_related('expenses')
    for j in assigned_jobs:
        vexps = sum(float(e.amount or 0) for e in j.expenses.all() if e.vendor_id == vendor.id)
        allowance = max(0.0, float(j.total_amount or 0) - vexps)
        allowance = round(allowance, 2)
        if allowance > 0:
            j_date = j.created_at.date() if j.created_at else datetime.date.today()
            all_items.append({
                'raw_id': j.id,
                'id': f"job-allowance-{j.id}",
                'date': j_date,
                'ref': j.order_id or f"JOB-{j.id}",
                'type': 'job_allowance',
                'type_label': 'Contract Allowance',
                'type_priority': 1,
                'description': f"Job order contract allowance ({j.order_id} - {j.title})",
                'debit': allowance,
                'credit': 0.0,
                'status': j.status,
                'job_order_id': j.id,
            })

    # 5. Vendor Payments (Credit)
    payments = vendor.payments.all().select_related('job_order')
    for vp in payments:
        vp_date = vp.payment_date or (vp.created_at.date() if vp.created_at else datetime.date.today())
        vp_amt = round(float(vp.amount or 0), 2)
        desc = (vp.notes or '').strip() or f"Disbursement to Vendor (VP-{vp.id})"
        all_items.append({
            'raw_id': vp.id,
            'id': f"vp-{vp.id}",
            'date': vp_date,
            'ref': f"VP-{vp.id:04d}",
            'type': 'payment',
            'type_label': 'Vendor Payment',
            'type_priority': 4,
            'description': desc,
            'debit': 0.0,
            'credit': vp_amt,
            'status': 'Disbursed',
            'vendor_payment_id': vp.id,
            'job_order_id': vp.job_order_id,
        })

    # Sort strictly by date, then type priority, then id
    all_items.sort(key=lambda x: (x['date'], x['type_priority'], x['raw_id']))

    opening_balance = 0.0
    period_items = []

    if s_date:
        # Date-filtered statement: opening balance includes everything before start_date
        for item in all_items:
            i_date = item['date']
            if i_date < s_date:
                opening_balance += (item['debit'] - item['credit'])
            elif e_date and i_date > e_date:
                continue
            else:
                period_items.append(item)
    else:
        # No date filter: all items are period items
        period_items = all_items

    opening_balance = round(opening_balance, 2)

    running = opening_balance
    total_debits = 0.0
    total_credits = 0.0

    final_rows = []
    for item in period_items:
        deb = item['debit']
        cred = item['credit']
        running = round(running + deb - cred, 2)
        total_debits = round(total_debits + deb, 2)
        total_credits = round(total_credits + cred, 2)

        row = dict(item)
        row['date'] = str(item['date'])
        row['running_balance'] = running
        final_rows.append(row)

    closing_balance = running

    if search:
        q = str(search).strip().lower()
        final_rows = [
            r for r in final_rows
            if q in r['ref'].lower()
            or q in r['description'].lower()
            or q in r['type_label'].lower()
            or q in str(r['debit'])
            or q in str(r['credit'])
            or q in str(r['running_balance'])
        ]

    return {
        'vendor': {
            'id': vendor.id,
            'name': vendor.name,
            'company': vendor.company,
            'phone': vendor.phone,
            'email': vendor.email,
            'address': vendor.address,
            'tax_number': getattr(vendor, 'tax_number', '') or '',
            'business_group': vendor.business_group,
            'opening_balance': base_ob,
        },
        'period': {
            'start_date': str(s_date) if s_date else None,
            'end_date': str(e_date) if e_date else None,
        },
        'opening_balance': opening_balance,
        'rows': final_rows,
        'totals': {
            'total_debits': total_debits,
            'total_credits': total_credits,
            'net_movement': round(total_debits - total_credits, 2),
        },
        'closing_balance': closing_balance,
    }


def format_statement_date(dt_val):
    """Formats any date or string into '04 Nov 2026'."""
    if not dt_val:
        return ''
    if isinstance(dt_val, str):
        try:
            parts = dt_val.split('T')[0].split(' ')[0].split('-')
            if len(parts) == 3:
                d = datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
                return d.strftime('%d %b %Y')
        except Exception:
            return dt_val
    elif hasattr(dt_val, 'strftime'):
        return dt_val.strftime('%d %b %Y')
    return str(dt_val)


def build_statement_payload(entity_type, entity_or_id, start_date=None, end_date=None, search=None):
    """
    Builds the unified Zoho-style Statement of Accounts payload for Customer or Vendor.
    Shared identically by:
      - GET /api/customers/<id>/statement/
      - GET /api/customers/<id>/statement-pdf/
      - GET /api/vendors/<id>/statement/
      - GET /api/vendors/<id>/statement-pdf/
    Enforces Rule 4 and Rule 5:
      - Labels:
          customer: Billed Amount / Amount Received / Balance Due (or Credit Balance)
          vendor:   Billed / Paid / Balance Payable
      - Opening row rule: emit one synthetic Opening Balance row from ledger.opening_balance
        when it is non-zero or start_date is set; if the ledger already emitted the vendor
        ob-1 row (all-time), do not add another.
    """
    is_customer = (entity_type == 'customer')
    if is_customer:
        ledger = build_customer_ledger(entity_or_id, start_date=start_date, end_date=end_date, search=search)
        entity_info = ledger['customer']
    else:
        ledger = build_vendor_ledger(entity_or_id, start_date=start_date, end_date=end_date, search=search)
        entity_info = ledger['vendor']

    s_date = ledger['period']['start_date']
    e_date = ledger['period']['end_date']
    if s_date and e_date:
        period_str = f"{format_statement_date(s_date)} To {format_statement_date(e_date)}"
    elif s_date:
        period_str = f"From {format_statement_date(s_date)}"
    elif e_date:
        period_str = f"Up to {format_statement_date(e_date)}"
    else:
        period_str = "All Time"

    op_bal = round(float(ledger.get('opening_balance') or 0.0), 2)
    raw_rows = list(ledger.get('rows') or [])

    has_vendor_ob_row = any(r.get('type') == 'opening_balance' or str(r.get('id', '')).startswith('ob-') for r in raw_rows)
    table_rows = []

    # Rule 5: emit one synthetic Opening Balance row when non-zero or start_date is set;
    # if vendor ledger already emitted the ob-1 row, do not add another.
    if (op_bal != 0.0 or s_date) and not has_vendor_ob_row:
        ob_date = s_date if s_date else (raw_rows[0]['date'] if raw_rows else '2026-01-01')
        table_rows.append({
            'raw_id': 0,
            'id': 'opening-balance-row',
            'date': ob_date,
            'ref': 'OPENING-BAL',
            'type': 'opening_balance',
            'type_label': 'Opening Balance',
            'transactions': '***Opening Balance***',
            'details': '',
            'description': '***Opening Balance***',
            'amount': op_bal if op_bal > 0 else 0.0,
            'payments': abs(op_bal) if op_bal < 0 else 0.0,
            'debit': op_bal if op_bal > 0 else 0.0,
            'credit': abs(op_bal) if op_bal < 0 else 0.0,
            'balance': op_bal,
            'running_balance': op_bal,
            'status': 'Confirmed'
        })

    for r in raw_rows:
        r_copy = dict(r)
        if r.get('type') == 'opening_balance' or str(r.get('id', '')).startswith('ob-'):
            r_copy['transactions'] = '***Opening Balance***'
            r_copy['details'] = ''
        else:
            r_copy['transactions'] = r_copy.get('type_label') or r_copy.get('type') or 'Transaction'
            r_copy['details'] = r_copy.get('description') or ''
        r_copy['amount'] = r_copy.get('debit', 0.0)
        r_copy['payments'] = r_copy.get('credit', 0.0)
        r_copy['balance'] = r_copy.get('running_balance', 0.0)
        table_rows.append(r_copy)

    totals = ledger.get('totals') or {}
    closing_bal = round(float(ledger.get('closing_balance') or 0.0), 2)
    tot_debits = round(float(totals.get('total_debits') or 0.0), 2)
    tot_credits = round(float(totals.get('total_credits') or 0.0), 2)
    tot_refunds = round(float(totals.get('total_refunds') or 0.0), 2)

    if is_customer:
        is_credit_balance = (closing_bal < 0)
        # Requirement 2: Billed Amount strictly equals customer total_billed (excluding refunds)
        customer_billed = round(tot_debits - tot_refunds, 2)
        account_summary = [
            {'label': 'Opening Balance', 'key': 'opening_balance', 'amount': op_bal},
            {'label': 'Billed Amount', 'key': 'billed_amount', 'amount': customer_billed},
            {'label': 'Amount Received', 'key': 'amount_received', 'amount': tot_credits},
        ]
        if tot_refunds > 0:
            account_summary.append({
                'label': 'Refunds Paid',
                'key': 'refunds_paid',
                'amount': tot_refunds
            })
        account_summary.append({
            'label': 'Credit Balance' if is_credit_balance else 'Balance Due',
            'key': 'balance_due',
            'amount': abs(closing_bal) if is_credit_balance else closing_bal,
            'is_cr': is_credit_balance,
            'raw_balance': closing_bal
        })
        summary_labels = {
            'opening': 'Opening Balance',
            'billed': 'Billed Amount',
            'paid': 'Amount Received',
            'refunds': 'Refunds Paid',
            'balance': 'Credit Balance' if is_credit_balance else 'Balance Due',
        }
    else:
        is_credit_balance = (closing_bal < 0)
        # Requirement 1: Vendor summary - when all-time ledger emits opening row,
        # Account Summary must show Opening = that amount and Billed excluding it.
        base_ob = round(float(entity_info.get('opening_balance') or 0.0), 2)
        if not s_date and base_ob != 0.0:
            vendor_op = base_ob
            vendor_billed = round(tot_debits - base_ob, 2)
        else:
            vendor_op = op_bal
            vendor_billed = tot_debits

        account_summary = [
            {'label': 'Opening Balance', 'key': 'opening_balance', 'amount': vendor_op},
            {'label': 'Billed', 'key': 'billed_amount', 'amount': vendor_billed},
            {'label': 'Paid', 'key': 'amount_received', 'amount': tot_credits},
            {
                'label': 'Balance Payable',
                'key': 'balance_payable',
                'amount': closing_bal,
                'is_cr': is_credit_balance,
                'raw_balance': closing_bal
            },
        ]
        summary_labels = {
            'opening': 'Opening Balance',
            'billed': 'Billed',
            'paid': 'Paid',
            'balance': 'Balance Payable',
        }

    return {
        'entity_type': entity_type,
        'entity': entity_info,
        'period': {
            'start_date': s_date,
            'end_date': e_date,
            'period_text': period_str,
        },
        'opening_balance': op_bal,
        'closing_balance': closing_bal,
        'totals': totals,
        'account_summary': account_summary,
        'summary_labels': summary_labels,
        'rows': table_rows,
        'count': len(table_rows),
    }


