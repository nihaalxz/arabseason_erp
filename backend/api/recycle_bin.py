import json
import logging
from decimal import Decimal
import datetime
from django.utils import timezone
from django.db import models, transaction
from django.conf import settings
from django.forms.models import model_to_dict

logger = logging.getLogger(__name__)

# Thread-local storage for current request user
import threading
_thread_locals = threading.local()

def set_current_user(user):
    _thread_locals.user = user

def get_current_user():
    return getattr(_thread_locals, 'user', None)

def set_bypass_recycle_bin(bypass=False):
    _thread_locals.bypass_recycle_bin = bypass

def should_bypass_recycle_bin():
    return getattr(_thread_locals, 'bypass_recycle_bin', False)


def _json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, (datetime.datetime, datetime.date, datetime.time)):
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        return str(obj)
    elif hasattr(obj, 'pk'):
        return obj.pk
    return str(obj)


def serialize_model_instance(instance):
    """
    Serializes a Django model instance into a JSON-serializable dictionary
    along with child relations where relevant.
    """
    data = {}
    for field in instance._meta.fields:
        val = getattr(instance, field.name)
        if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
            data[field.name] = val.isoformat()
        elif isinstance(val, Decimal):
            data[field.name] = str(val)
        elif isinstance(val, models.Model):
            data[field.name] = val.pk
        elif isinstance(val, (dict, list, str, int, float, bool)) or val is None:
            data[field.name] = val
        else:
            data[field.name] = str(val)

    # Capture child items if applicable
    child_items = []
    if hasattr(instance, 'items'):
        try:
            for item in instance.items.all():
                item_dict = {}
                for f in item._meta.fields:
                    v = getattr(item, f.name)
                    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
                        item_dict[f.name] = v.isoformat()
                    elif isinstance(v, Decimal):
                        item_dict[f.name] = str(v)
                    elif isinstance(v, models.Model):
                        item_dict[f.name] = v.pk
                    elif isinstance(v, (dict, list, str, int, float, bool)) or v is None:
                        item_dict[f.name] = v
                    else:
                        item_dict[f.name] = str(v)
                child_items.append(item_dict)
        except Exception as e:
            logger.warning(f"Error serializing child items: {e}")

    return {
        'fields': data,
        'child_items': child_items
    }


