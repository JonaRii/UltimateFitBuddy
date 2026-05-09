/* Self-test harness for the prototype.
 * Runs Chromium headless, walks every flow, captures console + uncaught
 * errors, calls the in-app test runner, and saves screenshots in
 * `screenshots/` for visual review.
 *
 * Run with:  node smoke.js
 * Exit code 0 = clean, non-zero = console errors or test failures.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = __dirname;
const INDEX = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const SHOTS = path.join(ROOT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const consoleErrors = [];
const pageErrors = [];
const findings = [];

function log(msg) { process.stdout.write(msg + '\n'); }

function bug(level, where, detail) {
  findings.push({ level, where, detail });
  log(`  [${level}] ${where} — ${detail}`);
}

async function shot(page, name) {
  // Clear any in-flight toast / rest-timer overlay so screenshots aren't noisy.
  // Force-hide via inline style to bypass the CSS transition.
  await page.evaluate(() => {
    document.querySelectorAll('.toast').forEach(t => {
      t.classList.remove('show');
      t.style.opacity = '0';
      t.style.transition = 'none';
    });
    const rest = document.getElementById('rest-pill');
    if (rest) rest.remove();
  });
  await page.waitForTimeout(50);
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function clickText(page, selector, text) {
  const handle = await page.locator(selector, { hasText: text }).first();
  await handle.click();
}

async function setTheme(page, theme) {
  // Use the app's own theme toggle via Profile to avoid stomping state.
  const restoreTab = await page.evaluate(() => {
    const active = document.querySelector('.tab-btn.active span:last-child');
    return active ? active.textContent.trim() : 'Today';
  });
  await page.locator('.tab-btn', { hasText: 'You' }).click();
  await page.waitForTimeout(250);
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Match system';
  // Use exact-text title match so "Light" doesn't pick up "Highlight" etc.
  const titleLocator = page.locator('.list-row.tappable .text .title', { hasText: new RegExp('^\\s*' + label + '\\s*$') });
  await titleLocator.first().click();
  await page.waitForTimeout(250);
  await page.locator('.tab-btn', { hasText: restoreTab }).click();
  await page.waitForTimeout(250);
}

async function run() {
  log('Booting Chromium…');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') {
      consoleErrors.push(`${t}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message + '\n' + (err.stack || ''));
  });

  log('Loading index.html…');
  await page.goto(INDEX);
  // Wipe any leftover state from earlier runs so each smoke test is clean.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('.tab-bar .tab-btn'), { timeout: 5000 });
  log('  ✓ booted (clean state)');

  // ---- 1. Take screenshots of every tab in light + dark
  for (const theme of ['light', 'dark']) {
    log(`\n— Theme: ${theme} —`);
    await setTheme(page, theme);
    for (const tab of ['dashboard', 'workouts', 'nutrition', 'profile']) {
      const tabBtn = page.locator('.tab-btn', { hasText: tabLabel(tab) });
      await tabBtn.click();
      await page.waitForTimeout(150);
      await shot(page, `${theme}-${tab}-empty`);
      const errs = await page.evaluate(() => {
        return document.querySelectorAll('.empty').length;
      });
      log(`  ${tab}: rendered (empty placeholders: ${errs})`);
    }
  }

  // ---- 2. Load demo data and screenshot populated states
  log('\n— Loading demo data —');
  await page.locator('.tab-btn', { hasText: 'You' }).click();
  await page.waitForTimeout(150);
  await page.locator('.list-row', { hasText: 'Load demo data' }).click();
  // Wait for the demo-loaded toast to clear so screenshots aren't obscured.
  await page.waitForTimeout(2200);

  for (const tab of ['dashboard', 'workouts', 'nutrition']) {
    await page.locator('.tab-btn', { hasText: tabLabel(tab) }).click();
    await page.waitForTimeout(250);
    await shot(page, `populated-${tab}`);
    log(`  ${tab}: populated screenshot saved`);
  }

  // ---- 3. Run the in-app test suite
  log('\n— Running in-app test suite —');
  await page.locator('.tab-btn', { hasText: 'Today' }).click();
  await page.waitForTimeout(150);
  await page.locator('.icon-btn').first().click();   // test-tube icon
  await page.waitForTimeout(300);
  await shot(page, 'tests');
  const testSummary = await page.evaluate(() => {
    const stats = [...document.querySelectorAll('.test-summary .stat')].map(s => ({
      num: s.querySelector('.num')?.textContent,
      lbl: s.querySelector('.lbl')?.textContent
    }));
    const failures = [...document.querySelectorAll('.test-row.fail')].map(r => ({
      name: r.querySelector('.test-name')?.textContent,
      detail: r.querySelector('.test-detail')?.textContent
    }));
    return { stats, failures };
  });
  log('  Stats: ' + JSON.stringify(testSummary.stats));
  if (testSummary.failures.length) {
    for (const f of testSummary.failures) {
      bug('FAIL', 'in-app test', `${f.name} — ${f.detail}`);
    }
  } else {
    log('  ✓ all in-app tests pass');
  }

  // ---- 4. Active workout flow
  log('\n— Active workout flow —');
  await page.locator('.tab-btn', { hasText: 'Workouts' }).click();
  await page.waitForTimeout(200);
  await page.locator('.list-row', { hasText: 'Start empty workout' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'flow-1-active-empty');
  // Add an exercise
  await page.locator('.btn-secondary', { hasText: 'Add exercise' }).click();
  await page.waitForTimeout(200);
  await shot(page, 'flow-2-exercise-picker');
  await page.locator('.list-row', { hasText: 'Bench Press' }).first().click();
  await page.waitForTimeout(200);
  await shot(page, 'flow-3-exercise-added');
  // Type into the weight + reps inputs
  const setInputs = page.locator('.set-row .input-pill input');
  if (await setInputs.count() >= 2) {
    await setInputs.nth(0).fill('80');
    await setInputs.nth(1).fill('5');
  }
  await page.locator('.set-row .check-btn').first().click();
  await page.waitForTimeout(300);
  await shot(page, 'flow-4-set-completed');
  // Finish
  await page.locator('.btn-link', { hasText: 'Finish' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'flow-5-after-finish');

  // Verify the workout was saved
  const savedCount = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ufb_state_v4') || '{}');
    return (s.workouts || []).filter(w => w.endedAt).length;
  });
  log(`  workouts in storage: ${savedCount}`);
  if (savedCount === 0) bug('FAIL', 'workout flow', 'no completed workout saved');

  // ---- 5. Nutrition: scanner simulator
  log('\n— Nutrition + scanner —');
  // Let any lingering toasts / timers clear so the screenshots are clean.
  await page.waitForTimeout(2200);
  await page.locator('.tab-btn', { hasText: 'Nutrition' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'flow-6-nutrition');
  // Tap + specifically on the Breakfast meal card (water + cardio also have add buttons now).
  await page.locator('.meal-card', { hasText: 'Breakfast' }).locator('.meal-card-add').click();
  await page.waitForTimeout(200);
  await shot(page, 'flow-7-add-food-sheet');
  await page.locator('.list-row', { hasText: 'Scan barcode' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'flow-8-scanner');
  // Pick Nutella fixture
  await page.locator('.scanner-row', { hasText: 'Nutella' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'flow-9-portion-sheet');
  // Tap "Add to Breakfast"
  await page.locator('.btn-primary', { hasText: 'Add to Breakfast' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'flow-10-after-scan-add');

  // Verify entry persisted
  const breakfastEntries = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ufb_state_v4') || '{}');
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return ((s.meals || {})[key] || {}).breakfast || [];
  });
  log(`  breakfast entries today: ${breakfastEntries.length}`);
  if (breakfastEntries.length === 0) bug('FAIL', 'scanner flow', 'no entry saved after scan');

  // ---- 6. Sanity checks for visual issues
  log('\n— Visual sanity checks —');
  const visualChecks = await page.evaluate(() => {
    const issues = [];
    // Look for un-styled raw text or broken icons
    const svgCount = document.querySelectorAll('svg').length;
    const broken = [...document.querySelectorAll('svg')].filter(s => !s.hasAttribute('viewBox')).length;
    if (broken > 0) issues.push(`${broken} svgs missing viewBox`);
    // Tab bar should have 4 buttons
    const tabs = document.querySelectorAll('.tab-btn').length;
    if (tabs !== 4) issues.push(`expected 4 tab buttons, got ${tabs}`);
    // Status bar should have battery + wifi + cellular
    const sb = document.querySelector('.status-bar .right');
    if (sb && sb.children.length < 3) issues.push(`status bar right has ${sb.children.length} children, expected 3`);
    return { svgCount, issues };
  });
  log(`  total SVGs rendered: ${visualChecks.svgCount}`);
  for (const i of visualChecks.issues) bug('WARN', 'visual', i);

  await browser.close();

  // ---- Summary
  log('\n========== SUMMARY ==========');
  log(`Console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) log('  ' + e);
  log(`Page errors: ${pageErrors.length}`);
  for (const e of pageErrors) log('  ' + e.split('\n')[0]);
  log(`Findings: ${findings.length}`);
  for (const f of findings) log(`  [${f.level}] ${f.where} — ${f.detail}`);
  log(`Screenshots: ${SHOTS}`);

  const fail = consoleErrors.length > 0 || pageErrors.length > 0 || findings.some(f => f.level === 'FAIL');
  process.exit(fail ? 1 : 0);
}

function tabLabel(tab) {
  return ({ dashboard: 'Today', workouts: 'Workouts', nutrition: 'Nutrition', profile: 'You' })[tab];
}

run().catch((err) => {
  console.error('Smoke run failed:', err);
  process.exit(2);
});
