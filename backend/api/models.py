from django.db import models
from django.conf import settings
from django.utils import timezone

class Customer(models.Model):
    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    address = models.TextField(blank=True, default='')
    payable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Amount owed by company to this customer")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='customers')
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def company(self):
        return self.company_name

    @company.setter
    def company(self, value):
        self.company_name = value

    def __str__(self):
        return self.name

class Vendor(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    company = models.CharField(max_length=255, blank=True)
    business_group = models.CharField(max_length=255, blank=True, default='General')
    address = models.TextField(blank=True)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendors')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class JobOrder(models.Model):
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    )
    PAYMENT_TYPE_CHOICES = (
        ('advance', 'Advance'),
        ('installment', 'Installment'),
        ('full', 'Full Payment'),
    )
    order_id = models.CharField(max_length=20, blank=True, null=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='job_orders')
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='job_orders')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    # 4.3 — Credit tracking fields
    advance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00,
        help_text="Cash received upfront at job creation (e.g. 2,000 of 10,000 job)")
    prior_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00,
        help_text="Carried-forward outstanding balance from previous jobs for this customer")
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='full',
        help_text="How the customer intends to pay: advance, installment, or full")
    invoice_number = models.CharField(max_length=100, blank=True, null=True)
    quotation_number = models.CharField(max_length=100, blank=True, null=True)
    project_name = models.CharField(max_length=255, blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='job_orders')
    created_by_staff = models.CharField(max_length=255, blank=True, null=True)
    payment_collected_by = models.CharField(max_length=255, blank=True, null=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    
    # ── Assignment & Delegation Fields ──
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_job_orders', help_text="Administrator assigned to review and manage this job order")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='delegated_job_orders', help_text="Staff member who created and delegated the job order")
    assignment_status = models.CharField(max_length=30, choices=(('unassigned', 'Unassigned'), ('pending', 'Pending Acceptance'), ('accepted', 'Accepted'), ('rejected', 'Rejected')), default='unassigned', db_index=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    original_creator_name = models.CharField(max_length=255, blank=True, null=True, help_text="Historical record of staff creator name retained after acceptance")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.order_id or ''} {self.title} - {self.customer.name}"

class PendingJobOrder(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Approval / Creation'),
        ('converted', 'Converted to Job Order'),
        ('cancelled', 'Cancelled'),
    )
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, null=True, blank=True, related_name='pending_job_orders')
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, null=True, blank=True, related_name='pending_job_orders')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    estimated_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True)
    initial_deposit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True)
    cashbook_entry = models.ForeignKey('CashBookEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_job_orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    converted_job = models.ForeignKey('JobOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='source_pending_entries')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_job_orders')
    attachment = models.TextField(blank=True, default='')
    attachment_name = models.CharField(max_length=255, blank=True, default='')
    attachment_type = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        party = self.customer.name if self.customer else (self.vendor.name if self.vendor else 'No Party')
        return f"Pending Job: {self.title} ({party})"

class Invoice(models.Model):
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Issued', 'Issued'),
        ('Partially Paid', 'Partially Paid'),
        ('Paid', 'Paid'),
        ('Overdue', 'Overdue'),
        ('Cancelled', 'Cancelled'),
    )
    PAYMENT_TERMS_CHOICES = (
        ('Due on Receipt', 'Due on Receipt'),
        ('Net 15', 'Net 15'),
        ('Net 30', 'Net 30'),
        ('Net 45', 'Net 45'),
        ('Net 60', 'Net 60'),
        ('Custom', 'Custom'),
    )
    invoice_number = models.CharField(max_length=100, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='invoices')
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    invoice_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)
    supply_date = models.DateField(null=True, blank=True)
    payment_terms = models.CharField(max_length=50, choices=PAYMENT_TERMS_CHOICES, default='Due on Receipt')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Issued')
    
    reference_number = models.CharField(max_length=100, blank=True, default='')
    customer_tax_number = models.CharField(max_length=100, blank=True, default='')
    billing_address = models.TextField(blank=True, default='')
    
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    
    bank_account = models.ForeignKey('BankAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    notes = models.TextField(blank=True, default='')
    terms_conditions = models.TextField(blank=True, default='')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    created_by_staff = models.CharField(max_length=255, blank=True, default='')
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-invoice_date', '-created_at']

    def __str__(self):
        return f"{self.invoice_number} - {self.customer.name} ({self.total_amount})"

class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1.00)
    unit = models.CharField(max_length=50, blank=True, default='Unit')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.description} ({self.quantity} x {self.unit_price})"

