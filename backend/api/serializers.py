from rest_framework import serializers
from .models import (
    Customer, Vendor, JobOrder, PendingJobOrder, CustomerPayment, VendorPayment, Expense, 
    Labour, PaymentRequest, ExpenseCategory, ExpenseType, SiteSettings,
    PlanningTool, PlanningWorker, ProjectPlan, SalaryPayment,
    CashBook, CashBookEntry, StaffTimesheet, BankAccount, PettyCashAccount,
    Invoice, InvoiceItem, CustomFormField,
    MaterialCategory, Material, Estimation, EstimationItem,
    Quotation, QuotationItem, CreditNote, CreditNoteItem, DeliveryNote, DeliveryNoteItem,
    Notification, RecycleBinItem
)
from decimal import Decimal
from django.db import models
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from django.contrib.auth import get_user_model

from django.utils import timezone
User = get_user_model()

class CustomerSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=True, allow_blank=False)
    company_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    email = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    payable_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=Decimal('0.00'))
    custom_fields = serializers.JSONField(required=False, allow_null=True, default=dict)
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    total_billed = serializers.FloatField(read_only=True, default=0.0)
    paid_amount = serializers.FloatField(read_only=True, default=0.0)
    pending_balance = serializers.SerializerMethodField()
    # 4.3 — Cumulative credit fields across all jobs
    outstanding_balance = serializers.SerializerMethodField()
    advance_paid = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ['created_by']
        extra_kwargs = {
            'company_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone': {'required': False, 'allow_blank': True, 'allow_null': True},
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'address': {'required': False, 'allow_blank': True, 'allow_null': True},
            'payable_amount': {'required': False, 'allow_null': True},
            'custom_fields': {'required': False, 'allow_null': True},
        }

    def get_pending_balance(self, obj):
        billed = getattr(obj, 'total_billed', None)
        paid = getattr(obj, 'paid_amount', None)
        if billed is not None and paid is not None:
            return round(float(billed) - float(paid), 2)
        job_billed = sum(float(j.total_amount) for j in obj.job_orders.exclude(status='Cancelled'))
        inv_billed = sum(float(i.total_amount) for i in obj.invoices.filter(job_order__isnull=True))
        cn_credited = sum(float(c.total_amount) for c in obj.credit_notes.exclude(status__in=['Draft', 'Cancelled']))
        billed = job_billed + inv_billed - cn_credited
        paid = sum(float(p.amount) for p in obj.payments.all())
        return round(float(billed) - float(paid), 2)

    def get_outstanding_balance(self, obj):
        """True outstanding across ALL job orders and invoices minus credit notes and payments."""
        billed = getattr(obj, 'total_billed', None)
        paid = getattr(obj, 'paid_amount', None)
        if billed is not None and paid is not None:
            return round(float(billed) - float(paid), 2)
        total_billed = sum(float(j.total_amount) for j in obj.job_orders.exclude(status='Cancelled'))
        inv_billed = sum(float(i.total_amount) for i in obj.invoices.filter(job_order__isnull=True))
        cn_credited = sum(float(c.total_amount) for c in obj.credit_notes.exclude(status__in=['Draft', 'Cancelled']))
        total_paid = sum(float(p.amount) for p in obj.payments.all())
        return round((total_billed + inv_billed - cn_credited) - total_paid, 2)

    def get_advance_paid(self, obj):
        """Sum of payments classified as 'advance' across all jobs."""
        adv = getattr(obj, 'advance_paid', None)
        if adv is not None:
            return round(float(adv), 2)
        return sum(
            float(p.amount) for p in obj.payments.all()
            if getattr(p, 'payment_type', 'installment') == 'advance'
        )

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            if 'company' in data and not data.get('company_name'):
                data['company_name'] = data['company']
        return super().to_internal_value(data)

    def validate(self, attrs):
        if 'company_name' in attrs and attrs['company_name'] is None:
            attrs['company_name'] = ''
        if 'phone' in attrs:
            if attrs['phone'] is None:
                attrs['phone'] = ''
            else:
                attrs['phone'] = str(attrs['phone']).strip()[:25]
        if 'email' in attrs and attrs['email'] is None:
            attrs['email'] = ''
        if 'address' in attrs and attrs['address'] is None:
            attrs['address'] = ''
        if 'payable_amount' in attrs and (attrs['payable_amount'] is None or attrs['payable_amount'] == ''):
            attrs['payable_amount'] = Decimal('0.00')
        if 'custom_fields' in attrs and attrs['custom_fields'] is None:
            attrs['custom_fields'] = {}
        return super().validate(attrs)

    def update(self, instance, validated_data):
        if 'payable_amount' in validated_data:
            new_payable = float(validated_data['payable_amount'] or 0)
            refund_sum = sum(float(p.amount) for p in instance.payments.all() if getattr(p, 'payment_type', None) == 'refund')
            # The user specifies the remaining payable balance they owe to the customer
            # Since remaining_payable = instance.payable_amount - refund_sum,
            # store new_payable + refund_sum so remaining_payable accurately becomes new_payable
            validated_data['payable_amount'] = Decimal(str(round(new_payable + refund_sum, 2)))
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['company'] = ret.get('company_name') or ''
        cn_credited = sum(float(c.total_amount) for c in instance.credit_notes.exclude(status__in=['Draft', 'Cancelled']))
        tb = getattr(instance, 'total_billed', None)
        if tb is None:
            job_billed = sum(float(j.total_amount) for j in instance.job_orders.exclude(status='Cancelled'))
            inv_billed = sum(float(i.total_amount) for i in instance.invoices.filter(job_order__isnull=True))
            tb = job_billed + inv_billed - cn_credited
        ret['total_billed'] = round(float(tb), 2)
        ret['credit_notes_total'] = round(float(cn_credited), 2)

        pa = getattr(instance, 'paid_amount', None)
        if pa is None:
            pa_in = sum(float(p.amount) for p in instance.payments.all() if getattr(p, 'payment_type', None) != 'refund')
            pa_refund = sum(float(p.amount) for p in instance.payments.all() if getattr(p, 'payment_type', None) == 'refund')
            pa = max(0.0, pa_in - pa_refund)
        ret['paid_amount'] = round(float(pa), 2)

        ret['pending_balance'] = round(ret['total_billed'] - ret['paid_amount'], 2)
        ret['outstanding_balance'] = ret['pending_balance']

        pa_owed = float(instance.payable_amount or 0)
        refund_sum = sum(float(p.amount) for p in instance.payments.all() if getattr(p, 'payment_type', None) == 'refund')
        ret['payable_amount'] = round(pa_owed, 2)
        ret['total_cashed_out'] = round(refund_sum, 2)
        ret['remaining_payable'] = round(max(0.0, pa_owed - refund_sum), 2)
        return ret

class VendorSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=True, allow_blank=False)
    company = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    email = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    business_group = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='General')
    opening_balance = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=Decimal('0.00'))
    created_by_name = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = Vendor
        fields = '__all__'
        read_only_fields = ['created_by']
        extra_kwargs = {
            'company': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone': {'required': False, 'allow_blank': True, 'allow_null': True},
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'address': {'required': False, 'allow_blank': True, 'allow_null': True},
            'business_group': {'required': False, 'allow_blank': True, 'allow_null': True},
            'opening_balance': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        if 'company' in attrs and attrs['company'] is None:
            attrs['company'] = ''
        if 'phone' in attrs:
            if attrs['phone'] is None:
                attrs['phone'] = ''
            else:
                attrs['phone'] = str(attrs['phone']).strip()[:25]
        if 'email' in attrs and attrs['email'] is None:
            attrs['email'] = ''
        if 'address' in attrs and attrs['address'] is None:
            attrs['address'] = ''
        if 'business_group' in attrs and (attrs['business_group'] is None or attrs['business_group'] == ''):
            attrs['business_group'] = 'General'
        if 'opening_balance' in attrs and (attrs['opening_balance'] is None or attrs['opening_balance'] == ''):
            attrs['opening_balance'] = Decimal('0.00')
        return super().validate(attrs)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        exp_sum = sum(float(e.amount) for e in instance.expenses.all())
        lab_sum = sum(float(l.payment_amount) for l in instance.labours.all())
        ob = float(instance.opening_balance or 0)
        total_billed = round(exp_sum + lab_sum + ob, 2)
        ret['total_billed'] = total_billed

        paid_sum = sum(float(p.amount) for p in instance.payments.all())
        ret['paid_amount'] = round(paid_sum, 2)

        pending = round(total_billed - paid_sum, 2)
        ret['pending_balance'] = pending
        ret['outstanding_balance'] = pending
        return ret

class JobOrderLookupSerializer(serializers.ModelSerializer):
    paid_amount = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    due_amount = serializers.SerializerMethodField()

    class Meta:
        model = JobOrder
        fields = ['id', 'order_id', 'title', 'total_amount', 'customer', 'vendor', 'created_by_staff', 'payment_collected_by', 'paid_amount', 'balance', 'due_amount']

    def get_paid_amount(self, obj):
        payments = getattr(obj, 'customer_payments', None)
        if payments is not None:
            return sum(float(p.amount) for p in payments.all())
        return sum(float(p.amount) for p in obj.customer_payments.all())

    def get_balance(self, obj):
        paid = self.get_paid_amount(obj)
        return max(0.0, float(obj.total_amount or 0) - paid)

    def get_due_amount(self, obj):
        return self.get_balance(obj)

class PendingJobOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')
    customer_email = serializers.ReadOnlyField(source='customer.email')
    vendor_name = serializers.ReadOnlyField(source='vendor.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    converted_job_order_id = serializers.ReadOnlyField(source='converted_job.order_id')
    converted_job_title = serializers.ReadOnlyField(source='converted_job.title')

    class Meta:
        model = PendingJobOrder
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']
        extra_kwargs = {
            'customer': {'required': False, 'allow_null': True},
            'vendor': {'required': False, 'allow_null': True},
        }

class JobOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.name')
    vendor_name = serializers.ReadOnlyField(source='vendor.name')
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    due_amount = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    # 4.3 — Credit tracking computed fields
    outstanding_balance = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()
    payment_type_display = serializers.ReadOnlyField(source='get_payment_type_display')
    payment_history = serializers.SerializerMethodField()
    purchase_expenses = serializers.SerializerMethodField()
    vendor_labor_costs = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    gross_margin = serializers.SerializerMethodField()
    margin_percentage = serializers.SerializerMethodField()
    linked_project = serializers.SerializerMethodField()
    cancelled_advance_retained = serializers.SerializerMethodField()

    class Meta:
        model = JobOrder
        fields = '__all__'
        read_only_fields = ['created_by']

    def get_created_by_name(self, obj):
        if obj.created_by_staff:
            return obj.created_by_staff
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username
        return 'System'

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            full = f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
            return full or obj.assigned_to.username
        return None

    def get_assigned_by_name(self, obj):
        if obj.original_creator_name:
            return obj.original_creator_name
        if obj.assigned_by:
            full = f"{obj.assigned_by.first_name} {obj.assigned_by.last_name}".strip()
            return full or obj.assigned_by.username
        return None

    def validate_order_id(self, value):
        if value and value.strip() and value.strip() != '#AS':
            val = value.strip()
            qs = JobOrder.objects.filter(order_id__iexact=val)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError(f"Contract ID '{val}' is already in use by another Job Order. Contract IDs must be unique.")
            return val
        return value

    def get_paid_amount(self, obj):
        # Optimized to use prefetched data if available
        payments = getattr(obj, 'customer_payments', None)
        if payments is not None:
            # If using prefetch_related, this is much faster
            pay_in = sum(float(p.amount) for p in payments.all() if getattr(p, 'payment_type', None) != 'refund')
            pay_refund = sum(float(p.amount) for p in payments.all() if getattr(p, 'payment_type', None) == 'refund')
            return max(0.0, pay_in - pay_refund)
        pay_in = sum(float(p.amount) for p in obj.customer_payments.all() if getattr(p, 'payment_type', None) != 'refund')
        pay_refund = sum(float(p.amount) for p in obj.customer_payments.all() if getattr(p, 'payment_type', None) == 'refund')
        return max(0.0, pay_in - pay_refund)

    def get_balance(self, obj):
        """Balance remaining on THIS job order only (job total - payments on this job)."""
        if obj.status == 'Cancelled':
            return 0.0
        paid = self.get_paid_amount(obj)
        return max(0.0, float(obj.total_amount or 0) - paid)

    def get_due_amount(self, obj):
        return self.get_balance(obj)

    def get_cancelled_advance_retained(self, obj):
        if obj.status == 'Cancelled':
            return self.get_paid_amount(obj)
        return 0.0

    def get_payment_status(self, obj):
        if obj.status == 'Cancelled':
            paid = self.get_paid_amount(obj)
            return 'credit_retained' if paid > 0 else 'cancelled'
        due = self.get_due_amount(obj)
        paid = self.get_paid_amount(obj)
        total = float(obj.total_amount or 0)
        if total > 0 and due <= 0.01:
            return 'paid'
        elif paid > 0:
            return 'partially_paid'
        return 'unpaid'

    def get_outstanding_balance(self, obj):
        """True outstanding = prior carried balance + this job's remaining balance."""
        balance_this_job = self.get_balance(obj)
        return round(float(obj.prior_balance or 0) + balance_this_job, 2)

    def get_grand_total(self, obj):
        """Grand total customer owes = prior balance + this job's total."""
        if obj.status == 'Cancelled':
            return round(float(obj.prior_balance or 0), 2)
        return round(float(obj.prior_balance or 0) + float(obj.total_amount or 0), 2)

    def get_payment_history(self, obj):
        # Limit history in list view to keep it fast
        payments = obj.customer_payments.all()[:10]
        return [
            {
                "id": p.id,
                "amount": p.amount,
                "date": p.payment_date,
                "notes": p.notes
            } for p in payments
        ]

    def get_purchase_expenses(self, obj):
        expenses = obj.expenses.all()
        purchase_cats = ['purchase', 'material', 'project material', 'raw material', 'supplies']
        purchase_sum = sum(
            float(e.amount) for e in expenses 
            if (e.category and e.category.strip().lower() in purchase_cats) or 
               (e.type and e.type.strip().lower() in purchase_cats) or 
               not (e.category and e.category.strip().lower() in ['labor', 'labour', 'vendor', 'subcontractor'])
        )
        return round(purchase_sum, 2)

    def get_vendor_labor_costs(self, obj):
        labour_costs = sum(float(l.payment_amount) for l in obj.labours.all())
        labor_expenses = sum(
            float(e.amount) for e in obj.expenses.all()
            if (e.category and e.category.strip().lower() in ['labor', 'labour', 'vendor', 'subcontractor']) or 
               (e.type and e.type.strip().lower() in ['labor', 'labour', 'vendor', 'subcontractor'])
        )
        vendor_payments = sum(float(vp.amount) for vp in obj.vendor_payments.all())
        uncovered_vp = max(0.0, vendor_payments - labor_expenses)
        return round(labor_expenses + labour_costs + uncovered_vp, 2)

    def get_total_cost(self, obj):
        return round(self.get_purchase_expenses(obj) + self.get_vendor_labor_costs(obj), 2)

    def get_gross_margin(self, obj):
        tot = float(obj.total_amount or 0)
        return round(tot - self.get_total_cost(obj), 2)

    def get_margin_percentage(self, obj):
        tot = float(obj.total_amount or 0)
        if tot <= 0:
            return 0.0
        return round((self.get_gross_margin(obj) / tot) * 100, 2)

    def get_linked_project(self, obj):
        p_plan = obj.project_plans.first()
        if p_plan:
            return {'id': p_plan.id, 'title': p_plan.title, 'status': p_plan.status}
        if obj.project_name:
            return {'id': None, 'title': obj.project_name, 'status': 'Linked'}
        return None

class CustomerPaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.name')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    payment_type_display = serializers.ReadOnlyField(source='get_payment_type_display')

    class Meta:
        model = CustomerPayment
        fields = '__all__'
        read_only_fields = ['created_by']

class VendorPaymentSerializer(serializers.ModelSerializer):
    vendor_name = serializers.ReadOnlyField(source='vendor.name')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_number = serializers.ReadOnlyField(source='job_order.order_id')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = VendorPayment
        fields = '__all__'
        read_only_fields = ['created_by']

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'

class ExpenseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseType
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    vendor_name = serializers.ReadOnlyField(source='vendor.name')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_number = serializers.ReadOnlyField(source='job_order.order_id')

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['created_by']

    def validate_amount(self, value):
        if value is None or value <= Decimal('0.00'):
            raise serializers.ValidationError('Expense amount must be greater than zero.')
        if value > Decimal('999999999.99'):
            raise serializers.ValidationError('Expense amount exceeds allowable limit.')
        return value


from .models import SiteSettings

class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = '__all__'

class LabourSerializer(serializers.ModelSerializer):
    date = serializers.DateField(required=False, default=timezone.localdate)
    phone = serializers.CharField(required=False, allow_blank=True, default='')
    vendor_name = serializers.ReadOnlyField(source='vendor.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_number = serializers.ReadOnlyField(source='job_order.order_id')
    job_order_customer_name = serializers.ReadOnlyField(source='job_order.customer.name')
    due_amount = serializers.SerializerMethodField()

    class Meta:
        model = Labour
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_due_amount(self, obj):
        tot = float(obj.payment_amount or 0)
        paid = float(obj.paid_amount or 0)
        return max(0.0, round(tot - paid, 2))

class PaymentRequestSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = PaymentRequest
        fields = '__all__'
        read_only_fields = ['created_by']

    def validate_amount(self, value):
        if value is None or value <= Decimal('0.00'):
            raise serializers.ValidationError("Payment request amount must be greater than zero.")
        if value > Decimal('999999999.99'):
            raise serializers.ValidationError("Payment request amount exceeds maximum allowed limit.")
        return value


class PlanningToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanningTool
        fields = '__all__'

class PlanningWorkerSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanningWorker
        fields = '__all__'

class ProjectPlanSerializer(serializers.ModelSerializer):
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_code = serializers.ReadOnlyField(source='job_order.order_id')
    customer_name = serializers.ReadOnlyField(source='job_order.customer.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = ProjectPlan
        fields = '__all__'
        read_only_fields = ['created_by']

    def validate(self, data):
        start = data.get('start_date') or (self.instance.start_date if self.instance else None)
        end = data.get('end_date') or (self.instance.end_date if self.instance else None)
        if start and end and start > end:
            raise serializers.ValidationError({'end_date': 'End date must be on or after start date.'})
        return data


    def create(self, validated_data):
        tools = validated_data.get('tools', [])
        workers = validated_data.get('workers', [])
        # Persist any new tools for future entries
        for t in tools:
            if t and isinstance(t, str) and t.strip():
                PlanningTool.objects.get_or_create(name=t.strip())
        # Persist any new workers for future entries
        for w in workers:
            if w and isinstance(w, str) and w.strip():
                PlanningWorker.objects.get_or_create(name=w.strip())
        return super().create(validated_data)

    def update(self, instance, validated_data):
        tools = validated_data.get('tools', [])
        workers = validated_data.get('workers', [])
        # Persist any new tools for future entries
        for t in tools:
            if t and isinstance(t, str) and t.strip():
                PlanningTool.objects.get_or_create(name=t.strip())
        # Persist any new workers for future entries
        for w in workers:
            if w and isinstance(w, str) and w.strip():
                PlanningWorker.objects.get_or_create(name=w.strip())
        return super().update(instance, validated_data)

class SalaryPaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    balance = serializers.SerializerMethodField()

    class Meta:
        model = SalaryPayment
        fields = '__all__'
        read_only_fields = ['created_by']
        extra_kwargs = {
            'payment_date': {'required': False}
        }

    def get_balance(self, obj):
        return float(obj.total_salary) - float(obj.amount)

    def validate_overtime_hours(self, value):
        if value is not None:
            if value < Decimal('0.00'):
                raise serializers.ValidationError('Overtime hours cannot be negative.')
            if value > Decimal('300.00'):
                raise serializers.ValidationError('Overtime hours cannot exceed 300 hours in a single month.')
        return value


class CashBookEntrySerializer(serializers.ModelSerializer):
    cashbook = serializers.PrimaryKeyRelatedField(queryset=CashBook.objects.all(), required=False, allow_null=True)
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    cashbook_name = serializers.ReadOnlyField(source='cashbook.name')
    vendor_name = serializers.ReadOnlyField(source='vendor.name')
    customer_name = serializers.ReadOnlyField(source='customer.name')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_number = serializers.ReadOnlyField(source='job_order.order_id')
    pending_job_order_title = serializers.ReadOnlyField(source='pending_job_order.title')
    staff_user_name = serializers.ReadOnlyField(source='staff_user.username')
    labour_name = serializers.ReadOnlyField(source='labour.name')
    approved_by_name = serializers.ReadOnlyField(source='approved_by.username')
    bank_account_detail = serializers.SerializerMethodField(read_only=True)
    petty_cash_account_detail = serializers.SerializerMethodField(read_only=True)
    running_balance = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CashBookEntry
        fields = '__all__'
        read_only_fields = ['created_by']

    def get_running_balance(self, obj):
        if hasattr(obj, 'running_balance_val') and obj.running_balance_val is not None:
            return float(obj.running_balance_val)
        return None

    def get_bank_account_detail(self, obj):
        if obj.bank_account:
            return {
                'id': obj.bank_account.id,
                'bank_name': obj.bank_account.bank_name,
                'account_number': obj.bank_account.account_number,
                'balance': float(obj.bank_account.balance)
            }
        return None

    def get_petty_cash_account_detail(self, obj):
        if obj.petty_cash_account:
            pca = obj.petty_cash_account
            owner_name = ''
            if pca.owner:
                owner_name = f"{pca.owner.first_name} {pca.owner.last_name}".strip() or pca.owner.username
            elif pca.holder_name:
                owner_name = pca.holder_name
            return {
                'id': pca.id,
                'name': pca.name,
                'holder_name': pca.holder_name,
                'owner_id': pca.owner_id,
                'owner_name': owner_name,
                'balance': float(pca.balance)
            }
        return None

    def validate(self, data):
        # 3.5 Cashbook Entry Requirements: customer name, amount, and credit/debit designation
        party_name = data.get('party_name', getattr(self.instance, 'party_name', ''))
        if not party_name or not str(party_name).strip():
            raise serializers.ValidationError({"party_name": "Customer name is required for every cashbook entry."})
        
        amount = data.get('amount', getattr(self.instance, 'amount', None))
        if amount is None or float(amount) <= 0:
            raise serializers.ValidationError({"amount": "A valid amount greater than 0 is required."})

        entry_type = data.get('entry_type', getattr(self.instance, 'entry_type', None))
        if not entry_type or entry_type not in ['in', 'out']:
            raise serializers.ValidationError({"entry_type": "Credit/Debit designation (Cash In/Cash Out) is required."})

        return data

    def create(self, validated_data):
        if validated_data.get('bank_account') and not validated_data.get('bank_account_name'):
            validated_data['bank_account_name'] = validated_data['bank_account'].bank_name
        if validated_data.get('petty_cash_account') and not validated_data.get('petty_cash_account_name'):
            validated_data['petty_cash_account_name'] = validated_data['petty_cash_account'].name
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get('bank_account'):
            validated_data['bank_account_name'] = validated_data['bank_account'].bank_name
        if validated_data.get('petty_cash_account'):
            validated_data['petty_cash_account_name'] = validated_data['petty_cash_account'].name
        return super().update(instance, validated_data)

    def to_internal_value(self, data):
        # Gracefully handle 12-hr vs 24-hr time strings or empty values
        if 'time' in data:
            val = data.get('time')
            if not val:
                data = data.copy() if hasattr(data, 'copy') else dict(data)
                data['time'] = None
            elif isinstance(val, str) and val.strip():
                from datetime import datetime
                t_str = val.strip()
                for fmt in ('%I:%M %p', '%I:%M:%S %p', '%I:%M%p', '%H:%M:%S', '%H:%M'):
                    try:
                        parsed = datetime.strptime(t_str, fmt).time()
                        data = data.copy() if hasattr(data, 'copy') else dict(data)
                        data['time'] = parsed.strftime('%H:%M:%S')
                        break
                    except ValueError:
                        continue
        return super().to_internal_value(data)

class CashBookSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    total_in = serializers.SerializerMethodField()
    total_out = serializers.SerializerMethodField()
    net_balance = serializers.SerializerMethodField()
    entries_count = serializers.SerializerMethodField()

    class Meta:
        model = CashBook
        fields = '__all__'
        read_only_fields = ['created_by']

    def get_total_in(self, obj):
        val = obj.entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=models.DecimalField()))['tot']
        return float(val)

    def get_total_out(self, obj):
        val = obj.entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=models.DecimalField()))['tot']
        return float(val)

    def get_net_balance(self, obj):
        total_in = obj.entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=models.DecimalField()))['tot']
        total_out = obj.entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=models.DecimalField()))['tot']
        return float(Decimal(str(obj.opening_balance or 0)) + total_in - total_out)

    def get_entries_count(self, obj):
        return obj.entries.count()


class StaffTimesheetSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    user_username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = StaffTimesheet
        fields = '__all__'
        read_only_fields = ['created_by']


class BankAccountSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = BankAccount
        fields = '__all__'
        read_only_fields = ['created_by']


class PettyCashAccountSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    owner_name = serializers.SerializerMethodField(read_only=True)
    linked_user = serializers.PrimaryKeyRelatedField(source='owner', queryset=User.objects.all(), required=False, allow_null=True)
    linked_user_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PettyCashAccount
        fields = '__all__'
        read_only_fields = ['created_by']

    def get_owner_name(self, obj):
        if obj.owner:
            full = f"{obj.owner.first_name} {obj.owner.last_name}".strip()
            return full or obj.owner.username
        return obj.holder_name or ''

    def get_linked_user_name(self, obj):
        return self.get_owner_name(obj)


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField(read_only=True)
    recipient_name = serializers.ReadOnlyField(source='recipient.username')

    class Meta:
        model = Notification
        fields = '__all__'

    def get_actor_name(self, obj):
        if obj.actor:
            full = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
            return full or obj.actor.username
        return 'System'


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = '__all__'
        read_only_fields = ['invoice']


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_email = serializers.ReadOnlyField(source='customer.email')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_code = serializers.ReadOnlyField(source='job_order.order_id')
    bank_name = serializers.ReadOnlyField(source='bank_account.bank_name')
    bank_account_number = serializers.ReadOnlyField(source='bank_account.account_number')
    bank_iban = serializers.ReadOnlyField(source='bank_account.iban')
    created_by_name = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()
    payments_history = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by_staff:
            return obj.created_by_staff
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username
        return 'System'

    def get_paid_amount(self, obj):
        paid = obj.payments.aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=models.DecimalField()))['tot']
        return float(paid)

    def get_balance_due(self, obj):
        paid = self.get_paid_amount(obj)
        from .models import CreditNote
        cn_tot = CreditNote.objects.filter(
            Q(invoice=obj) | Q(reference_number=obj.invoice_number)
        ).exclude(status__in=['Draft', 'Cancelled']).aggregate(
            tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=models.DecimalField())
        )['tot']
        bal = float(obj.total_amount) - paid - float(cn_tot)
        return round(max(0.0, bal), 2)


    def get_payments_history(self, obj):
        return [
            {
                'id': p.id,
                'amount': float(p.amount),
                'payment_date': str(p.payment_date),
                'notes': p.notes
            }
            for p in obj.payments.all()
        ]

    def validate(self, attrs):
        disc_amount = attrs.get('discount_amount')
        if disc_amount is not None and Decimal(str(disc_amount)) < Decimal('0.00'):
            raise serializers.ValidationError({'discount_amount': 'Discount amount cannot be negative.'})
        return super().validate(attrs)

    def create(self, validated_data):
        from django.db import transaction
        with transaction.atomic():
            items_data = validated_data.pop('items', [])
            invoice = Invoice.objects.create(**validated_data)
            
            calculated_subtotal = Decimal('0.00')
            calculated_tax = Decimal('0.00')

            for idx, item in enumerate(items_data):
                raw_qty = item.get('quantity', 1)
                qty = max(Decimal('0.01'), Decimal(str(raw_qty)))
                unit_price = max(Decimal('0.00'), Decimal(str(item.get('unit_price', 0))))
                disc_rate = min(Decimal('100.00'), max(Decimal('0.00'), Decimal(str(item.get('discount_rate', 0)))))
                tax_rate = Decimal(str(item.get('tax_rate', 15)))

                line_base = qty * unit_price
                line_disc = round(line_base * (disc_rate / Decimal('100')), 2)
                line_taxable = max(Decimal('0.00'), line_base - line_disc)
                line_tax = round(line_taxable * (tax_rate / Decimal('100')), 2)
                line_total = round(line_taxable + line_tax, 2)

                calculated_subtotal += line_taxable
                calculated_tax += line_tax

                InvoiceItem.objects.create(
                    invoice=invoice,
                    description=item.get('description', ''),
                    quantity=qty,
                    unit=item.get('unit', 'Unit'),
                    unit_price=unit_price,
                    discount_rate=disc_rate,
                    tax_rate=tax_rate,
                    tax_amount=line_tax,
                    total=line_total,
                    sort_order=idx
                )

            if items_data:
                invoice.subtotal = calculated_subtotal
                disc_overall = max(Decimal('0.00'), Decimal(str(invoice.discount_amount or 0)))
                net_taxable = max(Decimal('0.00'), calculated_subtotal - disc_overall)
                if calculated_subtotal > Decimal('0.00'):
                    adjusted_tax = round(calculated_tax * (net_taxable / calculated_subtotal), 2)
                else:
                    adjusted_tax = Decimal('0.00')
                invoice.tax_amount = adjusted_tax
                invoice.total_amount = net_taxable + adjusted_tax
                invoice.save()

            return invoice

    def update(self, instance, validated_data):
        from django.db import transaction
        with transaction.atomic():
            items_data = validated_data.pop('items', None)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            if items_data is not None:
                instance.items.all().delete()
                calculated_subtotal = Decimal('0.00')
                calculated_tax = Decimal('0.00')

                for idx, item in enumerate(items_data):
                    raw_qty = item.get('quantity', 1)
                    qty = max(Decimal('0.01'), Decimal(str(raw_qty)))
                    unit_price = max(Decimal('0.00'), Decimal(str(item.get('unit_price', 0))))
                    disc_rate = min(Decimal('100.00'), max(Decimal('0.00'), Decimal(str(item.get('discount_rate', 0)))))
                    tax_rate = Decimal(str(item.get('tax_rate', 15)))

                    line_base = qty * unit_price
                    line_disc = round(line_base * (disc_rate / Decimal('100')), 2)
                    line_taxable = max(Decimal('0.00'), line_base - line_disc)
                    line_tax = round(line_taxable * (tax_rate / Decimal('100')), 2)
                    line_total = round(line_taxable + line_tax, 2)

                    calculated_subtotal += line_taxable
                    calculated_tax += line_tax

                    InvoiceItem.objects.create(
                        invoice=instance,
                        description=item.get('description', ''),
                        quantity=qty,
                        unit=item.get('unit', 'Unit'),
                        unit_price=unit_price,
                        discount_rate=disc_rate,
                        tax_rate=tax_rate,
                        tax_amount=line_tax,
                        total=line_total,
                        sort_order=idx
                    )

                instance.subtotal = calculated_subtotal
                disc_overall = max(Decimal('0.00'), Decimal(str(instance.discount_amount or 0)))
                net_taxable = max(Decimal('0.00'), calculated_subtotal - disc_overall)
                if calculated_subtotal > Decimal('0.00'):
                    adjusted_tax = round(calculated_tax * (net_taxable / calculated_subtotal), 2)
                else:
                    adjusted_tax = Decimal('0.00')
                instance.tax_amount = adjusted_tax
                instance.total_amount = net_taxable + adjusted_tax

            instance.save()
            return instance


class CustomFormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFormField
        fields = '__all__'

    def validate_name(self, value):
        import re
        val = re.sub(r'[^a-zA-Z0-9_]', '_', value.strip().lower())
        if not val:
            raise serializers.ValidationError("Field identifier cannot be empty.")
        return val


class MaterialCategorySerializer(serializers.ModelSerializer):
    materials_count = serializers.SerializerMethodField()

    class Meta:
        model = MaterialCategory
        fields = '__all__'

    def get_materials_count(self, obj):
        return obj.materials.count()


class MaterialSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    lowest_shop_price = serializers.ReadOnlyField()
    created_by_name = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = Material
        fields = '__all__'
        read_only_fields = ['created_by']


class EstimationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstimationItem
        fields = '__all__'
        read_only_fields = ['estimation']


class EstimationSerializer(serializers.ModelSerializer):
    items = EstimationItemSerializer(many=True, required=False)
    estimate_number = serializers.CharField(required=False, allow_blank=True)
    customer_name = serializers.ReadOnlyField(source='customer.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    converted_job_title = serializers.ReadOnlyField(source='converted_job.title')

    class Meta:
        model = Estimation
        fields = '__all__'
        read_only_fields = ['created_by', 'converted_job']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        if not validated_data.get('estimate_number'):
            import datetime
            year = datetime.datetime.now().year
            count = Estimation.objects.filter(estimate_number__startswith=f"EST-{year}-").count() + 1
            cand = f"EST-{year}-{count:04d}"
            while Estimation.objects.filter(estimate_number=cand).exists():
                count += 1
                cand = f"EST-{year}-{count:04d}"
            validated_data['estimate_number'] = cand

        estimation = Estimation.objects.create(**validated_data)
        
        subtotal_cost = Decimal('0.00')
        subtotal_price = Decimal('0.00')

        for idx, item_data in enumerate(items_data):
            qty = Decimal(str(item_data.get('quantity', 1)))
            u_cost = Decimal(str(item_data.get('unit_cost', 0)))
            u_price = Decimal(str(item_data.get('unit_price', 0)))
            calc_type = item_data.get('calculation_type', 'unit')
            width = Decimal(str(item_data.get('width', 0)))
            height = Decimal(str(item_data.get('height', 0)))

            if calc_type == 'area' and width > 0 and height > 0:
                area = width * height
                tot_cost = qty * area * u_cost
                tot_price = qty * area * u_price
            elif calc_type == 'fixed':
                tot_cost = u_cost
                tot_price = u_price
            else:
                tot_cost = qty * u_cost
                tot_price = qty * u_price

            margin = tot_price - tot_cost
            item_data['unit_cost'] = u_cost
            item_data['total_cost'] = tot_cost
            item_data['unit_price'] = u_price
            item_data['total_price'] = tot_price
            item_data['margin'] = margin
            item_data['sort_order'] = item_data.get('sort_order', idx)

            EstimationItem.objects.create(estimation=estimation, **item_data)
            subtotal_cost += tot_cost
            subtotal_price += tot_price

        estimation.subtotal_cost = subtotal_cost
        estimation.subtotal_price = subtotal_price
        tax = Decimal(str(estimation.tax_amount or 0))
        estimation.total_price = subtotal_price + tax
        estimation.margin_amount = subtotal_price - subtotal_cost
        if subtotal_price > 0:
            estimation.margin_percentage = round(((subtotal_price - subtotal_cost) / subtotal_price) * 100, 2)
        else:
            estimation.margin_percentage = Decimal('0.00')
        estimation.save()
        return estimation

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if items_data is not None:
            instance.items.all().delete()
            subtotal_cost = Decimal('0.00')
            subtotal_price = Decimal('0.00')

            for idx, item_data in enumerate(items_data):
                qty = Decimal(str(item_data.get('quantity', 1)))
                u_cost = Decimal(str(item_data.get('unit_cost', 0)))
                u_price = Decimal(str(item_data.get('unit_price', 0)))
                calc_type = item_data.get('calculation_type', 'unit')
                width = Decimal(str(item_data.get('width', 0)))
                height = Decimal(str(item_data.get('height', 0)))

                if calc_type == 'area' and width > 0 and height > 0:
                    area = width * height
                    tot_cost = qty * area * u_cost
                    tot_price = qty * area * u_price
                elif calc_type == 'fixed':
                    tot_cost = u_cost
                    tot_price = u_price
                else:
                    tot_cost = qty * u_cost
                    tot_price = qty * u_price

                margin = tot_price - tot_cost
                item_data['unit_cost'] = u_cost
                item_data['total_cost'] = tot_cost
                item_data['unit_price'] = u_price
                item_data['total_price'] = tot_price
                item_data['margin'] = margin
                item_data['sort_order'] = item_data.get('sort_order', idx)

                EstimationItem.objects.create(estimation=instance, **item_data)
                subtotal_cost += tot_cost
                subtotal_price += tot_price

            instance.subtotal_cost = subtotal_cost
            instance.subtotal_price = subtotal_price
            tax = Decimal(str(instance.tax_amount or 0))
            instance.total_price = subtotal_price + tax
            instance.margin_amount = subtotal_price - subtotal_cost
            if subtotal_price > 0:
                instance.margin_percentage = round(((subtotal_price - subtotal_cost) / subtotal_price) * 100, 2)
            else:
                instance.margin_percentage = Decimal('0.00')

        instance.save()
        return instance


# -------------------------------------------------------------------------
# Quotation Serializers
# -------------------------------------------------------------------------
class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = '__all__'
        read_only_fields = ['quotation']


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, required=False)
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_email = serializers.ReadOnlyField(source='customer.email')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_code = serializers.ReadOnlyField(source='job_order.order_id')
    bank_name = serializers.ReadOnlyField(source='bank_account.bank_name')
    bank_account_number = serializers.ReadOnlyField(source='bank_account.account_number')
    bank_iban = serializers.ReadOnlyField(source='bank_account.iban')
    converted_invoice_number = serializers.ReadOnlyField(source='converted_invoice.invoice_number')
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by_staff:
            return obj.created_by_staff
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username
        return 'System'

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        quotation = Quotation.objects.create(**validated_data)

        calculated_subtotal = Decimal('0.00')
        calculated_tax = Decimal('0.00')

        for idx, item in enumerate(items_data):
            qty = Decimal(str(item.get('quantity', 1)))
            unit_price = Decimal(str(item.get('unit_price', 0)))
            disc_rate = Decimal(str(item.get('discount_rate', 0)))
            tax_rate = Decimal(str(item.get('tax_rate', 15)))

            line_base = qty * unit_price
            line_disc = round(line_base * (disc_rate / Decimal('100')), 2)
            line_taxable = max(Decimal('0.00'), line_base - line_disc)
            line_tax = round(line_taxable * (tax_rate / Decimal('100')), 2)
            line_total = round(line_taxable + line_tax, 2)

            calculated_subtotal += line_taxable
            calculated_tax += line_tax

            QuotationItem.objects.create(
                quotation=quotation,
                description=item.get('description', ''),
                quantity=qty,
                unit=item.get('unit', 'Unit'),
                unit_price=unit_price,
                discount_rate=disc_rate,
                tax_rate=tax_rate,
                tax_amount=line_tax,
                total=line_total,
                sort_order=idx
            )

        if items_data:
            quotation.subtotal = calculated_subtotal
            disc_overall = Decimal(str(quotation.discount_amount or 0))
            net_taxable = max(Decimal('0.00'), calculated_subtotal - disc_overall)
            if calculated_subtotal > Decimal('0.00'):
                adjusted_tax = round(calculated_tax * (net_taxable / calculated_subtotal), 2)
            else:
                adjusted_tax = Decimal('0.00')
            quotation.tax_amount = adjusted_tax
            quotation.total_amount = net_taxable + adjusted_tax
            quotation.save()

        return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if items_data is not None:
            instance.items.all().delete()
            calculated_subtotal = Decimal('0.00')
            calculated_tax = Decimal('0.00')

            for idx, item in enumerate(items_data):
                qty = Decimal(str(item.get('quantity', 1)))
                unit_price = Decimal(str(item.get('unit_price', 0)))
                disc_rate = Decimal(str(item.get('discount_rate', 0)))
                tax_rate = Decimal(str(item.get('tax_rate', 15)))

                line_base = qty * unit_price
                line_disc = round(line_base * (disc_rate / Decimal('100')), 2)
                line_taxable = max(Decimal('0.00'), line_base - line_disc)
                line_tax = round(line_taxable * (tax_rate / Decimal('100')), 2)
                line_total = round(line_taxable + line_tax, 2)

                calculated_subtotal += line_taxable
                calculated_tax += line_tax

                QuotationItem.objects.create(
                    quotation=instance,
                    description=item.get('description', ''),
                    quantity=qty,
                    unit=item.get('unit', 'Unit'),
                    unit_price=unit_price,
                    discount_rate=disc_rate,
                    tax_rate=tax_rate,
                    tax_amount=line_tax,
                    total=line_total,
                    sort_order=idx
                )

            instance.subtotal = calculated_subtotal
            disc_overall = Decimal(str(instance.discount_amount or 0))
            net_taxable = max(Decimal('0.00'), calculated_subtotal - disc_overall)
            if calculated_subtotal > Decimal('0.00'):
                adjusted_tax = round(calculated_tax * (net_taxable / calculated_subtotal), 2)
            else:
                adjusted_tax = Decimal('0.00')
            instance.tax_amount = adjusted_tax
            instance.total_amount = net_taxable + adjusted_tax

        instance.save()
        return instance


