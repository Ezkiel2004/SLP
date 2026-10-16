# DSWD Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the DSWD website design system (tokens, base, components, `ui.js`, icon sprite, self-hosted Inter) and a preview page at `SLP/dswd/index.html` that shows every component and state.

**Architecture:** Static files under `SLP/dswd/`, served by XAMPP at `http://localhost/SLP/dswd/index.html`. CSS is three layers (`tokens.css` → `base.css` → `components.css`). JS is one deferred file for the menu, tabs and opening the modal; the accordion and the modal itself are native `<details>` and `<dialog>`. One Playwright script, `dswd/tests/check.js`, is the test suite. Each task adds its checks first, watches them fail, then builds.

**Tech Stack:** HTML5, CSS3 custom properties, vanilla JS (ES2020), Inter variable WOFF2 (self-hosted), Lucide SVG sprite, Playwright (from the installed `playwright-skill`) for checks.

**Spec:** `docs/superpowers/specs/2026-10-12-dswd-design-system-design.md`. Read it before any task. Section numbers below (§) refer to it.

**No commits:** `SLP/` is not a git repository, so there are no commit steps. Do not run `git init` unless the user asks.

**Run the checks** (from `C:\xampp\htdocs\SLP`, Apache running). The browser is visible by default so the user can watch; set `PW_HEADLESS=true` to hide it.

```bash
node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/check.js
```

## Global Constraints

- Every new file goes under `SLP/dswd/`. Never edit the SLP app's files (`SLP/index.html`, `SLP/css/*`, `SLP/js/*`, `SLP/tests/*`).
- Plain HTML5, CSS3 custom properties and vanilla JS. No frameworks, no build step, no runtime dependencies, no CDN at runtime.
- Colors, sizes, radii and shadows come only from `css/tokens.css` (§5). That includes the preview page's `<style>` block.
- Brand palette: green and white only. `--success` and `--warning` are never text colors. `--error` is text only in field error messages (§5.2).
- One font: Inter, self-hosted (`fonts/inter-latin-wght-normal.woff2`). One icon set: Lucide, through `img/icons.svg` only.
- No gradients, no transitions or animations, no inline `style=""`, no `div` with `onclick`. Shadows only `--shadow`, on cards and the modal.
- WCAG 2.1 AA: text at least 4.5:1, non-text at least 3:1, targets at least 44 × 44px, focus ring `2px solid var(--focus)` with `2px` offset.
- Mobile-first `min-width` queries at 360, 768, 1024 and 1440px only (§5.5).
- Copy: sentence case, buttons start with a verb. No invented claims, statistics, hotlines, officials, or political names or images. Placeholders are bracketed (§11).
- Each CSS section starts with a one-to-three line comment saying what it styles and how to extend it.
- Do not open the page as a local file. The external sprite needs http.

## Review Focus

1. **`ui.js` fails or arrives late on a slow connection.** The nav, every tab panel and the accordion must still be usable without JS. Tested in Task 3 (menu) and Task 6 (tabs, accordion).
2. **Reader zooms to 400% (a 320 CSS px viewport) or uses long labels.** No sideways page scroll; only the table scrolls, inside its own region. Tested in Task 1 at 320px; the table in Task 4.
3. **Keyboard-only user.** Every Tab stop shows a 2px ring, including the white ring on the green footer. Tested in Task 1 (all stops) and Task 3 (footer color).
4. **A typo in an icon name.** It renders silently as blank space. Tested in Task 2 (every `<use>` resolves to a sprite symbol).
5. **A broken id reference.** Screen readers lose hints, errors and tab panels silently. Tested in Task 1 (every `aria-*` and `for` id resolves).

---

### Task 1: Page shell, tokens, base styles, font and check harness

**Files:**
- Create: `dswd/tests/check.js`
- Create: `dswd/PRODUCT.md`
- Create: `dswd/fonts/inter-latin-wght-normal.woff2`
- Create: `dswd/fonts/LICENSE`
- Create: `dswd/css/tokens.css`
- Create: `dswd/css/base.css`
- Create: `dswd/css/components.css` (header comment only)
- Create: `dswd/js/ui.js` (step 1 of §9 only)
- Create: `dswd/img/logo.svg`
- Create: `dswd/index.html`

**Interfaces:**
- Produces, for every later task:
  - Token names exactly as in §5.
  - Classes `.container`, `.grid`, `.span-md-{3,4,6,8,9}`, `.span-lg-{3,4,6,8,9}`, `.h1`–`.h4`, `.visually-hidden`, `.num`, `.skip-link`.
  - `<main id="main" tabindex="-1">`.
  - Section ids in page order, each a `<section aria-labelledby="{id}-title">` with `<h2 id="{id}-title">`: `color`, `typography`, `spacing`, `shape`, `grid`, `icons`, `buttons`, `forms`, `card`, `tabs`, `accordion`, `breadcrumbs`, `alerts`, `table`, `pagination`, `modal`, `header-footer`.
  - The check harness API: `check(name, { width = 1024, js = true }, async (page) => {…})`, with `assert` (`node:assert/strict`), `path`, `PAGE_URL` and `SHOTS` in scope. The page URL constant is named `PAGE_URL` so it doesn't shadow the global `URL` class.

