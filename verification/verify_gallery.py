
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Navigate to the generated gallery - using correct path
        page.goto("file:///app/generated-gallery/index.html")

        # Wait a bit for animations/generators to render
        page.wait_for_timeout(3000)

        # Take a full page screenshot
        page.screenshot(path="verification/gallery_screenshot.png", full_page=True)
        browser.close()

if __name__ == "__main__":
    run()
