/* DSWD design system checks (phase 1 preview page, index.html).
   Run from C:\xampp\htdocs\SLP with Apache running:
     node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/check.js
   Headless by default; PW_HEADLESS=false shows the browser. Harness: tests/harness.js. */

const { assert, path, SHOTS, check, run, missingIdRefs, unnamedControls, statusColoredText, tabStopsWithoutRing } = require('./harness');

const PAGE_URL = process.env.TARGET_URL || 'http://localhost/SLP/dswd/index.html';

/* ---------- Task 1: global checks ---------- */

for (const width of [320, 360, 768, 1024, 1440]) {
  check(`no sideways scroll at ${width}px`, { width }, async (page) => {
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(sw <= cw, `page is ${sw}px wide in a ${cw}px viewport`);
    await page.screenshot({ path: path.join(SHOTS, `${width}.png`), fullPage: true, timeout: 30000 });
  });
}

check('one h1 and every nav is labelled', {}, async (page) => {
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('nav:not([aria-label]):not([aria-labelledby])').count(), 0);
});

check('every id reference resolves', {}, async (page) => {
  assert.deepEqual(await page.evaluate(missingIdRefs), []);
});

check('every control and link has an accessible name', {}, async (page) => {
  assert.deepEqual(await page.evaluate(unnamedControls), []);
});

check('skip link is the first Tab stop and moves focus to main', {}, async (page) => {
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Skip to main content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
});

check('every Tab stop shows a 2px focus outline', {}, async (page) => {
  assert.deepEqual(await tabStopsWithoutRing(page), []);
});

check('success and warning colors are never text colors', {}, async (page) => {
  assert.deepEqual(await page.evaluate(statusColoredText), []);
});

check('Inter loads from the page itself', {}, async (page) => {
  // document.fonts.check() also returns true when no @font-face exists, so read the face's status instead
  assert.ok(await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded');
  }));
});

/* ---------- Task 2: icons and buttons ---------- */

const SPRITE_IDS = ['menu', 'x', 'chevron-down', 'chevron-left', 'chevron-right', 'arrow-right', 'download', 'external-link',
  'circle-check', 'triangle-alert', 'circle-alert', 'phone', 'mail', 'map-pin',
  // added in phase 2 for the site pages
  'search', 'hand-heart', 'heart-handshake', 'file-text', 'megaphone', 'building-2', 'clock', 'calendar', 'globe', 'check', 'user'];

const smallTargets = () => [...document.querySelectorAll('.btn, .menu-toggle, .site-nav__link, .breadcrumb a, .pagination__link, .choice, .tabs__tab, .accordion__summary, .site-footer a')]
  .filter((el) => el.getClientRects().length)
  .filter((el) => { const r = el.getBoundingClientRect(); return Math.round(r.width) < 44 || Math.round(r.height) < 44; })
  .map((el) => `${el.className} "${el.textContent.trim().slice(0, 30)}"`);

check('sprite holds exactly the spec icons and every <use> resolves', {}, async (page) => {
  const sprite = await (await page.request.get(new URL('img/icons.svg', PAGE_URL).href)).text();
  const ids = await page.evaluate((text) => [...new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('symbol')].map((s) => s.id), sprite);
  assert.deepEqual(ids.sort(), [...SPRITE_IDS].sort());
  const used = await page.$$eval('use', (els) => els.map((u) => u.getAttribute('href').split('#')[1]));
  assert.ok(used.length > 0, 'no icons on the page');
  assert.deepEqual(used.filter((id) => !SPRITE_IDS.includes(id)), []);
});

check('interactive targets are at least 44 by 44px', { width: 360 }, async (page) => {
  assert.deepEqual(await page.evaluate(smallTargets), []);
});

check('buttons are 48px pills and disabled ones look disabled', {}, async (page) => {
  const s = await page.locator('#buttons .btn--primary[disabled]').first()
    .evaluate((el) => { const c = getComputedStyle(el); return [c.borderRadius, c.backgroundColor, el.getBoundingClientRect().height]; });
  assert.deepEqual(s.slice(0, 2), ['999px', 'rgb(221, 229, 224)']);
  assert.ok(Math.round(s[2]) >= 48, `button is ${s[2]}px tall`);
  assert.equal(await page.locator('#buttons a.btn[aria-disabled="true"][href]').count(), 0);
});

