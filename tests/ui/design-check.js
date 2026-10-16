/*
   Design system check: the SLP app must match the DSWD design system.
   Reference: dswd/design-system.html. Every expected value is read LIVE
   from that page, then compared with the matching SLP component.

   Run (Apache must serve http://localhost/SLP/):
     node <playwright-skill>/run.js tests/ui/design-check.js
   Env: TARGET_URL (default http://localhost/SLP/), REFERENCE_URL
   (default <TARGET_URL>dswd/design-system.html), PW_HEADLESS=true to
   hide the browser, PW_CHANNEL=msedge to use Edge, SLOW_MO=<ms>,
   PW_ARTIFACT_DIR for screenshots. Exit code 1 if any check fails.
*/
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const APP = process.env.TARGET_URL || 'http://localhost/SLP/';
const REFERENCE = process.env.REFERENCE_URL || new URL('dswd/design-system.html', APP).href;
const SHOTS = process.env.PW_ARTIFACT_DIR || path.join(os.tmpdir(), 'slp-design');
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
let failed = 0;
const consoleErrors = [];

async function check(name, fn) {
    try {
        await fn();
        console.log(`PASS ${name}`);
        passed++;
    } catch (error) {
        console.log(`FAIL ${name}: ${error.message}`);
        failed++;
    }
}

function style(page, selector, props) {
    return page.$eval(selector, (el, props) => {
        const s = getComputedStyle(el);
        return Object.fromEntries(props.map(p => [p, s.getPropertyValue(p)]));
    }, props);
}

/* App value must equal reference value for every listed property. */
function same(app, ref, what) {
    const diffs = Object.keys(ref).filter(p => app[p] !== ref[p]).map(p => `${p} app=${app[p]} ref=${ref[p]}`);
    if (diffs.length) throw new Error(`${what}: ${diffs.join('; ')}`);
}

async function noSideScroll(page, label) {
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    if (scroll > client) throw new Error(`${label}: page is ${scroll}px wide in a ${client}px viewport`);
}

async function signIn(page, role) {
    await page.goto(APP);
    await page.locator(`.demo-account-row[data-username="${role}"]`).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.locator('#app:not(.hidden)').waitFor();
}