def get_entity_metadata(instance):
    """
    Returns (entity_type, item_name, item_summary) for a given instance.
    """
    model_name = instance.__class__.__name__

    if model_name == 'CashBookEntry':
        etype = 'cashbook_entry'
        entry_type_raw = getattr(instance, 'entry_type', 'out')
        direction = 'Credit (Inflow)' if str(entry_type_raw).lower() == 'in' else 'Debit (Outflow)'
        short_dir = 'In' if str(entry_type_raw).lower() == 'in' else 'Out'
        amount = getattr(instance, 'amount', 0)
        
        remark = getattr(instance, 'remark', '') or getattr(instance, 'description', '') or ''
        cust = getattr(instance, 'customer', None)
        vend = getattr(instance, 'vendor', None)
        staff = getattr(instance, 'staff_name', '')
        party = getattr(instance, 'party_name', '') or (cust.name if cust else (vend.name if vend else (staff or '')))
        category = getattr(instance, 'category', '') or ''
        payment_mode = getattr(instance, 'payment_mode', '') or ''
        ref = getattr(instance, 'reference_number', '') or ''
        book = getattr(instance, 'cashbook', None)
        book_name = getattr(book, 'name', '') if book else ''
        account = getattr(instance, 'bank_account_name', '') or getattr(instance, 'petty_cash_account_name', '')
        date_str = str(getattr(instance, 'date', ''))

        title = remark or party or category or 'Cashbook Transaction'
        party_suffix = f" [{party}]" if (party and remark and party.lower() not in remark.lower()) else ""
        name = f"{short_dir}: {title} ({amount} SAR){party_suffix}"

        summary_parts = [f"Date: {date_str}", f"Amount: {amount} SAR", f"Type: {direction}"]
        if category:
            summary_parts.append(f"Category: {category}")
        if party and party != title:
            summary_parts.append(f"Party: {party}")
        if payment_mode:
            summary_parts.append(f"Payment Mode: {payment_mode}")
        if account:
            summary_parts.append(f"Account: {account}")
        if book_name:
            summary_parts.append(f"Book: {book_name}")
        if ref:
            summary_parts.append(f"Ref #: {ref}")
        if remark and remark != title:
            summary_parts.append(f"Remark: {remark}")

        summary = " | ".join(summary_parts)
        return etype, name, summary

    elif model_name == 'CashBook':
        etype = 'cashbook'
        name = f"Cash Book: {instance.name}"
        summary = f"Book: {instance.name} | Month/Year: {getattr(instance, 'month', '')}/{getattr(instance, 'year', '')}"
        return etype, name, summary

    elif model_name == 'JobOrder':
        etype = 'job_order'
        order_id = getattr(instance, 'order_id', '')
        title = getattr(instance, 'title', '')
        cust = getattr(instance, 'customer', None)
        cust_name = cust.name if cust else ''
        tot = getattr(instance, 'total_amount', 0)
        name = f"{order_id}: {title or cust_name or 'Job Order'} ({tot} SAR)"
        summary = f"Customer: {cust_name} | Total: {tot} SAR | Status: {getattr(instance, 'status', '')}"
        return etype, name, summary

    elif model_name == 'Customer':
        etype = 'customer'
        name = f"Customer: {instance.name}"
        summary = f"Phone: {getattr(instance, 'phone', '')} | Email: {getattr(instance, 'email', '')}"
        return etype, name, summary

    elif model_name == 'Vendor':
        etype = 'vendor'
        name = f"Vendor: {instance.name}"
        summary = f"Company: {getattr(instance, 'company', '')} | Group: {getattr(instance, 'business_group', '')}"
        return etype, name, summary

    elif model_name == 'Expense':
        etype = 'expense'
        title = getattr(instance, 'title', '') or getattr(instance, 'description', '')
        amt = getattr(instance, 'amount', 0)
        name = f"Expense: {title[:40]} ({amt} SAR)"
        summary = f"Amount: {amt} SAR | Date: {getattr(instance, 'date', '')} | Category: {getattr(instance, 'category', '')}"
        return etype, name, summary

    elif model_name == 'Invoice':
        etype = 'invoice'
        inv_no = getattr(instance, 'invoice_number', '')
        cust = getattr(instance, 'customer', None)
        cust_name = cust.name if cust else getattr(instance, 'customer_name', '')
        tot = getattr(instance, 'total_amount', 0)
        name = f"Invoice {inv_no} - {cust_name} ({tot} SAR)"
        summary = f"Invoice Date: {getattr(instance, 'invoice_date', '')} | Total: {tot} SAR | Status: {getattr(instance, 'status', '')}"
        return etype, name, summary

    elif model_name == 'Quotation':
        etype = 'quotation'
        q_no = getattr(instance, 'quotation_number', '')
        cust = getattr(instance, 'customer', None)
        cust_name = cust.name if cust else ''
        tot = getattr(instance, 'total_amount', 0)
        name = f"Quotation {q_no} - {cust_name} ({tot} SAR)"
        summary = f"Date: {getattr(instance, 'quotation_date', '')} | Total: {tot} SAR | Status: {getattr(instance, 'status', '')}"
        return etype, name, summary

    elif model_name == 'CreditNote':
        etype = 'credit_note'
        cn_no = getattr(instance, 'credit_note_number', '')
        cust = getattr(instance, 'customer', None)
        cust_name = cust.name if cust else ''
        tot = getattr(instance, 'total_amount', 0)
        name = f"Credit Note {cn_no} - {cust_name} ({tot} SAR)"
        summary = f"Date: {getattr(instance, 'credit_note_date', '')} | Total: {tot} SAR"
        return etype, name, summary

    elif model_name == 'DeliveryNote':
        etype = 'delivery_note'
        dn_no = getattr(instance, 'delivery_note_number', '')
        cust = getattr(instance, 'customer', None)
        cust_name = cust.name if cust else ''
        name = f"Delivery Note {dn_no} - {cust_name}"
        summary = f"Date: {getattr(instance, 'delivery_date', '')} | Status: {getattr(instance, 'status', '')}"
        return etype, name, summary

    elif model_name == 'Estimation':
        etype = 'estimation'
        num = getattr(instance, 'estimate_number', '')
        title = getattr(instance, 'title', '')
        tot = getattr(instance, 'total_price', 0)
        name = f"Estimation {num}: {title} ({tot} SAR)"
        summary = f"Date: {getattr(instance, 'created_at', '')} | Total: {tot} SAR"
        return etype, name, summary

    elif model_name == 'CustomerPayment':
        etype = 'customer_payment'
        cust = getattr(instance, 'customer', None)
        cust_name = cust.name if cust else ''
        amt = getattr(instance, 'amount', 0)
        name = f"Customer Payment: {cust_name} ({amt} SAR)"
        summary = f"Amount: {amt} SAR | Method: {getattr(instance, 'payment_method', '')} | Date: {getattr(instance, 'payment_date', '')}"
        return etype, name, summary

    elif model_name == 'VendorPayment':
        etype = 'vendor_payment'
        vend = getattr(instance, 'vendor', None)
        vend_name = vend.name if vend else ''
        amt = getattr(instance, 'amount', 0)
        name = f"Vendor Payment: {vend_name} ({amt} SAR)"
        summary = f"Amount: {amt} SAR | Method: {getattr(instance, 'payment_method', '')} | Date: {getattr(instance, 'payment_date', '')}"
        return etype, name, summary

    elif model_name == 'SalaryPayment':
        etype = 'salary_payment'
        staff = getattr(instance, 'staff_name', '')
        amt = getattr(instance, 'net_salary', 0) or getattr(instance, 'amount', 0)
        name = f"Salary Payment: {staff} ({amt} SAR)"
        summary = f"Staff: {staff} | Amount: {amt} SAR | Month: {getattr(instance, 'month', '')}"
        return etype, name, summary

    elif model_name == 'Labour':
        etype = 'labour'
        name = f"Labour: {getattr(instance, 'name', '')}"
        summary = f"Trade: {getattr(instance, 'trade', '')} | Rate: {getattr(instance, 'daily_rate', '')}"
        return etype, name, summary

    elif model_name == 'Material':
        etype = 'material'
        name = f"Material: {getattr(instance, 'name', '')}"
        summary = f"Price: {getattr(instance, 'unit_price', '')} | Measurements: {getattr(instance, 'measurements', '')}"
        return etype, name, summary

    elif model_name == 'StaffTimesheet':
        etype = 'staff_timesheet'
        staff = getattr(instance, 'staff_name', '')
        date = getattr(instance, 'date', '')
        name = f"Timesheet: {staff} ({date})"
        summary = f"Staff: {staff} | Hours: {getattr(instance, 'hours', '')} | Date: {date}"
        return etype, name, summary

    elif model_name == 'BankAccount':
        etype = 'bank_account'
        name = f"Bank Account: {getattr(instance, 'bank_name', '')} ({getattr(instance, 'account_name', '')})"
        summary = f"IBAN: {getattr(instance, 'iban', '')} | Balance: {getattr(instance, 'current_balance', '')}"
        return etype, name, summary

    elif model_name == 'PettyCashAccount':
        etype = 'petty_cash'
        name = f"Petty Cash: {getattr(instance, 'name', '')}"
        summary = f"Custodian: {getattr(instance, 'custodian', '')} | Balance: {getattr(instance, 'current_balance', '')}"
        return etype, name, summary

    elif model_name == 'PaymentRequest':
        etype = 'payment_request'
        num = getattr(instance, 'request_number', '')
        amt = getattr(instance, 'amount', 0)
        name = f"Payment Request #{num} ({amt} SAR)"
        summary = f"Amount: {amt} SAR | Status: {getattr(instance, 'status', '')}"
        return etype, name, summary

    elif model_name == 'ProjectPlan':
        etype = 'project_plan'
        name = f"Project Plan: {getattr(instance, 'title', '')}"
        summary = f"Status: {getattr(instance, 'status', '')}"
        return etype, name, summary

    else:
        etype = 'other'
        name = f"{model_name} #{instance.pk}: {str(instance)}"
        summary = f"Record of {model_name} (ID: {instance.pk})"
        return etype, name, summary


