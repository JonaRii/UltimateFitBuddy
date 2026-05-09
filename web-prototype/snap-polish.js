'use strict';
const path = require('path');
const { chromium } = require('playwright');
const INDEX = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 1100 },
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  await page.goto(INDEX);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('ufb_state_v4', JSON.stringify({ onboarded: true }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  // Load demo for content
  await page.locator('.tab-btn', { hasText: 'You' }).click();
  await page.waitForTimeout(150);
  await page.locator('.list-row', { hasText: 'Load demo data' }).click();
  await page.waitForTimeout(2200);

  for (const theme of ['light', 'dark']) {
    await page.locator('.tab-btn', { hasText: 'You' }).click();
    await page.waitForTimeout(150);
    const label = theme === 'light' ? 'Light' : 'Dark';
    await page.locator('.list-row.tappable .text .title', { hasText: new RegExp('^\\s*' + label + '\\s*$') }).first().click();
    await page.waitForTimeout(250);
    for (const tab of ['Today', 'Workouts', 'Nutrition', 'You']) {
      await page.locator('.tab-btn', { hasText: tab }).click();
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        document.querySelectorAll('.toast').forEach(t => t.style.opacity = '0');
      });
      await page.screenshot({ path: `screenshots/polish-${theme}-${tab.toLowerCase()}.png` });
    }
  }
  await browser.close();
})();
