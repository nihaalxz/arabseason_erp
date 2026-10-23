from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerViewSet, VendorViewSet, JobOrderViewSet, PendingJobOrderViewSet,
    CustomerPaymentViewSet, VendorPaymentViewSet, ExpenseViewSet,
    DashboardAPIView, ReportAPIView, SettingsAPIView, ChangePasswordView,
    LabourViewSet, PaymentRequestViewSet, ExpenseCategoryViewSet, ExpenseTypeViewSet,
    ProjectPlanViewSet, PlanningToolViewSet, PlanningWorkerViewSet, SalaryPaymentViewSet,
    CashBookViewSet, CashBookEntryViewSet, StaffTimesheetViewSet, BankAccountViewSet,
    InvoiceViewSet, CustomFormFieldViewSet,
    MaterialCategoryViewSet, MaterialViewSet, EstimationViewSet,
    PettyCashAccountViewSet,
    QuotationViewSet, CreditNoteViewSet, DeliveryNoteViewSet,
    NotificationViewSet, RecycleBinViewSet, EnquiryViewSet
)

router = DefaultRouter()
router.register(r'enquiries', EnquiryViewSet, basename='enquiries')
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'vendors', VendorViewSet, basename='vendors')
router.register(r'job-orders', JobOrderViewSet, basename='job-orders')
router.register(r'pending-job-orders', PendingJobOrderViewSet, basename='pending-job-orders')
router.register(r'invoices', InvoiceViewSet, basename='invoices')
router.register(r'quotations', QuotationViewSet, basename='quotations')
router.register(r'credit-notes', CreditNoteViewSet, basename='credit-notes')
router.register(r'delivery-notes', DeliveryNoteViewSet, basename='delivery-notes')
router.register(r'material-categories', MaterialCategoryViewSet, basename='material-categories')
router.register(r'materials', MaterialViewSet, basename='materials')
router.register(r'estimations', EstimationViewSet, basename='estimations')
router.register(r'customer-payments', CustomerPaymentViewSet, basename='customer-payments')
router.register(r'vendor-payments', VendorPaymentViewSet, basename='vendor-payments')
router.register(r'expenses', ExpenseViewSet, basename='expenses')
router.register(r'labours', LabourViewSet, basename='labours')
router.register(r'payment-requests', PaymentRequestViewSet, basename='payment-requests')
router.register(r'expense-categories', ExpenseCategoryViewSet, basename='expense-categories')
router.register(r'expense-types', ExpenseTypeViewSet, basename='expense-types')
router.register(r'project-plans', ProjectPlanViewSet, basename='project-plans')
router.register(r'planning-tools', PlanningToolViewSet, basename='planning-tools')
router.register(r'planning-workers', PlanningWorkerViewSet, basename='planning-workers')
router.register(r'salaries', SalaryPaymentViewSet, basename='salaries')
router.register(r'cashbooks', CashBookViewSet, basename='cashbooks')
router.register(r'cashbook-entries', CashBookEntryViewSet, basename='cashbook-entries')
router.register(r'timesheets', StaffTimesheetViewSet, basename='timesheets')
router.register(r'staff-timesheets', StaffTimesheetViewSet, basename='staff-timesheets')
router.register(r'banks', BankAccountViewSet, basename='banks')
router.register(r'petty-cash-accounts', PettyCashAccountViewSet, basename='petty-cash-accounts')
router.register(r'custom-fields', CustomFormFieldViewSet, basename='custom-fields')
router.register(r'notifications', NotificationViewSet, basename='notifications')
router.register(r'recycle-bin', RecycleBinViewSet, basename='recycle-bin')

urlpatterns = [
    path('dashboard/', DashboardAPIView.as_view(), name='dashboard'),
    path('reports/', ReportAPIView.as_view(), name='reports'),
    path('settings/', SettingsAPIView.as_view(), name='settings'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('', include(router.urls)),
]