def archive_to_recycle_bin(instance, user=None):
    """
    Takes any model instance before deletion, serializes all its data,
    and saves an entry in RecycleBinItem.
    """
    from .models import RecycleBinItem

    # Don't archive RecycleBinItem or child line items (which are archived inside parents)
    if isinstance(instance, RecycleBinItem):
        return None

    model_name = instance.__class__.__name__

    if should_bypass_recycle_bin():
        try:
            RecycleBinItem.objects.filter(model_name=model_name, original_id=instance.pk).delete()
        except Exception:
            pass
        logger.info(f"Bypassing Recycle Bin for permanent deletion of {model_name} #{instance.pk}")
        return None
    child_models = ['InvoiceItem', 'QuotationItem', 'CreditNoteItem', 'DeliveryNoteItem', 'EstimationItem']
    if model_name in child_models:
        return None

    deleter = user or get_current_user()
    deleter_name = ''
    if deleter and hasattr(deleter, 'get_full_name'):
        deleter_name = deleter.get_full_name() or getattr(deleter, 'username', '')
    elif deleter and hasattr(deleter, 'username'):
        deleter_name = deleter.username

    etype, item_name, item_summary = get_entity_metadata(instance)
    serialized = serialize_model_instance(instance)

    # Prevent duplicate archiving if called both explicitly and via signal
    recent_duplicate = RecycleBinItem.objects.filter(
        model_name=model_name,
        original_id=instance.pk,
        deleted_at__gte=timezone.now() - datetime.timedelta(seconds=3)
    ).first()
    if recent_duplicate:
        return recent_duplicate

    try:
        bin_item = RecycleBinItem.objects.create(
            entity_type=etype,
            model_name=model_name,
            original_id=instance.pk,
            item_name=item_name[:255],
            item_summary=item_summary,
            item_data=serialized,
            deleted_by=deleter if (deleter and getattr(deleter, 'is_authenticated', False)) else None,
            deleted_by_name=deleter_name or 'System User',
            can_restore=True,
            is_restored=False
        )
        logger.info(f"Archived {model_name} #{instance.pk} to Recycle Bin (ID: {bin_item.id})")
        return bin_item
    except Exception as e:
        logger.error(f"Failed to archive {model_name} #{instance.pk} to Recycle Bin: {e}")
        return None


