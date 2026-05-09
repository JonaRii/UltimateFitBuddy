'use strict';
const path = require('path');
const { chromium } = require('playwright');
const INDEX = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 414, height: 900 } });
  page.on('console', m => console.log('[console.' + m.type() + ']', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(INDEX);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  await page.locator('.tab-btn', { hasText: 'You' }).click();
  await page.waitForTimeout(500);
  const profile = await page.evaluate(() => {
    return {
      tabbarHTML: document.querySelector('#tab-bar')?.outerHTML?.slice(0, 800),
      contentHTML: document.querySelector('#content')?.innerHTML?.slice(0, 4000),
      tappableTitles: [...document.querySelectorAll('.list-row.tappable .title')].map(t => t.textContent),
      allRowTitles: [...document.querySelectorAll('.list-row .title')].map(t => t.textContent)
    };
  });
  console.log('\nTabbar:\n', profile.tabbarHTML);
  console.log('\nTappable titles:', profile.tappableTitles);
  console.log('\nAll row titles:', profile.allRowTitles);
  await page.screenshot({ path: 'screenshots/profile-debug.png' });
  await browser.close();
})();
