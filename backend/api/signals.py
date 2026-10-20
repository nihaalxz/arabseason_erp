from django.db.models.signals import pre_delete
from .recycle_bin import archive_to_recycle_bin

ARCHIVE_MODELS = [
    'Customer',
    'Vendor',
    'JobOrder',
    'Invoice',
    'CustomerPayment',
    'VendorPayment',
    'Expense',
    'Labour',
    'PaymentRequest',
    'PlanningTool',
    'PlanningWorker',
    'ProjectPlan',
    'SalaryPayment',
    'CashBook',
    'CashBookEntry',
    'BankAccount',
    'PettyCashAccount',

    'MaterialCategory',
    'Material',
    'Estimation',
    'Quotation',
    'CreditNote',
    'DeliveryNote',
]

def handle_pre_delete(sender, instance, **kwargs):
    archive_to_recycle_bin(instance)

def register_recycle_bin_signals():
    import api.models as api_models
    for model_name in ARCHIVE_MODELS:
        model_cls = getattr(api_models, model_name, None)
        if model_cls:
            pre_delete.connect(handle_pre_delete, sender=model_cls, weak=False)