# -------------------------------------------------------------------------
# Credit Note Serializers
# -------------------------------------------------------------------------
class CreditNoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditNoteItem
        fields = '__all__'
        read_only_fields = ['credit_note']


class CreditNoteSerializer(serializers.ModelSerializer):
    items = CreditNoteItemSerializer(many=True, required=False)
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_email = serializers.ReadOnlyField(source='customer.email')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CreditNote
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by_staff:
            return obj.created_by_staff
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username
        return 'System'

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        credit_note = CreditNote.objects.create(**validated_data)

        calculated_subtotal = Decimal('0.00')
        calculated_tax = Decimal('0.00')

        for idx, item in enumerate(items_data):
            qty = max(Decimal('0.01'), Decimal(str(item.get('quantity', 1))))
            unit_price = max(Decimal('0.00'), Decimal(str(item.get('unit_price', 0))))
            disc_rate = min(Decimal('100.00'), max(Decimal('0.00'), Decimal(str(item.get('discount_rate', 0)))))
            tax_rate = max(Decimal('0.00'), Decimal(str(item.get('tax_rate', 15))))


            line_base = qty * unit_price
            line_disc = round(line_base * (disc_rate / Decimal('100')), 2)
            line_taxable = max(Decimal('0.00'), line_base - line_disc)
            line_tax = round(line_taxable * (tax_rate / Decimal('100')), 2)
            line_total = round(line_taxable + line_tax, 2)

            calculated_subtotal += line_taxable
            calculated_tax += line_tax

            CreditNoteItem.objects.create(
                credit_note=credit_note,
                description=item.get('description', ''),
                quantity=qty,
                unit=item.get('unit', 'Unit'),
                unit_price=unit_price,
                discount_rate=disc_rate,
                tax_rate=tax_rate,
                tax_amount=line_tax,
                total=line_total,
                sort_order=idx
            )

        if items_data:
            credit_note.subtotal = calculated_subtotal
            disc_overall = Decimal(str(credit_note.discount_amount or 0))
            net_taxable = max(Decimal('0.00'), calculated_subtotal - disc_overall)
            if calculated_subtotal > Decimal('0.00'):
                adjusted_tax = round(calculated_tax * (net_taxable / calculated_subtotal), 2)
            else:
                adjusted_tax = Decimal('0.00')
            credit_note.tax_amount = adjusted_tax
            credit_note.total_amount = net_taxable + adjusted_tax
            credit_note.save()

        return credit_note

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if items_data is not None:
            instance.items.all().delete()
            calculated_subtotal = Decimal('0.00')
            calculated_tax = Decimal('0.00')

            for idx, item in enumerate(items_data):
                qty = max(Decimal('0.01'), Decimal(str(item.get('quantity', 1))))
                unit_price = max(Decimal('0.00'), Decimal(str(item.get('unit_price', 0))))
                disc_rate = min(Decimal('100.00'), max(Decimal('0.00'), Decimal(str(item.get('discount_rate', 0)))))
                tax_rate = max(Decimal('0.00'), Decimal(str(item.get('tax_rate', 15))))


                line_base = qty * unit_price
                line_disc = round(line_base * (disc_rate / Decimal('100')), 2)
                line_taxable = max(Decimal('0.00'), line_base - line_disc)
                line_tax = round(line_taxable * (tax_rate / Decimal('100')), 2)
                line_total = round(line_taxable + line_tax, 2)

                calculated_subtotal += line_taxable
                calculated_tax += line_tax

                CreditNoteItem.objects.create(
                    credit_note=instance,
                    description=item.get('description', ''),
                    quantity=qty,
                    unit=item.get('unit', 'Unit'),
                    unit_price=unit_price,
                    discount_rate=disc_rate,
                    tax_rate=tax_rate,
                    tax_amount=line_tax,
                    total=line_total,
                    sort_order=idx
                )

            instance.subtotal = calculated_subtotal
            disc_overall = Decimal(str(instance.discount_amount or 0))
            net_taxable = max(Decimal('0.00'), calculated_subtotal - disc_overall)
            if calculated_subtotal > Decimal('0.00'):
                adjusted_tax = round(calculated_tax * (net_taxable / calculated_subtotal), 2)
            else:
                adjusted_tax = Decimal('0.00')
            instance.tax_amount = adjusted_tax
            instance.total_amount = net_taxable + adjusted_tax

        instance.save()
        return instance