class CustomerPayment(models.Model):
    PAYMENT_TYPE_CHOICES = (
        ('advance', 'Advance'),
        ('installment', 'Installment'),
        ('final', 'Final Payment'),
        ('credit_note', 'Credit Note'),
        ('refund', 'Customer Refund / Debit Payout'),
    )
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='payments')
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, related_name='customer_payments', null=True, blank=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField()
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='installment',
        help_text="Classification of this payment: advance, installment, final, or credit_note")
    notes = models.TextField(blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_payments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.amount} by {self.customer.name} ({self.get_payment_type_display()})"

class VendorPayment(models.Model):
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='payments')
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, related_name='vendor_payments', null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField()
    notes = models.TextField(blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_payments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.amount} to {self.vendor.name}"

class ExpenseCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class ExpenseType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Expense(models.Model):
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    category = models.CharField(max_length=100, blank=True)
    type = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    is_opening_balance = models.BooleanField(default=False)
    custom_fields = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.description} - {self.amount}"

class SiteSettings(models.Model):
    company_name = models.CharField(max_length=255, default='Arab Season')
    email = models.EmailField(default='ad@arabseason.net')
    phone = models.CharField(max_length=50, default='+965 57 5287 403')
    address = models.TextField(default='Saudi Arabia, Alsalihia Dist')
    currency = models.CharField(max_length=10, default='SAR')
    timezone = models.CharField(max_length=50, default='GST')
    date_format = models.CharField(max_length=50, default='DD/MM/YYYY')
    cr_number = models.CharField(max_length=100, blank=True, default='')
    tax_number = models.CharField(max_length=100, blank=True, default='')
    
    def __str__(self):
        return "Site Settings"

class Labour(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
    )
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='labours')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True, default='')
    work_done = models.TextField(blank=True, default='')
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00) # Total amount agreed
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00) # Paid amount so far
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='labours')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='labours')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.name} - {self.work_done[:30] if self.work_done else 'Labour'}"

class PaymentRequest(models.Model):
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    )
    title = models.CharField(max_length=255)
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='payment_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True)
    requested_by = models.CharField(max_length=255)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    admin_note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='payment_requests')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Request {self.title} - {self.status}"

class ExcludedJobTitle(models.Model):
    title = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class PlanningTool(models.Model):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class PlanningWorker(models.Model):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class ProjectPlan(models.Model):
    STATUS_CHOICES = (
        ('Planned', 'Planned'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('On Hold', 'On Hold'),
    )
    title = models.CharField(max_length=255)
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='project_plans')
    description = models.TextField(blank=True)
    tools = models.JSONField(default=list, blank=True)
    workers = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Planned')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='project_plans')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

class SalaryPayment(models.Model):
    staff_name = models.CharField(max_length=255)
    paid_month = models.CharField(max_length=50)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    overtime_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount = models.DecimalField(max_digits=12, decimal_places=2)  # Amount Paid
    payment_date = models.DateField()
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='salary_payments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"{self.staff_name} - {self.paid_month}: {self.amount}"

class CashBook(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default='SAR')
    color = models.CharField(max_length=50, default='#3b82f6')
    icon = models.CharField(max_length=50, default='book')
    is_archived = models.BooleanField(default=False)
    linked_year = models.IntegerField(null=True, blank=True, default=None)
    linked_months = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbooks')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

