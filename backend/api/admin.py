from django.contrib import admin
from .models import (
    Customer, Vendor, JobOrder, CustomerPayment, VendorPayment,
    ExpenseCategory, ExpenseType, Expense, SiteSettings, Labour, PaymentRequest,
    SalaryPayment, CashBook, CashBookEntry, StaffTimesheet, BankAccount, PettyCashAccount,
    Invoice, InvoiceItem, CustomFormField,
    MaterialCategory, Material, Estimation, EstimationItem,
    Quotation, QuotationItem, CreditNote, CreditNoteItem, DeliveryNote, DeliveryNoteItem
)

@admin.register(JobOrder)
class JobOrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'title', 'customer', 'status', 'total_amount', 'created_at')
    search_fields = ('order_id', 'title')

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'customer', 'invoice_date', 'due_date', 'total_amount', 'status')
    list_filter = ('status', 'invoice_date')
    search_fields = ('invoice_number', 'customer__name', 'reference_number')
    inlines = [InvoiceItemInline]

class EstimationItemInline(admin.TabularInline):
    model = EstimationItem
    extra = 1

@admin.register(Estimation)
class EstimationAdmin(admin.ModelAdmin):
    list_display = ('estimate_number', 'title', 'client_name', 'date', 'status', 'total_price', 'margin_amount')
    list_filter = ('status', 'date')
    search_fields = ('estimate_number', 'title', 'client_name')
    inlines = [EstimationItemInline]

@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'measurements', 'unit', 'customer_price')
    list_filter = ('category', 'unit')
    search_fields = ('name', 'measurements')

admin.site.register(MaterialCategory)
admin.site.register(Customer)
admin.site.register(Vendor)
admin.site.register(CustomerPayment)
admin.site.register(VendorPayment)
admin.site.register(ExpenseCategory)
admin.site.register(ExpenseType)
admin.site.register(Expense)
admin.site.register(SiteSettings)
admin.site.register(Labour)
admin.site.register(PaymentRequest)
admin.site.register(SalaryPayment)
admin.site.register(CashBook)
admin.site.register(CashBookEntry)
admin.site.register(StaffTimesheet)
admin.site.register(BankAccount)
admin.site.register(PettyCashAccount)
admin.site.register(CustomFormField)


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1

@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ('quotation_number', 'customer', 'quotation_date', 'valid_until', 'total_amount', 'status')
    list_filter = ('status', 'quotation_date')
    search_fields = ('quotation_number', 'customer__name', 'reference_number')
    inlines = [QuotationItemInline]


class CreditNoteItemInline(admin.TabularInline):
    model = CreditNoteItem
    extra = 1

@admin.register(CreditNote)
class CreditNoteAdmin(admin.ModelAdmin):
    list_display = ('credit_note_number', 'customer', 'invoice', 'credit_note_date', 'credit_reason', 'total_amount', 'status')
    list_filter = ('status', 'credit_reason', 'credit_note_date')
    search_fields = ('credit_note_number', 'customer__name', 'reference_number')
    inlines = [CreditNoteItemInline]


class DeliveryNoteItemInline(admin.TabularInline):
    model = DeliveryNoteItem
    extra = 1

@admin.register(DeliveryNote)
class DeliveryNoteAdmin(admin.ModelAdmin):
    list_display = ('delivery_note_number', 'customer', 'delivery_date', 'driver_name', 'vehicle_number', 'status')
    list_filter = ('status', 'delivery_date')
    search_fields = ('delivery_note_number', 'customer__name', 'driver_name', 'receiver_name')
    inlines = [DeliveryNoteItemInline]