# -------------------------------------------------------------------------
# Delivery Note Serializers
# -------------------------------------------------------------------------
class DeliveryNoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryNoteItem
        fields = '__all__'
        read_only_fields = ['delivery_note']


class DeliveryNoteSerializer(serializers.ModelSerializer):
    items = DeliveryNoteItemSerializer(many=True, required=False)
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_email = serializers.ReadOnlyField(source='customer.email')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')
    job_order_title = serializers.ReadOnlyField(source='job_order.title')
    job_order_code = serializers.ReadOnlyField(source='job_order.order_id')
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryNote
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by_staff:
            return obj.created_by_staff
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username
        return 'System'

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        delivery_note = DeliveryNote.objects.create(**validated_data)

        for idx, item in enumerate(items_data):
            qty = Decimal(str(item.get('quantity', 1)))
            u_price = Decimal(str(item.get('unit_price', 0))) if item.get('unit_price') else Decimal('0.00')
            tot = Decimal(str(item.get('total', qty * u_price))) if item.get('total') else (qty * u_price)

            DeliveryNoteItem.objects.create(
                delivery_note=delivery_note,
                description=item.get('description', ''),
                quantity=qty,
                unit=item.get('unit', 'Unit'),
                packages_count=item.get('packages_count', ''),
                package_type=item.get('package_type', ''),
                unit_price=u_price,
                total=tot,
                remarks=item.get('remarks', ''),
                sort_order=idx
            )

        return delivery_note

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if items_data is not None:
            instance.items.all().delete()
            for idx, item in enumerate(items_data):
                qty = Decimal(str(item.get('quantity', 1)))
                u_price = Decimal(str(item.get('unit_price', 0))) if item.get('unit_price') else Decimal('0.00')
                tot = Decimal(str(item.get('total', qty * u_price))) if item.get('total') else (qty * u_price)

                DeliveryNoteItem.objects.create(
                    delivery_note=instance,
                    description=item.get('description', ''),
                    quantity=qty,
                    unit=item.get('unit', 'Unit'),
                    packages_count=item.get('packages_count', ''),
                    package_type=item.get('package_type', ''),
                    unit_price=u_price,
                    total=tot,
                    remarks=item.get('remarks', ''),
                    sort_order=idx
                )

        instance.save()
        return instance


