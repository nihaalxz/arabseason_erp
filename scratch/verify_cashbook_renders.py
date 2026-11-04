import os
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\nihaa\.gemini\antigravity\brain\640e936d-fef2-4084-9176-90e97a80fb01"

print("Starting browser verification...")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    
    # 1. Desktop Admin
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    
    errors = []
    page.on('console', lambda msg: print(f"CONSOLE: {msg.text}") if msg.type == 'error' else None)
    page.on('pageerror', lambda err: errors.append(str(err)))
    
    # Login as admin
    page.goto('http://localhost:5174/login')
    page.fill('#login-username', 'admin')
    page.fill('#login-password', 'admin123')
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)
    
    # Visit /cashbook
    page.goto('http://localhost:5174/cashbook')
    page.wait_for_timeout(2500)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, 'cashbook_verified_admin_desktop.png'))
    print("Desktop cashbook screenshot captured.")
    
    # Visit /cashbook?tab=recycle_bin
    page.goto('http://localhost:5174/cashbook?tab=recycle_bin')
    page.wait_for_timeout(2500)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, 'cashbook_verified_recycle_bin.png'))
    print("Recycle bin tab screenshot captured.")
    
    # Visit /cashbook?tab=customer_chart
    page.goto('http://localhost:5174/cashbook?tab=customer_chart')
    page.wait_for_timeout(2500)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, 'cashbook_verified_customer_chart.png'))
    print("Customer chart screenshot captured.")
    
    # 2. Mobile Viewport (390 x 844)
    mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
    mobile_page = mobile_ctx.new_page()
    mobile_page.on('pageerror', lambda err: errors.append(str(err)))
    
    # Login on mobile
    mobile_page.goto('http://localhost:5174/login')
    mobile_page.fill('#login-username', 'admin')
    mobile_page.fill('#login-password', 'admin123')
    mobile_page.click('button[type="submit"]')
    mobile_page.wait_for_timeout(2000)
    
    mobile_page.goto('http://localhost:5174/cashbook')
    mobile_page.wait_for_timeout(2500)
    mobile_page.screenshot(path=os.path.join(ARTIFACT_DIR, 'cashbook_verified_mobile_390.png'))
    print("Mobile 390px cashbook screenshot captured.")
    
    browser.close()
    
    print("\n--- RESULTS ---")
    if errors:
        print(f"FAILED with {len(errors)} page errors:")
        for e in errors:
            print(" -", e)
    else:
        print("SUCCESS: 0 page errors! Everything rendered cleanly.")

