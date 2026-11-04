import os
import re

files_to_check = []
cashbook_dir = 'frontend/src/components/cashbook'
for root, _, filenames in os.walk(cashbook_dir):
    for f in filenames:
        if f.endswith(('.js', '.jsx')):
            files_to_check.append(os.path.join(root, f).replace('\\', '/'))
files_to_check.append('frontend/src/pages/Cashbook.jsx')
files_to_check.append('frontend/src/pages/RecycleBin.jsx')
files_to_check.append('frontend/src/utils/cashbookPdfGenerator.js')

call_patterns = [
    ('alert', re.compile(r'\b(?:window\.)?alert\s*\(')),
    ('confirm', re.compile(r'\b(?:window\.)?confirm\s*\(')),
    ('prompt', re.compile(r'\b(?:window\.)?prompt\s*\(')),
    ('Swal.fire', re.compile(r'Swal\.fire\s*\(')),
    ('showToast', re.compile(r'\bshowToast\s*\(')),
    ('showSuccess', re.compile(r'\bshowSuccess\s*\(')),
    ('showError', re.compile(r'\bshowError\s*\(')),
    ('showWarning', re.compile(r'\bshowWarning\s*\(')),
    ('showConfirm', re.compile(r'\bshowConfirm\s*\(')),
    ('showDeleteConfirm', re.compile(r'\bshowDeleteConfirm\s*\(')),
    ('showPrompt', re.compile(r'\bshowPrompt\s*\(')),
    ('showAlert', re.compile(r'\bshowAlert\s*\(')),
    ('Snackbar', re.compile(r'<Snackbar\b')),
]

entries = []

for fpath in sorted(files_to_check):
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx, line in enumerate(lines, 1):
        sline = line.strip()
        if sline.startswith('//') or sline.startswith('/*') or sline.startswith('*') or sline.startswith('import '):
            continue
        for name, pat in call_patterns:
            if pat.search(sline):
                # Filter false positives
                if name == 'confirm' and any(k in sline for k in ['isConfirmed', 'confirmButton', 'confirmPassword', 'showConfirm', 'confirmTitle', 'autoConfirm', 'confirmText']):
                    continue
                if name == 'alert' and any(k in sline for k in ['AlertCircle', 'AlertTriangle', 'showAlert', 'alert-']):
                    continue
                if name == 'prompt' and any(k in sline for k in ['showPrompt', 'promptText', 'promptTitle']):
                    continue

                # Determine kind
                kind = 'info'
                if name in ['showToast']:
                    if "'error'" in sline or '"error"' in sline:
                        kind = 'error'
                    elif "'warning'" in sline or '"warning"' in sline:
                        kind = 'warning'
                    elif "'info'" in sline or '"info"' in sline:
                        kind = 'info'
                    else:
                        kind = 'success' # default showToast is success
                elif name in ['showSuccess']:
                    kind = 'success'
                elif name in ['showError']:
                    kind = 'error'
                elif name in ['showWarning']:
                    kind = 'warning'
                elif name in ['showConfirm']:
                    if 'delete' in sline.lower():
                        kind = 'delete-confirm'
                    else:
                        kind = 'confirm'
                elif name in ['showDeleteConfirm']:
                    kind = 'delete-confirm'
                elif name in ['showPrompt', 'prompt']:
                    kind = 'input prompt'
                elif name in ['alert']:
                    kind = 'alert (native)'
                elif name in ['confirm']:
                    kind = 'confirm (native)'
                elif name in ['Snackbar']:
                    kind = 'custom snackbar'
                elif name in ['showAlert']:
                    kind = 'info'

                dialog_type = 'Native Browser' if 'native' in kind else ('Custom Component' if 'snackbar' in kind else 'SweetAlert')

                entries.append({
                    'file': fpath,
                    'line': idx,
                    'name': name,
                    'kind': kind,
                    'type': dialog_type,
                    'code': sline
                })

print(f"Total Call Sites Found: {len(entries)}")
# Group by file
from collections import defaultdict
grouped = defaultdict(list)
for e in entries:
    grouped[e['file']].append(e)

for fpath, items in grouped.items():
    print(f"\n=== {fpath} ({len(items)} dialog calls) ===")
    for item in items:
        print(f"  Line {item['line']:5d} | {item['kind']:15s} | {item['type']:14s} | {item['code'][:80]}")

