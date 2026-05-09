'use strict';
const path = require('path');
const { chromium } = require('playwright');
const INDEX = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
(async () => {
  const browser = await chromium.launch();
  // Desktop-sized viewport so the phone frame is visible.
  const page = await browser.newPage({ viewport: { width: 1280, height: 1080 } });
  await page.goto(INDEX);
  // Skip onboarding by priming localStorage like the smoke test does.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('ufb_state_v4', JSON.stringify({ onboarded: true }));
  });
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('.tab-bar .tab-btn'));
  await page.waitForTimeout(300);
  // Load demo so the dashboard has content
  await page.locator('.tab-btn', { hasText: 'You' }).click();
  await page.waitForTimeout(150);
  await page.locator('.list-row', { hasText: 'Load demo data' }).click();
  await page.waitForTimeout(2200);
  await page.locator('.tab-btn', { hasText: 'Today' }).click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelectorAll('.toast').forEach(t => t.style.opacity='0');
  });
  await page.screenshot({ path: 'screenshots/frame-desktop.png' });
  await browser.close();
})();