class RecycleBinItemSerializer(serializers.ModelSerializer):
    entity_type_display = serializers.CharField(source='get_entity_type_display', read_only=True)
    deleted_by_name = serializers.SerializerMethodField()
    restored_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RecycleBinItem
        fields = [
            'id',
            'entity_type',
            'entity_type_display',
            'model_name',
            'original_id',
            'item_name',
            'item_summary',
            'item_data',
            'deleted_by',
            'deleted_by_name',
            'deleted_at',
            'can_restore',
            'is_restored',
            'restored_at',
            'restored_by',
            'restored_by_name',
        ]
        read_only_fields = ['id', 'deleted_at', 'restored_at', 'deleted_by_name', 'restored_by_name']

    def get_deleted_by_name(self, obj):
        if obj.deleted_by:
            return obj.deleted_by.get_full_name() or obj.deleted_by.username
        return obj.deleted_by_name or 'System User'

    def get_restored_by_name(self, obj):
        if obj.restored_by:
            return obj.restored_by.get_full_name() or obj.restored_by.username
        return obj.restored_by_name or ''

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.model_name == 'CashBookEntry' or instance.entity_type == 'cashbook_entry':
            fields = (instance.item_data or {}).get('fields', {})
            remark = fields.get('remark') or fields.get('description') or ''
            party = fields.get('party_name') or fields.get('staff_name') or ''
            category = fields.get('category') or ''
            payment_mode = fields.get('payment_mode') or ''
            account = fields.get('bank_account_name') or fields.get('petty_cash_account_name') or ''
            ref = fields.get('reference_number') or ''
            amount = fields.get('amount') or 0
            date_str = fields.get('date') or ''
            entry_type_raw = str(fields.get('entry_type') or 'out').lower()
            direction = 'Credit (Inflow)' if entry_type_raw == 'in' else 'Debit (Outflow)'
            short_dir = 'In' if entry_type_raw == 'in' else 'Out'
            
            title = remark or party or category or 'Cashbook Transaction'
            party_suffix = f" [{party}]" if (party and remark and party.lower() not in remark.lower()) else ""
            data['item_name'] = f"{short_dir}: {title} ({amount} SAR){party_suffix}"
            
            summary_parts = [f"Date: {date_str}", f"Amount: {amount} SAR", f"Type: {direction}"]
            if category:
                summary_parts.append(f"Category: {category}")
            if party and party != title:
                summary_parts.append(f"Party: {party}")
            if payment_mode:
                summary_parts.append(f"Mode: {payment_mode}")
            if account:
                summary_parts.append(f"Account: {account}")
            if ref:
                summary_parts.append(f"Ref #: {ref}")
            if remark and remark != title:
                summary_parts.append(f"Remark: {remark}")
                
            data['item_summary'] = " | ".join(summary_parts)
        return data