class CashBookEntry(models.Model):
    ENTRY_TYPE_CHOICES = (
        ('in', 'Cash In'),
        ('out', 'Cash Out'),
    )
    cashbook = models.ForeignKey(CashBook, on_delete=models.SET_NULL, null=True, blank=True, related_name='entries')
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(default=timezone.now)
    time = models.TimeField(null=True, blank=True)
    category = models.CharField(max_length=100, blank=True)
    remark = models.TextField(blank=True)
    party_name = models.CharField(max_length=255, blank=True)
    payment_mode = models.CharField(max_length=50, default='Petty Cash')
    transaction_type = models.CharField(max_length=50, default='Petty Cash', blank=True)
    bank_account = models.ForeignKey('BankAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    bank_account_name = models.CharField(max_length=255, blank=True, default='')
    petty_cash_account = models.ForeignKey('PettyCashAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    petty_cash_account_name = models.CharField(max_length=255, blank=True, default='')
    APPROVAL_STATUS_CHOICES = (
        ('approved', 'Approved'),
        ('pending', 'Pending Approval'),
        ('rejected', 'Rejected'),
    )
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='approved')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_cashbook_entries')
    approved_at = models.DateTimeField(null=True, blank=True)
    vendor = models.ForeignKey('Vendor', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    vendor_payment = models.ForeignKey('VendorPayment', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    customer = models.ForeignKey('Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    job_order = models.ForeignKey('JobOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    pending_job_order = models.ForeignKey('PendingJobOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    customer_payment = models.ForeignKey('CustomerPayment', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    debit_type = models.CharField(max_length=50, blank=True, default='')
    staff_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='salary_cashbook_entries')
    staff_name = models.CharField(max_length=255, blank=True, default='')
    paid_month = models.CharField(max_length=50, blank=True, default='')
    salary_payment = models.ForeignKey('SalaryPayment', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    expense = models.ForeignKey('Expense', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    labour = models.ForeignKey('Labour', on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    reference_number = models.CharField(max_length=100, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='cashbook_entries')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        cb_name = self.cashbook.name if self.cashbook else "Cash Ledger"
        return f"{self.entry_type.upper()} {self.amount} ({cb_name})"


class StaffTimesheet(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='timesheets')
    staff_name = models.CharField(max_length=255)
    date = models.DateField()
    in_time = models.CharField(max_length=50, blank=True, default='')
    lunch_time = models.CharField(max_length=50, blank=True, default='')
    out_time = models.CharField(max_length=50, blank=True, default='')
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    overtime_text = models.CharField(max_length=50, blank=True, default='')
    ot_details = models.TextField(blank=True, default='')
    is_off_day = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_timesheets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'created_at', 'id']

    def __str__(self):
        return f"{self.staff_name} - {self.date}"


class BankAccount(models.Model):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    bank_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=100)
    account_holder_name = models.CharField(max_length=255, blank=True, default='')
    iban = models.CharField(max_length=100, blank=True, default='')
    branch_name = models.CharField(max_length=255, blank=True, default='')
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default='SAR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_accounts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.bank_name} - {self.account_number} ({self.balance} {self.currency})"


class PettyCashAccount(models.Model):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )
    name = models.CharField(max_length=255)
    holder_name = models.CharField(max_length=255, blank=True, default='')
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default='SAR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    notes = models.TextField(blank=True, default='')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_petty_cash_accounts')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='petty_cash_accounts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.balance} {self.currency})"


class CustomFormField(models.Model):
    FORM_TYPE_CHOICES = (
        ('job_order', 'Job Order'),
        ('customer_payment', 'Customer Payment'),
        ('invoice', 'Invoice'),
        ('expense', 'Expense'),
        ('customer', 'Customer'),
        ('estimation', 'Estimation'),
        ('cashbook', 'Cashbook'),
        ('quotation', 'Quotation'),
        ('credit_note', 'Credit Note'),
        ('delivery_note', 'Delivery Note'),
    )
    FIELD_TYPE_CHOICES = (
        ('text', 'Text'),
        ('number', 'Number'),
        ('date', 'Date'),
        ('dropdown', 'Dropdown / Select'),
        ('textarea', 'Text Area'),
        ('checkbox', 'Checkbox / Yes-No'),
    )
    form_type = models.CharField(max_length=50, choices=FORM_TYPE_CHOICES)
    label = models.CharField(max_length=255)
    name = models.CharField(max_length=100)  # Slug / identifier key (e.g. site_supervisor)
    field_type = models.CharField(max_length=50, choices=FIELD_TYPE_CHOICES, default='text')
    placeholder = models.CharField(max_length=255, blank=True, default='')
    options = models.JSONField(default=list, blank=True)  # List of string options for dropdown
    default_value = models.CharField(max_length=255, blank=True, default='')
    is_required = models.BooleanField(default=False)
    show_in_table = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']
        unique_together = ('form_type', 'name')

    def __str__(self):
        return f"{self.get_form_type_display()}: {self.label} ({self.name})"


class MaterialCategory(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, default='')
    color = models.CharField(max_length=50, blank=True, default='#2563eb')
    icon = models.CharField(max_length=50, blank=True, default='Layers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Material Categories'

    def __str__(self):
        return self.name


class Material(models.Model):
    CALC_CHOICES = (
        ('unit', 'Unit Based (Qty × Price)'),
        ('area', 'Area Based (Width × Height × Qty × Sq.m Price)'),
        ('fixed', 'Fixed / Flat Rate'),
    )
    name = models.CharField(max_length=255)
    category = models.ForeignKey(MaterialCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='materials')
    measurements = models.CharField(max_length=255, blank=True, default='')
    unit = models.CharField(max_length=50, default='pcs')
    customer_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    calculation_type = models.CharField(max_length=50, choices=CALC_CHOICES, default='unit')
    shop_prices = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_materials')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category__name', 'name']

    def __str__(self):
        return f"{self.name} ({self.measurements})" if self.measurements else self.name

    @property
    def lowest_shop_price(self):
        if not self.shop_prices or not isinstance(self.shop_prices, list):
            return None
        valid = []
        for p in self.shop_prices:
            if isinstance(p, dict):
                try:
                    price_val = p.get('price')
                    if price_val is not None:
                        num = float(price_val)
                        if num > 0:
                            valid.append(num)
                except (ValueError, TypeError):
                    pass
            elif isinstance(p, (int, float)) and p > 0:
                valid.append(float(p))
            elif isinstance(p, str):
                try:
                    num = float(p.strip())
                    if num > 0:
                        valid.append(num)
                except (ValueError, TypeError):
                    pass
        return min(valid) if valid else None



class Estimation(models.Model):
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Sent', 'Sent to Client'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Converted to Job', 'Converted to Job'),
    )
    estimate_number = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=255)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='estimations')
    client_name = models.CharField(max_length=255, blank=True, default='')
    client_contact = models.CharField(max_length=255, blank=True, default='')
    date = models.DateField(default=timezone.now)
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Draft')
    sections_list = models.JSONField(default=list, blank=True)
    calculation_settings = models.JSONField(default=dict, blank=True)
    subtotal_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    subtotal_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    margin_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    margin_percentage = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True, default='')
    converted_job = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='source_estimations')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_estimations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.estimate_number} - {self.title}"


