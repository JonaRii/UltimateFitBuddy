'use strict';
const path = require('path');
const { chromium } = require('playwright');
const INDEX = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 414, height: 1100 } });
  await page.goto(INDEX);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('ufb_state_v4', JSON.stringify({ onboarded: true }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  // Load demo so charts have data
  await page.locator('.tab-btn', { hasText: 'You' }).click();
  await page.waitForTimeout(150);
  await page.locator('.list-row', { hasText: 'Load demo data' }).click();
  await page.waitForTimeout(2200);
  await page.locator('.tab-btn', { hasText: 'You' }).click();
  await page.waitForTimeout(150);
  // Open body composition hub
  await page.locator('.list-row', { hasText: 'Body composition' }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelectorAll('.toast').forEach(t => t.style.opacity='0');
  });
  await page.screenshot({ path: 'screenshots/body-hub.png' });
  // Caliper sheet
  await page.locator('.list-row', { hasText: 'Caliper measurement' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/body-caliper.png' });
  await browser.close();
})();
