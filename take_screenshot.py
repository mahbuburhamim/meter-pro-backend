import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Define viewport widths to check
        widths = [360, 412]
        artifact_dir = "/Users/mahbuburhamim/.gemini/antigravity/brain/5c2c2f77-fa38-429b-9483-9ab19d036ce5"
        os.makedirs(artifact_dir, exist_ok=True)
        
        for w in widths:
            context = await browser.new_context(
                viewport={"width": w, "height": 800},
                user_agent="Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36"
            )
            page = await context.new_page()
            print(f"Navigating to http://127.0.0.1:3000/ at {w}px width...")
            await page.goto("http://127.0.0.1:3000/")
            await asyncio.sleep(2)
            
            print(f"Capturing Welcome Screen at {w}px...")
            welcome_path = os.path.join(artifact_dir, f"welcome_screen_{w}.png")
            await page.screenshot(path=welcome_path)
            print(f"Welcome Screen ({w}px) saved to {welcome_path}")
            await context.close()

        # Re-open a context for the rest of the walkthrough (standard 375px)
        context = await browser.new_context(
            viewport={"width": 375, "height": 812},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
        )
        page = await context.new_page()
        print("Navigating to http://127.0.0.1:3000/ for walkthrough...")
        await page.goto("http://127.0.0.1:3000/")
        await asyncio.sleep(2)
        
        # 2. Click Demo login button
        print("Clicking 'ডেমো মিটার দিয়ে চেষ্টা করুন'...")
        demo_button = page.locator("text=ডেমো মিটার দিয়ে চেষ্টা করুন")
        await demo_button.click()
        
        # Wait for dashboard to load (wait for the welcome text "স্বাগতম" or meter balance to load)
        print("Waiting for Dashboard to load...")
        await page.wait_for_selector("text=স্বাগতম", timeout=10000)
        await asyncio.sleep(3) # Let charts animate
        
        # 3. Capture Dashboard
        print("Capturing Dashboard Tab...")
        dashboard_path = os.path.join(artifact_dir, "dashboard_tab.png")
        await page.screenshot(path=dashboard_path)
        print(f"Dashboard Tab saved to {dashboard_path}")
        
        # 4. Navigate to Usage (হিসাব)
        print("Navigating to Usage Tab...")
        usage_nav = page.locator("nav >> text=হিসাব")
        await usage_nav.click()
        await asyncio.sleep(2)
        usage_path = os.path.join(artifact_dir, "usage_tab.png")
        await page.screenshot(path=usage_path)
        print(f"Usage Tab saved to {usage_path}")
        
        # 5. Navigate to AI Advice (AI পরামর্শ)
        print("Navigating to AI Advice Tab...")
        insights_nav = page.locator("nav >> text=AI পরামর্শ")
        await insights_nav.click()
        await asyncio.sleep(2)
        insights_path = os.path.join(artifact_dir, "insights_tab.png")
        await page.screenshot(path=insights_path)
        print(f"AI Advice Tab saved to {insights_path}")
        
        # 6. Navigate to Settings (সেটিংস)
        print("Navigating to Settings Tab...")
        settings_nav = page.locator("nav >> text=সেটিংস")
        await settings_nav.click()
        await asyncio.sleep(2)
        settings_path = os.path.join(artifact_dir, "settings_tab.png")
        await page.screenshot(path=settings_path)
        print(f"Settings Tab saved to {settings_path}")
        
        await browser.close()
        print("Walkthrough completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
