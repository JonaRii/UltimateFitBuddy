/* Capture the onboarding overlay only. */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const INDEX = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 414, height: 900 } });
  await page.goto(INDEX);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/onboarding-1.png' });
  await page.locator('button', { hasText: 'Next' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/onboarding-2.png' });
  await page.locator('button', { hasText: 'Next' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/onboarding-3.png' });
  await browser.close();
})();
