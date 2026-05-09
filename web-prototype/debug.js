/* Quick diagnostic — load page, dump everything I need to debug. */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const INDEX = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 414, height: 900 } });
  page.on('console', m => console.log('[console.' + m.type() + ']', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message, '\n', e.stack));

  await page.goto(INDEX);
  await page.waitForTimeout(500);

  const measurements = await page.evaluate(() => {
    const measure = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        bg: cs.backgroundColor,
        display: cs.display,
        flex: cs.flex,
        position: cs.position,
        overflow: cs.overflow,
        zIndex: cs.zIndex,
        opacity: cs.opacity,
        visibility: cs.visibility
      };
    };
    return {
      body: measure('body'),
      phoneShell: measure('.phone-shell'),
      phone: measure('.phone'),
      statusBar: measure('.status-bar'),
      content: measure('#content'),
      tabBar: measure('.tab-bar'),
      firstCard: measure('#content .card'),
      ring: measure('.ring')
    };
  });

  console.log('MEASUREMENTS:', JSON.stringify(measurements, null, 2));

  await page.screenshot({ path: 'screenshots/debug.png' });
  await browser.close();
})();
