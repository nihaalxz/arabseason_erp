import re
import os

def migrate_export_table_btn():
    fpath = 'frontend/src/components/cashbook/common/ExportTablePdfBtn.jsx'
    with open(fpath, 'r', encoding='utf-8') as f:
        c = f.read()

    if 'appDialog' not in c:
        c = re.sub(
            r"import\s*\{\s*exportTableToPdf\s*\}\s*from\s*'[^']+';",
            "import { exportTableToPdf } from '../../../utils/cashbookPdfGenerator';\nimport { appDialog } from '../../../utils/appDialog';",
            c
        )
    c = c.replace("alert('No data available to export.');", "appDialog.warning('No Data', 'No data available to export.');")
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'Migrated {fpath}')

def migrate_chart_view(fpath):
    with open(fpath, 'r', encoding='utf-8') as f:
        c = f.read()

    # Replace import from swal with appDialog
    c = re.sub(
        r"import\s*\{[^}]+\}\s*from\s*'[./]+utils/swal'?;?",
        "import { appDialog } from '../../../../utils/appDialog';",
        c
    )
    # Replace calls
    c = re.sub(r'\bshowSuccess\s*\(', 'appDialog.toast(', c)
    c = re.sub(r'\bshowToast\s*\(', 'appDialog.toast(', c)
    c = re.sub(r'\bshowError\s*\(', 'appDialog.error(', c)
    c = re.sub(r'\bshowWarning\s*\(', 'appDialog.warning(', c)
    c = re.sub(r'\bshowConfirm\s*\(', 'appDialog.confirm(', c)
    c = re.sub(r'\bshowDeleteConfirm\s*\(', 'appDialog.confirmDelete(', c)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'Migrated {fpath}')

def migrate_component(fpath, depth):
    with open(fpath, 'r', encoding='utf-8') as f:
        c = f.read()

    import_path = '../' * depth + 'utils/appDialog'
    c = re.sub(
        r"import\s*\{[^}]+\}\s*from\s*'[./]+utils/swal'?;?",
        f"import {{ appDialog }} from '{import_path}';",
        c
    )
    c = re.sub(r'\bshowSuccess\s*\(', 'appDialog.toast(', c)
    c = re.sub(r'\bshowToast\s*\(', 'appDialog.toast(', c)
    c = re.sub(r'\bshowError\s*\(', 'appDialog.error(', c)
    c = re.sub(r'\bshowWarning\s*\(', 'appDialog.warning(', c)
    c = re.sub(r'\bshowConfirm\s*\(', 'appDialog.confirm(', c)
    c = re.sub(r'\bshowDeleteConfirm\s*\(', 'appDialog.confirmDelete(', c)
    c = re.sub(r'\bshowPrompt\s*\(', 'appDialog.prompt(', c)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'Migrated {fpath}')

migrate_export_table_btn()
migrate_chart_view('frontend/src/components/cashbook/cred/pages/CredCustomerChartView.jsx')
migrate_chart_view('frontend/src/components/cashbook/cred/pages/CredLabourChartView.jsx')
migrate_chart_view('frontend/src/components/cashbook/cred/pages/CredVendorPriceChartView.jsx')
migrate_component('frontend/src/components/cashbook/CashbookJobOrders.jsx', depth=2)
migrate_component('frontend/src/components/cashbook/CashbookLabour.jsx', depth=2)
migrate_component('frontend/src/components/cashbook/PersonalCashLedger.jsx', depth=2)
migrate_component('frontend/src/pages/RecycleBin.jsx', depth=1)

print('Component migrations complete')

