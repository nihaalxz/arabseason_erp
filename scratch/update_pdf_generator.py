import re

with open('frontend/src/utils/cashbookPdfGenerator.js', 'r', encoding='utf-8') as f:
    c = f.read()

if 'appDialog' not in c:
    c = c.replace(
        "import { numberToWords } from './numberToWords.js';",
        "import { numberToWords } from './numberToWords.js';\nimport { appDialog } from './appDialog';"
    )

c = re.sub(
    r'alert\(`Failed to generate PDF report from server:\s*\$\{statusPrefix\}\$\{serverMessage\}`\);',
    "await appDialog.error('PDF Export Failed', `Failed to generate PDF report from server: ${statusPrefix}${serverMessage}`);",
    c
)

old_voucher_catch_pattern = re.compile(
    r'console\.error\(\'Failed to generate server-side payment voucher PDF:\',\s*err\);\s*alert\(\'Failed to generate voucher PDF from server\. Please check your network connection\.\'\);',
    re.MULTILINE
)

new_voucher_catch_text = """console.error('Failed to generate server-side payment voucher PDF:', err);
    let serverMessage = err.message || 'Unknown network error';
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          serverMessage = json.detail || json.error || text;
        } catch (_) {
          serverMessage = text.slice(0, 300);
        }
      } catch (_) {}
    } else if (err.response?.data) {
      const d = err.response.data;
      serverMessage = typeof d === 'object' ? (d.detail || d.error || JSON.stringify(d)) : String(d);
    }
    const statusPrefix = err.response?.status ? `[HTTP ${err.response.status}] ` : '';
    await appDialog.error('Voucher Export Failed', `Failed to generate voucher PDF from server: ${statusPrefix}${serverMessage}`);"""

c = old_voucher_catch_pattern.sub(new_voucher_catch_text, c)

with open('frontend/src/utils/cashbookPdfGenerator.js', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated cashbookPdfGenerator.js successfully')