class EstimationItem(models.Model):
    estimation = models.ForeignKey(Estimation, on_delete=models.CASCADE, related_name='items')
    material = models.ForeignKey(Material, on_delete=models.SET_NULL, null=True, blank=True, related_name='estimation_items')
    section_name = models.CharField(max_length=255, blank=True, default='General')
    item_name = models.CharField(max_length=255)
    measurements = models.CharField(max_length=255, blank=True, default='')
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1.00)
    unit = models.CharField(max_length=50, default='pcs')
    calculation_type = models.CharField(max_length=50, default='unit')
    width = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, blank=True)
    height = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, blank=True)
    selected_shop_name = models.CharField(max_length=255, blank=True, default='')
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    margin = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True, default='')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['section_name', 'sort_order', 'id']

    def __str__(self):
        return f"{self.item_name} (x{self.quantity})"


class Quotation(models.Model):
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Sent', 'Sent'),
        ('Accepted', 'Accepted'),
        ('Declined', 'Declined'),
        ('Converted to Invoice', 'Converted to Invoice'),
        ('Expired', 'Expired'),
    )
    PAYMENT_TERMS_CHOICES = (
        ('Due on Receipt', 'Due on Receipt'),
        ('Net 15', 'Net 15'),
        ('Net 30', 'Net 30'),
        ('Net 45', 'Net 45'),
        ('Net 60', 'Net 60'),
        ('Custom', 'Custom'),
    )
    quotation_number = models.CharField(max_length=100, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='quotations')
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotations')
    
    quotation_date = models.DateField(default=timezone.localdate)
    valid_until = models.DateField(null=True, blank=True)
    payment_terms = models.CharField(max_length=50, choices=PAYMENT_TERMS_CHOICES, default='Due on Receipt')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Draft')
    
    reference_number = models.CharField(max_length=100, blank=True, default='')
    customer_tax_number = models.CharField(max_length=100, blank=True, default='')
    billing_address = models.TextField(blank=True, default='')
    
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    
    bank_account = models.ForeignKey('BankAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='quotations')
    notes = models.TextField(blank=True, default='')
    terms_conditions = models.TextField(blank=True, default='')
    
    converted_invoice = models.ForeignKey('Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='source_quotations')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotations')
    created_by_staff = models.CharField(max_length=255, blank=True, default='')
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-quotation_date', '-created_at']

    def __str__(self):
        return f"{self.quotation_number} - {self.customer.name} ({self.total_amount})"


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1.00)
    unit = models.CharField(max_length=50, blank=True, default='Unit')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.description} ({self.quantity} x {self.unit_price})"


