import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="msedge")
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("Navigating to login...")
        await page.goto("http://localhost:5174/login", wait_until="networkidle")
        
        await page.fill("#login-username", "admin")
        await page.fill("#login-password", "admin123")
        await page.click('button[type="submit"]')
        
        print("Waiting for login to succeed...")
        await page.wait_for_url(lambda u: "/login" not in u, timeout=10000)
        print("Logged in successfully! Current URL:", page.url)

        # 1. Test ERP Settings with ?tab=localization
        print("Visiting http://localhost:5174/settings?tab=localization ...")
        await page.goto("http://localhost:5174/settings?tab=localization", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        url_erp = page.url
        print("Final URL for ERP settings:", url_erp)
        content_erp = await page.content()
        has_localization_erp = 'Localization & Business Preferences' in content_erp or 'Preferred Date Format' in content_erp or 'Default Base Currency' in content_erp
        print("Has Localization in ERP content?", has_localization_erp)
        await page.screenshot(path="C:/Users/nihaa/.gemini/antigravity/brain/640e936d-fef2-4084-9176-90e97a80fb01/erp_settings_no_localization.png")

        # 2. Test Accounting Settings with ?tab=localization
        print("Visiting http://localhost:5174/accounting/settings?tab=localization ...")
        await page.goto("http://localhost:5174/accounting/settings?tab=localization", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        url_acc = page.url
        print("Final URL for Accounting settings:", url_acc)
        content_acc = await page.content()
        has_localization_acc = 'Localization & Business Preferences' in content_acc or 'Preferred Date Format' in content_acc or 'Default Base Currency' in content_acc
        print("Has Localization in Accounting content?", has_localization_acc)
        await page.screenshot(path="C:/Users/nihaa/.gemini/antigravity/brain/640e936d-fef2-4084-9176-90e97a80fb01/accounting_settings_no_localization.png")

        await browser.close()
        print("Done! Both screenshots saved successfully.")

asyncio.run(run())