(async () => {
    const browser = await chromium.launch({
        headless: process.env.PW_HEADLESS === 'true',
        channel: process.env.PW_CHANNEL || undefined,
        slowMo: Number(process.env.SLOW_MO || 0),
    });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

        // ---------- 1. Read the reference ----------
        const refPage = await context.newPage();
        await refPage.goto(REFERENCE);
        await refPage.screenshot({ path: path.join(SHOTS, 'reference-1440.png') });
        const notState = ':not(.is-hover):not(.is-focus):not(:disabled):not([aria-disabled="true"])';
        const ref = {
            body: await style(refPage, 'body', ['color', 'background-color', 'font-family']),
            primary: await style(refPage, `.btn.btn--primary${notState}`, ['background-color', 'color', 'border-top-left-radius', 'min-height', 'font-size', 'font-weight']),
            secondary: await style(refPage, `.btn.btn--secondary${notState}`, ['background-color', 'border-top-color', 'color', 'border-top-left-radius']),
            ghost: await style(refPage, `.btn.btn--ghost${notState}`, ['color', 'border-top-left-radius']),
            input: await style(refPage, '#f-name', ['min-height', 'border-top-left-radius', 'border-top-color', 'font-size']),
            card: await style(refPage, '.card', ['border-top-left-radius', 'box-shadow', 'border-top-color', 'background-color']),
            tab: await style(refPage, '.tabs__tab[aria-selected="true"]', ['background-color', 'color', 'border-top-left-radius', 'box-shadow', 'font-weight']),
            nav: await style(refPage, '.site-nav__link.is-current, .site-nav__link[aria-current]', ['background-color', 'color', 'border-top-left-radius', 'box-shadow', 'font-weight']),
            footer: await style(refPage, '.site-footer', ['background-color', 'color']),
            th: await style(refPage, '.table thead th', ['background-color', 'font-weight']),
            tableWrap: await style(refPage, '.table-wrap', ['border-top-left-radius', 'border-top-color']),
            alert: await style(refPage, '.alert.alert--success', ['border-top-color', 'background-color']),
            alertIcon: await style(refPage, '.alert.alert--success .alert__icon', ['color']),
            dialog: await style(refPage, 'dialog.modal', ['border-top-left-radius']),
            h1: await style(refPage, 'h1', ['font-size']),
            h3: await style(refPage, 'h3', ['font-size']),
        };
        await refPage.focus('#f-name');
        ref.focus = await style(refPage, '#f-name', ['outline-style', 'outline-width', 'outline-color', 'outline-offset']);
        console.log(`Reference: ${REFERENCE}`);

        // ---------- 2. The app, side by side ----------
        const page = await context.newPage();
        await page.bringToFront();
        const fontRequests = [];
        page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fontRequests.push(request.url()); });
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', error => consoleErrors.push(error.message));

        await page.goto(APP);
        await page.screenshot({ path: path.join(SHOTS, 'login-1440.png'), fullPage: true });

        await check('Inter is self-hosted, not loaded from Google', async () => {
            await page.evaluate(() => document.fonts.load('16px Inter'));
            if (!(await page.evaluate(() => document.fonts.check('16px Inter')))) throw new Error('Inter is not available');
            if (fontRequests.length) throw new Error(`requests to Google Fonts: ${fontRequests[0]}`);
        });
        await check('page text and background', async () => same(await style(page, 'body', ['color', 'background-color']), { color: ref.body.color, 'background-color': ref.body['background-color'] }, 'body'));
        await check('primary button', async () => same(await style(page, '#loginForm button[type="submit"]', Object.keys(ref.primary)), ref.primary, 'Sign in button'));
        await check('secondary button', async () => same(await style(page, '#togglePasswordBtn', Object.keys(ref.secondary)), ref.secondary, 'Show password button'));
        await check('text input', async () => same(await style(page, '#password', Object.keys(ref.input)), ref.input, 'password field'));
        await check('focus ring', async () => {
            await page.focus('#password');
            same(await style(page, '#password', Object.keys(ref.focus)), ref.focus, 'focused field');
        });
        await check('sign-in card', async () => same(await style(page, '.login__card', Object.keys(ref.card)), ref.card, 'sign-in card'));

        await signIn(page, 'admin');
        await page.screenshot({ path: path.join(SHOTS, 'dashboard-1440.png'), fullPage: true });

        await check('card', async () => same(await style(page, '.card', Object.keys(ref.card)), ref.card, 'dashboard card'));
        await check('current nav item', async () => same(await style(page, '.nav__item[aria-current="page"]', Object.keys(ref.nav)), ref.nav, 'sidebar current item'));
        await check('footer band', async () => same(await style(page, '.app-footer', Object.keys(ref.footer)), ref.footer, 'footer'));

        await page.locator('#nav-beneficiaries').click();
        await page.locator('#beneficiaryTableBody').waitFor();
        await page.screenshot({ path: path.join(SHOTS, 'beneficiaries-1440.png'), fullPage: true });

        await check('table header and frame', async () => {
            same(await style(page, '.table thead th', Object.keys(ref.th)), ref.th, 'table header');
            same(await style(page, '.table-wrap', Object.keys(ref.tableWrap)), ref.tableWrap, 'table frame');
        });
        await check('ghost (tertiary) button', async () => same(await style(page, '#beneficiaryTableBody .btn--tertiary', Object.keys(ref.ghost)), ref.ghost, 'View button'));
        await check('status badge follows the alert rule (colour on border and icon only)', async () => {
            same(await style(page, '.badge.badge--success', ['border-top-color', 'background-color', 'color']),
                { 'border-top-color': ref.alert['border-top-color'], 'background-color': ref.alert['background-color'], color: ref.body.color }, 'success badge');
            same(await style(page, '.badge.badge--success .icon', ['color']), ref.alertIcon, 'success badge icon');
        });

        await page.getByRole('button', { name: 'Add beneficiary' }).first().click();
        await page.locator('#modal:not(.hidden)').waitFor();
        await page.screenshot({ path: path.join(SHOTS, 'modal-1440.png') });
        await check('dialog corners', async () => same(await style(page, '#modal .modal__dialog', Object.keys(ref.dialog)), ref.dialog, 'dialog'));
        await page.keyboard.press('Escape');

        await page.locator('#nav-notifications').click();
        await page.locator('#noticeTabAll').waitFor();
        await check('selected tab', async () => same(await style(page, '#noticeTabAll', Object.keys(ref.tab)), ref.tab, 'notifications tab'));

        // SLP-only rule: the official form replicas keep square fields.
        await page.locator('#logoutButton').click();
        await signIn(page, 'leader');
        await check('page title is the reference h1; text stat values are the reference h3', async () => {
            same(await style(page, '#pageTitle', ['font-size']), ref.h1, 'page title');
            same(await style(page, '.stat__value--text', ['font-size']), ref.h3, 'text stat value ("Saved", "Ongoing")');
        });
        await page.locator('#nav-mdmonitoring').click();
        await page.locator('#toolSheet1').waitFor();
        await page.screenshot({ path: path.join(SHOTS, 'mdmonitoring-1440.png') });
        await check('form replicas keep square fields', async () => {
            same(await style(page, '.paper input:not([type="checkbox"]):not([type="radio"])', ['border-top-left-radius']), { 'border-top-left-radius': '0px' }, 'paper input');
            same(await style(page, '.paper select', ['border-top-left-radius']), { 'border-top-left-radius': '0px' }, 'paper select');
        });

        await page.setViewportSize({ width: 390, height: 844 });
        for (const name of ['dashboard', 'profile', 'documents']) {
            await page.evaluate(n => window.navigate(n), name);
            await page.locator('#pageTitle').waitFor();
            await page.screenshot({ path: path.join(SHOTS, `${name}-390.png`), fullPage: true });
            await check(`no sideways scroll at 390px: ${name}`, () => noSideScroll(page, name));
        }

        await check('no console errors', async () => {
            if (consoleErrors.length) throw new Error(consoleErrors.join(' | '));
        });
    } finally {
        await browser.close();
    }
    console.log(`${passed} passed, ${failed} failed`);
    console.log(`Screenshots: ${SHOTS}`);
    process.exit(failed ? 1 : 0);
})();
