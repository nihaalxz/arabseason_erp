from django.shortcuts import render
from django.http import HttpResponse
from rest_framework import viewsets, permissions, status, views
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Sum, Count, Q, F, DecimalField, Subquery, OuterRef, Case, When
from django.db.models.functions import TruncMonth, Coalesce
from django.utils import timezone
import datetime
import logging
from decimal import Decimal
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

from .models import (Customer, Vendor, JobOrder, PendingJobOrder, CustomerPayment, VendorPayment, 
                    Expense, SiteSettings, PaymentRequest, ExpenseCategory, ExpenseType, Labour, ExcludedJobTitle,
                    PlanningTool, PlanningWorker, ProjectPlan, SalaryPayment,
                    CashBook, CashBookEntry, StaffTimesheet, BankAccount, PettyCashAccount,
                    Invoice, InvoiceItem, CustomFormField,
                    MaterialCategory, Material, Estimation, EstimationItem,
                    Quotation, QuotationItem, CreditNote, CreditNoteItem, DeliveryNote, DeliveryNoteItem,
                    Notification, RecycleBinItem, Enquiry, EnquiryFollowUp, Salesperson)
from .serializers import (CustomerSerializer, VendorSerializer, JobOrderSerializer, PendingJobOrderSerializer, 
                        CustomerPaymentSerializer, VendorPaymentSerializer,
                        ExpenseSerializer, SiteSettingsSerializer,
                        JobOrderLookupSerializer, PaymentRequestSerializer,
                        ExpenseCategorySerializer, ExpenseTypeSerializer, LabourSerializer,
                        PlanningToolSerializer, PlanningWorkerSerializer, ProjectPlanSerializer,
                        SalaryPaymentSerializer, CashBookSerializer, CashBookEntrySerializer,
                        StaffTimesheetSerializer, BankAccountSerializer, PettyCashAccountSerializer,
                        InvoiceSerializer, InvoiceItemSerializer, CustomFormFieldSerializer,
                        MaterialCategorySerializer, MaterialSerializer,
                        EstimationSerializer, EstimationItemSerializer,
                        QuotationSerializer, QuotationItemSerializer,
                        CreditNoteSerializer, CreditNoteItemSerializer,
                        DeliveryNoteSerializer, DeliveryNoteItemSerializer,
                        NotificationSerializer, RecycleBinItemSerializer,
                        EnquirySerializer, EnquiryFollowUpSerializer, SalespersonSerializer)

def is_admin_user(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.is_staff or getattr(user, 'role', '') == 'Admin'))

class IsAdminRoleUser(permissions.BasePermission):
    """
    Permission check for users with role = 'Admin', staff, or superuser.
    """
    def has_permission(self, request, view):
        return is_admin_user(request.user)

class HasCashbookAccess(permissions.BasePermission):
    """
    Permission check: Admin/Staff or users with 'cashbook' in their access_list.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_admin_user(user):
            return True
        access_list = getattr(user, 'access_list', None) or []
        return 'cashbook' in access_list

class HasSalaryAccess(permissions.BasePermission):
    """
    Permission check: Admin/Staff or users with salary/hr/payroll in their access_list.
    Blocks unauthorized employees from reading executive or company payroll data.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_admin_user(user):
            return True
        access_list = getattr(user, 'access_list', None) or []
        return any(k in access_list for k in ['salary', 'salaries', 'hr', 'payroll', 'accounting'])


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        jobs_sub = JobOrder.objects.filter(customer=OuterRef('pk')).exclude(status='Cancelled').values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
        invs_sub = Invoice.objects.filter(customer=OuterRef('pk'), job_order__isnull=True).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
        cns_sub = CreditNote.objects.filter(customer=OuterRef('pk')).exclude(status__in=['Draft', 'Cancelled']).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
        pays_sub = CustomerPayment.objects.filter(customer=OuterRef('pk')).values('customer').annotate(
            total=Sum(
                Case(
                    When(payment_type='refund', then=-F('amount')),
                    default=F('amount'),
                    output_field=DecimalField(max_digits=12, decimal_places=2)
                )
            )
        ).values('total')[:1]

        adv_sub = CustomerPayment.objects.filter(customer=OuterRef('pk'), payment_type='advance').values('customer').annotate(total=Sum('amount')).values('total')[:1]

        qs = Customer.objects.annotate(
            total_billed=Coalesce(Subquery(jobs_sub), Decimal('0'), output_field=DecimalField()) + Coalesce(Subquery(invs_sub), Decimal('0'), output_field=DecimalField()) - Coalesce(Subquery(cns_sub), Decimal('0'), output_field=DecimalField()),
            paid_amount=Coalesce(Subquery(pays_sub), Decimal('0'), output_field=DecimalField()),
            advance_paid=Coalesce(Subquery(adv_sub), Decimal('0'), output_field=DecimalField())
        ).select_related('created_by').order_by('name').distinct()

        if not is_admin_user(self.request.user):
            qs = qs.filter(created_by=self.request.user)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(company_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(address__icontains=search)
            )
        pending_only = self.request.query_params.get('pending_only')
        if pending_only == 'true':
            qs = qs.filter(total_billed__gt=F('paid_amount'))
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def list(self, request, *args, **kwargs):
        if request.query_params.get('nopage') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        is_admin = is_admin_user(request.user)
        job_qs = JobOrder.objects.exclude(status='Cancelled') if is_admin else JobOrder.objects.filter(customer__created_by=request.user).exclude(status='Cancelled')
        inv_qs = Invoice.objects.filter(job_order__isnull=True) if is_admin else Invoice.objects.filter(customer__created_by=request.user, job_order__isnull=True)
        cn_qs = CreditNote.objects.exclude(status__in=['Draft', 'Cancelled']) if is_admin else CreditNote.objects.filter(customer__created_by=request.user).exclude(status__in=['Draft', 'Cancelled'])
        pay_qs = CustomerPayment.objects.all() if is_admin else CustomerPayment.objects.filter(customer__created_by=request.user)

        job_total = float(job_qs.aggregate(Sum('total_amount'))['total_amount__sum'] or 0)
        inv_total = float(inv_qs.aggregate(Sum('total_amount'))['total_amount__sum'] or 0)
        cn_total = float(cn_qs.aggregate(Sum('total_amount'))['total_amount__sum'] or 0)
        total_billed = (job_total + inv_total) - cn_total
        pay_in = float(pay_qs.exclude(payment_type='refund').aggregate(Sum('amount'))['amount__sum'] or 0)
        pay_refund = float(pay_qs.filter(payment_type='refund').aggregate(Sum('amount'))['amount__sum'] or 0)
        total_paid = pay_in - pay_refund
        pending_balance = total_billed - total_paid

        cust_qs = Customer.objects.all() if is_admin else Customer.objects.filter(created_by=request.user)
        total_count = cust_qs.count()

        jobs_sub = JobOrder.objects.filter(customer=OuterRef('pk')).exclude(status='Cancelled').values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
        invs_sub = Invoice.objects.filter(customer=OuterRef('pk'), job_order__isnull=True).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
        cns_sub = CreditNote.objects.filter(customer=OuterRef('pk')).exclude(status__in=['Draft', 'Cancelled']).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
        pays_sub = CustomerPayment.objects.filter(customer=OuterRef('pk')).values('customer').annotate(
            total=Sum(
                Case(
                    When(payment_type='refund', then=-F('amount')),
                    default=F('amount'),
                    output_field=DecimalField(max_digits=12, decimal_places=2)
                )
            )
        ).values('total')[:1]
        pending_count = cust_qs.annotate(
            tb=Coalesce(Subquery(jobs_sub), Decimal('0'), output_field=DecimalField()) + Coalesce(Subquery(invs_sub), Decimal('0'), output_field=DecimalField()) - Coalesce(Subquery(cns_sub), Decimal('0'), output_field=DecimalField()),
            pa=Coalesce(Subquery(pays_sub), Decimal('0'), output_field=DecimalField())
        ).filter(tb__gt=F('pa')).count()

        total_payable = max(0.0, float(cust_qs.aggregate(tot=Coalesce(Sum('payable_amount'), Decimal('0'), output_field=DecimalField()))['tot'] or 0) - pay_refund)

        return Response({
            'total_billed': total_billed,
            'paid_amount': total_paid,
            'pending_balance': pending_balance,
            'total_count': total_count,
            'pending_count': pending_count,
            'total_payable': total_payable
        })

