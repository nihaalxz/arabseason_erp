import os
import re

cashbook_dir = 'frontend/src/components/cashbook'
files_to_check = []
for root, _, filenames in os.walk(cashbook_dir):
    for f in filenames:
        if f.endswith(('.js', '.jsx')):
            files_to_check.append(os.path.join(root, f).replace('\\', '/'))
files_to_check.append('frontend/src/pages/Cashbook.jsx')
files_to_check.append('frontend/src/pages/RecycleBin.jsx')

# Also check ExportTablePdfBtn and any common utilities used in cashbook
files_to_check.append('frontend/src/utils/swal.js')
files_to_check.append('frontend/src/utils/pdfDownload.js')

patterns = [
    ('Swal.fire', re.compile(r'Swal\.fire\s*\(')),
    ('Swal.mixin', re.compile(r'Swal\.mixin\s*\(')),
    ('sweetalert2_import', re.compile(r'from\s+[\'"]sweetalert2')),
    ('window.alert', re.compile(r'window\.alert\s*\(')),
    ('bare_alert', re.compile(r'(?<![a-zA-Z0-9_\.])alert\s*\(')),
    ('window.confirm', re.compile(r'window\.confirm\s*\(')),
    ('bare_confirm', re.compile(r'(?<![a-zA-Z0-9_\.])confirm\s*\(')),
    ('window.prompt', re.compile(r'window\.prompt\s*\(')),
    ('bare_prompt', re.compile(r'(?<![a-zA-Z0-9_\.])prompt\s*\(')),
    ('swal_helper', re.compile(r'\b(showConfirm|showDeleteConfirm|showAlert|showSuccess|showError|showWarning|showToast)\b')),
    ('snackbar_usage', re.compile(r'<Snackbar\b'))
]

results = []
for fpath in sorted(files_to_check):
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx, line in enumerate(lines, 1):
        sline = line.strip()
        # skip comments
        if sline.startswith('//') or sline.startswith('*'):
            continue
        for name, pat in patterns:
            if pat.search(line):
                # Filter false positives:
                if name == 'bare_alert' and any(x in line for x in ['AlertCircle', 'AlertTriangle', 'alert-dialog', 'alert-pill', 'Alert,', 'Alert }', 'Alert(']):
                    continue
                if name == 'bare_confirm' and any(x in line for x in ['confirmButton', 'confirmPassword', 'confirm_password', 'isConfirmed', 'confirmText', 'confirmTitle', 'autoConfirm']):
                    continue
                if name == 'bare_prompt' and any(x in line for x in ['promptText', 'promptTitle']):
                    continue
                results.append({
                    'file': fpath,
                    'line': idx,
                    'kind': name,
                    'text': sline
                })

print(f"Total dialog occurrences: {len(results)}")
for r in results:
    print(f"{r['file']}:{r['line']} [{r['kind']}] {r['text'][:110]}")