class CreditNote(models.Model):
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Issued', 'Issued'),
        ('Applied', 'Applied'),
        ('Refunded', 'Refunded'),
        ('Cancelled', 'Cancelled'),
    )
    REASON_CHOICES = (
        ('Sales Return', 'Sales Return'),
        ('Overbilled / Pricing Error', 'Overbilled / Pricing Error'),
        ('Defective / Damaged Goods', 'Defective / Damaged Goods'),
        ('Service Cancellation', 'Service Cancellation'),
        ('Goodwill / Rebate', 'Goodwill / Rebate'),
        ('Other', 'Other'),
    )
    credit_note_number = models.CharField(max_length=100, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='credit_notes')
    invoice = models.ForeignKey('Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='credit_notes')
    
    credit_note_date = models.DateField(default=timezone.localdate)
    credit_reason = models.CharField(max_length=100, choices=REASON_CHOICES, default='Sales Return')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Issued')
    
    reference_number = models.CharField(max_length=100, blank=True, default='')
    customer_tax_number = models.CharField(max_length=100, blank=True, default='')
    billing_address = models.TextField(blank=True, default='')
    
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    
    notes = models.TextField(blank=True, default='')
    terms_conditions = models.TextField(blank=True, default='')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='credit_notes')
    created_by_staff = models.CharField(max_length=255, blank=True, default='')
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-credit_note_date', '-created_at']

    def __str__(self):
        return f"{self.credit_note_number} - {self.customer.name} ({self.total_amount})"


class CreditNoteItem(models.Model):
    credit_note = models.ForeignKey(CreditNote, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1.00)
    unit = models.CharField(max_length=50, blank=True, default='Unit')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.description} ({self.quantity} x {self.unit_price})"