- [ ] **Step 1: Confirm the environment**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost/SLP/`
Expected: `200`. If not, ask the user to start Apache in XAMPP.

Run: `node "C:/Users/julie/.claude/skills/playwright-skill/run.js" -e "const b = await chromium.launch(); console.log('chromium ok'); await b.close();"`
Expected: `chromium ok`. If Chromium is missing, run `npm run setup` in `C:/Users/julie/.claude/skills/playwright-skill`.

- [ ] **Step 2: Write the harness and the global checks in `dswd/tests/check.js`**

Harness behavior:
- Each check gets a fresh browser context: viewport `{ width, height: 900 }`, `javaScriptEnabled: js`.
- It navigates to `PAGE_URL` (`process.env.TARGET_URL || 'http://localhost/SLP/dswd/index.html'`).
- The check fails if the page logs a console error or `pageerror`, or if any request fails or returns status 400 or above.
- Output is `PASS name` or `FAIL name` plus the reason. The summary line is `N/M passed`. Exit code is 1 if anything failed.
- Launch with `headless: process.env.PW_HEADLESS === 'true'` and `slowMo: Number(process.env.SLOW_MO || 0)`.
- Create `SHOTS = path.join(__dirname, 'screenshots')` if it is missing.

Checks to add, with these names and assertions:

```js
for (const width of [320, 360, 768, 1024, 1440]) {
  check(`no sideways scroll at ${width}px`, { width }, async (page) => {
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(sw <= cw, `page is ${sw}px wide in a ${cw}px viewport`);
    await page.screenshot({ path: path.join(SHOTS, `${width}.png`), fullPage: true });
  });
}
check('one h1 and every nav is labelled', {}, async (page) => {
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('nav:not([aria-label]):not([aria-labelledby])').count(), 0);
});
check('every id reference resolves', {}, async (page) => {
  // ids named by aria-describedby, aria-labelledby, aria-controls and label[for]
  assert.deepEqual(await page.evaluate(missingIdRefs), []);
});
check('every control and link has an accessible name', {}, async (page) => {
  // input/select/textarea: labels.length || aria-label || aria-labelledby; button/a[href]: trimmed text || aria-label
  assert.deepEqual(await page.evaluate(unnamedControls), []);
});
check('skip link is the first Tab stop and moves focus to main', {}, async (page) => {
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Skip to main content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
});
check('every Tab stop shows a 2px focus outline', {}, async (page) => {
  // press Tab until focus returns to <body> or 400 presses; for each activeElement read getComputedStyle
  assert.deepEqual(await tabStopsWithoutRing(page), []); // ring = outlineStyle !== 'none' && parseFloat(outlineWidth) >= 2
});
check('success and warning colors are never text colors', {}, async (page) => {
  // every element with a non-empty own text node: computed color not in ['rgb(30, 142, 90)', 'rgb(199, 119, 0)']
  assert.deepEqual(await page.evaluate(statusColoredText), []);
});
check('Inter loads from the page itself', {}, async (page) => {
  // document.fonts.check() also returns true when no @font-face exists, so read the face's status instead
  assert.ok(await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded'); }));
});
```

`missingIdRefs`, `unnamedControls`, `tabStopsWithoutRing` and `statusColoredText` are small helpers in the same file. Each returns an array of offender descriptions, as `tag#id` or the first 40 characters of text.

- [ ] **Step 3: Run the checks and confirm they fail**

Run the check command.
Expected: every check FAILs with `404: http://localhost/SLP/dswd/index.html`.

- [ ] **Step 4: Fetch the font and its license**

```bash
mkdir -p dswd/fonts && curl -sfL -o dswd/fonts/inter-latin-wght-normal.woff2 https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.2.5/files/inter-latin-wght-normal.woff2 && curl -sfL -o dswd/fonts/LICENSE https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.2.5/LICENSE && wc -c dswd/fonts/*
```

Expected: the woff2 is `48444` bytes and LICENSE is non-empty and contains "SIL Open Font License". These are the only downloads the user approved; fetch nothing else.

- [ ] **Step 5: Write `dswd/PRODUCT.md`**

Use the Impeccable template from `reference/init.md`, including `<!-- impeccable:product-schema 1 -->`. Sections and content:

- **Platform:** `web`.
- **Stack:** "static HTML/CSS/vanilla JS, no frameworks (user's brief)".
- **Users:** Filipino citizens of all ages, often on phones and slow mobile data, looking for DSWD programs, eligibility and how to apply. Developers and designers who build the site's pages.
- **Product Purpose:** a design system for the redesigned DSWD website. Phase 1 is the system and its preview page.
- **Positioning:** the official, non-partisan source.
- **Capabilities and Constraints:** §3 and the Global Constraints.
- **Brand Commitments:** green and white only, Inter only, Lucide only, pill buttons, minimal, no gradients, non-partisan.
- **Evidence on Hand:** no official logo or real content supplied. Do not fabricate.
- **Product Principles:** three to five.
- **Accessibility & Inclusion:** WCAG 2.1 AA and 44px targets.

- [ ] **Step 6: Record the Impeccable direction contract**

Write this body to a scratch file, then run:

```bash
"C:/Users/julie/.claude/plugins/cache/impeccable/impeccable/4.5.0/skills/impeccable/scripts/impeccable" surface-brief write dswd/index.html <body-file>
```

Read it back with `surface-brief read dswd/index.html` and confirm all six blocks are present.

```markdown
## Direction contract
THESIS: A calm official reference page where every token and component reads as plain and trustworthy. It refuses the portal template: hero banner, carousel, icon-tile grid.
OWN-WORLD: White ground; green-600 for action; green-900 footer; green-100 tints for hover and selected; 1px hairlines; 16px rounded fields and cards; pill actions; Inter 400/500/600; Lucide icons with a 1.5 stroke; status colors only on icons and borders.
STORY: A developer or designer sees every token and component with its states, learns the one rule for each, and copies markup from the page source.
FIRST VIEWPORT: Two-row header (logo and agency name, then the nav row or Menu button), breadcrumb, H1 "Design system", a two-sentence intro naming the load order, then the "On this page" list (a sticky left column from 1024px) beside the Color section.
FORM: Brief-pinned by the user's phase 1 brief, Read mode, documentation-page form. No concept-seed roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
```

- [ ] **Step 7: Write `css/tokens.css`**

Every token in §5.1–§5.4, with the brief's values exactly. The phone values sit in `:root`. Two `@media (min-width: …)` blocks override `--fs-h1`, `--fs-h2`, `--page-padding` and `--grid-gap` at 768px, and `--page-padding` at 1024px. A header comment lists the breakpoints (§5.5) and the rule "components use tokens only". Each color carries a contrast comment from §5.1.

- [ ] **Step 8: Write `css/base.css`**

Everything in §6, in this order: `@font-face` (`font-weight: 100 900`, `font-display: swap`, `src: url("../fonts/inter-latin-wght-normal.woff2") format("woff2")`), reset, `html`, `body`, headings and `.h1`–`.h4`, paragraphs, links, focus (including `.is-focus` and `[tabindex="-1"]:focus`), `::selection` and caret, `.container`, `.grid` and spans, utilities, `.skip-link`.

- [ ] **Step 9: Write `css/components.css`, `js/ui.js` and `img/logo.svg`**

- `components.css`: a header comment only. It names the section order (Icons, Buttons, Header, Footer, Breadcrumbs, Card, Alerts, Table, Pagination, Form fields, Tabs, Accordion, Modal) and the conventions from §8.
- `ui.js`: a header comment and `document.documentElement.classList.add("js");`.
- `logo.svg`: a 64×64 `viewBox`, a white circle with an `#5A6760` stroke, an inner `#DDE5E0` ring, and "LOGO" in `#5A6760`. It starts with the comment "PLACEHOLDER — replace with the official DSWD seal (same file name). Using the seal needs DSWD authorisation."

- [ ] **Step 10: Write `index.html`**

- **Head:** `lang="en"`; charset; viewport; `<title>Design system | DSWD</title>`; meta description; `<link rel="icon" href="img/logo.svg" type="image/svg+xml">` (this also stops Chrome requesting `/favicon.ico`); the font preload (§4); the three stylesheets in order; a preview-only `<style>` holding the `ds-` classes (`.ds-toc` sticky at `top: var(--space-3)` from 1024px, `.ds-specimen`, `.ds-state` with a `figcaption` in `--fs-small` and `--text-muted`); `<script src="js/ui.js" defer>`.
- **Body:** `<a class="skip-link" href="#main">Skip to main content</a>`, then `<main id="main" tabindex="-1"><div class="container">`. Inside: the H1 "Design system"; the intro "Tokens and components for the DSWD website. Load css/tokens.css, css/base.css and css/components.css in that order, then js/ui.js with defer."; a `.grid` holding `<nav class="ds-toc span-lg-3" aria-label="On this page">` (two headed lists, Foundations and Components, linking to every section id) and `<div class="span-lg-9">` with the 17 sections. Each section has its H2 (Color, Typography, Spacing, Shape and elevation, Grid, Icons, Buttons, Form controls, Card, Tabs, Accordion, Breadcrumbs, Alerts, Table, Pagination, Modal, Header and footer) and nothing else yet.

- [ ] **Step 11: Run the checks and confirm they pass**

Run the check command. Expected: all checks pass. Open `dswd/tests/screenshots/360.png` and `1440.png` and confirm Inter renders and the contents list sits beside the content at 1440.

---

### Task 2: Icon sprite and buttons

**Files:**
- Create: `dswd/img/icons.svg`
- Modify: `dswd/css/components.css` (sections 1 Icons, 2 Buttons)
- Modify: `dswd/index.html` (sections `#icons`, `#buttons`)
- Test: `dswd/tests/check.js`

**Interfaces:**
- Consumes: the tokens, the `.ds-specimen` and `.ds-state` preview classes, and the harness from Task 1.
- Produces:
  - Sprite ids: `menu`, `x`, `chevron-down`, `chevron-left`, `chevron-right`, `arrow-right`, `download`, `external-link`, `circle-check`, `triangle-alert`, `circle-alert`, `phone`, `mail`, `map-pin`.
  - `.icon` and `.icon--24`.
  - `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--ghost`, `.btn-group`.
  - Icon markup everywhere: `<svg class="icon" aria-hidden="true" focusable="false"><use href="img/icons.svg#{id}"></use></svg>`.

- [ ] **Step 1: Add the checks**

```js
const SPRITE_IDS = ['menu','x','chevron-down','chevron-left','chevron-right','arrow-right','download','external-link','circle-check','triangle-alert','circle-alert','phone','mail','map-pin'];
check('sprite holds exactly the spec icons and every <use> resolves', {}, async (page) => {
  const sprite = await (await page.request.get(new URL('img/icons.svg', PAGE_URL).href)).text();
  assert.deepEqual([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]).sort(), [...SPRITE_IDS].sort());
  const used = await page.$$eval('use', els => els.map(u => u.getAttribute('href').split('#')[1]));
  assert.deepEqual(used.filter(id => !SPRITE_IDS.includes(id)), []);
});
check('interactive targets are at least 44 by 44px', { width: 360 }, async (page) => {
  // visible elements matching: .btn, .menu-toggle, .site-nav__link, .breadcrumb a, .pagination__link, .choice, .tabs__tab, .accordion__summary, .site-footer a
  assert.deepEqual(await page.evaluate(smallTargets), []); // offender when rect.width < 44 || rect.height < 44
});
for (const [width, stacked] of [[320, true], [360, false]]) {
  check(`button group ${stacked ? 'stacks' : 'sits in a row'} at ${width}px`, { width }, async (page) => {
    const r = await page.locator('#buttons .btn-group').first().evaluate(g => ({ w: g.clientWidth, kids: [...g.children].map(c => c.getBoundingClientRect()) }));
    if (stacked) assert.ok(r.kids.every(k => Math.round(k.width) === r.w));
    else assert.equal(r.kids[0].top, r.kids[1].top);
  });
}
check('buttons are 48px pills and disabled ones look disabled', {}, async (page) => {
  const s = await page.locator('#buttons .btn--primary[disabled]').first().evaluate(el => { const c = getComputedStyle(el); return [c.borderRadius, c.backgroundColor, el.getBoundingClientRect().height]; });
  assert.deepEqual(s.slice(0, 2), ['999px', 'rgb(221, 229, 224)']);
  assert.ok(s[2] >= 48);
  assert.equal(await page.locator('#buttons a.btn[aria-disabled="true"][href]').count(), 0);
});
```

- [ ] **Step 2: Run the checks and confirm the new ones fail**

Expected: the sprite check fails with a 404 for `img/icons.svg`; the button check fails because no `#buttons .btn--primary[disabled]` exists.

- [ ] **Step 3: Write `img/icons.svg`**

- Start with a comment carrying Lucide's ISC license notice and the `lucide-static` version you read from.
- One `<symbol id viewBox="0 0 24 24">` per sprite id, containing the child elements only, with no stroke or fill attributes.
- Path data for `x`, `chevron-left`, `chevron-right`, `arrow-right`, `download`, `circle-check`, `triangle-alert`, `circle-alert`, `mail` and `map-pin`: copy from `SLP/js/script.js` `ICON_PATHS` (lines 306–366).
- For `menu`, `chevron-down`, `phone` and `external-link`: read `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/{name}.svg` with `curl -s` (text only) and copy the child elements.
- Wrap everything in `<svg xmlns="http://www.w3.org/2000/svg">` with no width or height.

- [ ] **Step 4: Write sections 1 and 2 of `components.css`**

§7 `.icon` rules and §8.1 exactly. Pair every `:hover` with `.is-hover`. Add `:active` for primary only (green-900).

- [ ] **Step 5: Fill `#icons` and `#buttons` in `index.html`**

- `#icons`: the usage rule "Use one Lucide icon next to visible text. Icons inherit the text color." Then a `.ds-icons` grid (add it to the preview `<style>`: `repeat(auto-fill, minmax(calc(var(--space-6) * 2), 1fr))`) of all 14 icons at 24px, each with its id as a caption.
- `#buttons`: the usage rule "Use one primary button per area. Start the label with a verb." Then one `.ds-specimen` row per variant with four `figure.ds-state` items:
  - Default.
  - Hover (`.is-hover`).
  - Focus (`.is-focus`).
  - Disabled (`disabled`).
  - Labels: "Apply now" (primary), "View requirements" (secondary), "Cancel" (ghost).
- Then a `div.btn-group` (the first one on the page) holding:
  - `<button class="btn btn--primary">` "Download form" with the `download` icon.
  - A secondary "Next" with `arrow-right` after the text.
  - `<a class="btn btn--secondary" role="link" aria-disabled="true">` "Disabled link" (no `href`).

- [ ] **Step 6: Run the checks and confirm they pass**

Expected: all pass. Look at `360.png`: the icons render and the buttons show four distinct states.

---

### Task 3: Header, footer and mobile menu

**Files:**
- Modify: `dswd/css/components.css` (sections 3 Header, 4 Footer)
- Modify: `dswd/js/ui.js` (§9 step 2)
- Modify: `dswd/index.html` (header before `<main>`, footer after it, the `#header-footer` section)
- Test: `dswd/tests/check.js`

**Interfaces:**
- Consumes: `.btn--ghost`, `.icon`, sprite ids `menu`, `map-pin`, `phone`, `mail`, `.grid`, `.span-md-6`, `.span-lg-3`.
- Produces:
  - `.site-header`, `.site-header__inner`, `.brand`, `.brand__logo`, `.brand__name`, `.menu-toggle`, `.site-nav`, `.site-nav__list`, `.site-nav__link`.
  - `.site-footer`, `.site-footer__heading`, `.site-footer__bottom`.
  - The selected-state style, shared with tabs in Task 6: green-100 background, green-900 text, weight 600, `box-shadow: inset 0 0 0 1px var(--green-600)`.

- [ ] **Step 1: Add the checks**

```js
check('menu opens with Enter and closes with Escape at 360px', { width: 360 }, async (page) => {
  const toggle = page.getByRole('button', { name: 'Menu' });
  const nav = page.getByRole('navigation', { name: 'Main' });
  assert.ok(await nav.isHidden());
  await toggle.focus(); await page.keyboard.press('Enter');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(await nav.isVisible());
  await nav.getByRole('link').first().focus(); await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(await nav.isHidden());
  assert.ok(await toggle.evaluate(el => el === document.activeElement));
});
check('desktop nav is a visible row and the toggle is hidden at 1024px', { width: 1024 }, async (page) => {
  assert.ok(await page.getByRole('button', { name: 'Menu' }).isHidden());
  const tops = await page.$$eval('.site-nav__link', els => els.map(e => e.getBoundingClientRect().top));
  assert.equal(new Set(tops).size, 1);
});
check('without JS the nav shows and the toggle is hidden', { width: 360, js: false }, async (page) => {
  assert.ok(await page.getByRole('navigation', { name: 'Main' }).isVisible());
  assert.ok(await page.locator('.menu-toggle').isHidden());
});
check('one current nav item, marked with the selected-state ring', {}, async (page) => {
  const current = page.locator('.site-nav [aria-current="page"]');
  assert.equal(await current.count(), 1);
  assert.match(await current.evaluate(el => getComputedStyle(el).boxShadow), /rgb\(30, 122, 76\).*inset|inset.*rgb\(30, 122, 76\)/);
});
check('footer focus ring is white', {}, async (page) => {
  await page.keyboard.press('Tab');
  const link = page.locator('.site-footer a').first(); await link.focus();
  assert.equal(await link.evaluate(el => getComputedStyle(el).outlineColor), 'rgb(255, 255, 255)');
});
```

- [ ] **Step 2: Run the checks and confirm the new ones fail**

Expected: the menu checks fail because the "Menu" button can't be found; the footer check fails because no `.site-footer a` exists.

- [ ] **Step 3: Write sections 3 and 4 of `components.css`**

§8.11 and §8.12 exactly, including the `html.js` visibility rules and the 1024px row. Pair `:hover` with `.is-hover` on `.site-nav__link`.

- [ ] **Step 4: Add the menu behavior to `ui.js`**

§9 step 2 exactly. A comment says the ARIA attribute is the only state.

- [ ] **Step 5: Add the header, footer and `#header-footer` section to `index.html`**

- Header markup per §8.11. Nav links in order: Home, About us, Programs and services (`aria-current="page"`), Transparency, News, Contact us, all `href="#"`.
- Footer markup and copy per §8.12.
- `#header-footer` section: the usage rule "Every page uses this header and footer. Below 1024px the nav collapses behind the Menu button." Then a list of the states that do not apply (§8).

- [ ] **Step 6: Run the checks and confirm they pass**

Expected: all pass. Look at the `360.png` and `1440.png` header and footer.

---

### Task 4: Breadcrumbs, card, alerts, table and pagination

**Files:**
- Modify: `dswd/css/components.css` (sections 5 Breadcrumbs, 6 Card, 7 Alerts, 8 Table, 9 Pagination)
- Modify: `dswd/index.html` (breadcrumb at the top of `<main>`, sections `#breadcrumbs`, `#card`, `#alerts`, `#table`, `#pagination`)
- Test: `dswd/tests/check.js`

**Interfaces:**
- Consumes: `.icon`, sprite ids `chevron-left`, `chevron-right`, `circle-check`, `triangle-alert`, `circle-alert`, `.grid` spans, `.num`.
- Produces:
  - `.breadcrumb`, `.breadcrumb__list`, `.breadcrumb__item`.
  - `.card`, `.card__title`.
  - `.alert`, `.alert--success`, `.alert--warning`, `.alert--error`, `.alert__icon`, `.alert__content`, `.alert__title`.
  - `.table-wrap`, `.table`.
  - `.pagination`, `.pagination__list`, `.pagination__link`.
  - Task 8 reuses `.table-wrap` and `.table` for the color table.

- [ ] **Step 1: Add the checks**

```js
check('breadcrumb ends with the current page as text', {}, async (page) => {
  const last = page.locator('main nav[aria-label="Breadcrumb"]').first().locator('[aria-current="page"]');
  assert.deepEqual(await last.evaluate(el => [el.tagName, el.textContent.trim()]), ['SPAN', 'Design system']);
});
check('table scrolls inside its own labelled region at 320px', { width: 320 }, async (page) => {
  const wrap = page.locator('#table .table-wrap');
  assert.deepEqual(await wrap.evaluate(el => [el.getAttribute('role'), el.tabIndex, el.scrollWidth > el.clientWidth]), ['region', 0, true]);
});
check('pagination has one current page and a non-link disabled Previous', {}, async (page) => {
  for (const nav of await page.locator('#pagination nav.pagination').all()) assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
  assert.deepEqual(await page.locator('#pagination [aria-disabled="true"]').first().evaluate(el => [el.tagName, el.textContent.trim()]), ['SPAN', 'Previous']);
});
check('alerts show the status on the border and icon, never as a side stripe', {}, async (page) => {
  const s = await page.locator('.alert--warning').first().evaluate(el => { const c = getComputedStyle(el); return [c.borderLeftWidth, c.borderLeftColor, getComputedStyle(el.querySelector('.alert__icon')).color]; });
  assert.deepEqual(s, ['1px', 'rgb(199, 119, 0)', 'rgb(199, 119, 0)']);
});
```

- [ ] **Step 2: Run the checks and confirm the new ones fail**

Expected: these four fail because the elements are missing.

- [ ] **Step 3: Write sections 5–9 of `components.css`**

§8.3 and §8.6–§8.9 exactly. Pair `:hover` with `.is-hover` on breadcrumb links and pagination links.

- [ ] **Step 4: Fill the markup in `index.html`**

- **Breadcrumb**, at the top of `<main>` before the H1: Home (`#`) › Resources (`#`) › `<span aria-current="page">Design system</span>`.
- **`#breadcrumbs`:** the rule "Show where the page sits. The last item is the current page and is not a link." Then a longer example: Home › Programs and services › Sustainable Livelihood Program › How to apply.
- **`#card`:** the rule "Group one topic. The title links to the full page; the card itself is not a button." Then four `article.card` items in `.grid` with `span-md-6`, using the §11 program names and descriptions. Each title links to `#`.
- **`#alerts`:** the rule "Use alerts for feedback only. The color is on the border and icon; the words carry the meaning." Then three alerts:
  - Success, "Application received": "Sample message. Your reference number is SAMPLE-0001. Keep it for follow-up."
  - Warning, "Your session will end soon": "Sample message. Save your work within 2 minutes."
  - Error, "There is a problem": "Sample message. Enter your full name to continue."
- **`#table`:** the rule "Use a caption. Numbers are right-aligned. On phones the table scrolls inside its frame." The caption is "Sample data: assistance requests". Columns: Reference no., Service, Date filed, Amount (`.num`), Status. Five rows `SAMPLE-0001`…`0005`:
  - Medical assistance, 1 Oct 2026, ₱5,000.00, Received.
  - Burial assistance, 2 Oct 2026, ₱10,000.00, Under review.
  - Educational assistance, 3 Oct 2026, ₱3,000.00, Released.
  - Transportation assistance, 5 Oct 2026, ₱1,500.00, Received.
  - Food assistance, 6 Oct 2026, ₱2,000.00, Under review.
- **`#pagination`:** the rule "Show where the reader is in a long list." Then two `nav`s with distinct `aria-label`s ("Pagination, first page example" and "Pagination, middle page example"):
  - Page 1 of 10, with Previous disabled.
  - Page 5 of 10, showing 1 … 4 5 6 … 10 with Previous and Next.

- [ ] **Step 5: Run the checks and confirm they pass**

Expected: all pass, including the 320px sideways-scroll check.

---

### Task 5: Form controls

**Files:**
- Modify: `dswd/css/components.css` (section 10 Form fields)
- Modify: `dswd/index.html` (section `#forms`)
- Test: `dswd/tests/check.js`

**Interfaces:**
- Consumes: `.icon`, sprite ids `chevron-down` and `circle-alert`, `.ds-specimen`, `.ds-state`, `.grid` spans.
- Produces: `.field`, `.field--error`, `.field__label`, `.field__required`, `.field__hint`, `.field__error`, `.input`, `.select`, `.fieldset`, `.fieldset--error`, `.fieldset__legend`, `.choices`, `.choice`.

- [ ] **Step 1: Add the checks**

```js
check('invalid controls point at an "Error:" message', {}, async (page) => {
  const bad = await page.$$eval('[aria-invalid="true"]', els => els.filter(el => !(el.getAttribute('aria-describedby') || '').split(/\s+/).some(id => document.getElementById(id)?.textContent.trim().startsWith('Error:'))).map(el => el.id));
  assert.deepEqual(bad, []);
  assert.ok((await page.locator('#forms [aria-invalid="true"]').count()) >= 2);
});
check('required controls say (required) in their label', {}, async (page) => {
  assert.deepEqual(await page.$$eval('#forms [required]', els => els.filter(el => ![el.labels?.[0], el.closest('fieldset')?.querySelector('legend')].some(n => n?.textContent.includes('(required)'))).map(el => el.id)), []);
});
check('text inputs are 48px tall with a 3:1 border', {}, async (page) => {
  const s = await page.locator('#forms input.input').first().evaluate(el => [el.getBoundingClientRect().height, getComputedStyle(el).borderTopColor]);
  assert.ok(s[0] >= 48); assert.equal(s[1], 'rgb(90, 103, 96)');
});
check('a disabled choice cannot be checked', {}, async (page) => {
  const box = page.locator('#forms input[type="checkbox"][disabled]').first();
  await box.click({ force: true });
  assert.equal(await box.isChecked(), false);
});
```

- [ ] **Step 2: Run the checks and confirm the new ones fail**

Expected: FAIL on the missing `#forms` controls (the `>= 2` assertion and the locator timeouts).

- [ ] **Step 3: Write section 10 of `components.css`**

§8.2 exactly. Pair `:hover` with `.is-hover` on `.input` and `.choice`.

- [ ] **Step 4: Fill `#forms` in `index.html`**

Usage rule: "Every field has a visible label. Hints say how to answer. Errors say how to fix it." Unique ids throughout. Contents:

- **Text input**, five `figure.ds-state` items in a `.grid` (`span-md-6`):
  - Default: "Full name (required)", hint "Write it as it appears on your valid ID.", `autocomplete="name"`.
  - Hover (`.is-hover`): "Email address", `type="email"`, `autocomplete="email"`.
  - Focus (`.is-focus`): "Mobile number", hint "For example, 0917 123 4567.", `type="tel"`, `autocomplete="tel"`.
  - Error: "Full name (required)", `.field--error`, message "Error: Enter your full name".
  - Disabled: "Reference number", value `SAMPLE-0001`.
- **Textarea:** "Your concern", hint "Describe it in a few sentences.", `rows="4"`.
- **Select:** "Type of assistance" with a first option "Choose one" (`value=""`) and then Medical assistance, Burial assistance, Educational assistance, Transportation assistance, Food assistance. Also a disabled select "Payout method", hint "Available after approval.".
- **Checkbox group** "Which programs are you asking about?", hint "Select all that apply.": the four §11 program names, with "Social Pension for Indigent Senior Citizens" disabled.
- **Checkbox error:** a fieldset `.fieldset--error` with legend "Privacy notice (required)", message "Error: Agree to the privacy notice to continue", one checkbox "I agree to the privacy notice" with `required` and `aria-invalid="true"`.
- **Radio group** "How should we contact you?": Mobile number (checked), Email address, Letter by post.

- [ ] **Step 5: Run the checks and confirm they pass**

Expected: all pass, including "every control and link has an accessible name" and "every id reference resolves".

---

### Task 6: Tabs and accordion

**Files:**
- Modify: `dswd/css/components.css` (sections 11 Tabs, 12 Accordion)
- Modify: `dswd/js/ui.js` (§9 step 3)
- Modify: `dswd/index.html` (sections `#tabs`, `#accordion`)
- Test: `dswd/tests/check.js`

**Interfaces:**
- Consumes: the selected-state style from Task 3, sprite id `chevron-down`.
- Produces: `.tabs`, `.tabs__list`, `.tabs__tab`, `.tabs__panel`, `.accordion`, `.accordion__item`, `.accordion__summary`, `.accordion__icon`, `.accordion__body`.

- [ ] **Step 1: Add the checks**

```js
const selectedTab = (page) => page.locator('#tabs [role="tab"][aria-selected="true"]').textContent();
const visiblePanels = (page) => page.$$eval('#tabs [role="tabpanel"]', els => els.filter(el => !el.hidden).map(el => el.id));
check('tabs follow the ARIA keyboard pattern', {}, async (page) => {
  await page.locator('#tabs [role="tab"][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowRight'); assert.equal((await selectedTab(page)).trim(), 'When to use');
  assert.equal((await visiblePanels(page)).length, 1);
  await page.keyboard.press('End'); assert.equal((await selectedTab(page)).trim(), 'Accessibility'); // last enabled; disabled "Archived" is skipped
  await page.keyboard.press('ArrowRight'); assert.equal((await selectedTab(page)).trim(), 'Overview'); // wraps
  await page.keyboard.press('ArrowLeft'); assert.equal((await selectedTab(page)).trim(), 'Accessibility');
  await page.keyboard.press('Home'); assert.equal((await selectedTab(page)).trim(), 'Overview');
  await page.locator('#tabs [role="tab"][aria-disabled="true"]').click({ force: true });
  assert.equal((await selectedTab(page)).trim(), 'Overview');
  assert.deepEqual(await page.$$eval('#tabs [role="tab"]', els => els.map(e => e.tabIndex)), [0, -1, -1, -1]);
});
check('without JS every tab panel shows', { js: false }, async (page) => {
  assert.equal((await visiblePanels(page)).length, 3);
});
check('accordion opens and closes from the keyboard', {}, async (page) => {
  const summary = page.locator('#accordion summary').first();
  await summary.focus(); await page.keyboard.press('Enter');
  assert.equal(await summary.evaluate(el => el.parentElement.open), true);
  await page.keyboard.press('Enter');
  assert.equal(await summary.evaluate(el => el.parentElement.open), false);
});
```

- [ ] **Step 2: Run the checks and confirm the new ones fail**

Expected: the locator timeouts fail because `#tabs [role="tab"]` and `#accordion summary` are missing.

- [ ] **Step 3: Write sections 11 and 12 of `components.css`**

§8.4 and §8.5 exactly. Pair `:hover` with `.is-hover` on `.tabs__tab` and `.accordion__summary`.

- [ ] **Step 4: Add the tabs behavior to `ui.js`**

§9 step 3. `select(tab)` sets `aria-selected` and `tabIndex` for every tab in its tablist, and `hidden` on each panel named by an `aria-controls` (a tab without `aria-controls` has no panel). Keyboard handling lives on the tablist (`keydown` for ArrowLeft, ArrowRight, Home and End over enabled tabs only, with `preventDefault`). The whole file stays at or under about 60 lines.

- [ ] **Step 5: Fill `#tabs` and `#accordion` in `index.html`**

- **`#tabs`:** the rule "Use tabs to switch between views of one topic. Keep labels short." Then a tablist with `aria-label="About tabs"`:
  - Overview (selected).
  - When to use.
  - Accessibility.
  - Archived: `aria-disabled="true"`, no `aria-controls`, and no panel. That leaves three panels.
  - Each panel has one or two sentences describing tabs themselves: what they are for, when to use them instead of the accordion, and their keyboard keys.
- **`#accordion`:** the rule "Use for FAQs. Readers open only what they need. No script is needed." Then four `details` items with these questions and short factual answers:
  - "Which files does a page need?" (the load order).
  - "How do I add an icon?" (add the Lucide symbol to `img/icons.svg` and use it with `<use>`).
  - "Why does the accordion have no script?" (native `<details>`: works before JS loads, works with keyboard and screen readers).
  - "Can I add another color or font?" (no; green and white with Inter only; status colors only for feedback).

- [ ] **Step 6: Run the checks and confirm they pass**

Expected: all pass.

---

### Task 7: Modal

**Files:**
- Modify: `dswd/css/components.css` (section 13 Modal)
- Modify: `dswd/js/ui.js` (§9 step 4)
- Modify: `dswd/index.html` (section `#modal`, with the `<dialog>` right after its open button)
- Test: `dswd/tests/check.js`

**Interfaces:**
- Consumes: `.btn` variants, `.h3`, sprite id `x`.
- Produces: `.modal`, `.modal__header`, `.modal__title`, `.modal__body`, `.modal__footer`, and the open-button contract `data-modal-open="{dialog id}"`.

- [ ] **Step 1: Add the checks**

```js
const opener = (page) => page.getByRole('button', { name: 'Open sample dialog' });
const isOpen = (page) => page.locator('#sample-dialog').evaluate(d => d.open);
check('dialog opens, makes the page inert, closes with Escape and returns focus', {}, async (page) => {
  await opener(page).click();
  assert.equal(await isOpen(page), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden');
  await page.evaluate(() => document.querySelector('.skip-link').focus());
  assert.ok(await page.evaluate(() => document.getElementById('sample-dialog').contains(document.activeElement)));
  await page.keyboard.press('Escape');
  assert.equal(await isOpen(page), false);
  assert.ok(await opener(page).evaluate(el => el === document.activeElement));
});
check('backdrop click closes the dialog and clicks inside do not', {}, async (page) => {
  await opener(page).click();
  await page.locator('#sample-dialog .modal__body').click();
  assert.equal(await isOpen(page), true);
  await page.mouse.click(5, 5);
  assert.equal(await isOpen(page), false);
});
check('Close and Cancel close the dialog', {}, async (page) => {
  for (const name of ['Close', 'Cancel']) {
    await opener(page).click();
    await page.locator('#sample-dialog').getByRole('button', { name }).click();
    assert.equal(await isOpen(page), false);
  }
});
```

- [ ] **Step 2: Run the checks and confirm the new ones fail**

Expected: the "Open sample dialog" button can't be found, so these three fail.

- [ ] **Step 3: Write section 13 of `components.css`**

§8.10 exactly, including `::backdrop` and `html:has(dialog:modal)`.

- [ ] **Step 4: Add the modal behavior to `ui.js`**

§9 step 4.

- [ ] **Step 5: Fill `#modal` in `index.html`**

The rule "Use a dialog only to confirm an action or protect focus. The browser handles focus and Escape." Then the button and dialog from §8.10. Body text: "Sample dialog. Check your details before you submit. You can't edit the request after this."

- [ ] **Step 6: Run the checks and confirm they pass**

Expected: all pass.

---

### Task 8: Foundations sections

**Files:**
- Modify: `dswd/index.html` (sections `#color`, `#typography`, `#spacing`, `#shape`, `#grid`, and the preview `<style>`)
- Test: `dswd/tests/check.js`

**Interfaces:**
- Consumes: `.table-wrap`, `.table` (Task 4), `.card`, `.btn`, `.input`, tokens.
- Produces: the finished preview page.

- [ ] **Step 1: Add the checks**

```js
const COLORS = { 'green-900':'#0F4A2C','green-700':'#166039','green-600':'#1E7A4C','green-100':'#E8F4EC','white':'#FFFFFF','surface':'#F6F9F7','text':'#1A2420','text-muted':'#5A6760','border':'#DDE5E0','success':'#1E8E5A','warning':'#C77700','error':'#C62828','border-strong':'#5A6760' };
check('color table matches tokens.css', {}, async (page) => {
  for (const [token, hex] of Object.entries(COLORS)) {
    assert.equal((await page.evaluate(t => getComputedStyle(document.documentElement).getPropertyValue(`--${t}`), token)).trim().toUpperCase(), hex);
    assert.equal(await page.locator('#color tr', { hasText: `--${token}` }).locator('td', { hasText: hex }).count(), 1, `--${token} row`);
  }
});
for (const [width, h1, h2] of [[360, '32px', '28px'], [1440, '40px', '32px']]) {
  check(`heading sizes at ${width}px`, { width }, async (page) => {
    assert.deepEqual(await page.evaluate(() => ['h1', '.h2'].map(s => getComputedStyle(document.querySelector(s)).fontSize)), [h1, h2]);
  });
}
check('spacing bars match the 8px scale', {}, async (page) => {
  assert.deepEqual(await page.$$eval('#spacing .ds-bar', els => els.map(e => e.getBoundingClientRect().width)), [8, 16, 24, 32, 48, 64]);
});
```

- [ ] **Step 2: Run the checks and confirm the new ones fail**

Expected: the color rows are missing, `.h2` doesn't exist, and `.ds-bar` doesn't exist.

- [ ] **Step 3: Fill the five sections and their preview classes**

- **`#color`:** the rule "Green and white carry the brand. Status colors appear only on icons and borders." Then the §5.1 color table and the three additions, as one `.table` with the columns Swatch, Token, Hex, Use, Contrast. The swatch is a `span.ds-swatch.ds-swatch--{token}` (24px square, `--border` outline). `--focus` and `--overlay` are listed with their values (`var(--green-600)` and `rgba(26, 36, 32, 0.5)`).
- **`#typography`:** the rule "One font, Inter. Weights 400, 500, 600." Then one row per style with `.h1`–`.h4`, body and small. Each specimen reads "Programs and services" (body: "Find help for your family."), with a caption giving size (phone / from 768px), line height and weight from §5.3.
- **`#spacing`:** the rule "Space comes in steps of 8px." Then six rows, each `div.ds-bar.ds-bar--{1..6}` (height `--space-2`, `--green-600` fill, width `var(--space-n)`) next to its token name and px value.
- **`#shape`:** the rule "Actions are pills; containers and fields are rounded 16px with a 1px border." Then three specimens: a `.btn--primary` "Pill (999px)", a `.card` "Card: 16px radius, 1px border, shadow", and an `.input` labelled "Field edge (3:1 border)".
- **`#grid`:** the rule "Twelve columns, up to 1200px wide. Columns stack below 768px." Then four `.grid` rows of `.ds-cell` items (green-100, `--radius`, `padding: var(--space-1)`, a centered label):
  - 1 × "12".
  - 2 × `span-md-6` "6".
  - 3 × `span-md-4` "4".
  - 4 × `span-md-6 span-lg-3` "3".

- [ ] **Step 4: Run the checks and confirm they pass**

Expected: all pass.

---

### Task 9: Review, documentation and handoff

**Files:**
- Modify: whatever the review findings name (inside `dswd/` only)
- Create: `dswd/.impeccable/review/desktop.png`, `dswd/.impeccable/review/mobile.png`
- Create: `dswd/DESIGN.md`, `dswd/.impeccable/design.json` (written by the documenter)

**Interfaces:**
- Consumes: the finished `dswd/`.
- Produces: the reviewed build and `DESIGN.md`.

- [ ] **Step 1: Run the full check suite**

Expected: every check prints PASS and the summary is `N/N passed`.

- [ ] **Step 2: Check the weight budget**

Run: `du -cb dswd/index.html dswd/css/*.css dswd/js/ui.js dswd/img/*.svg dswd/fonts/*.woff2 | tail -1`
Expected: under 122880 bytes (about 120 KB, §10).

- [ ] **Step 3: Run the Impeccable detector once**

Run: `"C:/Users/julie/.claude/plugins/cache/impeccable/impeccable/4.5.0/skills/impeccable/scripts/impeccable" detect --json dswd/index.html dswd/css dswd/js`

Fix the mechanical findings that do not conflict with the spec or the user's brief, then rerun the check suite (all pass). Keep the remaining findings for the reviewer.

- [ ] **Step 4: Capture review screenshots**

Capture at 1440 wide (full page) to `dswd/.impeccable/review/desktop.png` and at 390 wide to `mobile.png`. Use the harness's `open()` in a one-off script, or `node run.js -e`. Open both files once and confirm they show the whole page with no blank regions.

- [ ] **Step 5: Run the finish review**

Spawn `impeccable:impeccable-finish-reviewer` fresh, with no inherited history. Input packet:
- The user's phase 1 brief and the confirmed answers (spec §2).
- The artifact path `dswd/index.html` and the direction contract (from `surface-brief read dswd/index.html`).
- The screenshot paths, both required.
- The remaining detector findings.
- The craft-floor path `C:/Users/julie/.claude/plugins/cache/impeccable/impeccable/4.5.0/skills/impeccable/reference/craft-floor.md`.
- A note that this was a code-led build, so there is no comp.

Act on the disposition word:
- **fix:** one batch, rerun the checks, recapture, then a verdict pass from the same reviewer.
- **recapture:** recapture and review again.
- **rebuild:** tell the user and redo the named regions.
- **ship:** go on.

At most two rounds.

- [ ] **Step 6: Write `DESIGN.md`**

Spawn `impeccable:impeccable-documenter` with:
- The project root `C:\xampp\htdocs\SLP\dswd`.
- The artifact `dswd/index.html`, the direction contract, `dswd/PRODUCT.md`, and the `document.md` reference path.
- The write boundary: `dswd/DESIGN.md` and `dswd/.impeccable/` only.

Confirm both `DESIGN.md` (with tokens) and `.impeccable/design.json` exist.

- [ ] **Step 7: Confirm the SLP app is untouched**

Run: `npm test` in `C:\xampp\htdocs\SLP`.
Expected: the same pass count as before this work (13 tests, all passing).

- [ ] **Step 8: Hand off**

Reply with:
- The page URL.
- The check summary line.
- The reviewer's verdict at its actual scope.
- The decisions-to-confirm list from spec §14.
- The follow-ups from spec §15.
