/* Shared Playwright harness for the DSWD check suites (check.js, site-check.js).
   Each check opens a fresh page and fails on any console error, page error,
   failed request or HTTP status of 400 or more, unless the check sets allowErrors.
   Headless by default; PW_HEADLESS=false shows the browser (Edge), SLOW_MO=<ms> slows it.
   PW_CHANNEL=msedge runs in Edge; PW_BROWSER=firefox or webkit runs in those engines
   (install them first: npx playwright install firefox webkit). */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');

const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const checks = [];
/** Register a check. opts: { url, width = 1024, js = true, allowErrors = false } */
const check = (name, opts, fn) => checks.push({ name, opts, fn });

async function open(browser, baseUrl, { url, width = 1024, js = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: js });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);            // actions and locators
  page.setDefaultNavigationTimeout(30000); // Apache on Windows can be slow to answer
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));
  await page.goto(new URL(url || '', baseUrl).href);
  return { page, context, problems };
}

/** Run every registered check against baseUrl; exit 1 if any failed. */
async function run(baseUrl) {
  const headless = process.env.PW_HEADLESS !== 'false';
  // Visible runs use Edge: Playwright's bundled chrome.exe fails to start on this machine (spawn UNKNOWN).
  const channel = process.env.PW_CHANNEL || (headless ? undefined : 'msedge');
  const engine = playwright[process.env.PW_BROWSER || 'chromium'];
  const browser = await engine.launch({ headless, channel: engine === playwright.chromium ? channel : undefined, slowMo: Number(process.env.SLOW_MO || 0) });
  let failed = 0;
  for (const { name, opts, fn } of checks) {
    let context;
    try {
      const opened = await open(browser, baseUrl, opts);
      context = opened.context;
      await fn(opened.page);
      if (opened.problems.length && !opts.allowErrors) throw new Error(opened.problems.join('\n  '));
      console.log(`PASS ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL ${name}\n  ${error.message.split('\n').slice(0, 6).join('\n  ')}`);
    }
    await context?.close();
  }
  await browser.close();
  console.log(`${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
}

/* ---------- page helpers (run inside the page; each returns a list of offenders) ---------- */

/** Ids that ARIA, labels, in-page links or modal openers point to but that do not exist, plus duplicate ids. */
const missingIdRefs = () => [...document.querySelectorAll('[aria-describedby],[aria-labelledby],[aria-controls],label[for]')]
  .flatMap((el) => ['aria-describedby', 'aria-labelledby', 'aria-controls', 'for']
    .flatMap((a) => (el.getAttribute(a) || '').split(/\s+/).filter(Boolean)))
  .concat([...document.querySelectorAll('a[href^="#"]:not([href="#"]), [data-modal-open]')]
    .map((el) => el.dataset.modalOpen || decodeURIComponent(el.getAttribute('href').slice(1))))
  .filter((id) => !document.getElementById(id))
  .concat([...document.querySelectorAll('[id]')].map((el) => el.id)
    .filter((id, i, all) => all.indexOf(id) !== i).map((id) => `duplicate id: ${id}`));

const unnamedControls = () => [...document.querySelectorAll('input:not([type="hidden"]), select, textarea, button, a[href]')]
  .filter((el) => !el.closest('[hidden]')) // not in the accessibility tree
  .filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
  .filter((el) => (el.matches('input, select, textarea') ? !el.labels?.length : !el.textContent.trim()))
  .map((el) => `${el.tagName.toLowerCase()}#${el.id}`);

const statusColoredText = () => [...document.querySelectorAll('body *')]
  .filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()))
  .filter((el) => ['rgb(30, 142, 90)', 'rgb(199, 119, 0)'].includes(getComputedStyle(el).color))
  .map((el) => `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 40)}"`);

const smallTargets = () => [...document.querySelectorAll('.btn, .menu-toggle, .site-nav__link, .breadcrumb a, .pagination__link, .choice, .tabs__tab, .accordion__summary, .site-footer a, .lang-toggle__link')]
  .filter((el) => el.getClientRects().length)
  .filter((el) => { const r = el.getBoundingClientRect(); return Math.round(r.width) < 44 || Math.round(r.height) < 44; })
  .map((el) => `${el.className} "${el.textContent.trim().slice(0, 30)}"`);

/** Tab through the page; list every stop that has no visible outline. */
async function tabStopsWithoutRing(page) {
  const offenders = [];
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el.dataset.tabSeen) return null;
      el.dataset.tabSeen = '1';
      const c = getComputedStyle(el);
      // A link card moves its ring to the card (section 18), so read the card for those.
      const ringEl = el.closest('.card--link') || el;
      const r = getComputedStyle(ringEl);
      // >= 1.5: a scaled display snaps the authored 2px ring to whole device pixels (1.6px at 125%).
      const ok = (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 1.5)
        || (ringEl !== el && r.outlineStyle !== 'none' && parseFloat(r.outlineWidth) >= 1.5);
      return { ok, label: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.textContent || '').trim().slice(0, 40)}"` };
    });
    if (!stop) break;
    if (!stop.ok) offenders.push(stop.label);
  }
  return offenders;
}

const noSidewaysScroll = async (page) => {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, `page is ${sw}px wide in a ${cw}px viewport`);
};

module.exports = {
  assert, path, SHOTS, check, run,
  missingIdRefs, unnamedControls, statusColoredText, smallTargets, tabStopsWithoutRing, noSidewaysScroll,
};
