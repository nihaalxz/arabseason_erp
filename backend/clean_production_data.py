import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from api.models import (
    Customer, Vendor, JobOrder, CustomerPayment, VendorPayment,
    Expense, SiteSettings, ExcludedJobTitle, PlanningTool, PlanningWorker,
    ProjectPlan, SalaryPayment, CashBook, CashBookEntry, StaffTimesheet,
    BankAccount, Labour, PaymentRequest,
    Invoice, InvoiceItem, Quotation, QuotationItem, CreditNote, CreditNoteItem,
    DeliveryNote, DeliveryNoteItem, Estimation, EstimationItem,
    PettyCashAccount, Notification, RecycleBinItem
)

User = get_user_model()

def clean_database():
    print("==================================================")
    print("STARTING DATABASE CLEANUP FOR PRODUCTION")
    print("==================================================")

    # 1. Clear operational transaction and activity data
    rb_deleted = RecycleBinItem.objects.all().delete()[0]
    print(f"[-] Deleted {rb_deleted} RecycleBinItem records.")

    notifs_deleted = Notification.objects.all().delete()[0]
    print(f"[-] Deleted {notifs_deleted} Notification records.")

    deliv_deleted = DeliveryNote.objects.all().delete()[0]
    print(f"[-] Deleted {deliv_deleted} DeliveryNote records.")

    cn_deleted = CreditNote.objects.all().delete()[0]
    print(f"[-] Deleted {cn_deleted} CreditNote records.")

    inv_deleted = Invoice.objects.all().delete()[0]
    print(f"[-] Deleted {inv_deleted} Invoice records.")

    quot_deleted = Quotation.objects.all().delete()[0]
    print(f"[-] Deleted {quot_deleted} Quotation records.")

    est_deleted = Estimation.objects.all().delete()[0]
    print(f"[-] Deleted {est_deleted} Estimation records.")

    timesheets_deleted = StaffTimesheet.objects.all().delete()[0]
    print(f"[-] Deleted {timesheets_deleted} StaffTimesheet records.")

    salaries_deleted = SalaryPayment.objects.all().delete()[0]
    print(f"[-] Deleted {salaries_deleted} SalaryPayment records.")

    cash_entries_deleted = CashBookEntry.objects.all().delete()[0]
    print(f"[-] Deleted {cash_entries_deleted} CashBookEntry records.")

    cashbooks_deleted = CashBook.objects.all().delete()[0]
    print(f"[-] Deleted {cashbooks_deleted} CashBook records.")

    cust_payments_deleted = CustomerPayment.objects.all().delete()[0]
    print(f"[-] Deleted {cust_payments_deleted} CustomerPayment records.")

    vendor_payments_deleted = VendorPayment.objects.all().delete()[0]
    print(f"[-] Deleted {vendor_payments_deleted} VendorPayment records.")

    payment_requests_deleted = PaymentRequest.objects.all().delete()[0]
    print(f"[-] Deleted {payment_requests_deleted} PaymentRequest records.")

    labour_deleted = Labour.objects.all().delete()[0]
    print(f"[-] Deleted {labour_deleted} Labour records.")

    expenses_deleted = Expense.objects.all().delete()[0]
    print(f"[-] Deleted {expenses_deleted} Expense records.")

    project_plans_deleted = ProjectPlan.objects.all().delete()[0]
    print(f"[-] Deleted {project_plans_deleted} ProjectPlan records.")

    job_orders_deleted = JobOrder.objects.all().delete()[0]
    print(f"[-] Deleted {job_orders_deleted} JobOrder records.")

    customers_deleted = Customer.objects.all().delete()[0]
    print(f"[-] Deleted {customers_deleted} Customer records.")

    vendors_deleted = Vendor.objects.all().delete()[0]
    print(f"[-] Deleted {vendors_deleted} Vendor records.")

    planning_workers_deleted = PlanningWorker.objects.all().delete()[0]
    print(f"[-] Deleted {planning_workers_deleted} PlanningWorker records.")

    planning_tools_deleted = PlanningTool.objects.all().delete()[0]
    print(f"[-] Deleted {planning_tools_deleted} PlanningTool records.")

    excluded_titles_deleted = ExcludedJobTitle.objects.all().delete()[0]
    print(f"[-] Deleted {excluded_titles_deleted} ExcludedJobTitle records.")

    bank_accounts_deleted = BankAccount.objects.all().delete()[0]
    print(f"[-] Deleted {bank_accounts_deleted} BankAccount records.")

    petty_accounts_deleted = PettyCashAccount.objects.all().delete()[0]
    print(f"[-] Deleted {petty_accounts_deleted} PettyCashAccount records.")


    # 2. Clean test users while strictly preserving admin and Nihaal
    test_users = User.objects.exclude(username__in=['admin', 'Nihaal', 'nihaal'])
    test_usernames = list(test_users.values_list('username', flat=True))
    users_deleted = test_users.delete()[0]
    print(f"[-] Deleted {users_deleted} test user(s): {test_usernames}")

    # 3. Verify preserved records
    print("\n---------------- PRESERVED DATA ------------------")
    print("[OK] Active Users:")
    for u in User.objects.all():
        print(f"    - ID: {u.id}, Username: {u.username}, Email: {u.email}, Role: {getattr(u, 'role', 'N/A')}, Superuser: {u.is_superuser}")

    settings_count = SiteSettings.objects.count()
    print(f"[OK] Site Settings preserved: {settings_count} record(s)")
    if settings_count > 0:
        s = SiteSettings.objects.first()
        print(f"    - Company: {s.company_name}, Email: {s.email}, Address: {s.address}")

    print("==================================================")
    print("PRODUCTION CLEANUP COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    clean_database()
