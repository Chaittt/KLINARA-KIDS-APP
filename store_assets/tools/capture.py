"""Capture raw app screens from the running Expo web preview for store screenshots.
Usage: /tmp/pwenv/bin/python capture.py <preview_url>
Logs in through the API, puts the token in localStorage (AsyncStorage on web), then screenshots each screen."""
import asyncio
import json
import sys
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(__file__).resolve().parent.parent / "raw"
OUT.mkdir(parents=True, exist_ok=True)


def login(path: str, body: dict) -> str:
    req = urllib.request.Request(f"{BASE}/api{path}", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
    return json.loads(urllib.request.urlopen(req).read())["access_token"]


PARENT = login("/auth/parent/login", {"username": "anjali.reddy", "password": "Parent@123"})
TEACHER = login("/auth/staff/login", {"email": "teacher@klinara.com", "password": "Teacher@123"})

SHOTS = [
    ("01_parent_home", PARENT, "/parent/home", None),
    ("02_activity_feed", PARENT, "/parent/activities", None),
    ("03_attendance", PARENT, "/parent/attendance", None),
    ("04_fees_upi", PARENT, "/parent/fees", None),
    ("05_elthea_grow", PARENT, "/parent/profile", "elthea-card"),
    ("06_teacher_attendance", TEACHER, "/teacher/attendance", None),
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for name, token, route, scroll_to in SHOTS:
            ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3)
            await ctx.add_init_script(f"window.localStorage.setItem('klinara_token', {json.dumps(token)});")
            page = await ctx.new_page()
            await page.goto(BASE + route, timeout=120000)
            await page.wait_for_function("document.querySelector('#root') && document.querySelector('#root').innerText.length > 40", timeout=120000)
            await page.wait_for_timeout(4000)
            if scroll_to:
                el = page.get_by_test_id(scroll_to)
                await el.scroll_into_view_if_needed()
                await page.evaluate("""(id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (e) e.scrollIntoView({block: 'start'}); }""", scroll_to)
                await page.wait_for_timeout(1500)
            await page.screenshot(path=str(OUT / f"{name}.png"))
            print("captured", name, page.url)
            await ctx.close()
        await browser.close()


asyncio.run(main())