for (const [width, stacked] of [[320, true], [360, false]]) {
  check(`button group ${stacked ? 'stacks' : 'sits in a row'} at ${width}px`, { width }, async (page) => {
    const r = await page.locator('#buttons .btn-group').first()
      .evaluate((g) => ({ w: g.clientWidth, kids: [...g.children].map((c) => c.getBoundingClientRect()) }));
    if (stacked) assert.ok(r.kids.every((k) => Math.round(k.width) === r.w), 'buttons are not full width');
    else assert.equal(Math.round(r.kids[0].top), Math.round(r.kids[1].top));
  });
}

/* ---------- Task 3: header, footer, mobile menu ---------- */

check('menu opens with Enter and closes with Escape at 360px', { width: 360 }, async (page) => {
  const toggle = page.getByRole('button', { name: 'Menu' });
  const nav = page.getByRole('navigation', { name: 'Main' });
  assert.ok(await nav.isHidden(), 'nav should start collapsed');
  await toggle.focus();
  await page.keyboard.press('Enter');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(await nav.isVisible(), 'nav should open');
  await nav.getByRole('link').first().focus();
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(await nav.isHidden(), 'nav should close');
  assert.ok(await toggle.evaluate((el) => el === document.activeElement), 'focus should return to the toggle');
});

