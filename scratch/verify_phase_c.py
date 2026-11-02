import os, sys
import pdfplumber

sys.stdout.reconfigure(encoding='utf-8')

print('--- VERIFYING PHASE C PDF PROPERTIES ---')
reports = [
    ('design-reference/output/phaseC/phaseC_universal_table_multipage.pdf', 'Universal Table'),
    ('design-reference/output/phaseC/phaseC_cashbook_ledger_multipage.pdf', 'Cashbook Ledger'),
    ('design-reference/output/phaseC/phaseC_bank_statement_multipage.pdf', 'Bank Statement'),
    ('design-reference/output/phaseC/phaseC_timesheet_report_multipage.pdf', 'Timesheet Report'),
    ('design-reference/output/phaseC/phaseC_financial_report_multipage.pdf', 'Financial Report')
]

for r_path, r_name in reports:
    if not os.path.exists(r_path):
        print(f"File not found: {r_path}")
        continue
    with pdfplumber.open(r_path) as pdf:
        print(f'\nDocument: {r_name}')
        num_pages = len(pdf.pages)
        print(f'  Total Pages: {num_pages}')
        p1 = pdf.pages[0]
        p2 = pdf.pages[1] if num_pages > 1 else None
        
        # Check text on p1
        text_p1 = p1.extract_text() or ''
        has_gen_p1 = 'Generated:' in text_p1
        print(f'  P1 has Generated timestamp: {has_gen_p1}')
        
        # Check text on p2
        if p2:
            text_p2 = p2.extract_text() or ''
            has_gen_p2 = 'Generated:' in text_p2
            has_page_p2 = f'Page 2 of {num_pages}' in text_p2
            print(f'  P2 has Generated timestamp: {has_gen_p2}')
            print(f'  P2 has Page 2 of {num_pages}: {has_page_p2}')
            
            # Check repeated header
            lines = [line.strip() for line in text_p2.split('\n') if line.strip()]
            print(f'  P2 header line: {lines[0] if lines else "None"}')

        # Check footer rule
        lines = p1.lines or []
        footer_rules = [l for l in lines if abs(l.get('top', 0) - (p1.height - 50.03)) < 2.0 or abs(l.get('bottom', 0) - (p1.height - 50.03)) < 2.0]
        print(f'  P1 footer rule found: {len(footer_rules) > 0}')