def restore_recycle_bin_item(bin_item, user=None):
    """
    Restores a record from RecycleBinItem back into its respective model.
    """
    import api.models as models_module

    if bin_item.is_restored:
        return False, "This item has already been restored."

    model_name = bin_item.model_name
    model_class = getattr(models_module, model_name, None)
    if not model_class:
        return False, f"Model {model_name} is no longer available in the system."

    fields = bin_item.item_data.get('fields', {})
    child_items = bin_item.item_data.get('child_items', [])

    try:
        with transaction.atomic():
            # Prepare kwargs for model creation
            kwargs = {}
            for field in model_class._meta.fields:
                fname = field.name
                if fname == 'id':
                    # Exclude primary key so database assigns new id or reuse if free
                    continue
                if fname not in fields:
                    continue

                val = fields[fname]
                if isinstance(field, models.ForeignKey):
                    rel_model = field.remote_field.model
                    if val is not None:
                        # Check if foreign relation still exists
                        exists = rel_model.objects.filter(pk=val).exists()
                        if exists:
                            kwargs[fname] = rel_model.objects.get(pk=val)
                        else:
                            # If FK relation was deleted, handle fallbacks
                            if field.null:
                                kwargs[fname] = None
                            elif model_name == 'CashBookEntry' and fname in ['book', 'cashbook']:
                                # fallback to any existing CashBook
                                fallback_book = models_module.CashBook.objects.first()
                                if not fallback_book:
                                    fallback_book = models_module.CashBook.objects.create(name='General Cashbook')
                                kwargs[fname] = fallback_book
                            else:
                                rel_name = getattr(rel_model, '__name__', 'parent record')
                                return False, f"Cannot restore {model_name}: The associated {rel_name} (ID: {val}) was deleted and no longer exists. Please restore or recreate the {rel_name} first."
                    else:
                        if field.null:
                            kwargs[fname] = None
                        else:
                            rel_name = getattr(rel_model, '__name__', 'parent record')
                            return False, f"Cannot restore {model_name}: Missing required relation {rel_name}."


                else:
                    kwargs[fname] = val

            # Check unique constraint collisions (e.g. invoice_number, order_id, quotation_number)
            unique_fields = ['order_id', 'invoice_number', 'quotation_number', 'credit_note_number', 'delivery_note_number', 'estimate_number']
            for ufield in unique_fields:
                if hasattr(model_class, ufield) and ufield in kwargs and kwargs[ufield]:
                    existing = model_class.objects.filter(**{ufield: kwargs[ufield]}).exists()
                    if existing:
                        suffix = "-R"
                        try:
                            field_obj = model_class._meta.get_field(ufield)
                            max_len = getattr(field_obj, 'max_length', None)
                            val_str = str(kwargs[ufield])
                            if max_len and len(val_str) + len(suffix) > max_len:
                                trimmed = val_str[:max(1, max_len - len(suffix))]
                                kwargs[ufield] = f"{trimmed}{suffix}"
                            else:
                                kwargs[ufield] = f"{val_str}{suffix}"
                        except Exception:
                            kwargs[ufield] = f"{str(kwargs[ufield])[:17]}-R"

            # Create the restored instance
            restored_instance = model_class.objects.create(**kwargs)

            # Re-apply account balance adjustments if restoring a CashBookEntry
            if model_name == 'CashBookEntry':
                try:
                    if restored_instance.bank_account:
                        from .views import compute_bank_delta
                        bank = restored_instance.bank_account
                        delta = compute_bank_delta(restored_instance)
                        bank.balance = (bank.balance or Decimal('0.00')) + delta
                        bank.save(update_fields=['balance'])

                    if restored_instance.petty_cash_account:
                        pca = restored_instance.petty_cash_account
                        amt = Decimal(str(restored_instance.amount or 0))
                        if restored_instance.entry_type == 'in':
                            if restored_instance.approval_status == 'approved':
                                pca.balance = (pca.balance or Decimal('0.00')) + amt
                                pca.save(update_fields=['balance'])
                        elif restored_instance.entry_type == 'out':
                            pca.balance = (pca.balance or Decimal('0.00')) - amt
                            pca.save(update_fields=['balance'])

                    if restored_instance.debit_type == 'LABOUR' and restored_instance.labour:
                        l = restored_instance.labour
                        l.paid_amount = (l.paid_amount or Decimal('0.00')) + Decimal(str(restored_instance.amount or 0))
                        if l.paid_amount >= l.payment_amount and l.payment_amount > 0:
                            l.status = 'paid'
                        elif l.paid_amount > 0:
                            l.status = 'partially_paid'
                        l.save()
                except Exception as e:
                    logger.warning(f"Error re-applying balance adjustments for restored CashBookEntry: {e}")

            # Recreate child items if applicable
            if child_items:
                child_map = {
                    'Invoice': (models_module.InvoiceItem, 'invoice'),
                    'Quotation': (models_module.QuotationItem, 'quotation'),
                    'CreditNote': (models_module.CreditNoteItem, 'credit_note'),
                    'DeliveryNote': (models_module.DeliveryNoteItem, 'delivery_note'),
                    'Estimation': (models_module.EstimationItem, 'estimation'),
                }
                if model_name in child_map:
                    child_model, fk_name = child_map[model_name]
                    for c_data in child_items:
                        c_kwargs = {fk_name: restored_instance}
                        for cf in child_model._meta.fields:
                            if cf.name in ['id', fk_name]:
                                continue
                            if cf.name in c_data:
                                c_kwargs[cf.name] = c_data[cf.name]
                        child_model.objects.create(**c_kwargs)

            # Update bin_item record
            bin_item.is_restored = True
            bin_item.restored_at = timezone.now()
            if user and getattr(user, 'is_authenticated', False):
                bin_item.restored_by = user
                bin_item.restored_by_name = user.get_full_name() or user.username
            else:
                bin_item.restored_by_name = 'System'
            bin_item.save()

            return True, f"Successfully restored {bin_item.item_name} to active records."
    except Exception as e:
        logger.error(f"Error restoring Recycle Bin item {bin_item.id}: {e}", exc_info=True)
        return False, f"Failed to restore item: {str(e)}"