check('desktop nav is a visible row and the toggle is hidden at 1024px', { width: 1024 }, async (page) => {
  assert.ok(await page.getByRole('button', { name: 'Menu' }).isHidden());
  const tops = await page.$$eval('.site-header .site-nav__link', (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  assert.equal(tops.length, 6);
  assert.equal(new Set(tops).size, 1, 'nav links are not on one row');
});

check('without JS the nav shows and the toggle is hidden', { width: 360, js: false }, async (page) => {
  assert.ok(await page.getByRole('navigation', { name: 'Main' }).isVisible());
  assert.ok(await page.locator('.menu-toggle').isHidden());
});

check('live nav marks no current page here; the specimen shows the current-state ring', {}, async (page) => {
  // This page is not in the nav, so aria-current there would misinform screen readers.
  assert.equal(await page.locator('.site-header [aria-current]').count(), 0);
  const sample = page.locator('#header-footer .site-nav__link.is-current');
  assert.equal(await sample.count(), 1);
  assert.match(await sample.evaluate((el) => getComputedStyle(el).boxShadow), /rgb\(30, 122, 76\).*inset|inset.*rgb\(30, 122, 76\)/);
});

check('footer focus ring is white', {}, async (page) => {
  await page.keyboard.press('Tab');
  const link = page.locator('.site-footer a').first();
  await link.focus();
  assert.deepEqual(await link.evaluate((el) => { const s = getComputedStyle(el); return [s.outlineStyle, s.outlineColor, parseFloat(s.outlineWidth) >= 1.5]; }),
    ['solid', 'rgb(255, 255, 255)', true]);
});

/* ---------- Task 4: breadcrumbs, card, alerts, table, pagination ---------- */

check('breadcrumb ends with the current page as text', {}, async (page) => {
  const last = page.locator('main nav[aria-label="Breadcrumb"]').first().locator('[aria-current="page"]');
  assert.deepEqual(await last.evaluate((el) => [el.tagName, el.textContent.trim()]), ['SPAN', 'Design system']);
});

check('table scrolls inside its own labelled region at 320px', { width: 320 }, async (page) => {
  const wrap = page.locator('#table .table-wrap');
  assert.deepEqual(await wrap.evaluate((el) => [el.getAttribute('role'), el.tabIndex, el.scrollWidth > el.clientWidth]), ['region', 0, true]);
});

check('pagination has one current page and a non-link disabled Previous', {}, async (page) => {
  const navs = await page.locator('#pagination nav.pagination').all();
  assert.equal(navs.length, 2);
  for (const nav of navs) assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
  assert.deepEqual(await page.locator('#pagination [aria-disabled="true"]').first()
    .evaluate((el) => [el.tagName, el.textContent.trim()]), ['SPAN', 'Previous']);
});

check('alerts show the status on the border and icon, never as a side stripe', {}, async (page) => {
  const s = await page.locator('.alert--warning').first().evaluate((el) => {
    const c = getComputedStyle(el);
    return [c.borderLeftWidth === c.borderTopWidth, parseFloat(c.borderLeftWidth) <= 1, c.borderLeftColor, getComputedStyle(el.querySelector('.alert__icon')).color];
  });
  assert.deepEqual(s, [true, true, 'rgb(199, 119, 0)', 'rgb(199, 119, 0)']);
});

/* ---------- Task 5: form controls ---------- */

check('invalid controls point at an "Error:" message', {}, async (page) => {
  const bad = await page.$$eval('[aria-invalid="true"]', (els) => els
    .filter((el) => !(el.getAttribute('aria-describedby') || '').split(/\s+/)
      .some((id) => document.getElementById(id)?.textContent.trim().startsWith('Error:')))
    .map((el) => el.id));
  assert.deepEqual(bad, []);
  assert.ok((await page.locator('#forms [aria-invalid="true"]').count()) >= 2, 'expected at least 2 error examples');
});

check('required controls say (required) in their label', {}, async (page) => {
  assert.ok((await page.locator('#forms [required]').count()) >= 2, 'expected required examples');
  assert.deepEqual(await page.$$eval('#forms [required]', (els) => els
    .filter((el) => ![el.labels?.[0], el.closest('fieldset')?.querySelector('legend')].some((n) => n?.textContent.includes('(required)')))
    .map((el) => el.id)), []);
});

check('text inputs are 48px tall with a 3:1 border', {}, async (page) => {
  const s = await page.locator('#forms input.input').first().evaluate((el) => [el.getBoundingClientRect().height, getComputedStyle(el).borderTopColor]);
  assert.ok(Math.round(s[0]) >= 48, `input is ${s[0]}px tall`);
  assert.equal(s[1], 'rgb(90, 103, 96)');
});

check('a disabled choice looks disabled: muted label and a not-allowed cursor', {}, async (page) => {
  const label = page.locator('#forms .choice:has(input[disabled])').first();
  assert.deepEqual(await label.evaluate((el) => { const s = getComputedStyle(el); return [s.color, s.cursor]; }), ['rgb(90, 103, 96)', 'not-allowed']);
});

/* ---------- Task 6: tabs and accordion ---------- */

const selectedTab = async (page) => (await page.locator('#tabs [role="tab"][aria-selected="true"]').textContent()).trim();
const visiblePanels = (page) => page.$$eval('#tabs [role="tabpanel"]', (els) => els.filter((el) => !el.hidden).map((el) => el.id));

check('tabs follow the ARIA keyboard pattern', {}, async (page) => {
  await page.locator('#tabs [role="tab"][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await selectedTab(page), 'When to use');
  assert.equal((await visiblePanels(page)).length, 1);
  await page.keyboard.press('End');
  assert.equal(await selectedTab(page), 'Accessibility', 'End should skip the disabled tab');
  await page.keyboard.press('ArrowRight');
  assert.equal(await selectedTab(page), 'Overview', 'ArrowRight should wrap');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await selectedTab(page), 'Accessibility', 'ArrowLeft should wrap');
  await page.keyboard.press('Home');
  assert.equal(await selectedTab(page), 'Overview');
  await page.locator('#tabs [role="tab"][aria-disabled="true"]').click({ force: true });
  assert.equal(await selectedTab(page), 'Overview', 'a disabled tab cannot be selected');
  assert.deepEqual(await page.$$eval('#tabs [role="tab"]', (els) => els.map((e) => e.tabIndex)), [0, -1, -1, -1]);
});

check('without JS every tab panel shows and the dead tab strip is hidden', { js: false }, async (page) => {
  assert.equal((await visiblePanels(page)).length, 3);
  assert.ok(await page.locator('#tabs [role="tablist"]').isHidden(), 'tabs that cannot work should not show');
});

check('accordion opens and closes from the keyboard', {}, async (page) => {
  // Hold the element: the :not([open]) locator would re-resolve to another item once this one opens.
  const summary = await page.locator('#accordion details:not([open]) > summary').first().elementHandle();
  await summary.focus();
  await page.keyboard.press('Enter');
  assert.equal(await summary.evaluate((el) => el.parentElement.open), true);
  await page.keyboard.press('Enter');
  assert.equal(await summary.evaluate((el) => el.parentElement.open), false);
});

/* ---------- Task 7: modal ---------- */

const opener = (page) => page.getByRole('button', { name: 'Open sample dialog' });
const isOpen = (page) => page.locator('#sample-dialog').evaluate((d) => d.open);

check('dialog opens, makes the page inert, closes with Escape and returns focus', {}, async (page) => {
  await opener(page).click();
  assert.equal(await isOpen(page), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden', 'page should not scroll');
  await page.evaluate(() => document.querySelector('.skip-link').focus());
  assert.ok(await page.evaluate(() => document.getElementById('sample-dialog').contains(document.activeElement)), 'focus escaped the dialog');
  await page.keyboard.press('Escape');
  assert.equal(await isOpen(page), false);
  assert.ok(await opener(page).evaluate((el) => el === document.activeElement), 'focus should return to the opener');
});

check('backdrop click closes the dialog and clicks inside do not', {}, async (page) => {
  await opener(page).click();
  await page.locator('#sample-dialog .modal__body').click();
  assert.equal(await isOpen(page), true, 'a click inside closed the dialog');
  await page.mouse.click(5, 5);
  assert.equal(await isOpen(page), false, 'a backdrop click did not close the dialog');
});

check('Close and Cancel close the dialog', {}, async (page) => {
  for (const name of ['Close', 'Cancel']) {
    await opener(page).click();
    await page.locator('#sample-dialog').getByRole('button', { name }).click();
    assert.equal(await isOpen(page), false, `${name} did not close the dialog`);
  }
});

/* ---------- Task 8: foundations ---------- */

const COLORS = { 'green-900': '#0F4A2C', 'green-700': '#166039', 'green-600': '#1E7A4C', 'green-100': '#E8F4EC', white: '#FFFFFF',
  surface: '#F6F9F7', text: '#1A2420', 'text-muted': '#5A6760', border: '#DDE5E0', success: '#1E8E5A', warning: '#C77700',
  error: '#C62828', 'border-strong': '#5A6760' };

check('color table matches tokens.css', {}, async (page) => {
  for (const [token, hex] of Object.entries(COLORS)) {
    const value = await page.evaluate((t) => getComputedStyle(document.documentElement).getPropertyValue(`--${t}`), token);
    assert.equal(value.trim().toUpperCase(), hex, `--${token} in tokens.css`);
    assert.equal(await page.locator('#color tr', { hasText: `--${token}` }).locator('td', { hasText: hex }).count(), 1, `--${token} row`);
  }
});

for (const [width, h1, h2] of [[360, '32px', '28px'], [1440, '40px', '32px']]) {
  check(`heading sizes at ${width}px`, { width }, async (page) => {
    assert.deepEqual(await page.evaluate(() => ['h1', '.h2'].map((s) => getComputedStyle(document.querySelector(s)).fontSize)), [h1, h2]);
  });
}

check('spacing bars match the 8px scale', {}, async (page) => {
  assert.deepEqual(await page.$$eval('#spacing .ds-bar', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width))), [8, 16, 24, 32, 48, 64]);
});

/* ---------- Finish review fixes ---------- */

check('checkbox error mark shows on the control and differs from the focus ring', {}, async (page) => {
  const box = page.locator('#f-privacy');
  const ring = () => box.evaluate((el) => { const c = getComputedStyle(el); return [c.outlineStyle, c.outlineColor]; });
  assert.deepEqual(await ring(), ['dashed', 'rgb(198, 40, 40)'], 'error mark');
  await page.keyboard.press('Tab'); // keyboard modality, so focus() matches :focus-visible
  await box.focus();
  assert.deepEqual(await ring(), ['solid', 'rgb(30, 122, 76)'], 'focus ring');
});

check('long unbroken text wraps instead of widening the page at 320px', { width: 320 }, async (page) => {
  await page.evaluate(() => {
    const long = ` https://example.gov.ph/${'a'.repeat(60)}`;
    ['.alert__content > p:last-child', '#forms .choice', '#forms .field__error', '.site-footer__contact li', '.card p', '.ds-rule']
      .forEach((sel) => document.querySelector(sel).append(long));
  });
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, `page is ${sw}px wide in a ${cw}px viewport`);
});

check('a long tab label wraps inside its tab at 320px', { width: 320 }, async (page) => {
  await page.locator('#tab-when').evaluate((el) => { el.textContent = 'Assistance to Individuals in Crisis Situations'; });
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, `page is ${sw}px wide in a ${cw}px viewport`);
});

check('tabs wrap and stay on screen at 360px', { width: 360 }, async (page) => {
  const off = await page.$$eval('#tabs [role="tab"]', (els) => els
    .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth)
    .map((e) => e.textContent.trim()));
  assert.deepEqual(off, []);
});

check('accordion shows one open example', {}, async (page) => {
  assert.equal(await page.locator('#accordion details[open]').count(), 1);
});

check('every interactive component shows hover and focus specimens', {}, async (page) => {
  const missing = await page.evaluate(() => ['buttons', 'forms', 'card', 'tabs', 'accordion', 'breadcrumbs', 'pagination', 'header-footer']
    .flatMap((id) => ['is-hover', 'is-focus'].filter((c) => !document.querySelector(`#${id} .${c}`)).map((c) => `${id} ${c}`)));
  assert.deepEqual(missing, []);
});

/* ---------- runner ---------- */

run(PAGE_URL);