class VendorViewSet(viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Vendor.objects.all().select_related('created_by').order_by('name')
        if not is_admin_user(self.request.user):
            qs = qs.filter(created_by=self.request.user)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(company__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(address__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def list(self, request, *args, **kwargs):
        if request.query_params.get('nopage') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)

class JobOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        if request.query_params.get('nopage') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = JobOrder.objects.all().select_related('customer', 'vendor', 'created_by', 'assigned_to', 'assigned_by').prefetch_related('customer_payments')
        
        user = self.request.user
        if not is_admin_user(user):
            # Staff member: sees jobs they created that have NOT been accepted yet by an admin
            queryset = queryset.filter(created_by=user).exclude(assignment_status='accepted')
        else:
            # Administrator: can view 'my' (owned/accepted), 'assigned' (delegated pending), or all
            view_scope = self.request.query_params.get('view_scope')
            if view_scope == 'assigned':
                queryset = queryset.filter(
                    Q(assigned_to=user) | Q(assigned_to__isnull=True),
                    assignment_status='pending'
                )
                staff_filter = self.request.query_params.get('assigned_by_staff')
                if staff_filter and staff_filter != 'all':
                    if str(staff_filter).isdigit():
                        queryset = queryset.filter(assigned_by_id=staff_filter)
                    else:
                        queryset = queryset.filter(
                            Q(assigned_by__username__iexact=staff_filter) |
                            Q(original_creator_name__icontains=staff_filter)
                        )
            elif view_scope == 'my':
                queryset = queryset.filter(
                    Q(created_by=user) |
                    Q(assignment_status='accepted', assigned_to=user)
                )
            elif view_scope != 'all' and not self.request.query_params.get('nopage') and not self.request.query_params.get('customer') and not self.request.query_params.get('vendor'):
                # Default main list view for admin is "My Job Orders"
                queryset = queryset.filter(
                    Q(created_by=user) |
                    Q(assignment_status='accepted', assigned_to=user)
                )

        customer_id = self.request.query_params.get('customer')
        if customer_id and str(customer_id).lower() != 'all':
            if str(customer_id).isdigit():
                queryset = queryset.filter(customer_id=customer_id)
            else:
                queryset = queryset.filter(customer__name=customer_id)

        vendor_id = self.request.query_params.get('vendor')
        if vendor_id and str(vendor_id).lower() != 'all':
            if str(vendor_id).isdigit():
                queryset = queryset.filter(
                    Q(vendor_id=vendor_id) |
                    Q(expenses__vendor_id=vendor_id) |
                    Q(vendor_payments__vendor_id=vendor_id)
                ).distinct()
            else:
                queryset = queryset.filter(
                    Q(vendor__name=vendor_id) |
                    Q(expenses__vendor__name=vendor_id) |
                    Q(vendor_payments__vendor__name=vendor_id)
                ).distinct()
            
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(order_id__icontains=search_query) |
                Q(customer__name__icontains=search_query) |
                Q(vendor__name__icontains=search_query)
            )
            
        payment_status = self.request.query_params.get('payment_status')
        if payment_status:
            queryset = queryset.annotate(
                total_paid=Coalesce(Sum('customer_payments__amount'), Decimal('0'), output_field=DecimalField())
            )
            if payment_status == 'paid':
                queryset = queryset.filter(total_amount__lte=F('total_paid'))
            elif payment_status == 'unpaid':
                queryset = queryset.filter(total_amount__gt=F('total_paid'))

        ordering = self.request.query_params.get('ordering')
        if ordering:
            valid_orderings = {
                'order_id': 'order_id',
                '-order_id': '-order_id',
                'id': 'id',
                '-id': '-id',
                'title': 'title',
                '-title': '-title',
                'status': 'status',
                '-status': '-status',
                'total_amount': 'total_amount',
                '-total_amount': '-total_amount',
                'customer': 'customer__name',
                '-customer': '-customer__name',
                'customer__name': 'customer__name',
                '-customer__name': '-customer__name',
                'created_at': 'created_at',
                '-created_at': '-created_at',
            }
            if ordering in valid_orderings:
                queryset = queryset.order_by(valid_orderings[ordering])
            else:
                queryset = queryset.order_by('-created_at')
        else:
            queryset = queryset.order_by('-created_at')
                
        return queryset.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        customer_obj = serializer.validated_data.get('customer')
        advance_amount = serializer.validated_data.get('advance_amount', Decimal('0'))
        payment_type = serializer.validated_data.get('payment_type', 'full')

        # 4.3 — Compute prior_balance: sum of all previous jobs' and standalone invoices' minus credit notes and payments
        prior_balance = Decimal('0')
        if customer_obj:
            cid = customer_obj.id if hasattr(customer_obj, 'id') else customer_obj
            total_prior_billed = JobOrder.objects.filter(customer_id=cid).aggregate(
                tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            total_prior_invoices = Invoice.objects.filter(customer_id=cid, job_order__isnull=True).aggregate(
                tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            total_prior_cn = CreditNote.objects.filter(customer_id=cid).exclude(status__in=['Draft', 'Cancelled']).aggregate(
                tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            total_prior_paid = CustomerPayment.objects.filter(customer_id=cid).aggregate(
                tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            prior_balance = max(Decimal('0'), (total_prior_billed + total_prior_invoices - total_prior_cn) - total_prior_paid)

        order_id = serializer.validated_data.get('order_id')
        if not order_id:
            import datetime
            import re
            cur_month = datetime.date.today().strftime('%b').upper()
            existing = JobOrder.objects.filter(order_id__istartswith=f"#{cur_month}")
            nums = []
            for j in existing:
                m = re.search(r'\d+', j.order_id or '')
                if m:
                    nums.append(int(m.group()))
            next_num = max(nums) + 1 if nums else (existing.count() + 1)
            order_id = f"#{cur_month}{str(next_num).zfill(2)}"

        created_by_staff = serializer.validated_data.get('created_by_staff')
        if not created_by_staff and user and user.is_authenticated:
            full = f"{user.first_name} {user.last_name}".strip()
            created_by_staff = full or user.username

        # Check if an admin was assigned during creation
        assigned_to_id = self.request.data.get('assigned_to') or self.request.data.get('assigned_to_id')
        assigned_to_user = None
        if assigned_to_id:
            User = get_user_model()
            assigned_to_user = User.objects.filter(id=assigned_to_id).first()

        job = serializer.save(
            order_id=order_id,
            created_by=user,
            created_by_staff=created_by_staff,
            prior_balance=prior_balance,
            assigned_to=assigned_to_user,
            assigned_by=user if assigned_to_user else None,
            original_creator_name=created_by_staff if assigned_to_user else None,
            assignment_status='pending' if assigned_to_user else 'unassigned',
            assigned_at=timezone.now() if assigned_to_user else None
        )

        # Notify assigned admin
        if assigned_to_user and assigned_to_user != user:
            Notification.objects.create(
                recipient=assigned_to_user,
                actor=user,
                notification_type='job_order_assigned',
                title=f"Job Order Assigned: {job.order_id}",
                message=f"{created_by_staff} created and assigned Job Order {job.order_id} ({job.title}) to you for review.",
                action_type='view_job_order',
                action_data={'job_order_id': job.id, 'order_id': job.order_id}
            )

        # If advance_amount provided, auto-create a CustomerPayment tagged as 'advance'
        advance_amount_val = Decimal('0.00')
        if advance_amount:
            try:
                advance_amount_val = Decimal(str(advance_amount).replace(',', '').strip())
            except (ValueError, TypeError, ArithmeticError):
                advance_amount_val = Decimal('0.00')

        if advance_amount_val > Decimal('0.00'):
            import datetime
            from django.db import transaction
            with transaction.atomic():
                cp = CustomerPayment.objects.create(
                    customer=job.customer,
                    job_order=job,
                    amount=advance_amount_val,
                    payment_date=datetime.date.today(),
                    payment_type='advance',
                    notes=f"Advance payment at job creation ({job.order_id or job.id})",
                    created_by=user
                )

                # Check if an account was selected for receiving the advance payment
                bank_id = self.request.data.get('bank_account') or self.request.data.get('bank_account_id')
                pca_id = self.request.data.get('petty_cash_account') or self.request.data.get('petty_cash_account_id')
                cashbook_id = self.request.data.get('cashbook') or self.request.data.get('cashbook_id')
                payment_mode = self.request.data.get('payment_mode')

                bank_obj = BankAccount.objects.filter(id=bank_id).first() if bank_id else None
                pca_obj = PettyCashAccount.objects.filter(id=pca_id).first() if pca_id else None

                if not payment_mode:
                    if bank_obj:
                        payment_mode = 'Bank Transfer'
                    elif pca_obj:
                        payment_mode = 'Petty Cash'
                    else:
                        payment_mode = 'Cash'

                # If bank or pca or cashbook was specified, create CashBookEntry
                if bank_obj or pca_obj or cashbook_id:
                    cb_entry = CashBookEntry.objects.create(
                        cashbook_id=cashbook_id,
                        entry_type='in',
                        amount=advance_amount_val,
                        date=datetime.date.today(),
                        time=datetime.datetime.now().time().strftime('%H:%M:%S'),
                        remark=f"Advance payment against Job #{str(job.order_id or job.id).replace('#', '')} - {job.title}",
                        category='Sales',
                        payment_mode=payment_mode,
                        transaction_type='Customer Payment',
                        bank_account=bank_obj,
                        bank_account_name=bank_obj.bank_name if bank_obj else '',
                        petty_cash_account=pca_obj,
                        petty_cash_account_name=pca_obj.name if pca_obj else '',
                        party_name=job.customer.name if job.customer else '',
                        customer=job.customer,
                        customer_payment=cp,
                        job_order=job,
                        created_by=user
                    )
                    if bank_obj:
                        BankAccount.objects.filter(id=bank_obj.id).update(
                            balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + advance_amount_val
                        )
                    if pca_obj:
                        PettyCashAccount.objects.filter(id=pca_obj.id).update(
                            balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + advance_amount_val
                        )

        # 4.4 — If converted from a pending job order, link and convert it
        pending_id = self.request.data.get('pending_job_order') or self.request.data.get('pending_job_order_id')
        if pending_id:
            try:
                pjo = PendingJobOrder.objects.get(id=pending_id)
                pjo.converted_job = job
                pjo.status = 'converted'
                pjo.save(update_fields=['converted_job', 'status'])
                if pjo.cashbook_entry:
                    cb = pjo.cashbook_entry
                    cb.job_order = job
                    cb.save(update_fields=['job_order'])
                    if cb.customer_payment:
                        cp = cb.customer_payment
                        cp.job_order = job
                        cp.save(update_fields=['job_order'])
            except (PendingJobOrder.DoesNotExist, ValueError):
                pass

    def perform_update(self, serializer):
        prev_instance = self.get_object()
        old_status = prev_instance.status
        old_assigned_to = prev_instance.assigned_to

        job = serializer.save()
        user = self.request.user if self.request.user.is_authenticated else None
        advance_amount = Decimal(str(job.advance_amount or 0))
        adv_payment = CustomerPayment.objects.filter(job_order=job, payment_type='advance').first()

        # Check if newly assigned to an admin
        if job.assigned_to and job.assigned_to != old_assigned_to:
            job.assigned_by = user
            job.assignment_status = 'pending'
            job.assigned_at = timezone.now()
            if not job.original_creator_name:
                creator_user = job.created_by or user
                if creator_user:
                    job.original_creator_name = creator_user.get_full_name() or creator_user.username
            job.save(update_fields=['assigned_by', 'assignment_status', 'assigned_at', 'original_creator_name'])

            if job.assigned_to != user:
                creator_name = user.get_full_name() or user.username if user else 'Staff'
                Notification.objects.create(
                    recipient=job.assigned_to,
                    actor=user,
                    notification_type='job_order_assigned',
                    title=f"Job Order Assigned: {job.order_id}",
                    message=f"{creator_name} assigned Job Order {job.order_id} ({job.title}) to you for review.",
                    action_type='view_job_order',
                    action_data={'job_order_id': job.id, 'order_id': job.order_id}
                )

        # Check if marked as Cancelled
        if job.status == 'Cancelled' and old_status != 'Cancelled':
            job.assignment_status = 'cancelled'
            job.save(update_fields=['assignment_status'])
            target_recipient = job.assigned_by or (job.created_by if job.created_by != user else None)
            if target_recipient and target_recipient != user:
                actor_name = user.get_full_name() or user.username if user else 'Admin'
                Notification.objects.create(
                    recipient=target_recipient,
                    actor=user,
                    notification_type='job_order_cancelled',
                    title=f"Job Order Cancelled: {job.order_id}",
                    message=f"Job Order {job.order_id} ({job.title}) has been marked as Cancelled by {actor_name}.",
                    action_type='view_job_order',
                    action_data={'job_order_id': job.id, 'order_id': job.order_id}
                )
        if advance_amount > 0:
            import datetime
            if adv_payment:
                old_adv = adv_payment.amount
                adv_payment.amount = advance_amount
                adv_payment.save(update_fields=['amount'])
                cb_entry = CashBookEntry.objects.filter(customer_payment=adv_payment).first()
                if cb_entry:
                    diff = advance_amount - old_adv
                    cb_entry.amount = advance_amount
                    cb_entry.save(update_fields=['amount'])
                    if cb_entry.bank_account:
                        b = cb_entry.bank_account
                        b.balance = (b.balance or Decimal('0.00')) + diff
                        b.save(update_fields=['balance'])
                    elif cb_entry.petty_cash_account:
                        p = cb_entry.petty_cash_account
                        p.balance = (p.balance or Decimal('0.00')) + diff
                        p.save(update_fields=['balance'])
            else:
                cp = CustomerPayment.objects.create(
                    customer=job.customer,
                    job_order=job,
                    amount=advance_amount,
                    payment_date=datetime.date.today(),
                    payment_type='advance',
                    notes=f"Advance payment for job ({job.order_id or job.id})",
                    created_by=user
                )
                bank_id = self.request.data.get('bank_account') or self.request.data.get('bank_account_id')
                pca_id = self.request.data.get('petty_cash_account') or self.request.data.get('petty_cash_account_id')
                cashbook_id = self.request.data.get('cashbook') or self.request.data.get('cashbook_id')
                payment_mode = self.request.data.get('payment_mode')
                bank_obj = BankAccount.objects.filter(id=bank_id).first() if bank_id else None
                pca_obj = PettyCashAccount.objects.filter(id=pca_id).first() if pca_id else None
                if not payment_mode:
                    payment_mode = 'Bank Transfer' if bank_obj else ('Petty Cash' if pca_obj else 'Cash')
                if bank_obj or pca_obj or cashbook_id:
                    cb_entry = CashBookEntry.objects.create(
                        cashbook_id=cashbook_id,
                        entry_type='in',
                        amount=advance_amount,
                        date=datetime.date.today(),
                        time=datetime.datetime.now().time().strftime('%H:%M:%S'),
                        remark=f"Advance payment against Job #{str(job.order_id or job.id).replace('#', '')} - {job.title}",
                        category='Sales',
                        payment_mode=payment_mode,
                        transaction_type='Customer Payment',
                        bank_account=bank_obj,
                        bank_account_name=bank_obj.bank_name if bank_obj else '',
                        petty_cash_account=pca_obj,
                        petty_cash_account_name=pca_obj.name if pca_obj else '',
                        party_name=job.customer.name if job.customer else '',
                        customer=job.customer,
                        customer_payment=cp,
                        job_order=job,
                        created_by=user
                    )
                    if bank_obj:
                        bank_obj.balance = (bank_obj.balance or Decimal('0.00')) + advance_amount
                        bank_obj.save(update_fields=['balance'])
                    if pca_obj:
                        pca_obj.balance = (pca_obj.balance or Decimal('0.00')) + advance_amount
                        pca_obj.save(update_fields=['balance'])
        elif adv_payment and advance_amount == 0:
            cb_entry = CashBookEntry.objects.filter(customer_payment=adv_payment).first()
            if cb_entry:
                if cb_entry.bank_account:
                    b = cb_entry.bank_account
                    b.balance = (b.balance or Decimal('0.00')) - cb_entry.amount
                    b.save(update_fields=['balance'])
                elif cb_entry.petty_cash_account:
                    p = cb_entry.petty_cash_account
                    p.balance = (p.balance or Decimal('0.00')) - cb_entry.amount
                    p.save(update_fields=['balance'])
                cb_entry.delete()
            adv_payment.delete()

    @action(detail=False, methods=['get'], url_path='prior-balance')
    def prior_balance(self, request):
        customer_id = request.query_params.get('customer')
        if not customer_id:
            return Response({'prior_balance': 0.0, 'total_billed': 0.0, 'total_paid': 0.0})
        
        jobs_tot = JobOrder.objects.filter(customer_id=customer_id).exclude(status='Cancelled').aggregate(
            tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
        )['tot']
        inv_tot = Invoice.objects.filter(customer_id=customer_id, job_order__isnull=True).aggregate(
            tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
        )['tot']
        cn_tot = CreditNote.objects.filter(customer_id=customer_id).exclude(status__in=['Draft', 'Cancelled']).aggregate(
            tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
        )['tot']
        
        pay_qs = CustomerPayment.objects.filter(customer_id=customer_id)
        cust_pay_in = pay_qs.exclude(payment_type__in=['refund', 'credit_note']).aggregate(
            tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
        )['tot']
        cust_refunds = pay_qs.filter(payment_type='refund').aggregate(
            tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
        )['tot']
        
        net_paid = max(Decimal('0'), cust_pay_in - cust_refunds)
        net_billed = max(Decimal('0'), (jobs_tot + inv_tot) - cn_tot)
        prior_bal = max(Decimal('0'), net_billed - net_paid)
        return Response({
            'customer_id': int(customer_id) if str(customer_id).isdigit() else customer_id,
            'prior_balance': float(prior_bal),
            'total_billed': float(net_billed),
            'total_paid': float(net_paid)
        })


    @action(detail=False, methods=['get'], url_path='staff-options')
    def staff_options(self, request):
        from accounts.models import CustomUser
        users = CustomUser.objects.filter(is_active=True).values('id', 'username', 'first_name', 'last_name')
        staff_list = []
        for u in users:
            full = f"{u['first_name']} {u['last_name']}".strip()
            name = full if full else u['username']
            staff_list.append({
                'id': u['id'],
                'username': u['username'],
                'name': name
            })
        return Response(staff_list)

    def get_serializer_class(self):
        if self.request.query_params.get('lookup') == 'true':
            return JobOrderLookupSerializer
        return JobOrderSerializer

    @action(detail=False, methods=['get'])
    def titles(self, request):
        excluded = ExcludedJobTitle.objects.values_list('title', flat=True)
        qs = JobOrder.objects.all()
        if not is_admin_user(request.user):
            qs = qs.filter(created_by=request.user)
        titles = qs.exclude(title__in=excluded).values_list('title', flat=True).distinct().order_by('title')
        return Response(list(titles))

    @action(detail=False, methods=['post'], url_path='delete-title')
    def delete_title(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'role', '') == 'Admin'):
            return Response({'detail': 'Only administrators can exclude job titles.'}, status=status.HTTP_403_FORBIDDEN)
        title = request.data.get('title')
        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)
        ExcludedJobTitle.objects.get_or_create(title=title)
        excluded = ExcludedJobTitle.objects.values_list('title', flat=True)
        qs = JobOrder.objects.all()
        if not is_admin_user(request.user):
            qs = qs.filter(created_by=request.user)
        titles = qs.exclude(title__in=excluded).values_list('title', flat=True).distinct().order_by('title')
        return Response(list(titles))

    @action(detail=False, methods=['post'], url_path='restore-title')
    def restore_title(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'role', '') == 'Admin'):
            return Response({'detail': 'Only administrators can restore job titles.'}, status=status.HTTP_403_FORBIDDEN)
        title = request.data.get('title')
        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)
        ExcludedJobTitle.objects.filter(title=title).delete()
        excluded = ExcludedJobTitle.objects.values_list('title', flat=True)
        qs = JobOrder.objects.all()
        if not is_admin_user(request.user):
            qs = qs.filter(created_by=request.user)
        titles = qs.exclude(title__in=excluded).values_list('title', flat=True).distinct().order_by('title')
        return Response(list(titles))


    @action(detail=True, methods=['get'], url_path='credit-summary')
    def credit_summary(self, request, pk=None):
        """
        4.3 — Returns the complete credit breakdown for a job order:
        prior_balance, job total, grand total owed, advance paid, and outstanding.
        """
        job = self.get_object()
        paid_on_job = float(
            CustomerPayment.objects.filter(job_order=job)
            .aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        )
        advance_on_job = float(
            CustomerPayment.objects.filter(job_order=job, payment_type='advance')
            .aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        )
        balance_this_job = float(job.total_amount) - paid_on_job
        outstanding = float(job.prior_balance) + balance_this_job
        grand_total = float(job.prior_balance) + float(job.total_amount)

        payments = CustomerPayment.objects.filter(job_order=job).order_by('payment_date')
        history = [
            {
                'id': p.id,
                'amount': float(p.amount),
                'date': str(p.payment_date),
                'payment_type': p.payment_type,
                'payment_type_display': p.get_payment_type_display(),
                'notes': p.notes
            }
            for p in payments
        ]

        return Response({
            'job_id': job.id,
            'job_title': job.title,
            'job_total': float(job.total_amount),
            'prior_balance': float(job.prior_balance),
            'grand_total': round(grand_total, 2),
            'advance_paid': round(advance_on_job, 2),
            'paid_on_job': round(paid_on_job, 2),
            'balance_this_job': round(balance_this_job, 2),
            'outstanding': round(outstanding, 2),
            'payment_type': job.payment_type,
            'payment_history': history
        })

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        from .models import Customer
        qs = self.get_queryset()
        
        active_qs = qs.exclude(status='Cancelled')
        cancelled_qs = qs.filter(status='Cancelled')

        total_val = active_qs.aggregate(tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField()))['tot']
        total_paid = CustomerPayment.objects.filter(job_order__in=active_qs).aggregate(
            tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
        )['tot']
        total_balance = max(Decimal('0'), total_val - total_paid)
        count = active_qs.count()

        # Cancelled metrics
        cancelled_val = cancelled_qs.aggregate(tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField()))['tot']
        cancelled_paid = CustomerPayment.objects.filter(job_order__in=cancelled_qs).aggregate(
            tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
        )['tot']
        cancelled_count = cancelled_qs.count()

        # Build client breakdown
        customers = Customer.objects.all()
        if not is_admin_user(request.user):
            customers = customers.filter(created_by=request.user)
        
        client_breakdown = []
        for cust in customers:
            cust_jobs = JobOrder.objects.filter(customer=cust).exclude(status='Cancelled')
            if not is_admin_user(request.user):
                cust_jobs = cust_jobs.filter(created_by=request.user)
            c_count = cust_jobs.count()
            if c_count > 0:
                c_val = cust_jobs.aggregate(tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField()))['tot']
                c_paid = CustomerPayment.objects.filter(job_order__in=cust_jobs).aggregate(
                    tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
                )['tot']
                client_breakdown.append({
                    'customer_id': cust.id,
                    'customer_name': cust.name,
                    'count': c_count,
                    'total_value': float(c_val),
                    'total_paid': float(c_paid),
                    'total_balance': float(max(Decimal('0'), c_val - c_paid))
                })

        return Response({
            'total_value': float(total_val),
            'total_paid': float(total_paid),
            'total_balance': float(total_balance),
            'count': count,
            'by_client': client_breakdown,
            'cancelled_summary': {
                'count': cancelled_count,
                'total_value': float(cancelled_val),
                'total_paid': float(cancelled_paid),
            }
        })

    @action(detail=False, methods=['get'], url_path='assignable-admins')
    def assignable_admins(self, request):
        User = get_user_model()
        admins = User.objects.filter(
            Q(role='Admin') | Q(is_superuser=True) | Q(is_staff=True)
        ).filter(is_active=True).order_by('username')
        
        data = []
        for u in admins:
            full = f"{u.first_name} {u.last_name}".strip()
            data.append({
                'id': u.id,
                'username': u.username,
                'name': full or u.username,
                'email': u.email or '',
                'role': getattr(u, 'role', 'Admin')
            })
        return Response(data)

    @action(detail=True, methods=['post'], url_path='assign')
    def assign_to_admin(self, request, pk=None):
        job = self.get_object()
        admin_id = request.data.get('admin_id') or request.data.get('assigned_to')
        if not admin_id:
            return Response({'error': 'admin_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        User = get_user_model()
        admin_user = User.objects.filter(id=admin_id).first()
        if not admin_user:
            return Response({'error': 'Admin user not found'}, status=status.HTTP_404_NOT_FOUND)
        
        creator_name = request.user.get_full_name() or request.user.username
        job.assigned_to = admin_user
        job.assigned_by = request.user
        job.original_creator_name = creator_name
        job.assignment_status = 'pending'
        job.assigned_at = timezone.now()
        job.save(update_fields=['assigned_to', 'assigned_by', 'original_creator_name', 'assignment_status', 'assigned_at'])

        # Notify the assigned Admin
        Notification.objects.create(
            recipient=admin_user,
            actor=request.user,
            notification_type='job_order_assigned',
            title=f"Job Order Assigned: {job.order_id}",
            message=f"{creator_name} assigned Job Order {job.order_id} ({job.title}) to you for review and acceptance.",
            action_type='view_job_order',
            action_data={'job_order_id': job.id, 'order_id': job.order_id}
        )

        return Response(JobOrderSerializer(job, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept_job_order(self, request, pk=None):
        job = self.get_object()
        user = request.user
        
        # Only the assigned admin or superuser can accept
        if job.assigned_to and job.assigned_to != user and not is_admin_user(user):
            return Response({'error': 'Only the assigned Administrator can accept this Job Order'}, status=status.HTTP_403_FORBIDDEN)

        old_staff_user = job.assigned_by or job.created_by
        creator_name = job.original_creator_name or (old_staff_user.username if old_staff_user else 'Staff')
        admin_name = user.get_full_name() or user.username

        # CRITICAL OWNERSHIP & LEDGER TRANSFER
        job.created_by = user
        job.assignment_status = 'accepted'
        job.accepted_at = timezone.now()
        job.save(update_fields=['created_by', 'assignment_status', 'accepted_at'])

        # Re-attribute linked customer payments, expenses, and cashbook entries to this Admin
        CustomerPayment.objects.filter(job_order=job).update(created_by=user)
        Expense.objects.filter(job_order=job).update(created_by=user)
        CashBookEntry.objects.filter(job_order=job).update(created_by=user)

        # Notify the original staff creator that their job was accepted
        if old_staff_user and old_staff_user != user:
            Notification.objects.create(
                recipient=old_staff_user,
                actor=user,
                notification_type='job_order_accepted',
                title=f"Job Order Accepted: {job.order_id}",
                message=f"Admin {admin_name} has accepted Job Order {job.order_id} ({job.title}). It is now managed by {admin_name}.",
                action_type='view_job_order',
                action_data={'job_order_id': job.id, 'order_id': job.order_id}
            )

        return Response(JobOrderSerializer(job, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='cancel-job')
    def cancel_job_order(self, request, pk=None):
        job = self.get_object()
        user = request.user

        # Ensure order_id is present
        if not job.order_id:
            import re
            cur_month = timezone.now().date().strftime('%b').upper()
            existing = JobOrder.objects.filter(order_id__istartswith=f"#{cur_month}")
            nums = []
            for j in existing:
                m = re.search(r'\d+', j.order_id or '')
                if m:
                    nums.append(int(m.group()))
            next_num = max(nums) + 1 if nums else (existing.count() + 1)
            job.order_id = f"#{cur_month}{str(next_num).zfill(2)}"

        job.status = 'Cancelled'
        job.assignment_status = 'cancelled'

        reason = request.data.get('reason') or request.data.get('cancellation_reason')
        if reason:
            prefix = f"\n[Cancelled]: {str(reason).strip()}"
            job.description = ((job.description or '') + prefix).strip()
            job.save(update_fields=['order_id', 'status', 'assignment_status', 'description'])
        else:
            job.save(update_fields=['order_id', 'status', 'assignment_status'])

        # Notify the original creator / staff member
        target_recipient = job.assigned_by or (job.created_by if job.created_by != user else None)
        if target_recipient and target_recipient != user:
            actor_name = user.get_full_name() or user.username
            Notification.objects.create(
                recipient=target_recipient,
                actor=user,
                notification_type='job_order_cancelled',
                title=f"Job Order Cancelled: {job.order_id}",
                message=f"Job Order {job.order_id} ({job.title}) has been marked as Cancelled by {actor_name}." + (f" Reason: {reason}" if reason else ""),
                action_type='view_job_order',
                action_data={'job_order_id': job.id, 'order_id': job.order_id}
            )

        return Response(JobOrderSerializer(job, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='restore-job')
    def restore_job_order(self, request, pk=None):
        job = self.get_object()
        user = request.user
        if not is_admin_user(user):
            return Response({'error': 'Only administrators can restore cancelled job orders.'}, status=status.HTTP_403_FORBIDDEN)

        job.status = 'Pending'
        job.assignment_status = 'accepted' if job.assigned_to == user else ('pending' if job.assigned_to else 'accepted')
        job.save(update_fields=['status', 'assignment_status'])

        target_recipient = job.assigned_by or (job.created_by if job.created_by != user else None)
        if target_recipient and target_recipient != user:
            actor_name = user.get_full_name() or user.username
            Notification.objects.create(
                recipient=target_recipient,
                actor=user,
                notification_type='job_order_restored',
                title=f"Job Order Restored: {job.order_id}",
                message=f"Job Order {job.order_id} ({job.title}) has been restored to active status by {actor_name}.",
                action_type='view_job_order',
                action_data={'job_order_id': job.id, 'order_id': job.order_id}
            )

        return Response(JobOrderSerializer(job, context={'request': request}).data)

class CustomerPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = CustomerPayment.objects.all().select_related('customer', 'job_order', 'invoice', 'created_by').order_by('-payment_date')
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(
                Q(created_by=self.request.user) |
                Q(job_order__created_by=self.request.user) |
                Q(customer__created_by=self.request.user)
            )
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        job_order_id = self.request.query_params.get('job_order')
        if job_order_id:
            queryset = queryset.filter(job_order_id=job_order_id)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(customer__name__icontains=search) |
                Q(job_order__title__icontains=search) |
                Q(job_order__order_id__icontains=search) |
                Q(notes__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        from django.db import transaction
        with transaction.atomic():
            payment = serializer.save(created_by=self.request.user)
            if payment.invoice:
                inv = payment.invoice
                tot_paid = inv.payments.aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
                if tot_paid >= inv.total_amount and inv.total_amount > 0:
                    inv.status = 'Paid'
                elif tot_paid > Decimal('0'):
                    inv.status = 'Partially Paid'
                else:
                    inv.status = 'Issued'
                inv.save(update_fields=['status'])

    def perform_destroy(self, instance):
        from django.db import transaction
        with transaction.atomic():
            inv = instance.invoice
            super().perform_destroy(instance)
            if inv:
                tot_paid = inv.payments.aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
                if tot_paid >= inv.total_amount and inv.total_amount > 0:
                    inv.status = 'Paid'
                elif tot_paid > Decimal('0'):
                    inv.status = 'Partially Paid'
                else:
                    inv.status = 'Issued'
                inv.save(update_fields=['status'])

    def list(self, request, *args, **kwargs):
        if request.query_params.get('nopage') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)


class VendorPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = VendorPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = VendorPayment.objects.all().select_related('vendor', 'job_order', 'created_by').order_by('-payment_date')
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(
                Q(created_by=self.request.user) |
                Q(job_order__created_by=self.request.user) |
                Q(vendor__created_by=self.request.user)
            )
        vendor_id = self.request.query_params.get('vendor')
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
        job_order_id = self.request.query_params.get('job_order')
        if job_order_id:
            queryset = queryset.filter(job_order_id=job_order_id)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(vendor__name__icontains=search) |
                Q(job_order__title__icontains=search) |
                Q(job_order__order_id__icontains=search) |
                Q(notes__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        if request.query_params.get('nopage') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Expense.objects.all().select_related('vendor', 'job_order', 'created_by').order_by('-date', '-created_at', '-id')
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(
                Q(created_by=self.request.user) |
                Q(job_order__created_by=self.request.user)
            )
        # Internal fund transfers between accounts are never business expenses
        queryset = queryset.exclude(
            Q(category__iexact='Transfer') |
            Q(notes__icontains='Internal Transfer') |
            Q(description__icontains='Internal Transfer') |
            Q(notes__icontains='➔') |
            Q(description__icontains='➔')
        )
        job_order = self.request.query_params.get('job_order')
        if job_order:
            queryset = queryset.filter(job_order_id=job_order)
        vendor_id = self.request.query_params.get('vendor')
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
        category = self.request.query_params.get('category')
        if category and category != 'all':
            queryset = queryset.filter(category=category)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(description__icontains=search) |
                Q(vendor__name__icontains=search) |
                Q(job_order__title__icontains=search) |
                Q(job_order__order_id__icontains=search) |
                Q(category__icontains=search) |
                Q(type__icontains=search) |
                Q(notes__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = self.get_queryset()
        total_amount = qs.aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        categories = qs.values('category').annotate(
            total=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()),
            count=Count('id')
        ).order_by('-total')
        return Response({
            'total_amount': float(total_amount),
            'total_count': qs.count(),
            'categories': list(categories)
        })

class PaymentRequestViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PaymentRequest.objects.all().select_related('vendor', 'created_by').order_by('-created_at')
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(created_by=self.request.user)
        vendor_id = self.request.query_params.get('vendor')
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(vendor__name__icontains=search) |
                Q(requested_by__icontains=search) |
                Q(status__icontains=search) |
                Q(admin_note__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        req_by = self.request.user.get_full_name() or self.request.user.username
        serializer.save(created_by=self.request.user, requested_by=req_by)

    def perform_update(self, serializer):
        prev_status = serializer.instance.status
        instance = serializer.save()
        if prev_status != 'Approved' and instance.status == 'Approved':
            # Auto-generate a pending CashBookEntry disbursement voucher for finance
            cb = CashBook.objects.first()
            if cb:
                CashBookEntry.objects.create(
                    cashbook=cb,
                    entry_type='out',
                    amount=instance.amount,
                    date=timezone.now().date(),
                    category='Vendor Payment' if instance.vendor else 'Payment Request',
                    debit_type='VENDOR' if instance.vendor else 'Company Expense',
                    party_name=instance.vendor.name if instance.vendor else instance.requested_by,
                    vendor=instance.vendor,
                    remark=f"Approved Payment Request #{instance.id}: {instance.title}".strip(),
                    approval_status='pending',
                    created_by=self.request.user if self.request.user.is_authenticated else None
                )
        elif prev_status == 'Approved' and instance.status in ['Rejected', 'Pending']:
            CashBookEntry.objects.filter(
                remark__startswith=f"Approved Payment Request #{instance.id}:",
                approval_status='pending'
            ).delete()



class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all().order_by('name')
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        name = str(request.data.get('name', '')).strip()
        if not name:
            return Response({"detail": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        existing = ExpenseCategory.objects.filter(name__iexact=name).first()
        if existing:
            return Response({"detail": "Category already exists."}, status=status.HTTP_400_BAD_REQUEST)
            
        mutable_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        mutable_data['name'] = name
        serializer = self.get_serializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if Expense.objects.filter(category=instance.name).exists():
            return Response({"message": "Cannot delete category as it is currently in use by one or more expenses."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

class ExpenseTypeViewSet(viewsets.ModelViewSet):
    queryset = ExpenseType.objects.all().order_by('name')
    serializer_class = ExpenseTypeSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        name = str(request.data.get('name', '')).strip()
        if not name:
            return Response({"detail": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        existing = ExpenseType.objects.filter(name__iexact=name).first()
        if existing:
            return Response({"detail": "Type already exists."}, status=status.HTTP_400_BAD_REQUEST)
            
        mutable_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        mutable_data['name'] = name
        serializer = self.get_serializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if Expense.objects.filter(type=instance.name).exists():
            return Response({"message": "Cannot delete type as it is currently in use by one or more expenses."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

class LabourViewSet(viewsets.ModelViewSet):
    serializer_class = LabourSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Labour.objects.all().select_related('vendor', 'created_by', 'job_order', 'job_order__customer').order_by('-date', '-created_at')
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(created_by=self.request.user)
        vendor_id = self.request.query_params.get('vendor')
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
        job_order_id = self.request.query_params.get('job_order')
        if job_order_id:
            queryset = queryset.filter(job_order_id=job_order_id)
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)
        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                models.Q(name__icontains=search_query) |
                models.Q(phone__icontains=search_query) |
                models.Q(work_done__icontains=search_query) |
                models.Q(job_order__title__icontains=search_query) |
                models.Q(job_order__order_id__icontains=search_query)
            )
        return queryset

    def perform_create(self, serializer):
        payment_amount = serializer.validated_data.get('payment_amount', Decimal('0.00'))
        paid_amount = serializer.validated_data.get('paid_amount', Decimal('0.00'))
        status_val = serializer.validated_data.get('status', 'pending')
        if paid_amount >= payment_amount and payment_amount > 0:
            status_val = 'paid'
        elif paid_amount > 0:
            status_val = 'partially_paid'
        else:
            status_val = 'pending'
        serializer.save(created_by=self.request.user, status=status_val)

    def perform_update(self, serializer):
        instance = serializer.instance
        payment_amount = serializer.validated_data.get('payment_amount', instance.payment_amount)
        paid_amount = serializer.validated_data.get('paid_amount', instance.paid_amount)
        if paid_amount >= payment_amount and payment_amount > 0:
            status_val = 'paid'
        elif paid_amount > 0:
            status_val = 'partially_paid'
        else:
            status_val = 'pending'
        serializer.save(status=status_val)

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        from django.db import transaction
        with transaction.atomic():
            labour = Labour.objects.select_for_update().filter(pk=pk).first()
            if not labour:
                return Response({'error': 'Labour record not found'}, status=status.HTTP_404_NOT_FOUND)
            try:
                amt = Decimal(str(request.data.get('amount', '0')).strip())
            except Exception:
                return Response({'error': 'Invalid payment amount'}, status=status.HTTP_400_BAD_REQUEST)
            if amt <= 0:
                return Response({'error': 'Payment amount must be greater than zero'}, status=status.HTTP_400_BAD_REQUEST)

            curr_paid = labour.paid_amount or Decimal('0.00')
            tot_payment = labour.payment_amount or Decimal('0.00')
            remaining_due = max(Decimal('0.00'), tot_payment - curr_paid)
            if tot_payment > Decimal('0.00') and amt > remaining_due:
                return Response({
                    'error': f'Payment amount ({amt}) exceeds the remaining balance due ({remaining_due}).'
                }, status=status.HTTP_400_BAD_REQUEST)

            labour.paid_amount = curr_paid + amt
            if labour.paid_amount >= tot_payment and tot_payment > 0:
                labour.status = 'paid'
            elif labour.paid_amount > 0:
                labour.status = 'partially_paid'
            labour.save()

            # Generate CashBookEntry disbursement voucher to keep cashbook and bank balances synchronized
            cb = CashBook.objects.first()
            if cb:
                bank_id = request.data.get('bank_account') or request.data.get('bank_account_id')
                pca_id = request.data.get('petty_cash_account') or request.data.get('petty_cash_account_id')
                bank_obj = BankAccount.objects.select_for_update().filter(pk=bank_id).first() if bank_id else None
                pca_obj = PettyCashAccount.objects.select_for_update().filter(pk=pca_id).first() if pca_id else None

                payment_date = request.data.get('payment_date') or timezone.now().date()
                notes = (request.data.get('notes') or f"Disbursement to {labour.name} for {labour.work_done or 'Labour work'}").strip()

                CashBookEntry.objects.create(
                    cashbook=cb,
                    entry_type='out',
                    amount=amt,
                    date=payment_date,
                    category='Labour',
                    debit_type='LABOUR',
                    party_name=labour.name,
                    labour=labour,
                    job_order=labour.job_order,
                    bank_account=bank_obj,
                    bank_name=bank_obj.bank_name if bank_obj else '',
                    petty_cash_account=pca_obj,
                    petty_cash_account_name=pca_obj.name if pca_obj else '',
                    remark=notes,
                    approval_status='approved',
                    created_by=request.user
                )
                if bank_obj:
                    bank_obj.balance = (bank_obj.balance or Decimal('0.00')) - amt
                    bank_obj.save(update_fields=['balance'])
                elif pca_obj:
                    pca_obj.balance = (pca_obj.balance or Decimal('0.00')) - amt
                    pca_obj.save(update_fields=['balance'])

            return Response(self.get_serializer(labour).data)



    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = self.get_queryset()
        total_amount = qs.aggregate(s=Sum('payment_amount'))['s'] or Decimal('0.00')
        paid_amount = qs.aggregate(s=Sum('paid_amount'))['s'] or Decimal('0.00')
        due_amount = max(Decimal('0.00'), total_amount - paid_amount)
        distinct_names = qs.values('name').distinct().count()
        pending_count = qs.filter(status__in=['pending', 'partially_paid']).count()
        settled_count = qs.filter(status='paid').count()

        return Response({
            'total_labourers': distinct_names,
            'total_entries': qs.count(),
            'total_amount': float(total_amount),
            'paid_amount': float(paid_amount),
            'due_amount': float(due_amount),
            'pending_count': pending_count,
            'settled_count': settled_count
        })

class DashboardAPIView(views.APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if start_date_str and end_date_str:
            try:
                start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                end_date = timezone.now().date()
                start_date = end_date - datetime.timedelta(days=30)
        else:
            end_date = timezone.now().date()
            start_date = end_date - datetime.timedelta(days=30)
        
        is_admin = is_admin_user(request.user)
        
        cust_qs = Customer.objects.all() if is_admin else Customer.objects.filter(created_by=request.user)
        job_qs = JobOrder.objects.all() if is_admin else JobOrder.objects.filter(created_by=request.user)
        cust_pay_qs = CustomerPayment.objects.all() if is_admin else CustomerPayment.objects.filter(Q(created_by=request.user) | Q(job_order__created_by=request.user))
        exp_qs = (Expense.objects.all() if is_admin else Expense.objects.filter(Q(created_by=request.user) | Q(job_order__created_by=request.user))).exclude(
            Q(category__iexact='Transfer') | Q(notes__icontains='Internal Transfer') | Q(description__icontains='Internal Transfer') | Q(notes__icontains='➔') | Q(description__icontains='➔')
        )
        pay_req_qs = PaymentRequest.objects.all() if is_admin else PaymentRequest.objects.filter(created_by=request.user)
        labour_qs = Labour.objects.all() if is_admin else Labour.objects.filter(created_by=request.user)

        total_customers = cust_qs.count()
        total_job_orders = job_qs.filter(status__in=['Pending', 'In Progress']).count()
        
        income_range = {'payment_date__range': (start_date, end_date)}
        expense_range = {'date__range': (start_date, end_date)}
        labour_range = {'date__range': (start_date, end_date)}
        job_range = {'created_at__date__range': (start_date, end_date)}
        
        total_income = cust_pay_qs.filter(**income_range).aggregate(Sum('amount'))['amount__sum'] or 0
        total_exp = exp_qs.filter(**expense_range).aggregate(Sum('amount'))['amount__sum'] or 0
        total_vend = pay_req_qs.filter(status='Approved', created_at__date__range=(start_date, end_date)).aggregate(Sum('amount'))['amount__sum'] or 0
        total_labour = labour_qs.filter(**labour_range).aggregate(Sum('payment_amount'))['payment_amount__sum'] or 0
        
        total_outgoing = float(total_exp) + float(total_vend) + float(total_labour)
        
        # Jobs by status in range
        jobs_in_range = job_qs.filter(**job_range)
        jobs_by_status = {
            'Pending': jobs_in_range.filter(status='Pending').count(),
            'In Progress': jobs_in_range.filter(status='In Progress').count(),
            'Completed': jobs_in_range.filter(status='Completed').count(),
            'Cancelled': jobs_in_range.filter(status='Cancelled').count(),
        }
        
        # Recent jobs
        recent_jobs = job_qs.select_related('customer').order_by('-created_at')[:5]
        recent_jobs_data = []
        for job in recent_jobs:
            recent_jobs_data.append({
                'id': job.id,
                'title': job.title,
                'customer_name': job.customer.name if job.customer else 'Unknown',
                'total_amount': float(job.total_amount)
            })

        # Trends
        daily_income = cust_pay_qs.filter(**income_range).values('payment_date').annotate(total=Sum('amount'))
        daily_expenses = exp_qs.filter(**expense_range).values('date').annotate(total=Sum('amount'))
        daily_labour = labour_qs.filter(**labour_range).values('date').annotate(total=Sum('payment_amount'))
        
        daily_trends = []
        curr = start_date
        while curr <= end_date:
            inc = next((i['total'] for i in daily_income if i['payment_date'] == curr), 0)
            exp = next((e['total'] for e in daily_expenses if e['date'] == curr), 0)
            lab = next((l['total'] for l in daily_labour if l['date'] == curr), 0)
            
            daily_trends.append({
                'date': str(curr), 
                'income': float(inc),
                'expenses': float(exp) + float(lab)
            })
            curr += datetime.timedelta(days=1)

        total_cust_cn = CreditNote.objects.exclude(status__in=['Draft', 'Cancelled']).aggregate(tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField()))['tot']
        total_cust_billed = (job_qs.aggregate(tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField()))['tot'] +
                             Invoice.objects.filter(job_order__isnull=True).aggregate(tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField()))['tot'] -
                             total_cust_cn)
        total_cust_paid = cust_pay_qs.aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        total_receivables = float(max(Decimal('0'), total_cust_billed - total_cust_paid))

        total_vend_billed = exp_qs.aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        total_vend_paid = (VendorPayment.objects.all().aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot'] +
                           pay_req_qs.filter(status='Approved').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot'])
        from django.db.models import F
        labour_payables = Labour.objects.filter(status__in=['pending', 'partially_paid']).aggregate(
            tot=Coalesce(Sum(F('payment_amount') - F('paid_amount')), Decimal('0'), output_field=DecimalField())
        )['tot']
        total_payables = float(max(Decimal('0'), (total_vend_billed - total_vend_paid) + max(Decimal('0'), labour_payables)))

        cb_cash_opening = CashBook.objects.aggregate(tot=Coalesce(Sum('opening_balance'), Decimal('0'), output_field=DecimalField()))['tot']
        cb_cash_in = CashBookEntry.objects.filter(entry_type='in', cashbook__isnull=False, bank_account__isnull=True, petty_cash_account__isnull=True).exclude(approval_status='rejected').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        cb_cash_out = CashBookEntry.objects.filter(entry_type='out', cashbook__isnull=False, bank_account__isnull=True, petty_cash_account__isnull=True).exclude(approval_status='rejected').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        cb_physical_cash = max(Decimal('0'), cb_cash_opening + cb_cash_in - cb_cash_out)
        bank_balance = BankAccount.objects.aggregate(tot=Coalesce(Sum('balance'), Decimal('0'), output_field=DecimalField()))['tot']
        petty_balance = PettyCashAccount.objects.aggregate(tot=Coalesce(Sum('balance'), Decimal('0'), output_field=DecimalField()))['tot']
        total_cash_balance = float(cb_physical_cash + bank_balance + petty_balance)


        return Response({
            'total_customers': total_customers,
            'total_job_orders': total_job_orders,
            'total_income': float(total_income),
            'total_outgoing': total_outgoing,
            'total_receivables': total_receivables,
            'total_payables': total_payables,
            'cash_balance': total_cash_balance,
            'jobs_by_status': jobs_by_status,
            'recent_jobs': recent_jobs_data,
            'daily_trends': daily_trends
        })

class ReportAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    def perform_content_negotiation(self, request, force=False):
        # Prevent DRF 404 when format=pdf is passed as a query parameter
        if request.query_params.get('format') == 'pdf' or request.query_params.get('export_format') == 'pdf':
            renderers = self.get_renderers()
            return renderers[0], renderers[0].media_type
        return super().perform_content_negotiation(request, force=force)
    
    def get(self, request):
        try:
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
            
            if start_date_str and end_date_str:
                start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
            else:
                end_date = timezone.now().date()
                start_date = end_date - datetime.timedelta(days=365)

            is_admin = is_admin_user(request.user)

            # Scoped base querysets
            job_base = JobOrder.objects.all() if is_admin else JobOrder.objects.filter(created_by=request.user)
            cust_base = Customer.objects.all() if is_admin else Customer.objects.filter(created_by=request.user)
            vend_base = Vendor.objects.all() if is_admin else Vendor.objects.filter(created_by=request.user)
            cust_pay_base = CustomerPayment.objects.all() if is_admin else CustomerPayment.objects.filter(Q(created_by=request.user) | Q(job_order__created_by=request.user))
            exp_base = (Expense.objects.all() if is_admin else Expense.objects.filter(Q(created_by=request.user) | Q(job_order__created_by=request.user))).exclude(
                Q(category__iexact='Transfer') | Q(notes__icontains='Internal Transfer') | Q(description__icontains='Internal Transfer') | Q(notes__icontains='➔') | Q(description__icontains='➔')
            )
            vend_pay_base = VendorPayment.objects.all() if is_admin else VendorPayment.objects.filter(Q(created_by=request.user) | Q(job_order__created_by=request.user))
            pay_req_base = PaymentRequest.objects.all() if is_admin else PaymentRequest.objects.filter(created_by=request.user)
            labour_base = Labour.objects.all() if is_admin else Labour.objects.filter(created_by=request.user)

            # 1. Financial Trends
            monthly_income = cust_pay_base.filter(payment_date__range=(start_date, end_date))\
                .annotate(month=TruncMonth('payment_date')).values('month').annotate(total=Sum('amount')).order_by('month')
            
            monthly_expenses = exp_base.filter(date__range=(start_date, end_date))\
                .annotate(month=TruncMonth('date')).values('month').annotate(total=Sum('amount')).order_by('month')

            # 2. Customer Aggregate (including standalone invoices & credit notes)
            cust_job_rev = JobOrder.objects.filter(customer=OuterRef('pk')).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
            cust_inv_rev = Invoice.objects.filter(customer=OuterRef('pk'), job_order__isnull=True).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
            cust_cn_rev = CreditNote.objects.filter(customer=OuterRef('pk')).exclude(status__in=['Draft', 'Cancelled']).values('customer').annotate(total=Sum('total_amount')).values('total')[:1]
            cust_paid = CustomerPayment.objects.filter(customer=OuterRef('pk')).values('customer').annotate(
                total=Sum(
                    Case(
                        When(payment_type='refund', then=-F('amount')),
                        default=F('amount'),
                        output_field=DecimalField(max_digits=12, decimal_places=2)
                    )
                )
            ).values('total')[:1]

            customers = cust_base.annotate(
                total_jobs=Count('job_orders', distinct=True),
                job_rev_sum=Coalesce(Subquery(cust_job_rev, output_field=DecimalField(max_digits=12, decimal_places=2)), Decimal('0')),
                inv_rev_sum=Coalesce(Subquery(cust_inv_rev, output_field=DecimalField(max_digits=12, decimal_places=2)), Decimal('0')),
                cn_rev_sum=Coalesce(Subquery(cust_cn_rev, output_field=DecimalField(max_digits=12, decimal_places=2)), Decimal('0')),
                paid_sum=Coalesce(Subquery(cust_paid, output_field=DecimalField(max_digits=12, decimal_places=2)), Decimal('0'))
            ).annotate(
                rev_sum=F('job_rev_sum') + F('inv_rev_sum') - F('cn_rev_sum'),
                total_revenue=F('job_rev_sum') + F('inv_rev_sum') - F('cn_rev_sum'),
                balance=F('job_rev_sum') + F('inv_rev_sum') - F('cn_rev_sum') - F('paid_sum')
            ).values('id', 'name', 'email', 'phone', 'total_jobs', 'rev_sum', 'total_revenue', 'paid_sum', 'balance')

            # 3. Vendor Aggregate (including VendorPayment and PaymentRequest)
            vend_purch = Expense.objects.filter(vendor=OuterRef('pk')).values('vendor').annotate(total=Sum('amount')).values('total')[:1]
            vend_vp = VendorPayment.objects.filter(vendor=OuterRef('pk')).values('vendor').annotate(total=Sum('amount')).values('total')[:1]
            vend_pr = PaymentRequest.objects.filter(vendor=OuterRef('pk'), status='Approved').values('vendor').annotate(total=Sum('amount')).values('total')[:1]

            vendors = vend_base.annotate(
                total_purchases=Count('expenses', distinct=True),
                purch_sum=Coalesce(Subquery(vend_purch, output_field=DecimalField(max_digits=12, decimal_places=2)), Decimal('0')),
                vp_paid_sum=Coalesce(Subquery(vend_vp, output_field=DecimalField(max_digits=12, decimal_places=2)), Decimal('0')),
                pr_paid_sum=Coalesce(Subquery(vend_pr, output_field=DecimalField(max_digits=12, decimal_places=2)), Decimal('0')),
            ).annotate(
                paid_sum=F('vp_paid_sum') + F('pr_paid_sum'),
                total_paid=F('vp_paid_sum') + F('pr_paid_sum'),
                balance=F('purch_sum') - (F('vp_paid_sum') + F('pr_paid_sum'))
            ).values('id', 'name', 'business_group', 'email', 'phone', 'total_purchases', 'purch_sum', 'total_paid', 'balance')

            # 4. Job Orders Aggregate
            job_paid_sq = CustomerPayment.objects.filter(job_order=OuterRef('pk')).values('job_order').annotate(total=Sum('amount')).values('total')[:1]
            
            jobs = job_base.select_related('customer').annotate(
                paid=Coalesce(Subquery(job_paid_sq, output_field=DecimalField()), Decimal('0')),
                balance=F('total_amount') - Coalesce(Subquery(job_paid_sq, output_field=DecimalField()), Decimal('0'))
            ).values('id', 'order_id', 'title', 'customer__name', 'status', 'total_amount', 'paid', 'balance')

            # 5. Job P&L (if job_id provided)
            job_id = request.query_params.get('job_id')
            job_pl = None
            if job_id:
                try:
                    job_obj = job_base.get(id=job_id)
                    rev = cust_pay_base.filter(job_order=job_obj).aggregate(Sum('amount'))['amount__sum'] or 0
                    exp = exp_base.filter(job_order=job_obj).aggregate(Sum('amount'))['amount__sum'] or 0
                    job_pl = {
                        'job_id': job_obj.id,
                        'title': job_obj.title,
                        'client_name': job_obj.customer.name if job_obj.customer else 'Unknown',
                        'status': job_obj.status,
                        'contract_total': float(job_obj.total_amount),
                        'revenue': float(rev),
                        'expenses': float(exp),
                        'profit': float(rev) - float(exp)
                    }
                except (JobOrder.DoesNotExist, ValueError): pass

            # 6. Expense Report Data
            expenses_qs = exp_base.order_by('-date')
            if start_date_str and end_date_str:
                expenses_qs = expenses_qs.filter(date__range=(start_date, end_date))
                
            opening_balance_qs = exp_base.filter(is_opening_balance=True, date__lte=end_date)
            opening_balance = opening_balance_qs.aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            
            all_income = cust_pay_base.filter(payment_date__lte=end_date).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            # Deduplicate vendor payments from expense bills: direct operational expenses + max(vendor incurred expenses, vendor cash payments) + labour
            direct_exp = exp_base.filter(is_opening_balance=False, vendor__isnull=True, date__lte=end_date).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            vendor_exp = exp_base.filter(is_opening_balance=False, vendor__isnull=False, date__lte=end_date).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            all_vendor_req = pay_req_base.filter(status='Approved', created_at__date__lte=end_date).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            all_vendor_pay = vend_pay_base.filter(payment_date__lte=end_date).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            vendor_outflow = max(vendor_exp, all_vendor_req + all_vendor_pay)
            all_labour = labour_base.filter(date__lte=end_date).aggregate(Sum('payment_amount'))['payment_amount__sum'] or Decimal('0')
            
            bank_balance = float(opening_balance + all_income - direct_exp - vendor_outflow - all_labour)
            
            expense_list = list(expenses_qs.filter(is_opening_balance=False).values(
                'id', 'date', 'description', 'amount', 'category', 'type', 'notes'
            ))
            
            expense_report = {
                'opening_balance': float(opening_balance),
                'bank_balance': bank_balance,
                'closing_balance': bank_balance,
                'expenses': expense_list
            }

            # Safe date formatting helper
            def fmt_month(dt):
                if not dt: return ''
                if hasattr(dt, 'strftime'): return dt.strftime('%Y-%m')
                return str(dt)[:7] # Fallback for strings

            formatted_income = [{'month': fmt_month(i['month']), 'total': float(i['total'] or 0)} for i in monthly_income]
            formatted_expenses = [{'month': fmt_month(e['month']), 'total': float(e['total'] or 0)} for e in monthly_expenses]
            if not formatted_income and not formatted_expenses:
                current_m = datetime.datetime.now().strftime('%Y-%m')
                formatted_income = [{'month': current_m, 'total': 0.0}]
                formatted_expenses = [{'month': current_m, 'total': 0.0}]

            report_payload = {
                'monthly_income': formatted_income,
                'monthly_expenses': formatted_expenses,
                'customers': list(customers),
                'vendors': list(vendors),
                'jobs': [{**j, 'order_id': j['order_id'] or f"#JOB{j['id']}"} for j in jobs],
                'job_pl': job_pl,
                'expense_report': expense_report
            }


            if request.query_params.get('export_format') == 'pdf' or request.query_params.get('format') == 'pdf' or request.query_params.get('pdf') == 'true':
                from django.http import HttpResponse
                from .pdf_generator import universal_pdf_generator, format_dynamic_filename
                tab = request.query_params.get('tab', 'overview')
                filters = {
                    'start_date': str(start_date) if start_date else None,
                    'end_date': str(end_date) if end_date else None,
                    'job_id': job_id
                }
                pdf_bytes = universal_pdf_generator.generate_financial_report_pdf(tab, report_payload, filters)
                s_str = str(start_date) if start_date else None
                e_str = str(end_date) if end_date else datetime.datetime.now().strftime('%Y%m%d')
                filename = format_dynamic_filename('financial_report', tab, s_str, 'to' if s_str else None, e_str)
                response = HttpResponse(pdf_bytes, content_type='application/pdf')
                response['Content-Disposition'] = f'inline; filename="{filename}"'
                return response

            return Response(report_payload)

        except Exception as e:
            logger.exception("Report generation failed")
            return Response({'detail': str(e)}, status=500)

_cached_site_settings = None

def get_cached_site_settings():
    global _cached_site_settings
    if _cached_site_settings is None:
        _cached_site_settings, _ = SiteSettings.objects.get_or_create(id=1)
    return _cached_site_settings

def invalidate_site_settings_cache():
    global _cached_site_settings
    _cached_site_settings = None

class SettingsAPIView(views.APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        s = get_cached_site_settings()
        return Response(SiteSettingsSerializer(s).data)
    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'role', '') == 'Admin'):
            return Response({'detail': 'You do not have permission to modify site settings.'}, status=403)
        s, _ = SiteSettings.objects.get_or_create(id=1)
        ser = SiteSettingsSerializer(s, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            invalidate_site_settings_cache()
            return Response(ser.data)
        return Response(ser.errors, status=400)


    def put(self, request):
        return self.post(request)

    def patch(self, request):
        return self.post(request)


class ChangePasswordView(views.APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        u = request.user
        curr_pw = request.data.get('current_password')
        new_pw = (request.data.get('new_password') or '').strip()

        if not u.check_password(curr_pw):
            return Response({'detail': 'Incorrect current password.'}, status=400)

        if not new_pw or len(new_pw) < 6:
            return Response({'detail': 'New password must be at least 6 characters long.'}, status=400)

        try:
            validate_password(new_pw, user=u)
        except ValidationError as ve:
            return Response({'detail': ' | '.join(ve.messages)}, status=400)

        u.set_password(new_pw)
        u.save()

        # Revoke old outstanding refresh tokens for this user
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            for token in OutstandingToken.objects.filter(user=u):
                BlacklistedToken.objects.get_or_create(token=token)
        except Exception:
            pass

        return Response({'status': 'Password updated successfully.'})


class PlanningToolViewSet(viewsets.ModelViewSet):
    serializer_class = PlanningToolSerializer
    permission_classes = [IsAuthenticated]
    queryset = PlanningTool.objects.all().order_by('name')
    pagination_class = None

    def get_queryset(self):
        qs = PlanningTool.objects.all().order_by('name')
        q = self.request.query_params.get('search')
        if q:
            qs = qs.filter(name__icontains=q)
        return qs

class PlanningWorkerViewSet(viewsets.ModelViewSet):
    serializer_class = PlanningWorkerSerializer
    permission_classes = [IsAuthenticated]
    queryset = PlanningWorker.objects.all().order_by('name')
    pagination_class = None

    def get_queryset(self):
        qs = PlanningWorker.objects.all().order_by('name')
        q = self.request.query_params.get('search')
        if q:
            qs = qs.filter(name__icontains=q)
        return qs

class ProjectPlanViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ProjectPlan.objects.select_related('job_order', 'job_order__customer', 'created_by').all()
        if not is_admin_user(self.request.user):
            qs = qs.filter(
                Q(created_by=self.request.user) |
                Q(job_order__created_by=self.request.user)
            )
        job_id = self.request.query_params.get('job_order')

        if job_id:
            qs = qs.filter(job_order_id=job_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        q = self.request.query_params.get('search')
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | 
                Q(description__icontains=q) | 
                Q(job_order__title__icontains=q) | 
                Q(job_order__order_id__icontains=q) |
                Q(job_order__customer__name__icontains=q)
            )
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class SalaryPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = SalaryPaymentSerializer
    permission_classes = [HasSalaryAccess]
    pagination_class = None

    def get_queryset(self):
        qs = SalaryPayment.objects.select_related('created_by').all()
        month = self.request.query_params.get('paid_month')
        if month:
            qs = qs.filter(paid_month=month)
        q = self.request.query_params.get('search')
        if q:
            qs = qs.filter(
                Q(staff_name__icontains=q) |
                Q(paid_month__icontains=q) |
                Q(description__icontains=q)
            )
        return qs.order_by('-payment_date', '-created_at')

    def perform_create(self, serializer):
        data = serializer.validated_data
        if not data.get('payment_date'):
            serializer.validated_data['payment_date'] = timezone.now().date()
        base = data.get('base_salary') or Decimal('0.00')
        ot_amt = data.get('overtime_amount') or Decimal('0.00')
        tot = data.get('total_salary')
        if tot is None:
            if base > 0 or ot_amt > 0:
                tot = base + ot_amt
            elif data.get('amount') is not None:
                tot = data.get('amount')
            else:
                tot = Decimal('0.00')
        else:
            tot = max(Decimal('0.00'), tot)
        serializer.save(created_by=self.request.user, total_salary=tot)

    def perform_update(self, serializer):
        data = serializer.validated_data
        base = data.get('base_salary') or serializer.instance.base_salary or Decimal('0.00')
        ot_amt = data.get('overtime_amount') or serializer.instance.overtime_amount or Decimal('0.00')
        tot = data.get('total_salary')
        if tot is None:
            if base > 0 or ot_amt > 0:
                tot = base + ot_amt
            elif data.get('amount') is not None:
                tot = data.get('amount')
            elif serializer.instance.total_salary is not None:
                tot = serializer.instance.total_salary
            else:
                tot = serializer.instance.amount or Decimal('0.00')
        else:
            tot = max(Decimal('0.00'), tot)
        serializer.save(total_salary=tot)


    @action(detail=False, methods=['get'], url_path='ledger')
    def ledger(self, request):
        """
        Calculates per-employee running ledger carrying forward pending balances month-to-month.
        """
        records = SalaryPayment.objects.all().order_by('payment_date', 'created_at', 'id')
        staff_filter = request.query_params.get('staff_name')
        if staff_filter:
            records = records.filter(staff_name__icontains=staff_filter)

        grouped = {}
        for r in records:
            name = r.staff_name.strip()
            if name not in grouped:
                grouped[name] = []
            grouped[name].append(r)

        result = []
        for name, emp_records in grouped.items():
            running_balance = Decimal('0.00')
            total_salary_acc = Decimal('0.00')
            total_paid_acc = Decimal('0.00')
            total_base_acc = Decimal('0.00')
            total_ot_hours_acc = Decimal('0.00')
            total_ot_amt_acc = Decimal('0.00')
            entries = []

            for r in emp_records:
                base = r.base_salary or Decimal('0.00')
                ot_hrs = r.overtime_hours or Decimal('0.00')
                ot_amt = r.overtime_amount or Decimal('0.00')
                tot = r.total_salary if (r.total_salary and r.total_salary > 0) else (base + ot_amt)
                paid = r.amount or Decimal('0.00')

                starting_bal = running_balance
                period_pending = tot - paid
                running_balance += period_pending

                total_base_acc += base
                total_ot_hours_acc += ot_hrs
                total_ot_amt_acc += ot_amt
                total_salary_acc += tot
                total_paid_acc += paid

                entries.append({
                    'id': r.id,
                    'paid_month': r.paid_month,
                    'payment_date': str(r.payment_date),
                    'description': r.description,
                    'base_salary': float(base),
                    'overtime_hours': float(ot_hrs),
                    'overtime_amount': float(ot_amt),
                    'total_salary': float(tot),
                    'amount_paid': float(paid),
                    'period_pending': float(period_pending),
                    'starting_balance': float(starting_bal),
                    'running_balance': float(running_balance),
                    'created_by_name': r.created_by.username if r.created_by else 'System'
                })

            result.append({
                'staff_name': name,
                'total_base_salary': float(total_base_acc),
                'total_overtime_hours': float(total_ot_hours_acc),
                'total_overtime_amount': float(total_ot_amt_acc),
                'total_salary_owed': float(total_salary_acc),
                'total_amount_paid': float(total_paid_acc),
                'current_pending_balance': float(running_balance),
                'entries_count': len(entries),
                'last_payment_date': str(emp_records[-1].payment_date) if emp_records else None,
                'entries': entries
            })

        # Sort by pending balance descending (employees with pending balance first)
        result.sort(key=lambda x: (x['current_pending_balance'] <= 0, -x['current_pending_balance'], x['staff_name'].lower()))
        return Response(result)

    @action(detail=True, methods=['get'], url_path='voucher-pdf')
    def voucher_pdf(self, request, pk=None):
        from django.http import HttpResponse
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        salary = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_salary_voucher_pdf(salary)
        filename = format_dynamic_filename('salary_slip', salary.staff_name, salary.paid_month or salary.payment_date)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='ledger-pdf')
    def ledger_pdf(self, request):
        from django.http import HttpResponse
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        staff_filter = request.query_params.get('staff_name')
        if not staff_filter:
            return Response({'detail': 'staff_name query parameter is required.'}, status=400)

        ledger_resp = self.ledger(request)
        ledgers = ledger_resp.data
        employee_ledger = next((l for l in ledgers if l['staff_name'].strip().lower() == staff_filter.strip().lower()), None)
        if not employee_ledger:
            employee_ledger = next((l for l in ledgers if staff_filter.strip().lower() in l['staff_name'].strip().lower()), None)
        if not employee_ledger:
            return Response({'detail': f'No ledger found for staff "{staff_filter}"'}, status=404)

        pdf_bytes = universal_pdf_generator.generate_employee_ledger_pdf(employee_ledger)
        filename = format_dynamic_filename('employee_ledger', staff_filter, datetime.datetime.now().strftime('%Y%m%d'))
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

class CashBookViewSet(viewsets.ModelViewSet):
    serializer_class = CashBookSerializer
    permission_classes = [IsAuthenticated, HasCashbookAccess]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return CashBook.objects.none()

        # Strict user isolation for EVERY user regardless of admin privilege
        qs = CashBook.objects.filter(created_by=user)

        qp = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        show_archived = qp.get('archived') == 'true'
        if not show_archived:
            qs = qs.filter(is_archived=False)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        books = self.get_queryset()
        total_opening = books.aggregate(
            tot=Coalesce(Sum('opening_balance'), Decimal('0.00'), output_field=DecimalField())
        )['tot']

        aggregates = CashBookEntry.objects.filter(
            cashbook__in=books
        ).exclude(
            approval_status='rejected'
        ).aggregate(
            total_in=Coalesce(Sum('amount', filter=Q(entry_type='in')), Decimal('0.00'), output_field=DecimalField()),
            total_out=Coalesce(Sum('amount', filter=Q(entry_type='out')), Decimal('0.00'), output_field=DecimalField()),
        )
        total_in = aggregates['total_in']
        total_out = aggregates['total_out']
        net_balance = total_opening + total_in - total_out

        return Response({
            'total_in': float(total_in),
            'total_out': float(total_out),
            'total_opening': float(total_opening),
            'net_balance': float(net_balance),
            'books_count': books.count()
        })


def compute_bank_delta(entry_or_type, transaction_type=None, remark=None, amount=None, debit_type=None, customer=None, vendor=None, party_name=None):
    """
    Computes the net delta for a BankAccount balance from a CashBookEntry.
    - Cash In (entry_type == 'in'): Money entering the bank account -> returns +amount
    - Cash Out (entry_type == 'out'): Money leaving the bank account -> returns -amount
    """
    if hasattr(entry_or_type, 'entry_type'):
        e_type = entry_or_type.entry_type
        amt = Decimal(str(entry_or_type.amount or '0.00'))
    else:
        e_type = entry_or_type
        amt = Decimal(str(amount or '0.00'))

    if e_type == 'in':
        return amt
    return -amt



class CashBookEntryViewSet(viewsets.ModelViewSet):
    serializer_class = CashBookEntrySerializer
    permission_classes = [IsAuthenticated, HasCashbookAccess]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return CashBookEntry.objects.none()

        qp = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))

        # Strict user isolation for EVERY user regardless of admin privilege
        qs = CashBookEntry.objects.filter(
            Q(created_by=user) | Q(cashbook__created_by=user)
        ).select_related('cashbook', 'created_by')

        book_id = qp.get('cashbook')
        if book_id:
            qs = qs.filter(cashbook_id=book_id)

        entry_type = qp.get('entry_type')
        if entry_type in ['in', 'out']:
            qs = qs.filter(entry_type=entry_type)

        category = qp.get('category')
        if category and category != 'all':
            qs = qs.filter(category__iexact=category)

        payment_mode = qp.get('payment_mode')
        if payment_mode and payment_mode != 'all':
            if payment_mode.lower() == 'petty cash':
                qs = qs.filter(Q(payment_mode__iexact='Petty Cash') | Q(payment_mode__iexact='Cash') | Q(payment_mode__iexact='Self Account'))
            else:
                qs = qs.filter(payment_mode__iexact=payment_mode)

        tx_type = qp.get('transaction_type')
        if tx_type and tx_type != 'all':
            qs = qs.filter(transaction_type__iexact=tx_type)

        bank_acc = qp.get('bank_account')
        if bank_acc and bank_acc != 'all':
            qs = qs.filter(bank_account_id=bank_acc)

        petty_acc = qp.get('petty_cash_account')
        if petty_acc and petty_acc != 'all':
            qs = qs.filter(petty_cash_account_id=petty_acc)

        start_date = qp.get('start_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)

        end_date = qp.get('end_date')
        if end_date:
            qs = qs.filter(date__lte=end_date)

        entity = qp.get('entity')
        if entity and entity != 'all':
            e_lower = entity.lower()
            if e_lower in ['customer', 'customers']:
                qs = qs.filter(
                    Q(customer__isnull=False) |
                    Q(customer_payment__isnull=False) |
                    Q(debit_type__iexact='CUSTOMER') |
                    Q(category__icontains='Customer') |
                    Q(category__iexact='Sales')
                )
            elif e_lower in ['vendor', 'vendors']:
                qs = qs.filter(
                    Q(vendor__isnull=False) |
                    Q(vendor_payment__isnull=False) |
                    Q(debit_type__iexact='VENDOR')
                )
            elif e_lower in ['labour', 'labor']:
                qs = qs.filter(
                    Q(labour__isnull=False) |
                    Q(salary_payment__isnull=False) |
                    Q(staff_user__isnull=False) |
                    Q(debit_type__iexact='LABOUR') |
                    Q(debit_type__iexact='SALARY') |
                    Q(category__icontains='Salary') |
                    Q(category__icontains='Labour') |
                    Q(category__icontains='Wage')
                )
            elif e_lower in ['job_order', 'job_orders', 'jobs']:
                qs = qs.filter(
                    Q(job_order__isnull=False) |
                    Q(pending_job_order__isnull=False)
                )
            elif e_lower in ['expense', 'expenses']:
                qs = qs.filter(
                    Q(expense__isnull=False) |
                    Q(debit_type__iexact='Company Expense') |
                    Q(category__in=['Food', 'Petrol', 'Office Supplies', 'Rent', 'Maintenance', 'Utility', 'General', 'Expense'])
                )

        customer_param = qp.get('customer')
        if customer_param and customer_param != 'all':
            qs = qs.filter(customer_id=customer_param)

        vendor_param = qp.get('vendor')
        if vendor_param and vendor_param != 'all':
            qs = qs.filter(vendor_id=vendor_param)

        labour_param = qp.get('labour')
        if labour_param and labour_param != 'all':
            qs = qs.filter(labour_id=labour_param)

        job_param = qp.get('job_order')
        if job_param and job_param != 'all':
            qs = qs.filter(job_order_id=job_param)

        expense_param = qp.get('expense')
        if expense_param and expense_param != 'all':
            qs = qs.filter(expense_id=expense_param)

        ledger_only = qp.get('ledger_only')
        if ledger_only in ['true', '1', True]:
            qs = qs.filter(cashbook__isnull=True)

        search = qp.get('search')
        if search:
            qs = qs.filter(
                Q(remark__icontains=search) |
                Q(party_name__icontains=search) |
                Q(category__icontains=search) |
                Q(transaction_type__icontains=search) |
                Q(bank_account_name__icontains=search) |
                Q(petty_cash_account_name__icontains=search) |
                Q(reference_number__icontains=search)
            )

        return qs.order_by('date', 'time', 'created_at', 'id')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        book_ids = set(queryset.values_list('cashbook_id', flat=True))
        running_map = {}
        for b_id in book_ids:
            if b_id:
                try:
                    book = CashBook.objects.get(id=b_id)
                    bal = Decimal(str(book.opening_balance or '0.00'))
                    all_cb_entries = CashBookEntry.objects.filter(cashbook_id=b_id).exclude(approval_status='rejected').order_by('date', 'time', 'created_at', 'id')
                    for e in all_cb_entries:
                        amt = Decimal(str(e.amount or '0.00'))
                        if e.entry_type == 'in':
                            bal += amt
                        else:
                            bal -= amt
                        running_map[e.id] = bal
                except CashBook.DoesNotExist:
                    pass

        bank_ids = set(queryset.values_list('bank_account_id', flat=True))
        for bk_id in bank_ids:
            if bk_id:
                try:
                    bank = BankAccount.objects.get(id=bk_id)
                    all_bk_entries = CashBookEntry.objects.filter(bank_account_id=bk_id).exclude(approval_status='rejected').order_by('date', 'time', 'created_at', 'id').only('id', 'amount', 'entry_type', 'approval_status')
                    hist_in = all_bk_entries.filter(entry_type='in', approval_status='approved').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
                    hist_out = all_bk_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
                    bal = (bank.balance or Decimal('0.00')) - (hist_in - hist_out)
                    for e in all_bk_entries:
                        amt = Decimal(str(e.amount or '0.00'))
                        if e.entry_type == 'in':
                            if e.approval_status == 'approved':
                                bal += amt
                        else:
                            bal -= amt
                        if e.id not in running_map:
                            running_map[e.id] = bal

                except BankAccount.DoesNotExist:
                    pass

        petty_ids = set(queryset.values_list('petty_cash_account_id', flat=True))
        for p_id in petty_ids:
            if p_id:
                try:
                    pca = PettyCashAccount.objects.get(id=p_id)
                    all_pca_entries = CashBookEntry.objects.filter(petty_cash_account_id=p_id).exclude(approval_status='rejected').order_by('date', 'time', 'created_at', 'id')
                    hist_in = all_pca_entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
                    hist_out = all_pca_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
                    bal = (pca.balance or Decimal('0.00')) - (hist_in - hist_out)
                    for e in all_pca_entries:
                        amt = Decimal(str(e.amount or '0.00'))
                        if e.entry_type == 'in':
                            bal += amt
                        else:
                            bal -= amt
                        if e.id not in running_map or self.request.query_params.get('petty_cash_account'):
                            running_map[e.id] = bal
                except PettyCashAccount.DoesNotExist:
                    pass

        page = self.paginate_queryset(queryset)
        if page is not None:
            for item in page:
                if item.id in running_map:
                    item.running_balance_val = running_map[item.id]
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        for item in queryset:
            if item.id in running_map:
                item.running_balance_val = running_map[item.id]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def _sync_entry_side_effects(self, entry):
        cb_name = f"Cashbook #{entry.cashbook.name}" if entry.cashbook else "Cash Ledger"
        from .recycle_bin import set_bypass_recycle_bin

        def _cleanup(instance_to_del):
            if instance_to_del:
                try:
                    set_bypass_recycle_bin(True)
                    instance_to_del.delete()
                except Exception:
                    pass
                finally:
                    set_bypass_recycle_bin(False)

        # Automated side-effects for Cash Out (Debit)
        if entry.entry_type == 'out':
            # Clean up Cash In customer payment if it exists
            if entry.customer_payment and (entry.debit_type != 'CUSTOMER' or entry.customer_payment.payment_type != 'refund'):
                _cleanup(entry.customer_payment)
                entry.customer_payment = None
                entry.save(update_fields=['customer_payment'])

            # Check if this is an internal transfer between accounts (Bank/PCA)
            cat_lower = (entry.category or '').strip().lower()
            party_lower = (entry.party_name or '').strip().lower()
            remark_lower = (entry.remark or '').strip().lower()
            tx_type = (entry.transaction_type or '').strip()
            d_type_raw = (entry.debit_type or '').strip().upper()

            is_transfer = (
                cat_lower == 'transfer' or
                d_type_raw == 'TRANSFER' or
                'internal transfer' in party_lower or
                'internal transfer' in remark_lower or
                '➔' in (entry.party_name or '') or
                '->' in (entry.party_name or '') or
                tx_type in ['Bank Transfer', 'Bank Deposit', 'Bank Withdrawal'] or
                (entry.petty_cash_account_id and entry.bank_account_id)
            )

            if is_transfer:
                entry.debit_type = 'Transfer'
                # Fund transfers are not expenses or customer payments
                _cleanup(entry.expense); entry.expense = None
                _cleanup(entry.vendor_payment); entry.vendor_payment = None
                _cleanup(entry.salary_payment); entry.salary_payment = None
                _cleanup(entry.customer_payment); entry.customer_payment = None
                entry.save(update_fields=['debit_type', 'expense', 'vendor_payment', 'salary_payment', 'customer_payment'])
                return

            d_type = (entry.debit_type or '').strip().upper()
            if not d_type:
                # Fallback auto-detection if debit_type not explicitly sent
                if entry.vendor or Vendor.objects.filter(name__iexact=(entry.party_name or '').strip()).exists():
                    d_type = 'VENDOR'
                elif entry.customer or Customer.objects.filter(name__iexact=(entry.party_name or '').strip()).exists():
                    d_type = 'CUSTOMER'
                elif entry.staff_name or entry.staff_user:
                    d_type = 'SALARY'
                else:
                    d_type = 'COMPANY EXPENSE'
                entry.debit_type = 'Company Expense' if d_type == 'COMPANY EXPENSE' else d_type
                entry.save(update_fields=['debit_type'])

            # Case 1: VENDOR
            if d_type == 'VENDOR':
                _cleanup(entry.expense); entry.expense = None
                _cleanup(entry.salary_payment); entry.salary_payment = None
                _cleanup(entry.customer_payment); entry.customer_payment = None

                vendor = entry.vendor
                if not vendor and entry.party_name:
                    vendor = Vendor.objects.filter(name__iexact=entry.party_name.strip()).first()
                if vendor:
                    entry.vendor = vendor
                    if entry.vendor_payment:
                        vp = entry.vendor_payment
                        vp.vendor = vendor
                        vp.job_order = entry.job_order
                        vp.amount = entry.amount
                        vp.payment_date = entry.date
                        vp.notes = f"{cb_name}: {entry.remark or entry.party_name}".strip()
                        vp.save()
                    else:
                        vp = VendorPayment.objects.create(
                            vendor=vendor,
                            job_order=entry.job_order,
                            amount=entry.amount,
                            payment_date=entry.date,
                            notes=f"{cb_name}: {entry.remark or entry.party_name}".strip(),
                            created_by=self.request.user if self.request.user.is_authenticated else None
                        )
                        entry.vendor_payment = vp
                elif entry.vendor_payment:
                    _cleanup(entry.vendor_payment)
                    entry.vendor_payment = None

                entry.save(update_fields=['vendor', 'vendor_payment', 'expense', 'salary_payment', 'customer_payment'])

            # Case 2: SALARY
            elif d_type == 'SALARY':
                _cleanup(entry.vendor_payment); entry.vendor_payment = None
                _cleanup(entry.expense); entry.expense = None
                _cleanup(entry.customer_payment); entry.customer_payment = None

                s_name = (entry.staff_name or '').strip()
                if not s_name and entry.staff_user:
                    s_name = f"{entry.staff_user.first_name} {entry.staff_user.last_name}".strip() or entry.staff_user.username
                if not s_name and entry.party_name:
                    s_name = entry.party_name.strip()
                if not s_name:
                    s_name = 'Staff Member'
                entry.staff_name = s_name

                month_val = (entry.paid_month or '').strip() or entry.date.strftime('%B %Y')
                entry.paid_month = month_val

                if entry.salary_payment:
                    sp = entry.salary_payment
                    sp.staff_name = s_name
                    sp.paid_month = month_val
                    sp.amount = entry.amount
                    sp.total_salary = entry.amount
                    sp.payment_date = entry.date
                    sp.description = f"{cb_name}: {entry.remark or 'Salary Payment'}".strip()
                    sp.save()
                else:
                    sp = SalaryPayment.objects.create(
                        staff_name=s_name,
                        paid_month=month_val,
                        amount=entry.amount,
                        total_salary=entry.amount,
                        payment_date=entry.date,
                        description=f"{cb_name}: {entry.remark or 'Salary Payment'}".strip(),
                        created_by=self.request.user if self.request.user.is_authenticated else None
                    )
                    entry.salary_payment = sp

                entry.save(update_fields=['staff_name', 'paid_month', 'salary_payment', 'vendor_payment', 'expense', 'customer_payment'])

            # Case 3: CUSTOMER (Debit / Refund)
            elif d_type == 'CUSTOMER':
                _cleanup(entry.vendor_payment); entry.vendor_payment = None
                _cleanup(entry.expense); entry.expense = None
                _cleanup(entry.salary_payment); entry.salary_payment = None

                customer = entry.customer
                if not customer and entry.party_name:
                    customer = Customer.objects.filter(name__iexact=entry.party_name.strip()).first()
                if customer:
                    entry.customer = customer
                    if entry.customer_payment:
                        cp = entry.customer_payment
                        cp.customer = customer
                        cp.job_order = entry.job_order
                        cp.amount = entry.amount
                        cp.payment_date = entry.date
                        cp.payment_type = 'refund'
                        cp.notes = f"{cb_name} (Refund): {entry.remark or entry.party_name}".strip()
                        cp.save()
                    else:
                        cp = CustomerPayment.objects.create(
                            customer=customer,
                            job_order=entry.job_order,
                            amount=entry.amount,
                            payment_date=entry.date,
                            payment_type='refund',
                            notes=f"{cb_name} (Refund): {entry.remark or entry.party_name}".strip(),
                            created_by=self.request.user if self.request.user.is_authenticated else None
                        )
                        entry.customer_payment = cp
                elif entry.customer_payment:
                    _cleanup(entry.customer_payment)
                    entry.customer_payment = None

                entry.save(update_fields=['customer', 'customer_payment', 'vendor_payment', 'expense', 'salary_payment'])

            # Case 4: LABOUR
            elif d_type == 'LABOUR':
                _cleanup(entry.vendor_payment); entry.vendor_payment = None
                _cleanup(entry.salary_payment); entry.salary_payment = None
                _cleanup(entry.customer_payment); entry.customer_payment = None
                _cleanup(entry.expense); entry.expense = None

                labour = entry.labour
                if labour:
                    labour = Labour.objects.select_for_update().filter(pk=labour.pk).first()
                elif entry.party_name:
                    l_qs = Labour.objects.select_for_update().filter(name__iexact=entry.party_name.strip())
                    if entry.job_order:
                        l_qs_job = l_qs.filter(job_order=entry.job_order)
                        if l_qs_job.exists():
                            l_qs = l_qs_job
                    labour = l_qs.filter(status__in=['pending', 'partially_paid']).first() or l_qs.first()

                if labour:
                    entry.labour = labour
                    labour.paid_amount = (labour.paid_amount or Decimal('0.00')) + entry.amount
                    if labour.paid_amount >= labour.payment_amount and labour.payment_amount > 0:
                        labour.status = 'paid'
                    elif labour.paid_amount > 0:
                        labour.status = 'partially_paid'
                    labour.save(update_fields=['paid_amount', 'status'])


                entry.save(update_fields=['labour', 'vendor_payment', 'salary_payment', 'customer_payment', 'expense'])

            # Case 5: Company Expense
            else:
                _cleanup(entry.vendor_payment); entry.vendor_payment = None
                _cleanup(entry.salary_payment); entry.salary_payment = None
                _cleanup(entry.customer_payment); entry.customer_payment = None

                desc = entry.remark or entry.category or 'Company Expense'
                cat = entry.category or 'General'
                notes = f"{cb_name} - Payee: {entry.party_name or 'Company'}".strip()

                if entry.expense:
                    exp = entry.expense
                    exp.description = desc
                    exp.amount = entry.amount
                    exp.date = entry.date
                    exp.category = cat
                    exp.notes = notes
                    exp.job_order = entry.job_order
                    exp.save()
                else:
                    exp = Expense.objects.create(
                        description=desc,
                        amount=entry.amount,
                        date=entry.date,
                        category=cat,
                        type='Operational',
                        notes=notes,
                        job_order=entry.job_order,
                        created_by=self.request.user if self.request.user.is_authenticated else None
                    )
                    entry.expense = exp

                entry.save(update_fields=['expense', 'vendor_payment', 'salary_payment', 'customer_payment'])

        # Automated side-effects for Cash In (Credit)
        elif entry.entry_type == 'in':
            cat_lower = (entry.category or '').strip().lower()
            party_lower = (entry.party_name or '').strip().lower()
            remark_lower = (entry.remark or '').strip().lower()
            tx_type = (entry.transaction_type or '').strip()

            is_transfer = (
                not entry.customer and
                tx_type != 'Customer Payment' and (
                    cat_lower == 'transfer' or
                    'internal transfer' in party_lower or
                    'internal transfer' in remark_lower or
                    '➔' in (entry.party_name or '') or
                    '->' in (entry.party_name or '') or
                    tx_type in ['Bank Transfer', 'Bank Deposit', 'Bank Withdrawal'] or
                    (entry.petty_cash_account_id and entry.bank_account_id)
                )
            )

            if is_transfer:
                _cleanup(entry.customer_payment); entry.customer_payment = None
                _cleanup(entry.expense); entry.expense = None
                entry.save(update_fields=['customer_payment', 'expense'])
                return

            _cleanup(entry.vendor_payment); entry.vendor_payment = None
            _cleanup(entry.expense); entry.expense = None
            _cleanup(entry.salary_payment); entry.salary_payment = None

            customer = entry.customer
            if not customer and entry.party_name:
                customer = Customer.objects.filter(name__iexact=entry.party_name.strip()).first()
            if customer:
                entry.customer = customer
                if entry.customer_payment:
                    cp = entry.customer_payment
                    cp.customer = customer
                    cp.job_order = entry.job_order
                    cp.amount = entry.amount
                    cp.payment_date = entry.date
                    cp.payment_type = 'installment'
                    cp.notes = f"{cb_name}: {entry.remark or entry.party_name}".strip()
                    cp.save()
                else:
                    cp = CustomerPayment.objects.create(
                        customer=customer,
                        job_order=entry.job_order,
                        amount=entry.amount,
                        payment_date=entry.date,
                        payment_type='installment',
                        notes=f"{cb_name}: {entry.remark or entry.party_name}".strip(),
                        created_by=self.request.user if self.request.user.is_authenticated else None
                    )
                    entry.customer_payment = cp
            elif entry.customer_payment:
                _cleanup(entry.customer_payment)
                entry.customer_payment = None


            entry.save(update_fields=['customer', 'customer_payment', 'vendor_payment', 'expense', 'salary_payment'])

    def perform_create(self, serializer):
        from django.db import transaction
        with transaction.atomic():
            entry = serializer.save(created_by=self.request.user)
            self._sync_entry_side_effects(entry)

            if entry.bank_account:
                delta = compute_bank_delta(entry)
                BankAccount.objects.filter(id=entry.bank_account_id).update(
                    balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + delta
                )

            if entry.petty_cash_account:
                pca = entry.petty_cash_account
                amt = Decimal(str(entry.amount))
                if entry.entry_type == 'in':
                    # 4.1 Petty Cash Approval Workflow: Check if current user is adding cash to someone else's petty cash account
                    account_owner = pca.owner
                    if not account_owner and pca.created_by:
                        account_owner = pca.created_by
                    if not account_owner and pca.holder_name:
                        from django.contrib.auth import get_user_model
                        UserModel = get_user_model()
                        account_owner = UserModel.objects.filter(
                            Q(first_name__iexact=pca.holder_name.strip()) |
                            Q(username__iexact=pca.holder_name.strip())
                        ).first()

                    current_user = self.request.user if self.request.user.is_authenticated else None
                    is_other_person = bool(
                        account_owner and current_user and account_owner.id != current_user.id
                    )

                    if is_other_person:
                        entry.approval_status = 'pending'
                        entry.save(update_fields=['approval_status'])
                        # Held in pending: do NOT credit pca.balance yet!
                        actor_name = current_user.get_full_name() or current_user.username
                        Notification.objects.create(
                            recipient=account_owner,
                            actor=current_user,
                            notification_type='petty_cash_approval',
                            title=f"Petty Cash Deposit: {entry.amount} {pca.currency}",
                            message=f"{actor_name} added {entry.amount} {pca.currency} to your petty cash account ({pca.name}). Please review and approve with 'OK'.",
                            action_type='petty_cash_approval',
                            action_data={
                                'entry_id': entry.id,
                                'cashbook_id': entry.cashbook_id,
                                'cashbook_name': entry.cashbook.name if entry.cashbook else 'Cash Ledger',
                                'account_id': pca.id,
                                'account_name': pca.name,
                                'amount': str(entry.amount),
                                'currency': pca.currency,
                                'date': str(entry.date),
                                'party_name': entry.party_name,
                                'remark': entry.remark
                            }
                        )
                    else:
                        entry.approval_status = 'approved'
                        entry.save(update_fields=['approval_status'])
                        PettyCashAccount.objects.filter(id=pca.id).update(
                            balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + amt
                        )
                elif entry.entry_type == 'out':
                    PettyCashAccount.objects.filter(id=pca.id).update(
                        balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) - amt
                    )

    def perform_update(self, serializer):
        from django.db import transaction
        with transaction.atomic():
            old_instance = self.get_object()
            old_bank = old_instance.bank_account
            old_pca = old_instance.petty_cash_account
            old_entry_type = old_instance.entry_type
            old_amount = Decimal(str(old_instance.amount))
            old_status = old_instance.approval_status

            if old_bank:
                old_delta = compute_bank_delta(old_instance)
                BankAccount.objects.filter(id=old_bank.id).update(
                    balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) - old_delta
                )

            if old_pca:
                if old_entry_type == 'in':
                    if old_status == 'approved':
                        PettyCashAccount.objects.filter(id=old_pca.id).update(
                            balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) - old_amount
                        )
                elif old_entry_type == 'out':
                    PettyCashAccount.objects.filter(id=old_pca.id).update(
                        balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + old_amount
                    )

            # If previous entry was linked to a Labour record, revert that old payment amount
            if old_instance.debit_type == 'LABOUR' and old_instance.labour:
                try:
                    old_l = old_instance.labour
                    old_l.paid_amount = max(Decimal('0.00'), (old_l.paid_amount or Decimal('0.00')) - old_amount)
                    if old_l.paid_amount >= old_l.payment_amount and old_l.payment_amount > 0:
                        old_l.status = 'paid'
                    elif old_l.paid_amount > 0:
                        old_l.status = 'partially_paid'
                    else:
                        old_l.status = 'pending'
                    old_l.save()
                except Exception:
                    pass

            new_instance = serializer.save()
            self._sync_entry_side_effects(new_instance)

            if new_instance.bank_account:
                new_delta = compute_bank_delta(new_instance)
                BankAccount.objects.filter(id=new_instance.bank_account_id).update(
                    balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + new_delta
                )

            if new_instance.petty_cash_account:
                amt = Decimal(str(new_instance.amount))
                if new_instance.entry_type == 'in':
                    if new_instance.approval_status == 'approved':
                        PettyCashAccount.objects.filter(id=new_instance.petty_cash_account_id).update(
                            balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + amt
                        )
                elif new_instance.entry_type == 'out':
                    PettyCashAccount.objects.filter(id=new_instance.petty_cash_account_id).update(
                        balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) - amt
                    )

    def perform_destroy(self, instance):
        from django.db import transaction
        from .recycle_bin import archive_to_recycle_bin, set_bypass_recycle_bin

        with transaction.atomic():
            archive_to_recycle_bin(instance, user=self.request.user)
            try:
                set_bypass_recycle_bin(True)
                if instance.vendor_payment:
                    try: instance.vendor_payment.delete()
                    except Exception: pass
                if instance.customer_payment:
                    try: instance.customer_payment.delete()
                    except Exception: pass
                if instance.salary_payment:
                    try: instance.salary_payment.delete()
                    except Exception: pass
                if instance.expense:
                    try: instance.expense.delete()
                    except Exception: pass
            finally:
                set_bypass_recycle_bin(False)

            if instance.debit_type == 'LABOUR' and instance.labour:
                try:
                    l = instance.labour
                    l.paid_amount = max(Decimal('0.00'), (l.paid_amount or Decimal('0.00')) - instance.amount)
                    if l.paid_amount >= l.payment_amount and l.payment_amount > 0:
                        l.status = 'paid'
                    elif l.paid_amount > 0:
                        l.status = 'partially_paid'
                    else:
                        l.status = 'pending'
                    l.save()
                except Exception:
                    pass

            if instance.bank_account_id:
                delta = compute_bank_delta(instance)
                BankAccount.objects.filter(id=instance.bank_account_id).update(
                    balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) - delta
                )

            if instance.petty_cash_account_id:
                amt = Decimal(str(instance.amount))
                if instance.entry_type == 'in':
                    if instance.approval_status == 'approved':
                        PettyCashAccount.objects.filter(id=instance.petty_cash_account_id).update(
                            balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) - amt
                        )
                elif instance.entry_type == 'out':
                    PettyCashAccount.objects.filter(id=instance.petty_cash_account_id).update(
                        balance=Coalesce(F('balance'), Decimal('0.00'), output_field=DecimalField()) + amt
                    )

            instance.delete()


    @action(detail=True, methods=['post'], url_path='approve')
    def approve_entry(self, request, pk=None):
        entry = self.get_object()
        if entry.approval_status == 'approved':
            return Response({'detail': 'Entry is already approved.'})
        pca = entry.petty_cash_account
        if not pca:
            return Response({'detail': 'Entry has no linked petty cash account.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check authorization: user must be the account owner, or admin
        account_owner = pca.owner or pca.created_by
        if account_owner and request.user.id != account_owner.id and not is_admin_user(request.user):
            return Response({'detail': 'Only the petty cash account owner can approve this addition.'}, status=status.HTTP_403_FORBIDDEN)

        entry.approval_status = 'approved'
        entry.approved_by = request.user
        entry.approved_at = timezone.now()
        entry.save(update_fields=['approval_status', 'approved_by', 'approved_at'])

        # Now credit the balance
        amt = Decimal(str(entry.amount))
        pca.balance = (pca.balance or Decimal('0.00')) + amt
        pca.save(update_fields=['balance'])

        # Update any notifications for this entry
        Notification.objects.filter(
            notification_type='petty_cash_approval',
            action_data__entry_id=entry.id
        ).update(is_read=True, action_taken='approved')

        return Response({
            'detail': 'Petty cash addition approved successfully.',
            'entry': CashBookEntrySerializer(entry).data,
            'account_balance': float(pca.balance)
        })

    @action(detail=True, methods=['post'], url_path='reject')
    def reject_entry(self, request, pk=None):
        entry = self.get_object()
        if entry.approval_status == 'rejected':
            return Response({'detail': 'Entry is already rejected.'})
        pca = entry.petty_cash_account
        account_owner = pca.owner or pca.created_by if pca else None
        if account_owner and request.user.id != account_owner.id and not is_admin_user(request.user):
            return Response({'detail': 'Only the petty cash account owner can reject this addition.'}, status=status.HTTP_403_FORBIDDEN)

        entry.approval_status = 'rejected'
        entry.approved_by = request.user
        entry.approved_at = timezone.now()
        entry.save(update_fields=['approval_status', 'approved_by', 'approved_at'])

        Notification.objects.filter(
            notification_type='petty_cash_approval',
            action_data__entry_id=entry.id
        ).update(is_read=True, action_taken='rejected')

        return Response({
            'detail': 'Petty cash addition rejected.',
            'entry': CashBookEntrySerializer(entry).data
        })

    @action(detail=False, methods=['get'], url_path='ledger')
    def ledger(self, request):
        book_id = request.query_params.get('cashbook')
        if not book_id:
            return Response({'error': 'cashbook query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        try:
            # Strict user isolation for EVERY user regardless of admin privilege
            book = CashBook.objects.get(pk=book_id, created_by=user)
        except CashBook.DoesNotExist:
            return Response({'error': 'CashBook not found or access denied'}, status=status.HTTP_404_NOT_FOUND)

        # Precompute chronological running balance map for ALL entries of this book
        all_book_entries = CashBookEntry.objects.filter(cashbook_id=book_id).exclude(approval_status='rejected').order_by('date', 'time', 'created_at', 'id')
        running_map = {}
        curr_bal = Decimal(str(book.opening_balance or 0))
        for e in all_book_entries:
            amt = e.amount
            if e.entry_type == 'in':
                curr_bal += amt
            else:
                curr_bal -= amt
            running_map[e.id] = curr_bal

        entries_qs = self.get_queryset().filter(cashbook_id=book_id).exclude(approval_status='rejected')
        
        total_in = Decimal('0.00')
        total_out = Decimal('0.00')
        ledger_entries = []

        for e in entries_qs:
            amt = e.amount
            if e.entry_type == 'in':
                total_in += amt
            else:
                total_out += amt

            ledger_entries.append({
                'id': e.id,
                'cashbook': e.cashbook_id,
                'cashbook_name': book.name,
                'entry_type': e.entry_type,
                'amount': float(amt),
                'date': str(e.date),
                'time': str(e.time) if e.time else None,
                'category': e.category,
                'remark': e.remark,
                'party_name': e.party_name,
                'payment_mode': e.payment_mode,
                'transaction_type': e.transaction_type,
                'bank_account': e.bank_account_id,
                'bank_account_name': e.bank_account_name,
                'petty_cash_account': e.petty_cash_account_id,
                'petty_cash_account_name': e.petty_cash_account_name,
                'reference_number': e.reference_number,
                'custom_fields': e.custom_fields or {},
                'running_balance': float(running_map.get(e.id, 0.0)),
                'created_by_name': e.created_by.username if e.created_by else 'System'
            })

        return Response({
            'cashbook': {
                'id': book.id,
                'name': book.name,
                'description': book.description,
                'color': book.color,
                'icon': book.icon,
                'currency': book.currency,
                'opening_balance': float(book.opening_balance)
            },
            'total_in': float(total_in),
            'total_out': float(total_out),
            'net_balance': float(curr_bal),
            'entries_count': len(ledger_entries),
            'entries': list(reversed(ledger_entries))
        })

    @action(detail=False, methods=['get'], url_path='bank-flow')
    def bank_flow(self, request):
        entries = CashBookEntry.objects.filter(
            Q(bank_account__isnull=False) | Q(payment_mode__iexact='Bank Transfer')
        ).select_related('cashbook', 'bank_account', 'created_by')

        start_date = request.query_params.get('start_date')
        if start_date:
            entries = entries.filter(date__gte=start_date)

        end_date = request.query_params.get('end_date')
        if end_date:
            entries = entries.filter(date__lte=end_date)

        bank_acc_id = request.query_params.get('bank_account')
        if bank_acc_id and bank_acc_id not in ['all', 'All']:
            entries = entries.filter(bank_account_id=bank_acc_id)

        flow_type = request.query_params.get('flow_type')
        if flow_type in ['deposit', 'in']:
            entries = entries.filter(entry_type='in')
        elif flow_type in ['withdrawal', 'out']:
            entries = entries.filter(entry_type='out')

        search = request.query_params.get('search')
        if search:
            entries = entries.filter(
                Q(remark__icontains=search) |
                Q(party_name__icontains=search) |
                Q(category__icontains=search) |
                Q(bank_account_name__icontains=search) |
                Q(reference_number__icontains=search) |
                Q(cashbook__name__icontains=search)
            )

        total_bank_deposits = entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        total_bank_withdrawals = entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        net_bank_flow = total_bank_deposits - total_bank_withdrawals

        banks = BankAccount.objects.all()
        bank_stats = []
        for b in banks:
            b_entries = CashBookEntry.objects.filter(bank_account_id=b.id)
            b_deposits = b_entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
            b_withdrawals = b_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
            bank_stats.append({
                'id': b.id,
                'bank_name': b.bank_name,
                'account_number': b.account_number,
                'balance': float(b.balance or 0),
                'currency': b.currency,
                'status': b.status,
                'total_deposits': float(b_deposits),
                'total_withdrawals': float(b_withdrawals),
                'net_flow': float(b_deposits - b_withdrawals),
                'transaction_count': b_entries.count()
            })

        total_bank_reserves = banks.filter(status='Active').aggregate(tot=Coalesce(Sum('balance'), Decimal('0'), output_field=DecimalField()))['tot']
        total_petty_cash_reserves = PettyCashAccount.objects.filter(status='Active').aggregate(tot=Coalesce(Sum('balance'), Decimal('0'), output_field=DecimalField()))['tot']

        ordered_entries = entries.order_by('-date', '-time', '-created_at', '-id')
        transaction_list = []
        for e in ordered_entries:
            transaction_list.append({
                'id': e.id,
                'cashbook': e.cashbook_id,
                'cashbook_name': e.cashbook.name if e.cashbook else 'Unassigned',
                'entry_type': e.entry_type,
                'flow_direction': 'Bank Deposit / Receipt' if e.entry_type == 'in' else 'Bank Payment / Outflow',
                'amount': float(e.amount),
                'date': str(e.date),
                'time': str(e.time) if e.time else None,
                'category': e.category,
                'remark': e.remark,
                'party_name': e.party_name,
                'payment_mode': e.payment_mode,
                'transaction_type': e.transaction_type,
                'bank_account': e.bank_account_id,
                'bank_account_name': e.bank_account_name or (e.bank_account.bank_name if e.bank_account else 'Unspecified Bank'),
                'bank_account_number': e.bank_account.account_number if e.bank_account else '',
                'petty_cash_account': e.petty_cash_account_id,
                'petty_cash_account_name': e.petty_cash_account_name or (e.petty_cash_account.name if e.petty_cash_account else ''),
                'reference_number': e.reference_number,
                'custom_fields': e.custom_fields or {},
                'created_by_name': e.created_by.username if e.created_by else 'System'
            })

        return Response({
            'total_bank_deposits': float(total_bank_deposits),
            'total_bank_withdrawals': float(total_bank_withdrawals),
            'net_bank_flow': float(net_bank_flow),
            'total_transactions': entries.count(),
            'total_bank_reserves': float(total_bank_reserves),
            'total_petty_cash_reserves': float(total_petty_cash_reserves),
            'banks_summary': bank_stats,
            'transactions': transaction_list
        })

    @action(detail=False, methods=['get'], url_path='ledger-pdf')
    def ledger_pdf(self, request):
        from django.http import HttpResponse
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename

        resp = self.ledger(request)
        if resp.status_code != 200:
            return resp

        data = resp.data
        book_data = data['cashbook']
        summary = {
            'opening_balance': book_data.get('opening_balance', 0),
            'total_in': data.get('total_in', 0),
            'total_out': data.get('total_out', 0),
            'net_balance': data.get('net_balance', 0),
        }
        entries = list(reversed(data.get('entries', [])))
        filters = {
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date')
        }

        pdf_bytes = universal_pdf_generator.generate_cashbook_ledger_pdf(
            book_data=book_data,
            summary=summary,
            entries=entries,
            filters=filters
        )

        s_date = filters.get('start_date')
        e_date = filters.get('end_date')
        filename = format_dynamic_filename('cashbook', book_data.get('name', 'cashbook'), s_date, 'to' if s_date and e_date else None, e_date or datetime.datetime.now().strftime('%Y%m%d'))
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='bank-flow-pdf')
    def bank_flow_pdf(self, request):
        from django.http import HttpResponse
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename

        resp = self.bank_flow(request)
        if resp.status_code != 200:
            return resp

        data = resp.data
        summary = {
            'total_inflows': data.get('total_bank_deposits', 0),
            'total_outflows': data.get('total_bank_withdrawals', 0),
            'net_flow': data.get('net_bank_flow', 0),
            'total_transactions': data.get('total_transactions', len(data.get('transactions', []))),
        }
        transactions = data.get('transactions', [])
        filters = {
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date')
        }

        pdf_bytes = universal_pdf_generator.generate_cashbook_bank_flow_pdf(
            summary=summary,
            transactions=transactions,
            filters=filters
        )

        s_date = filters.get('start_date')
        e_date = filters.get('end_date')
        filename = format_dynamic_filename('cashbook_bank_flow', s_date, 'to' if s_date and e_date else None, e_date or datetime.datetime.now().strftime('%Y%m%d'))
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


class StaffTimesheetViewSet(viewsets.ModelViewSet):
    serializer_class = StaffTimesheetSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # Seed reference dataset matching user's reference screenshot if none exist
        if not StaffTimesheet.objects.exists():
            from accounts.models import CustomUser
            default_user = CustomUser.objects.filter(username='mustaq').first() or CustomUser.objects.first()
            s_name = (f"{default_user.first_name} {default_user.last_name}".strip() or default_user.username) if default_user else 'mustaq'
            
            sample_entries = [
                {'date': '2026-08-06', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-07', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-08', 'in_time': '9:00:00 AM', 'lunch_time': '', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 500, 'overtime_hours': 3, 'overtime_text': '3hr', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-09', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-10', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-11', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-13', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 100, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-14', 'in_time': '', 'lunch_time': '', 'out_time': '', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': True},
                {'date': '2026-08-15', 'in_time': '9:00:00 AM', 'lunch_time': '', 'out_time': '11:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 4, 'overtime_text': '4HR', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-16', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '1:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 3, 'overtime_text': '3HR', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-17', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '1:00:00 PM', 'debit': 0, 'credit': 100, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-18', 'in_time': '9:00:00 AM', 'lunch_time': '', 'out_time': '12:00:00 AM', 'debit': 0, 'credit': 0, 'overtime_hours': 3, 'overtime_text': '3hr', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-19', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '1:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-20', 'in_time': '9:00:00 AM', 'lunch_time': '', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 3, 'overtime_text': '3hr', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-21', 'in_time': '', 'lunch_time': '', 'out_time': '', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': True},
                {'date': '2026-08-22', 'in_time': '9:00:00 AM', 'lunch_time': '', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-23', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-24', 'in_time': '4:00:00 PM', 'lunch_time': '', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-25', 'in_time': '9:00:00 AM', 'lunch_time': '2:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 1, 'overtime_text': '1 HR', 'ot_details': 'SPACE CRAFT WORK', 'is_off_day': False},
                {'date': '2026-08-26', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 100, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-27', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-28', 'in_time': '', 'lunch_time': '2:00:00 PM', 'out_time': '5:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 3, 'overtime_text': '3HR', 'ot_details': 'NISAM MINISTRY OF CULTURE', 'is_off_day': True},
                {'date': '2026-08-29', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-08-30', 'in_time': '9:00:00 AM', 'lunch_time': '', 'out_time': '2:00:00 AM', 'debit': 0, 'credit': 0, 'overtime_hours': 7, 'overtime_text': '7HR', 'ot_details': 'NISAM MINISTRY OF CULTURE', 'is_off_day': False},
                {'date': '2026-08-31', 'in_time': '9:00:00 AM', 'lunch_time': '', 'out_time': '4:00:00 AM', 'debit': 0, 'credit': 0, 'overtime_hours': 9, 'overtime_text': '9HR', 'ot_details': 'popup setting&moc die cut', 'is_off_day': False},
                {'date': '2026-09-01', 'in_time': '9:00:00 AM', 'lunch_time': '2:00:00 PM', 'out_time': '12:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 3, 'overtime_text': '3hr', 'ot_details': 'banner print & moc die cut', 'is_off_day': False},
                {'date': '2026-09-02', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
                {'date': '2026-09-03', 'in_time': '9:00:00 AM', 'lunch_time': '2:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 1, 'overtime_text': '1 HR', 'ot_details': 'ASHRAF FOREX SETTING', 'is_off_day': False},
                {'date': '2026-09-04', 'in_time': '', 'lunch_time': '', 'out_time': '', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': True},
                {'date': '2026-09-05', 'in_time': '9:00:00 AM', 'lunch_time': '1:00:00 PM', 'out_time': '10:00:00 PM', 'debit': 0, 'credit': 0, 'overtime_hours': 0, 'overtime_text': '', 'ot_details': '', 'is_off_day': False},
            ]
            for se in sample_entries:
                StaffTimesheet.objects.create(
                    user=default_user,
                    staff_name=s_name,
                    created_by=self.request.user if self.request.user.is_authenticated else None,
                    **se
                )

        qs = StaffTimesheet.objects.all().select_related('user', 'created_by')
        
        staff_name = self.request.query_params.get('staff_name')
        if staff_name and staff_name != 'All':
            qs = qs.filter(Q(staff_name__iexact=staff_name) | Q(user__username__iexact=staff_name))

        user_id = self.request.query_params.get('user_id')
        if user_id and user_id != 'All':
            qs = qs.filter(user_id=user_id)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(date__lte=end_date)

        month_str = self.request.query_params.get('month')
        if month_str and month_str != 'All':
            # e.g., "August 2026" or "2026-08"
            dt = None
            try:
                dt = datetime.datetime.strptime(month_str, '%B %Y')
            except ValueError:
                try:
                    dt = datetime.datetime.strptime(month_str, '%Y-%m')
                except ValueError:
                    pass
            if dt:
                qs = qs.filter(date__year=dt.year, date__month=dt.month)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(staff_name__icontains=search) |
                Q(ot_details__icontains=search) |
                Q(overtime_text__icontains=search)
            )

        ordering = self.request.query_params.get('ordering', '-date')
        if ordering == 'asc':
            return qs.order_by('date', 'created_at', 'id')
        return qs.order_by('-date', '-created_at', '-id')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='staff-users')
    def staff_users(self, request):
        """
        Returns list of database users for staff selection.
        """
        from accounts.models import CustomUser
        users = CustomUser.objects.all().order_by('username')
        data = []
        for u in users:
            full_name = f"{u.first_name} {u.last_name}".strip()
            data.append({
                'id': u.id,
                'username': u.username,
                'full_name': full_name or u.username,
                'email': u.email,
                'role': u.role
            })
        return Response(data)

    @action(detail=False, methods=['post'], url_path='generate-month')
    def generate_month(self, request):
        """
        Bulk generate 1 month (28-31 days) of timesheet attendance entries for a staff member.
        Parameters in request.data:
        - staff_name (str)
        - user_id (int, optional)
        - month (str like 'September 2026' or '2026-09' or int 1-12)
        - year (int, optional)
        - in_time (str, default '9:00:00 AM')
        - lunch_time (str, default '1:00:00 PM')
        - out_time (str, default '10:00:00 PM')
        - off_days (list of int, default [4] which is Friday)
        - overwrite_existing (bool, default False)
        """
        import calendar
        from accounts.models import CustomUser

        staff_name = request.data.get('staff_name', '').strip()
        user_id = request.data.get('user_id')
        user = None
        if user_id:
            try:
                user = CustomUser.objects.filter(id=int(user_id)).first()
            except (ValueError, TypeError):
                pass

        if not staff_name and user:
            staff_name = f"{user.first_name} {user.last_name}".strip() or user.username

        if not staff_name:
            return Response({'error': 'Staff member name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse year and month
        month_raw = request.data.get('month')
        year_raw = request.data.get('year')

        target_year = None
        target_month = None

        if isinstance(month_raw, str):
            try:
                dt = datetime.datetime.strptime(month_raw.strip(), '%B %Y')
                target_year = dt.year
                target_month = dt.month
            except ValueError:
                try:
                    dt = datetime.datetime.strptime(month_raw.strip(), '%Y-%m')
                    target_year = dt.year
                    target_month = dt.month
                except ValueError:
                    pass

        if not target_month and month_raw is not None:
            try:
                target_month = int(month_raw)
            except (ValueError, TypeError):
                pass

        if not target_year and year_raw is not None:
            try:
                target_year = int(year_raw)
            except (ValueError, TypeError):
                pass

        now = datetime.datetime.now()
        if not target_year:
            target_year = now.year
        if not target_month or target_month < 1 or target_month > 12:
            target_month = now.month

        # Standard shift timings
        in_time = request.data.get('in_time', '9:00:00 AM')
        lunch_time = request.data.get('lunch_time', '1:00:00 PM')
        out_time = request.data.get('out_time', '10:00:00 PM')

        # Off days: default Friday (weekday 4). Can be int or list of ints.
        off_days = request.data.get('off_days', [4])
        if isinstance(off_days, int):
            off_days = [off_days]
        elif not isinstance(off_days, list):
            off_days = [4]

        overwrite_existing = bool(request.data.get('overwrite_existing', False))

        _, num_days = calendar.monthrange(target_year, target_month)
        
        start_of_month = datetime.date(target_year, target_month, 1)
        end_of_month = datetime.date(target_year, target_month, num_days)

        from django.db import transaction
        with transaction.atomic():
            existing_query = StaffTimesheet.objects.filter(date__range=(start_of_month, end_of_month))
            if user:
                existing_query = existing_query.filter(Q(user=user) | Q(staff_name__iexact=staff_name))
            else:
                existing_query = existing_query.filter(staff_name__iexact=staff_name)
            
            existing_map = {e.date: e for e in existing_query}

            to_create = []
            to_update = []
            created_count = 0
            updated_count = 0
            skipped_count = 0

            for day in range(1, num_days + 1):
                entry_date = datetime.date(target_year, target_month, day)
                is_off = entry_date.weekday() in off_days

                existing = existing_map.get(entry_date)

                day_in = '' if is_off else in_time
                day_lunch = '' if is_off else lunch_time
                day_out = '' if is_off else out_time

                if existing:
                    if overwrite_existing:
                        existing.in_time = day_in
                        existing.lunch_time = day_lunch
                        existing.out_time = day_out
                        existing.is_off_day = is_off
                        existing.user = user or existing.user
                        existing.staff_name = staff_name
                        to_update.append(existing)
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    to_create.append(StaffTimesheet(
                        user=user,
                        staff_name=staff_name,
                        date=entry_date,
                        in_time=day_in,
                        lunch_time=day_lunch,
                        out_time=day_out,
                        debit=0,
                        credit=0,
                        overtime_hours=0,
                        overtime_text='',
                        ot_details='',
                        is_off_day=is_off,
                        created_by=request.user if request.user.is_authenticated else None
                    ))
                    created_count += 1

            if to_create:
                StaffTimesheet.objects.bulk_create(to_create)
            if to_update:
                StaffTimesheet.objects.bulk_update(to_update, ['in_time', 'lunch_time', 'out_time', 'is_off_day', 'user', 'staff_name'])


        month_display = datetime.date(target_year, target_month, 1).strftime('%B %Y')
        return Response({
            'message': f'Timesheet for {month_display} ({num_days} days) generated successfully.',
            'month': month_display,
            'year': target_year,
            'month_num': target_month,
            'num_days': num_days,
            'created_count': created_count,
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'staff_name': staff_name,
            'user_id': user.id if user else None
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='pdf')
    def pdf(self, request):
        from django.http import HttpResponse
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        qs = self.filter_queryset(self.get_queryset())
        filters = {
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'staff_name': request.query_params.get('staff_name'),
            'month': request.query_params.get('month')
        }
        pdf_bytes = universal_pdf_generator.generate_timesheet_report_pdf(list(qs), filters=filters)
        staff_str = filters.get('staff_name') or 'all_staff'
        month_or_period = filters.get('month') or (f"{filters.get('start_date')}_to_{filters.get('end_date')}" if filters.get('start_date') else datetime.datetime.now().strftime('%Y%m%d'))
        filename = format_dynamic_filename('timesheet', staff_str, month_or_period)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


class BankAccountViewSet(viewsets.ModelViewSet):
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = BankAccount.objects.all().select_related('created_by')
        # Seed default accounts if none exist
        if not qs.exists():
            default_banks = [
                {
                    'bank_name': 'Al Rajhi Bank',
                    'account_number': 'SA4580000201608010123456',
                    'account_holder_name': 'Arab Season Enterprise LLC',
                    'iban': 'SA4580000201608010123456',
                    'branch_name': 'Main Branch, Riyadh',
                    'balance': Decimal('0.00'),
                    'currency': 'SAR',
                    'status': 'Active',
                    'notes': 'Primary operational business account'
                },
                {
                    'bank_name': 'SNB AlAhli (National Commercial Bank)',
                    'account_number': 'SA1210000001234567890123',
                    'account_holder_name': 'Arab Season Enterprise LLC',
                    'iban': 'SA1210000001234567890123',
                    'branch_name': 'Olaya Branch',
                    'balance': Decimal('0.00'),
                    'currency': 'SAR',
                    'status': 'Active',
                    'notes': 'Vendor payments & payroll reserve'
                },
                {
                    'bank_name': 'Riyad Bank',
                    'account_number': 'SA9820000009876543210987',
                    'account_holder_name': 'Arab Season Enterprise LLC',
                    'iban': 'SA9820000009876543210987',
                    'branch_name': 'King Fahd Road',
                    'balance': Decimal('0.00'),
                    'currency': 'SAR',
                    'status': 'Active',
                    'notes': 'Tax and VAT reserve account'
                }
            ]
            for b in default_banks:
                BankAccount.objects.create(
                    created_by=self.request.user if self.request.user.is_authenticated else None,
                    **b
                )
            qs = BankAccount.objects.all().select_related('created_by')

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'All':
            qs = qs.filter(status__iexact=status_param)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(bank_name__icontains=search) |
                Q(account_number__icontains=search) |
                Q(account_holder_name__icontains=search) |
                Q(iban__icontains=search) |
                Q(branch_name__icontains=search)
            )
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = BankAccount.objects.all()
        total_balance = qs.aggregate(tot=Coalesce(Sum('balance'), Decimal('0'), output_field=DecimalField()))['tot']
        active_count = qs.filter(status='Active').count()
        total_count = qs.count()
        return Response({
            'total_balance': float(total_balance),
            'active_accounts': active_count,
            'total_accounts': total_count,
            'currency': 'SAR'
        })

    @action(detail=True, methods=['get'], url_path='statement')
    def statement(self, request, pk=None):
        bank = self.get_object()

        # All historical transactions for this bank account
        all_entries = CashBookEntry.objects.filter(bank_account=bank).order_by('date', 'time', 'created_at', 'id')

        # Compute true opening balance before all recorded transactions
        hist_in = all_entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        hist_out = all_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        initial_balance = (bank.balance or Decimal('0.00')) - (hist_in - hist_out)

        # Filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        flow_type = request.query_params.get('flow_type')
        search = request.query_params.get('search')

        # Calculate opening balance for the chosen date period
        if start_date:
            prior_entries = all_entries.filter(date__lt=start_date)
            prior_in = prior_entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
            prior_out = prior_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
            period_opening_balance = initial_balance + (prior_in - prior_out)
        else:
            period_opening_balance = initial_balance

        # Filter entries for the period
        period_entries = all_entries
        if start_date:
            period_entries = period_entries.filter(date__gte=start_date)
        if end_date:
            period_entries = period_entries.filter(date__lte=end_date)

        period_inflows = period_entries.filter(entry_type='in').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        period_outflows = period_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        period_net = period_inflows - period_outflows
        period_closing_balance = period_opening_balance + period_net

        # Compute running balances sequentially
        running_bal = period_opening_balance
        statement_transactions = []
        for e in period_entries.select_related('cashbook', 'created_by'):
            amt = Decimal(str(e.amount))
            is_credit = (e.entry_type == 'in')
            if is_credit:
                running_bal += amt
                credit_val = amt
                debit_val = Decimal('0.00')
            else:
                running_bal -= amt
                credit_val = Decimal('0.00')
                debit_val = amt

            statement_transactions.append({
                'id': e.id,
                'date': str(e.date),
                'time': str(e.time) if e.time else None,
                'reference_number': e.reference_number or f"TX-B{bank.id}-{e.id:04d}",
                'remark': e.remark or 'Bank Settlement',
                'party_name': e.party_name or 'Direct Transaction',
                'category': e.category or 'General',
                'payment_mode': e.payment_mode,
                'transaction_type': e.transaction_type,
                'entry_type': e.entry_type,
                'credit': float(credit_val),
                'debit': float(debit_val),
                'running_balance': float(running_bal),
                'cashbook_id': e.cashbook_id,
                'cashbook_name': e.cashbook.name if e.cashbook else 'Cashbook',
                'created_by_name': e.created_by.username if e.created_by else 'System'
            })

        # Apply search and flow_type filters to displayed transactions
        filtered_list = []
        for tx in statement_transactions:
            if flow_type in ['in', 'credit', 'deposit'] and tx['entry_type'] != 'in':
                continue
            if flow_type in ['out', 'debit', 'withdrawal'] and tx['entry_type'] != 'out':
                continue
            if search:
                s_lower = search.lower()
                matches = (
                    s_lower in tx['remark'].lower() or
                    s_lower in tx['party_name'].lower() or
                    s_lower in tx['category'].lower() or
                    s_lower in tx['reference_number'].lower() or
                    s_lower in tx['cashbook_name'].lower()
                )
                if not matches:
                    continue
            filtered_list.append(tx)

        return Response({
            'bank': {
                'id': bank.id,
                'bank_name': bank.bank_name,
                'account_number': bank.account_number,
                'account_holder_name': bank.account_holder_name or 'Arab Season Enterprise LLC',
                'iban': bank.iban,
                'branch_name': bank.branch_name,
                'balance': float(bank.balance or 0),
                'currency': bank.currency or 'SAR',
                'status': bank.status,
                'notes': bank.notes
            },
            'filters': {
                'start_date': start_date,
                'end_date': end_date,
                'flow_type': flow_type,
                'search': search
            },
            'summary': {
                'initial_balance': float(initial_balance),
                'opening_balance': float(period_opening_balance),
                'total_credits': float(period_inflows),
                'total_debits': float(period_outflows),
                'net_change': float(period_net),
                'closing_balance': float(period_closing_balance),
                'transactions_count': period_entries.count(),
                'filtered_count': len(filtered_list)
            },
            'transactions': filtered_list
        })

    @action(detail=True, methods=['get'], url_path='statement-pdf')
    def statement_pdf(self, request, pk=None):
        from django.http import HttpResponse
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename

        # Optional query param token authentication for direct browser links
        if not request.user or not request.user.is_authenticated:
            query_token = request.query_params.get('token')
            if query_token:
                try:
                    jwt_auth = JWTAuthentication()
                    validated_token = jwt_auth.get_validated_token(query_token)
                    request.user = jwt_auth.get_user(validated_token)
                except Exception:
                    pass

        stmt_resp = self.statement(request, pk=pk)
        if stmt_resp.status_code != 200:
            return stmt_resp

        data = stmt_resp.data
        bank = self.get_object()
        summary = data['summary']
        transactions = data['transactions']
        filters = data['filters']

        sort_order = request.query_params.get('sort', 'asc')
        if sort_order == 'desc':
            transactions = list(reversed(transactions))

        pdf_bytes = universal_pdf_generator.generate_bank_statement_pdf(
            bank=bank,
            summary=summary,
            transactions=transactions,
            filters=filters
        )

        s_date = filters.get('start_date')
        e_date = filters.get('end_date')
        filename = format_dynamic_filename('bank_statement', bank.bank_name, s_date, 'to' if s_date and e_date else None, e_date or datetime.datetime.now().strftime('%Y%m%d'))

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


class PettyCashAccountViewSet(viewsets.ModelViewSet):
    serializer_class = PettyCashAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PettyCashAccount.objects.all().select_related('created_by')
        # Seed default accounts if none exist
        if not qs.exists():
            default_accounts = [
                {
                    'name': 'Nizam Petty Cash',
                    'holder_name': 'Nizam',
                    'balance': Decimal('0.00'),
                    'currency': 'SAR',
                    'status': 'Active',
                    'notes': 'Custody account for Nizam'
                },
                {
                    'name': 'Shuhaib Petty Cash',
                    'holder_name': 'Shuhaib',
                    'balance': Decimal('0.00'),
                    'currency': 'SAR',
                    'status': 'Active',
                    'notes': 'Custody account for Shuhaib'
                },
                {
                    'name': 'Main Office Petty Cash',
                    'holder_name': 'Admin Office',
                    'balance': Decimal('0.00'),
                    'currency': 'SAR',
                    'status': 'Active',
                    'notes': 'Office operational float'
                }
            ]
            for a in default_accounts:
                PettyCashAccount.objects.create(
                    created_by=self.request.user if self.request.user.is_authenticated else None,
                    **a
                )
            qs = PettyCashAccount.objects.all().select_related('created_by')

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'All':
            qs = qs.filter(status__iexact=status_param)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(holder_name__icontains=search) |
                Q(notes__icontains=search)
            )
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = PettyCashAccount.objects.all()
        total_balance = qs.aggregate(tot=Coalesce(Sum('balance'), Decimal('0'), output_field=DecimalField()))['tot']
        active_count = qs.filter(status='Active').count()
        total_count = qs.count()
        return Response({
            'total_balance': float(total_balance),
            'active_accounts': active_count,
            'total_accounts': total_count,
            'currency': 'SAR'
        })

    @action(detail=True, methods=['get'], url_path='statement')
    def statement(self, request, pk=None):
        pca = self.get_object()

        # All valid historical transactions for this petty cash account (excluding rejected)
        all_entries = CashBookEntry.objects.filter(petty_cash_account=pca).exclude(approval_status='rejected').order_by('date', 'time', 'created_at', 'id')

        # Inflows to PCA only increment balance once approved
        hist_in = all_entries.filter(entry_type='in', approval_status='approved').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        hist_out = all_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        initial_balance = (pca.balance or Decimal('0.00')) - (hist_in - hist_out)

        # Filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        flow_type = request.query_params.get('flow_type')
        search = request.query_params.get('search')

        # Calculate opening balance for the chosen date period
        if start_date:
            prior_entries = all_entries.filter(date__lt=start_date)
            prior_in = prior_entries.filter(entry_type='in', approval_status='approved').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
            prior_out = prior_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
            period_opening_balance = initial_balance + (prior_in - prior_out)
        else:
            period_opening_balance = initial_balance

        # Filter entries for the period
        period_entries = all_entries
        if start_date:
            period_entries = period_entries.filter(date__gte=start_date)
        if end_date:
            period_entries = period_entries.filter(date__lte=end_date)

        period_inflows = period_entries.filter(entry_type='in', approval_status='approved').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        period_outflows = period_entries.filter(entry_type='out').aggregate(tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField()))['tot']
        period_net = period_inflows - period_outflows
        period_closing_balance = period_opening_balance + period_net

        # Compute running balances sequentially
        running_bal = period_opening_balance
        statement_transactions = []
        for e in period_entries.select_related('cashbook', 'created_by'):
            amt = Decimal(str(e.amount))
            is_credit = (e.entry_type == 'in')
            if is_credit:
                if e.approval_status == 'approved':
                    running_bal += amt
                credit_val = amt
                debit_val = Decimal('0.00')
            else:
                running_bal -= amt
                credit_val = Decimal('0.00')
                debit_val = amt


            statement_transactions.append({
                'id': e.id,
                'date': str(e.date),
                'time': str(e.time) if e.time else None,
                'reference_number': e.reference_number or f"TX-PC{pca.id}-{e.id:04d}",
                'remark': e.remark or 'Petty Cash Transaction',
                'party_name': e.party_name or 'Direct Transaction',
                'category': e.category or 'General',
                'payment_mode': e.payment_mode or 'Cash',
                'transaction_type': e.transaction_type,
                'entry_type': e.entry_type,
                'credit': float(credit_val),
                'debit': float(debit_val),
                'running_balance': float(running_bal),
                'cashbook_id': e.cashbook_id,
                'cashbook_name': e.cashbook.name if e.cashbook else 'Cashbook',
                'created_by_name': e.created_by.username if e.created_by else 'System'
            })

        # Apply search and flow_type filters to displayed transactions
        filtered_list = []
        for tx in statement_transactions:
            if flow_type in ['in', 'credit', 'deposit'] and tx['entry_type'] != 'in':
                continue
            if flow_type in ['out', 'debit', 'withdrawal'] and tx['entry_type'] != 'out':
                continue
            if search:
                s_lower = search.lower()
                matches = (
                    s_lower in tx['remark'].lower() or
                    s_lower in tx['party_name'].lower() or
                    s_lower in tx['category'].lower() or
                    s_lower in tx['reference_number'].lower() or
                    s_lower in tx['cashbook_name'].lower()
                )
                if not matches:
                    continue
            filtered_list.append(tx)

        return Response({
            'account': {
                'id': pca.id,
                'name': pca.name,
                'holder_name': pca.holder_name,
                'balance': float(pca.balance or 0),
                'currency': pca.currency or 'SAR',
                'status': pca.status,
                'notes': pca.notes
            },
            'filters': {
                'start_date': start_date,
                'end_date': end_date,
                'flow_type': flow_type,
                'search': search
            },
            'summary': {
                'initial_balance': float(initial_balance),
                'opening_balance': float(period_opening_balance),
                'total_credits': float(period_inflows),
                'total_debits': float(period_outflows),
                'net_change': float(period_net),
                'closing_balance': float(period_closing_balance),
                'transactions_count': period_entries.count(),
                'filtered_count': len(filtered_list)
            },
            'transactions': filtered_list
        })



class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Invoice.objects.all().select_related('customer', 'job_order', 'bank_account', 'created_by').prefetch_related('items', 'payments')
        user = self.request.user
        if not is_admin_user(user):
            qs = qs.filter(Q(created_by=user) | Q(customer__created_by=user))
        
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
            
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.lower() != 'all':
            qs = qs.filter(status__iexact=status_filter)
            
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(invoice_date__gte=start_date)
        if end_date:
            qs = qs.filter(invoice_date__lte=end_date)
            
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(reference_number__icontains=search) |
                Q(job_order__title__icontains=search) |
                Q(job_order__order_id__icontains=search)
            )
            
        return qs.order_by('-invoice_date', '-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        staff_name = user.get_full_name() or user.username
        serializer.save(created_by=user, created_by_staff=staff_name)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        """
        Generate the next sequential invoice number, e.g. INV-2026-0001
        Uses true maximum numerical sequence to prevent regressions from out-of-order IDs.
        """
        year = datetime.datetime.now().year
        prefix = f"INV-{year}-"
        existing = Invoice.objects.filter(invoice_number__startswith=prefix)
        nums = []
        for inv in existing:
            try:
                nums.append(int(inv.invoice_number.split('-')[-1]))
            except (ValueError, IndexError):
                pass
        seq = max(nums) + 1 if nums else 1
        next_num = f"{prefix}{seq:04d}"
        return Response({'next_number': next_num})

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        from django.http import HttpResponse

        query_token = request.query_params.get('token')
        if query_token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(query_token)
                request.user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        invoice = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_tax_invoice_pdf(invoice)
        c_name = invoice.customer.name if invoice.customer else (getattr(invoice, 'client_name', '') or 'Customer')
        filename = format_dynamic_filename('tax_invoice', invoice.invoice_number, c_name)

        
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


class CustomFormFieldViewSet(viewsets.ModelViewSet):
    serializer_class = CustomFormFieldSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = CustomFormField.objects.all().order_by('order', 'id')
        form_type = self.request.query_params.get('form_type')
        if form_type:
            qs = qs.filter(form_type=form_type)
        return qs

    def perform_create(self, serializer):
        if not (self.request.user.is_staff or self.request.user.is_superuser or getattr(self.request.user, 'role', '') == 'Admin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only administrators can configure custom form fields.')
        serializer.save()

    def perform_update(self, serializer):
        if not (self.request.user.is_staff or self.request.user.is_superuser or getattr(self.request.user, 'role', '') == 'Admin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only administrators can modify custom form fields.')
        serializer.save()

    def perform_destroy(self, instance):
        if not (self.request.user.is_staff or self.request.user.is_superuser or getattr(self.request.user, 'role', '') == 'Admin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only administrators can delete custom form fields.')
        super().perform_destroy(instance)



class MaterialCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MaterialCategorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    queryset = MaterialCategory.objects.all().order_by('name')


class MaterialViewSet(viewsets.ModelViewSet):
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = Material.objects.all().select_related('category', 'created_by').order_by('category__name', 'name')
        cat_id = self.request.query_params.get('category')
        if cat_id:
            qs = qs.filter(category_id=cat_id)
        search = self.request.query_params.get('q')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(measurements__icontains=search) |
                Q(category__name__icontains=search) |
                Q(notes__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EstimationViewSet(viewsets.ModelViewSet):
    serializer_class = EstimationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = Estimation.objects.all().select_related('customer', 'created_by', 'converted_job').prefetch_related('items').order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get('q')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(estimate_number__icontains=search) |
                Q(client_name__icontains=search) |
                Q(customer__name__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'], url_path='client-pdf')
    def client_pdf(self, request, pk=None):
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        query_token = request.query_params.get('token')
        if query_token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(query_token)
                request.user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        estimation = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_client_estimation_checklist_pdf(estimation)
        filename = format_dynamic_filename('client_checklist', estimation.estimate_number, estimation.client_name or 'estimate')
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'], url_path='admin-pdf')
    def admin_pdf(self, request, pk=None):
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        query_token = request.query_params.get('token')
        if query_token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(query_token)
                request.user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        estimation = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_admin_estimation_pdf(estimation)
        filename = format_dynamic_filename('admin_estimate', estimation.estimate_number, estimation.client_name or 'estimate')
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'], url_path='convert-to-job')
    def convert_to_job(self, request, pk=None):
        estimation = self.get_object()

        if estimation.converted_job:
            return Response({
                'detail': f'Estimation {estimation.estimate_number} was already converted to Job Order {estimation.converted_job.order_id}.',
                'job_order_id': estimation.converted_job.id,
                'order_id': estimation.converted_job.order_id
            }, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        with transaction.atomic():
            # Find or create customer (scoped if not admin)
            customer = estimation.customer
            if not customer:
                c_name = (estimation.client_name or '').strip() or 'Client'
                cust_qs = Customer.objects.all() if is_admin_user(request.user) else Customer.objects.filter(created_by=request.user)
                customer = cust_qs.filter(name__iexact=c_name).first()
                if not customer:
                    customer = Customer.objects.create(name=c_name, created_by=request.user)
                estimation.customer = customer

            # Generate Job Order ID using true max sequence
            existing_jobs = JobOrder.objects.filter(order_id__startswith='JOB-')
            job_nums = []
            for j in existing_jobs:
                try:
                    job_nums.append(int(j.order_id.split('-')[1]))
                except (IndexError, ValueError):
                    pass
            new_num = max(job_nums) + 1 if job_nums else 1
            order_id = f"JOB-{new_num:04d}"

            # Compute prior balance for customer
            prev_jobs_tot = JobOrder.objects.filter(customer=customer).aggregate(
                tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            prev_inv_tot = Invoice.objects.filter(customer=customer, job_order__isnull=True).aggregate(
                tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            prev_cn_tot = CreditNote.objects.filter(customer=customer).exclude(
                status__in=['Draft', 'Cancelled']
            ).aggregate(
                tot=Coalesce(Sum('total_amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            prev_pay_qs = CustomerPayment.objects.filter(customer=customer)
            prev_pay_in = prev_pay_qs.exclude(payment_type__in=['refund', 'credit_note']).aggregate(
                tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            prev_refunds = prev_pay_qs.filter(payment_type='refund').aggregate(
                tot=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField())
            )['tot']
            prev_net_paid = max(Decimal('0'), prev_pay_in - prev_refunds)
            prev_net_billed = max(Decimal('0'), (prev_jobs_tot + prev_inv_tot) - prev_cn_tot)
            prior_balance = max(Decimal('0'), prev_net_billed - prev_net_paid)


            # Build detailed item breakdown description from EstimationItems
            items_summary = []
            for itm in estimation.items.all().order_by('sort_order', 'id'):
                items_summary.append(f"• {itm.description or 'Item'}: {itm.quantity} {itm.unit} @ {itm.unit_price} SAR = {itm.total_price} SAR")
            items_desc = "\nScope of Work / Bill of Quantities:\n" + "\n".join(items_summary) if items_summary else ""

            job_desc = f"Auto-converted from Estimation {estimation.estimate_number}.\n{estimation.notes or ''}".strip()
            if items_desc:
                job_desc += f"\n{items_desc}"

            job = JobOrder.objects.create(
                order_id=order_id,
                title=f"Quote Ref {estimation.estimate_number}: {estimation.title}",
                description=job_desc,
                customer=customer,
                status='In Progress',
                total_amount=estimation.total_price or Decimal('0.00'),
                prior_balance=prior_balance,
                quotation_number=estimation.estimate_number,
                created_by=request.user
            )

            estimation.converted_job = job
            estimation.status = 'Converted to Job'
            estimation.save()

            return Response({
                'success': True,
                'message': f'Estimation successfully converted to Job Order {job.order_id}',
                'job_order_id': job.id,
                'order_id': job.order_id
            }, status=status.HTTP_201_CREATED)



# -------------------------------------------------------------------------
# Quotation ViewSet
# -------------------------------------------------------------------------
class QuotationViewSet(viewsets.ModelViewSet):
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Quotation.objects.all().select_related(
            'customer', 'job_order', 'bank_account', 'converted_invoice', 'created_by'
        ).prefetch_related('items')
        user = self.request.user
        if not is_admin_user(user):
            qs = qs.filter(Q(created_by=user) | Q(customer__created_by=user))

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.lower() != 'all':
            qs = qs.filter(status__iexact=status_filter)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(quotation_date__gte=start_date)
        if end_date:
            qs = qs.filter(quotation_date__lte=end_date)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(quotation_number__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(reference_number__icontains=search) |
                Q(notes__icontains=search)
            )

        return qs.order_by('-quotation_date', '-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        staff_name = user.get_full_name() or user.username
        serializer.save(created_by=user, created_by_staff=staff_name)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        year = datetime.datetime.now().year
        prefix = f"QT-{year}-"
        existing = Quotation.objects.filter(quotation_number__startswith=prefix)
        nums = []
        for q in existing:
            try:
                nums.append(int(q.quotation_number.split('-')[-1]))
            except (ValueError, IndexError):
                pass
        seq = max(nums) + 1 if nums else 1
        return Response({'next_number': f"{prefix}{seq:04d}"})

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        from django.http import HttpResponse

        query_token = request.query_params.get('token')
        if query_token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(query_token)
                request.user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        quotation = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_quotation_pdf(quotation)
        c_name = quotation.customer.name if quotation.customer else (getattr(quotation, 'client_name', '') or 'Customer')
        filename = format_dynamic_filename('quotation', quotation.quotation_number, c_name)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


    @action(detail=True, methods=['post'], url_path='convert-to-invoice')
    def convert_to_invoice(self, request, pk=None):
        from django.db import transaction
        with transaction.atomic():
            quotation = Quotation.objects.select_for_update().filter(pk=pk).first()
            if not quotation:
                return Response({'detail': 'Quotation not found'}, status=status.HTTP_404_NOT_FOUND)

            if quotation.converted_invoice:
                return Response({
                    'detail': f'Quotation already converted to Invoice {quotation.converted_invoice.invoice_number}',
                    'invoice_id': quotation.converted_invoice.id,
                    'invoice_number': quotation.converted_invoice.invoice_number
                }, status=status.HTTP_400_BAD_REQUEST)

            year = datetime.datetime.now().year
            prefix = f"INV-{year}-"
            existing_invs = Invoice.objects.filter(invoice_number__startswith=prefix)
            nums = []
            for inv in existing_invs:
                try:
                    nums.append(int(inv.invoice_number.split('-')[-1]))
                except (ValueError, IndexError):
                    pass
            seq = max(nums) + 1 if nums else 1
            inv_num = f"{prefix}{seq:04d}"

            today = timezone.now().date()
            terms_days = {'Due on Receipt': 0, 'Net 15': 15, 'Net 30': 30, 'Net 45': 45, 'Net 60': 60}.get(quotation.payment_terms, 0)
            calc_due_date = today + datetime.timedelta(days=terms_days)

            invoice = Invoice.objects.create(
                invoice_number=inv_num,
                customer=quotation.customer,
                job_order=quotation.job_order,
                invoice_date=today,
                due_date=calc_due_date,
                payment_terms=quotation.payment_terms or 'Due on Receipt',
                status='Draft',
                reference_number=quotation.reference_number or f"From {quotation.quotation_number}",
                customer_tax_number=quotation.customer_tax_number,
                billing_address=quotation.billing_address,
                subtotal=quotation.subtotal,

                discount_amount=quotation.discount_amount,
                tax_rate=quotation.tax_rate,
                tax_amount=quotation.tax_amount,
                total_amount=quotation.total_amount,
                bank_account=quotation.bank_account,
                notes=quotation.notes,
                terms_conditions=quotation.terms_conditions,
                created_by=request.user,
                created_by_staff=request.user.get_full_name() or request.user.username,
                custom_fields=quotation.custom_fields or {}
            )

            for q_item in quotation.items.all():
                InvoiceItem.objects.create(
                    invoice=invoice,
                    description=q_item.description,
                    quantity=q_item.quantity,
                    unit=q_item.unit,
                    unit_price=q_item.unit_price,
                    discount_rate=q_item.discount_rate,
                    tax_rate=q_item.tax_rate,
                    tax_amount=q_item.tax_amount,
                    total=q_item.total,
                    sort_order=q_item.sort_order
                )

            quotation.converted_invoice = invoice
            quotation.status = 'Converted to Invoice'
            quotation.save(update_fields=['converted_invoice', 'status'])

            return Response({
                'success': True,
                'message': f'Quotation successfully converted to Invoice {invoice.invoice_number}',
                'invoice_id': invoice.id,
                'invoice_number': invoice.invoice_number
            }, status=status.HTTP_201_CREATED)


# -------------------------------------------------------------------------
# Credit Note ViewSet
# -------------------------------------------------------------------------
class CreditNoteViewSet(viewsets.ModelViewSet):
    serializer_class = CreditNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = CreditNote.objects.all().select_related(
            'customer', 'invoice', 'created_by'
        ).prefetch_related('items')
        user = self.request.user
        if not is_admin_user(user):
            qs = qs.filter(Q(created_by=user) | Q(customer__created_by=user))

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.lower() != 'all':
            qs = qs.filter(status__iexact=status_filter)

        reason_filter = self.request.query_params.get('reason')
        if reason_filter:
            qs = qs.filter(credit_reason=reason_filter)

        invoice_id = self.request.query_params.get('invoice')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(credit_note_date__gte=start_date)
        if end_date:
            qs = qs.filter(credit_note_date__lte=end_date)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(credit_note_number__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(reference_number__icontains=search) |
                Q(invoice__invoice_number__icontains=search) |
                Q(notes__icontains=search)
            )

        return qs.order_by('-credit_note_date', '-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        staff_name = user.get_full_name() or user.username
        serializer.save(created_by=user, created_by_staff=staff_name)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        year = datetime.datetime.now().year
        prefix = f"CN-{year}-"
        existing = CreditNote.objects.filter(credit_note_number__startswith=prefix)
        nums = []
        for cn in existing:
            try:
                nums.append(int(cn.credit_note_number.split('-')[-1]))
            except (ValueError, IndexError):
                pass
        seq = max(nums) + 1 if nums else 1
        return Response({'next_number': f"{prefix}{seq:04d}"})

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        from django.http import HttpResponse

        query_token = request.query_params.get('token')
        if query_token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(query_token)
                request.user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        credit_note = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_credit_note_pdf(credit_note)
        c_name = credit_note.customer.name if credit_note.customer else (getattr(credit_note, 'client_name', '') or 'Customer')
        filename = format_dynamic_filename('credit_note', credit_note.credit_note_number, c_name)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response



# -------------------------------------------------------------------------
# Delivery Note ViewSet
# -------------------------------------------------------------------------
class DeliveryNoteViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = DeliveryNote.objects.all().select_related(
            'customer', 'job_order', 'invoice', 'created_by'
        ).prefetch_related('items')
        user = self.request.user
        if not is_admin_user(user):
            qs = qs.filter(Q(created_by=user) | Q(customer__created_by=user))

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.lower() != 'all':
            qs = qs.filter(status__iexact=status_filter)

        job_order_id = self.request.query_params.get('job_order')
        if job_order_id:
            qs = qs.filter(job_order_id=job_order_id)

        invoice_id = self.request.query_params.get('invoice')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(delivery_date__gte=start_date)
        if end_date:
            qs = qs.filter(delivery_date__lte=end_date)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(delivery_note_number__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(driver_name__icontains=search) |
                Q(vehicle_number__icontains=search) |
                Q(receiver_name__icontains=search) |
                Q(tracking_number__icontains=search) |
                Q(customer_po_number__icontains=search) |
                Q(reference_number__icontains=search)
            )

        return qs.order_by('-delivery_date', '-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        staff_name = user.get_full_name() or user.username
        from django.db import transaction
        with transaction.atomic():
            dn_number = serializer.validated_data.get('delivery_note_number')
            if not dn_number:
                year = datetime.datetime.now().year
                prefix = f"DN-{year}-"
                existing = DeliveryNote.objects.select_for_update().filter(delivery_note_number__startswith=prefix)
                nums = []
                for dn in existing:
                    try:
                        nums.append(int(dn.delivery_note_number.split('-')[-1]))
                    except (ValueError, IndexError):
                        pass
                seq = max(nums) + 1 if nums else 1
                serializer.validated_data['delivery_note_number'] = f"{prefix}{seq:04d}"
            serializer.save(created_by=user, created_by_staff=staff_name)


    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        year = datetime.datetime.now().year
        prefix = f"DN-{year}-"
        existing = DeliveryNote.objects.filter(delivery_note_number__startswith=prefix)
        nums = []
        for dn in existing:
            try:
                nums.append(int(dn.delivery_note_number.split('-')[-1]))
            except (ValueError, IndexError):
                pass
        seq = max(nums) + 1 if nums else 1
        return Response({'next_number': f"{prefix}{seq:04d}"})


    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        from django.http import HttpResponse

        query_token = request.query_params.get('token')
        if query_token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(query_token)
                request.user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        delivery_note = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_delivery_note_pdf(delivery_note)
        c_name = delivery_note.customer.name if delivery_note.customer else (getattr(delivery_note, 'receiver_name', '') or 'Customer')
        filename = format_dynamic_filename('delivery_note', delivery_note.delivery_note_number, c_name)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response



class NotificationViewSet(viewsets.ModelViewSet):
    """
    Provides per-user notifications.
    GET  /api/notifications/                    — list my notifications
    POST /api/notifications/{id}/mark_read/     — mark one as read
    POST /api/notifications/mark_all_read/      — mark all as read
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user).order_by('-created_at')
        unread_only = self.request.query_params.get('unread_only')
        if unread_only == 'true':
            qs = qs.filter(is_read=False)
        return qs

    def list(self, request, *args, **kwargs):
        if request.query_params.get('nopage') == 'true' or request.query_params.get('unread_only') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        cnt = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': cnt})

    @action(detail=True, methods=['post'], url_path='mark_read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'detail': 'Marked as read.'})

    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All notifications marked as read.'})



class RecycleBinViewSet(viewsets.ModelViewSet):
    """
    Recycle Bin for deleted records across the entire ERP system.
    Users CANNOT permanently delete items from here.
    Supports viewing details, searching, filtering by entity type, and restoring items.
    """
    serializer_class = RecycleBinItemSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = RecycleBinItem.objects.all().select_related('deleted_by', 'restored_by')

        # Filter by entity type
        entity_type = self.request.query_params.get('entity_type')
        if entity_type and entity_type.lower() != 'all':
            if ',' in entity_type:
                qs = qs.filter(entity_type__in=[t.strip() for t in entity_type.split(',') if t.strip()])
            else:
                qs = qs.filter(entity_type=entity_type)

        # Filter by module (e.g. module=cashbook)
        module = self.request.query_params.get('module')
        if module == 'cashbook':
            qs = qs.filter(entity_type__in=['cashbook_entry', 'cashbook'])

        # Filter by restored status
        status_filter = self.request.query_params.get('status', 'active')
        if status_filter == 'active':
            qs = qs.filter(is_restored=False)
        elif status_filter == 'restored':
            qs = qs.filter(is_restored=True)

        # Search query
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            qs = qs.filter(
                Q(item_name__icontains=search) |
                Q(item_summary__icontains=search) |
                Q(deleted_by_name__icontains=search) |
                Q(entity_type__icontains=search)
            )

        return qs.order_by('-deleted_at')

    def destroy(self, request, *args, **kwargs):
        """
        Permanently purge an item from the Recycle Bin.
        """
        bin_item = self.get_object()
        item_name = bin_item.item_name
        bin_item.delete()
        return Response(
            {'success': True, 'message': f'"{item_name}" has been permanently purged.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Restore an item from the Recycle Bin back into its respective model.
        """
        bin_item = self.get_object()
        from .recycle_bin import restore_recycle_bin_item
        success, message = restore_recycle_bin_item(bin_item, user=request.user)
        if success:
            return Response({'success': True, 'message': message})
        else:
            return Response({'success': False, 'detail': message}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        Returns count breakdown by entity type for the Recycle Bin filter tabs.
        """
        qs = RecycleBinItem.objects.all()
        module = request.query_params.get('module')
        if module == 'cashbook':
            qs = qs.filter(entity_type__in=['cashbook_entry', 'cashbook'])

        total_active = qs.filter(is_restored=False).count()
        total_restored = qs.filter(is_restored=True).count()
        type_counts = {}
        for row in qs.filter(is_restored=False).values('entity_type').annotate(count=Count('id')):
            type_counts[row['entity_type']] = row['count']

        return Response({
            'total_active': total_active,
            'total_restored': total_restored,
            'by_type': type_counts
        })


class PendingJobOrderViewSet(viewsets.ModelViewSet):
    """
    CRUD and status management for rough Pending Job Order entries created from Cash In or Quick Log.
    """
    queryset = PendingJobOrder.objects.all().select_related('customer', 'vendor', 'created_by', 'cashbook_entry', 'converted_job')
    serializer_class = PendingJobOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)
        customer_id = self.request.query_params.get('customer')
        if customer_id and customer_id != 'all':
            qs = qs.filter(customer_id=customer_id)
        vendor_id = self.request.query_params.get('vendor')
        if vendor_id and vendor_id != 'all':
            qs = qs.filter(vendor_id=vendor_id)
        search_query = self.request.query_params.get('search')
        if search_query:
            qs = qs.filter(
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(customer__name__icontains=search_query) |
                Q(vendor__name__icontains=search_query)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='pending-count')
    def pending_count(self, request):
        count = PendingJobOrder.objects.filter(status='pending').count()
        return Response({'pending_count': count})

    @action(detail=True, methods=['post'], url_path='convert')
    def convert_to_job(self, request, pk=None):
        pending_obj = self.get_object()
        job_order_id = request.data.get('job_order_id')
        if not job_order_id:
            return Response({'error': 'job_order_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            job = JobOrder.objects.get(id=job_order_id)
        except JobOrder.DoesNotExist:
            return Response({'error': 'JobOrder not found'}, status=status.HTTP_404_NOT_FOUND)

        pending_obj.converted_job = job
        pending_obj.status = 'converted'
        pending_obj.save(update_fields=['converted_job', 'status'])

        # If there's a linked cashbook entry, link it to the newly created job
        if pending_obj.cashbook_entry:
            cb_entry = pending_obj.cashbook_entry
            cb_entry.job_order = job
            cb_entry.save(update_fields=['job_order'])
            if cb_entry.customer_payment:
                cp = cb_entry.customer_payment
                cp.job_order = job
                cp.save(update_fields=['job_order'])
            if cb_entry.vendor_payment:
                vp = cb_entry.vendor_payment
                vp.job_order = job
                vp.save(update_fields=['job_order'])

        return Response(self.get_serializer(pending_obj).data)


class SalespersonViewSet(viewsets.ModelViewSet):
    queryset = Salesperson.objects.all().order_by('name')
    serializer_class = SalespersonSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get('active_only')
        if active_only == 'true':
            qs = qs.filter(is_active=True)
        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search) | Q(email__icontains=search))
        return qs


class EnquiryViewSet(viewsets.ModelViewSet):
    queryset = Enquiry.objects.all().select_related('customer', 'salesperson', 'created_by', 'assigned_to', 'converted_job_order', 'converted_quotation').prefetch_related('follow_ups')
    serializer_class = EnquirySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        qp = self.request.query_params
        
        status_filter = qp.get('status')
        if status_filter:
            if status_filter == 'active':
                qs = qs.filter(status__in=['enquiry', 'quotation_pending', 'quotation_sent', 'under_followup'])
            elif status_filter in ['completed', 'converted']:
                qs = qs.filter(status='converted')
            elif status_filter in ['cancelled', 'lost']:
                qs = qs.filter(status='cancelled')
            else:
                qs = qs.filter(status=status_filter)

        channel = qp.get('channel')
        if channel and channel != 'all':
            qs = qs.filter(channel=channel)

        salesperson_id = qp.get('salesperson')
        if salesperson_id and salesperson_id != 'all':
            qs = qs.filter(salesperson_id=salesperson_id)

        outcome = qp.get('outcome')
        if outcome and outcome != 'all':
            latest_follow_up_outcome = EnquiryFollowUp.objects.filter(
                enquiry=OuterRef('pk')
            ).order_by('-id').values('outcome')[:1]
            qs = qs.annotate(latest_outcome=Subquery(latest_follow_up_outcome))
            if outcome == 'no_calls':
                qs = qs.filter(latest_outcome__isnull=True)
            else:
                qs = qs.filter(latest_outcome=outcome)

        follow_up_filter = qp.get('follow_up')
        today = timezone.localdate()
        if follow_up_filter == 'due_today':
            qs = qs.filter(status__in=['enquiry', 'quotation_pending', 'quotation_sent', 'under_followup'], next_follow_up_date=today)
        elif follow_up_filter == 'overdue':
            qs = qs.filter(status__in=['enquiry', 'quotation_pending', 'quotation_sent', 'under_followup'], next_follow_up_date__lt=today)
        elif follow_up_filter == 'pending':
            qs = qs.filter(status__in=['enquiry', 'quotation_pending', 'quotation_sent', 'under_followup'])

        search = qp.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(enquiry_number__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(salesperson__name__icontains=search) |
                Q(salesperson_name__icontains=search) |
                Q(phone__icontains=search) |
                Q(title__icontains=search) |
                Q(description__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        today = timezone.localdate()
        all_qs = Enquiry.objects.all()
        active_count = all_qs.filter(status__in=['enquiry', 'quotation_pending', 'quotation_sent', 'under_followup']).count()
        due_today_count = all_qs.filter(
            status__in=['enquiry', 'quotation_pending', 'quotation_sent', 'under_followup'],
            next_follow_up_date=today
        ).count()
        overdue_count = all_qs.filter(
            status__in=['enquiry', 'quotation_pending', 'quotation_sent', 'under_followup'],
            next_follow_up_date__lt=today
        ).count()
        converted_count = all_qs.filter(status='converted').count()
        cancelled_count = all_qs.filter(status='cancelled').count()
        total_closed = converted_count + cancelled_count
        conversion_rate = round((converted_count / total_closed * 100), 1) if total_closed > 0 else 0.0

        return Response({
            'active_count': active_count,
            'due_today_count': due_today_count,
            'overdue_count': overdue_count,
            'converted_count': converted_count,
            'cancelled_count': cancelled_count,
            'conversion_rate': conversion_rate,
        })

    @action(detail=True, methods=['post'], url_path='log-follow-up')
    def log_follow_up(self, request, pk=None):
        enquiry = self.get_object()
        data = request.data
        contact_mode = data.get('contact_mode', 'phone_call')
        outcome = data.get('outcome', 'interested')
        notes = data.get('notes', '')
        next_follow_up_date = data.get('next_follow_up_date') or None

        current_count = enquiry.follow_up_count + 1
        EnquiryFollowUp.objects.create(
            enquiry=enquiry,
            follow_up_number=current_count,
            contact_mode=contact_mode,
            outcome=outcome,
            notes=notes,
            next_follow_up_date=next_follow_up_date,
            created_by=request.user if request.user.is_authenticated else None
        )

        enquiry.follow_up_count = current_count
        enquiry.last_follow_up_date = timezone.localdate()
        if next_follow_up_date:
            enquiry.next_follow_up_date = next_follow_up_date
        
        # Status progression based on outcome
        if outcome == 'ready_to_close':
            enquiry.status = 'converted'
            enquiry.converted_at = timezone.now()
        elif outcome == 'not_interested':
            enquiry.status = 'cancelled'
            enquiry.cancellation_reason = data.get('cancellation_reason', 'other')
            enquiry.cancellation_notes = notes
        elif outcome == 'quotation_requested':
            enquiry.status = 'quotation_pending'
        else:
            if enquiry.status in ['enquiry', 'quotation_pending', 'quotation_sent']:
                enquiry.status = 'under_followup'

        enquiry.save()
        return Response(EnquirySerializer(enquiry).data)

    @action(detail=True, methods=['post'], url_path='mark-converted')
    def mark_converted(self, request, pk=None):
        enquiry = self.get_object()
        enquiry.status = 'converted'
        enquiry.converted_at = timezone.now()
        job_order_id = request.data.get('job_order_id')
        if job_order_id:
            try:
                enquiry.converted_job_order = JobOrder.objects.get(id=job_order_id)
            except JobOrder.DoesNotExist:
                pass
        quotation_id = request.data.get('quotation_id')
        if quotation_id:
            try:
                enquiry.converted_quotation = Quotation.objects.get(id=quotation_id)
            except Quotation.DoesNotExist:
                pass
        enquiry.save()
        return Response(EnquirySerializer(enquiry).data)

    @action(detail=True, methods=['post'], url_path='mark-cancelled')
    def mark_cancelled(self, request, pk=None):
        enquiry = self.get_object()
        enquiry.status = 'cancelled'
        enquiry.cancellation_reason = request.data.get('cancellation_reason', 'other')
        enquiry.cancellation_notes = request.data.get('cancellation_notes', '')
        enquiry.save()
        return Response(EnquirySerializer(enquiry).data)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        enquiry = self.get_object()
        enquiry.status = 'enquiry'
        enquiry.cancellation_reason = ''
        enquiry.cancellation_notes = ''
        enquiry.save()
        return Response(EnquirySerializer(enquiry).data)

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        from .pdf_generator import universal_pdf_generator, format_dynamic_filename
        from django.http import HttpResponse

        query_token = request.query_params.get('token')
        if query_token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(query_token)
                request.user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        enquiry = self.get_object()
        pdf_bytes = universal_pdf_generator.generate_enquiry_pdf(enquiry)
        c_name = enquiry.customer.name if enquiry.customer else (enquiry.customer_name or 'Prospect')
        filename = format_dynamic_filename('enquiry', enquiry.enquiry_number, c_name)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response