class DeliveryNote(models.Model):
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Dispatched', 'Dispatched'),
        ('In Transit', 'In Transit'),
        ('Delivered', 'Delivered'),
        ('Signed & Returned', 'Signed & Returned'),
        ('Cancelled', 'Cancelled'),
    )
    delivery_note_number = models.CharField(max_length=100, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='delivery_notes')
    job_order = models.ForeignKey(JobOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_notes')
    invoice = models.ForeignKey('Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_notes')
    
    delivery_date = models.DateField(default=timezone.localdate)
    dispatch_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Delivered')
    
    delivery_address = models.TextField(blank=True, default='')
    shipping_method = models.CharField(max_length=100, blank=True, default='')
    driver_name = models.CharField(max_length=255, blank=True, default='')
    driver_phone = models.CharField(max_length=50, blank=True, default='')
    vehicle_number = models.CharField(max_length=100, blank=True, default='')
    tracking_number = models.CharField(max_length=100, blank=True, default='')
    
    receiver_name = models.CharField(max_length=255, blank=True, default='')
    receiver_phone = models.CharField(max_length=50, blank=True, default='')
    customer_po_number = models.CharField(max_length=100, blank=True, default='')
    reference_number = models.CharField(max_length=100, blank=True, default='')
    
    show_prices = models.BooleanField(default=False)
    total_packages = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default='')
    terms_conditions = models.TextField(blank=True, default='')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_notes')
    created_by_staff = models.CharField(max_length=255, blank=True, default='')
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-delivery_date', '-created_at']

    def __str__(self):
        return f"{self.delivery_note_number} - {self.customer.name}"


class DeliveryNoteItem(models.Model):
    delivery_note = models.ForeignKey(DeliveryNote, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1.00)
    unit = models.CharField(max_length=50, blank=True, default='Unit')
    packages_count = models.CharField(max_length=100, blank=True, default='')
    package_type = models.CharField(max_length=100, blank=True, default='')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, blank=True)
    remarks = models.CharField(max_length=255, blank=True, default='')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.description} ({self.quantity} {self.unit})"


class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications')
    notification_type = models.CharField(max_length=50, default='general')
    title = models.CharField(max_length=255)
    message = models.TextField()
    action_type = models.CharField(max_length=50, blank=True, default='')
    action_data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    action_taken = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.notification_type}: {self.title} -> {self.recipient.username}"


class RecycleBinItem(models.Model):
    ENTITY_TYPE_CHOICES = (
        ('cashbook_entry', 'Cashbook Transaction'),
        ('cashbook', 'Cash Book'),
        ('job_order', 'Job Order'),
        ('customer', 'Customer'),
        ('vendor', 'Vendor'),
        ('expense', 'Expense'),
        ('customer_payment', 'Customer Payment'),
        ('vendor_payment', 'Vendor Payment'),
        ('payment_request', 'Payment Request'),
        ('salary_payment', 'Salary Payment'),
        ('invoice', 'Invoice'),
        ('quotation', 'Quotation'),
        ('credit_note', 'Credit Note'),
        ('delivery_note', 'Delivery Note'),
        ('estimation', 'Estimation'),
        ('labour', 'Labour'),
        ('material', 'Material'),
        ('bank_account', 'Bank Account'),
        ('petty_cash', 'Petty Cash Account'),
        ('staff_timesheet', 'Staff Timesheet'),
        ('project_plan', 'Project Plan'),
        ('other', 'Other Record'),
    )

    entity_type = models.CharField(max_length=50, choices=ENTITY_TYPE_CHOICES, default='other')
    model_name = models.CharField(max_length=100)
    original_id = models.IntegerField(null=True, blank=True)
    item_name = models.CharField(max_length=255)
    item_summary = models.TextField(blank=True, default='')
    item_data = models.JSONField(default=dict)

    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_recycle_items')
    deleted_by_name = models.CharField(max_length=255, blank=True, default='')
    deleted_at = models.DateTimeField(auto_now_add=True)

    can_restore = models.BooleanField(default=True)
    is_restored = models.BooleanField(default=False)
    restored_at = models.DateTimeField(null=True, blank=True)
    restored_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    restored_by_name = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['-deleted_at']
        indexes = [
            models.Index(fields=['entity_type', 'is_restored']),
            models.Index(fields=['-deleted_at']),
        ]

    def __str__(self):
        return f"{self.get_entity_type_display()}: {self.item_name} ({'Restored' if self.is_restored else 'In Bin'})"

