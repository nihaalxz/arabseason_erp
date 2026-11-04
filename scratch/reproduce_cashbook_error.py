from playwright.sync_api import sync_playwright

tabs = [
    'ledger',
    'cash_ledger',
    'bank_dashboard',
    'books',
    'expenses',
    'labour',
    'labour_chart',
    'job_orders',
    'customers',
    'customer_chart',
    'vendors',
    'vendor_chart',
    'reports',
    'recycle_bin',
    'more',
    'transfers',
    'bank_statement',
    'accounts'
]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page()
    page.on('console', lambda msg: print(f'CONSOLE [{msg.type}]: {msg.text}'))
    page.on('pageerror', lambda err: print(f'PAGE ERROR: {err}'))
    
    # login first
    page.goto('http://localhost:5174/login')
    page.fill('#login-username', 'admin')
    page.fill('#login-password', 'admin123')
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)
    
    for t in tabs:
        url = f'http://localhost:5174/cashbook?tab={t}'
        print(f'Checking {url}...')
        page.goto(url)
        page.wait_for_timeout(1000)
        content = page.content()
        if 'cashbookRecycleCount is not defined' in content or 'Unable to display this view' in content:
            print(f'*** ERROR FOUND ON TAB {t} ***')
            page.screenshot(path=f'error_tab_{t}.png')
        else:
            print(f'Tab {t} OK')
            
    browser.close()
