# DSWD website design system — phase 1 design

**Date:** 2026-10-12
**Status:** Design approved in chat (sections 1–3). This spec is awaiting review.
**Location:** `SLP/dswd/`, previewed at `http://localhost/SLP/dswd/index.html`

## 1. Goal

Build the design system for a redesigned website for the Department of Social Welfare and Development (DSWD, Philippines). It must be minimalist, calm, trustworthy, formal and non-partisan. It must work for citizens of all ages on slow mobile connections.

Phase 1 delivers reusable CSS and JavaScript files plus one preview page, `index.html`, that shows every component. Real pages come in later phases.

## 2. Decisions confirmed in chat

| Topic | Decision |
|---|---|
| Location | New subfolder `SLP/dswd/`. The SLP app's files are not touched. |
| Font loading | Self-host Inter as a variable WOFF2 file: `inter-latin-wght-normal.woff2` (48 KB, OFL-1.1), from jsDelivr `@fontsource-variable/inter@5.2.5`, plus its license file. |
| GOVPH elements | Not included. The header and footer carry only the DSWD identity. |
| Interactive components | Native-first. Accordion = `<details>`/`<summary>` (no JS). Modal = native `<dialog>`. JS only for the mobile menu, tabs, and opening the modal. |
| Logo | Neutral placeholder. The real DSWD seal is not used. |
| Language and theme | English only, light theme only. |
| Conflicts with the SLP design system | This brief wins (16px radius, pill buttons, card shadow). The SLP system is not changed. |

## 3. Scope

**In scope:** tokens, base styles, components (buttons, text input, textarea, select, checkbox, radio, card, tabs, accordion, breadcrumbs, alerts, table, pagination, modal, header with mobile menu, footer, skip link), `ui.js`, icon sprite, logo placeholder, self-hosted font, preview page, one check script, `PRODUCT.md`, `DESIGN.md`.

**Out of scope:** real content pages, search, dark mode, Filipino translation, a GOVPH bar, badges or status tags, a CMS or PHP integration, copy-paste code snippets on the preview page.

## 4. Files

```
SLP/dswd/
├─ index.html     Preview page (includes a small preview-only <style> block)
├─ PRODUCT.md             Impeccable product record (written before the build)
├─ DESIGN.md              Design record (written from the finished build)
├─ css/
│  ├─ tokens.css          Design tokens (CSS variables). Loads first.
│  ├─ base.css            @font-face, reset, typography, links, focus, layout, grid, utilities
│  └─ components.css      Every component, numbered sections
├─ js/ui.js               Mobile menu, tabs, modal opening (~60 lines, loaded with defer)
├─ img/
│  ├─ icons.svg           Lucide SVG sprite (<symbol>s)
│  └─ logo.svg            Placeholder logo
├─ fonts/
│  ├─ inter-latin-wght-normal.woff2
│  └─ LICENSE             SIL Open Font License for Inter
└─ tests/check.js         Playwright check script (see §13)
```

Load order on every page: `tokens.css` → `base.css` → `components.css`, then `<script src="js/ui.js" defer>`. Preload the font with `<link rel="preload" href="fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`.

## 5. Tokens (`css/tokens.css`)

### 5.1 Color

The brief's values are kept exactly. Contrast ratios use the WCAG 2.x formula.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--green-900` | `#0F4A2C` | Footer background, headings on tint | White on it 10.31:1 · on green-100 9.13:1 |
| `--green-700` | `#166039` | Button hover | White on it 7.59:1 · on green-100 6.72:1 |
| `--green-600` | `#1E7A4C` | Primary buttons, links, focus ring, selected-state ring | White on it 5.33:1 · on white 5.33:1 · on surface 5.02:1 · on green-100 4.71:1 |
| `--green-100` | `#E8F4EC` | Tint backgrounds (hover, selected, current) | — |
| `--white` | `#FFFFFF` | Page and card background | — |
| `--surface` | `#F6F9F7` | Table header, preview specimen areas | — |
| `--text` | `#1A2420` | Body text, headings | 15.94:1 on white · 15.04:1 on surface · 14.11:1 on green-100 |
| `--text-muted` | `#5A6760` | Hints, metadata, disabled text | 5.93:1 on white · 5.59:1 on surface · 5.24:1 on green-100 · 4.62:1 on border |
| `--border` | `#DDE5E0` | Card, modal, table and divider borders (decorative only); disabled background | 1.28:1 on white |
| `--success` | `#1E8E5A` | Success icon and border only | 4.14:1 on white (fails as text) |
| `--warning` | `#C77700` | Warning icon and border only | 3.46:1 on white (fails as text) |
| `--error` | `#C62828` | Error icon, border and error-message text | 5.62:1 on white · 5.30:1 on surface |

Additions:

| Token | Value | Why |
|---|---|---|
| `--border-strong` | `#5A6760` | Edges of inputs, selects and textareas. `--border` is 1.28:1 and WCAG 1.4.11 needs 3:1 for control edges. This is 5.93:1. |
| `--focus` | `var(--green-600)` | Focus ring color. The footer overrides it with `var(--white)`, because a green ring on green-900 is only 1.94:1. |
| `--overlay` | `rgba(26, 36, 32, 0.5)` | Dialog backdrop (`--text` at 50%). |

### 5.2 Status color rule

Success, warning and error colors appear only on icons and 1px borders, where 3:1 is enough (4.14, 3.46 and 5.62:1). Alert text uses `--text`. The only status color used as text is `--error`, for field error messages (5.62:1). Success and warning are never used as text.

### 5.3 Typography

- Family: `--font-sans: "Inter", system-ui, sans-serif`. The `@font-face` covers weights 100–900 and uses `font-display: swap`. The ₱ sign is not in the Latin subset, so it falls back to the system font.
- Sizes use `rem`, so they follow the reader's browser text size.

| Token | Phones (< 768px) | From 768px | Line height | Weight |
|---|---|---|---|---|
| `--fs-h1` | 2rem (32px) | 2.5rem (40px) | 1.2 | 600 |
| `--fs-h2` | 1.75rem (28px) | 2rem (32px) | 1.2 | 600 |
| `--fs-h3` | 1.5rem (24px) | same | 1.2 | 600 |
| `--fs-h4` | 1.25rem (20px) | same | 1.2 | 600 |
| `--fs-body` | 1rem (16px) | same | 1.5 | 400 |
| `--fs-small` | 0.875rem (14px) | same | 1.5 | 400 |

- Weights: `--fw-regular: 400` (body), `--fw-medium: 500` (labels, buttons, nav), `--fw-semibold: 600` (headings, selected states).
- Line heights: `--lh-body: 1.5`, `--lh-heading: 1.2`, `--lh-control: 1.25` (single-line controls).
- The phone sizes for H1 and H2 are the one deviation from the brief: a 40px H1 wraps most titles to three or more lines at 360px.

### 5.4 Spacing, shape, layout

- Spacing (8px scale): `--space-1: 8px`, `--space-2: 16px`, `--space-3: 24px`, `--space-4: 32px`, `--space-5: 48px`, `--space-6: 64px`.
- Shape: `--radius: 16px` (cards, inputs, modals, alerts, table wrapper), `--radius-pill: 999px` (buttons, tabs, nav links, pagination), `--shadow: 0 1px 3px rgba(0, 0, 0, 0.06)` (cards and modal only).
- Controls: `--control-height: 48px` (minimum height of buttons, inputs and selects; above the brief's 44px minimum so buttons and fields line up), `--btn-padding: 12px 24px`, `--input-padding: 12px 16px`, `--target-min: 44px` (minimum size of any other target), `--choice-size: 20px` (checkbox and radio).
- Icons: `--icon: 20px`, `--icon-lg: 24px`.
- Layout: `--container: 1200px` (maximum content width), `--page-padding` (16px, 24px from 768px, 32px from 1024px), `--grid-gap` (16px, 24px from 768px), `--modal-width: 560px`.

### 5.5 Breakpoints

Mobile-first `min-width` queries. CSS variables cannot be used inside `@media`, so the values are documented in a comment in `tokens.css` and written literally in the queries.

| Width | What changes |
|---|---|
| Base (< 360px) | Button groups stack full width. |
| 360px | Button groups sit in a row and wrap. |
| 768px | H1 and H2 sizes, page padding, grid gap, `span-md-*` classes, footer becomes 2 columns. |
| 1024px | The desktop nav row replaces the Menu button. Page padding 32px. `span-lg-*` classes. Footer becomes 4 columns. The preview contents list becomes a sticky side column. |
| 1440px | No rule. Content already stops at 1200px. Tested at this width. |

## 6. Base styles (`css/base.css`)

- `@font-face` for Inter, then a small reset: `box-sizing: border-box`, no body margin, media `max-width: 100%`, form controls inherit `font`.
- `html { color-scheme: light; scrollbar-color: var(--border-strong) var(--surface); }`
- `body`: `--font-sans`, `--fs-body`, `--lh-body`, `--text` color, `--white` background.
- Headings `h1`–`h4` and the matching classes `.h1`–`.h4` (same look, any element, so the preview can show sizes without breaking the heading outline). Weight 600, line height 1.2, `margin: 0 0 var(--space-2)`. `* + h2 { margin-top: var(--space-5) }` and `* + h3, * + h4 { margin-top: var(--space-4) }`, so headings have more space above than below.
- `p { margin: 0 0 var(--space-2); max-width: 70ch; }`
- Links: `--green-600`, underlined, `text-underline-offset: 0.2em`. Hover: `--green-700` and a 2px underline.
- Focus: `:focus-visible, .is-focus { outline: 2px solid var(--focus); outline-offset: 2px; }`. `[tabindex="-1"]:focus { outline: none; }` for the skip-link target.
- `::selection { background: var(--green-100); color: var(--green-900); }` and `caret-color: var(--green-600)` on inputs.
- Layout: `.container { width: min(100% - 2 * var(--page-padding), var(--container)); margin-inline: auto; }`
- Grid: `.grid` is 12 columns (`repeat(12, minmax(0, 1fr))`) with `gap: var(--grid-gap)`. Children span 12 by default. Span classes `.span-md-{3,4,6,8,9}` (from 768px) and `.span-lg-{3,4,6,8,9}` (from 1024px).
- Utilities: `.visually-hidden`, `.num` (right-aligned, `font-variant-numeric: tabular-nums`).
- The skip link: `.skip-link` is visually hidden until focused, then appears at the top left as a green-600 pill with white text.

## 7. Icons (`img/icons.svg`)

- Lucide outline icons as `<symbol id="{name}" viewBox="0 0 24 24">`. Path data is reused from SLP's `ICON_PATHS` (`js/script.js`), which is already Lucide. Four new ones (`menu`, `chevron-down`, `phone`, `external-link`) are checked against the `lucide-static` package source before use. The sprite starts with a comment carrying Lucide's ISC license notice.
- Only icons that are used are included: `menu`, `x`, `chevron-down`, `chevron-left`, `chevron-right`, `arrow-right`, `download`, `external-link`, `circle-check`, `triangle-alert`, `circle-alert`, `phone`, `mail`, `map-pin`.
- Symbols carry no stroke or fill attributes. The `.icon` class sets `width/height: var(--icon)`, `fill: none`, `stroke: currentColor`, `stroke-width: 1.5`, round caps and joins, `flex: none`. `.icon--24` uses `--icon-lg`. These properties inherit into the `<use>` shadow tree.
- Usage: `<svg class="icon" aria-hidden="true" focusable="false"><use href="img/icons.svg#menu"></use></svg>`. Icons are always decorative and sit next to visible text.
- Limitation: an external sprite only loads over http(s). The page must be opened through XAMPP, not as a local file.

## 8. Components (`css/components.css`)

**Conventions**

- BEM class names: `block`, `block__element`, `block--modifier`.
- State comes from native pseudo-classes and ARIA attributes, not state classes: `:hover`, `:focus-visible`, `:active`, `:disabled`, `[aria-disabled="true"]`, `[aria-invalid="true"]`, `[aria-current]`, `[aria-selected]`, `[aria-expanded]`, `[open]`, `:modal`.
- Preview-only classes `.is-hover` and `.is-focus` are paired with the real pseudo-classes, so the preview can show those states statically. They have no other use.
- **Selected and current states** (selected tab, current nav item) use a green-100 background, green-900 text, weight 600 **and** a 1px inset green-600 ring (`box-shadow: inset 0 0 0 1px var(--green-600)`). The tint alone is 1.12:1 against white, which fails WCAG 1.4.11 for a state indicator. The ring is 5.33:1.
- Components use tokens only. No hard-coded colors or sizes, no inline `style=""`, no gradients, no transitions or animations.

**States that do not apply** (documented on the preview page): buttons, tabs, accordion, menu, breadcrumbs and pagination have no error state. `<details>` cannot be disabled.

### 8.1 Buttons

- `.btn` + `.btn--primary` | `.btn--secondary` | `.btn--ghost`. `inline-flex`, centered, `gap: var(--space-1)`, `min-height: var(--control-height)`, `padding: var(--btn-padding)`, `border: 1px solid`, `border-radius: var(--radius-pill)`, weight 500, `line-height: var(--lh-control)`.
- Primary: green-600 fill, white text. Hover: green-700. Active: green-900.
- Secondary: white fill, green-600 border and text. Hover: green-100 fill, green-700 border and text.
- Ghost: transparent, green-600 text, no visible border. Hover: green-100 fill, green-700 text.
- Disabled (`:disabled` on buttons, `[aria-disabled="true"]` on links without `href`): `--border` fill and border, `--text-muted` text, `cursor: not-allowed`, no hover change. Ghost keeps a transparent fill.
- `.btn-group`: stacked full width below 360px, a wrapping row from 360px, `gap: var(--space-2)`.

### 8.2 Form fields

```html
<div class="field">
  <label class="field__label" for="full-name">Full name <span class="field__required">(required)</span></label>
  <p class="field__hint" id="full-name-hint">Write it as it appears on your valid ID.</p>
  <input class="input" id="full-name" name="full-name" type="text" autocomplete="name" required aria-describedby="full-name-hint">
</div>
```

- Order: label, hint, error message, control. `.field > * + * { margin-top: var(--space-1) }` and `.field + .field { margin-top: var(--space-3) }`.
- Label: block, weight 500. `(required)` is visible text in weight 400. Optional fields are not marked.
- Hint: `--fs-small`, `--text-muted`.
- `.input` (used on `input`, `textarea` and `select`): full width, `min-height: var(--control-height)`, `padding: var(--input-padding)`, `line-height: var(--lh-control)`, white background, `1px solid var(--border-strong)`, `border-radius: var(--radius)`. Textareas use the `rows` attribute for height, `line-height: var(--lh-body)`, `resize: vertical`.
- Hover: border `--text`. Focus: the global focus ring.
- Error: the field gets `.field--error`. The control gets `aria-invalid="true"` and `aria-describedby` pointing at the hint and the error. Border `--error` plus `box-shadow: inset 0 0 0 1px var(--error)`. The message is `<p class="field__error" id="…-error">` with a `circle-alert` icon, visible text "Error:" and the fix, for example "Error: Enter your full name". Error text is `--error`, weight 500.
- Disabled: `--border` background, `--text-muted` text, `--border` border, `cursor: not-allowed`.
- Select: `<div class="select"><select class="input">…</select><svg class="icon">chevron-down</svg></div>`. The select has `appearance: none` and room on the right. The icon is absolutely positioned and has `pointer-events: none`.
- Checkboxes and radios are native, `--choice-size` square, `accent-color: var(--green-600)`, `margin: 0`. Each sits in `<label class="choice">` (flex row, `min-height: var(--target-min)`, `gap: var(--space-2)`, pill radius). Hover: green-100 row background. Disabled: `.choice:has(input:disabled)` uses `--text-muted` and `cursor: not-allowed`.
- Groups use `<fieldset class="fieldset">` with `<legend class="fieldset__legend">` (weight 500), an optional hint, and `<div class="choices">`. Error: `.fieldset--error`, an error message with the same markup as fields, placed above the choices and linked with `aria-describedby` on the fieldset.

### 8.3 Card

- `<article class="card">` with `.card__title` (an `h3` at `--fs-h4`, usually wrapping a link) and body text.
- White, `1px solid var(--border)`, `--radius`, `--shadow`, `padding: var(--space-3)`. The last child has no bottom margin.
- The card itself is not clickable. Links inside it carry the hover and focus states.

### 8.4 Tabs

```html
<div class="tabs">
  <div class="tabs__list" role="tablist" aria-label="Program details">
    <button class="tabs__tab" type="button" role="tab" id="tab-a" aria-controls="panel-a" aria-selected="true">Overview</button>
  </div>
  <div class="tabs__panel" role="tabpanel" id="panel-a" aria-labelledby="tab-a" tabindex="0">…</div>
</div>
```

- `.tabs__list`: flex row, `gap: var(--space-1)`, `overflow-x: auto` (scrolls sideways on phones), `padding: var(--space-1)` so focus rings are not clipped, bottom border `--border`.
- `.tabs__tab`: pill, `min-height: var(--target-min)`, `padding: 0 var(--space-2)`, no border, transparent, `--text-muted`, weight 500, `white-space: nowrap`.
- Hover: `--text` color and an underline. Selected (`aria-selected="true"`): the selected-state style. Disabled (`aria-disabled="true"`): `--text-muted`, `cursor: not-allowed`, no hover change, skipped by the keyboard.
- `.tabs__panel`: `padding-top: var(--space-3)`. Without JS, every panel shows.

### 8.5 Accordion

```html
<div class="accordion">
  <details class="accordion__item">
    <summary class="accordion__summary">Question text<svg class="icon accordion__icon" aria-hidden="true" focusable="false"><use href="img/icons.svg#chevron-down"></use></svg></summary>
    <div class="accordion__body"><p>Answer.</p></div>
  </details>
</div>
```

- `.accordion` has a top border and each item a bottom border (`--border`).
- `.accordion__summary`: flex, space-between, `min-height: var(--target-min)`, `padding: var(--space-2) 0`, weight 600, `cursor: pointer`, `list-style: none`, and the WebKit marker hidden.
- Hover: `--green-700` text. Focus: the global ring. Open: the icon is rotated 180° (no transition).
- `.accordion__body`: `padding-bottom: var(--space-3)`.

### 8.6 Breadcrumbs

- `<nav class="breadcrumb" aria-label="Breadcrumb"><ol class="breadcrumb__list">`. Each item after the first starts with a `chevron-right` icon (`aria-hidden`).
- The list is a wrapping flex row, `gap: var(--space-1)`, `--fs-small`, no bullets.
- Links are `inline-flex` and centered, with `min-width` and `min-height: var(--target-min)`, so a short label like "Home" still gives a 44px target. The current page is a `<span aria-current="page">` in `--text-muted`, not a link.

### 8.7 Alerts

```html
<div class="alert alert--success">
  <svg class="icon icon--24 alert__icon" aria-hidden="true" focusable="false"><use href="img/icons.svg#circle-check"></use></svg>
  <div class="alert__content"><p class="alert__title">Title</p><p>Body.</p></div>
</div>
```

- Flex row, `gap: var(--space-2)`, `padding: var(--space-2) var(--space-3)`, white background, `1px solid`, `--radius`.
- `.alert--success` / `--warning` / `--error` set the border and icon color to the status token. Icons: `circle-check`, `triangle-alert`, `circle-alert`.
- `.alert__title` weight 600. Body text is `--text`.
- No colored side stripe. `role="alert"` is added only when the alert is inserted dynamically.

### 8.8 Table

```html
<div class="table-wrap" role="region" aria-labelledby="t-caption" tabindex="0">
  <table class="table"><caption id="t-caption">…</caption>…</table>
</div>
```

- `.table-wrap`: `overflow-x: auto`, `1px solid var(--border)`, `--radius`.
- `.table`: full width, `border-collapse: collapse`. Caption left-aligned, weight 600, `padding: var(--space-2)`.
- `th` and `td`: `padding: var(--space-2)`, left-aligned, `white-space: nowrap` (the region scrolls rather than the cells wrapping), bottom border `--border` (none on the last row). `th` uses `scope`, a `--surface` background and weight 600. Numeric columns use `.num`.

### 8.9 Pagination

- `<nav class="pagination" aria-label="Pagination"><ul class="pagination__list">`, a wrapping flex row, `gap: var(--space-1)`.
- `.pagination__link`: `inline-flex`, `min-width` and `min-height: var(--target-min)`, pill, `--green-600`, weight 500, no underline. Page numbers have `aria-label="Page N"`. Previous and Next show an icon and text.
- Hover: green-100 background, `--green-700` text. Current (`aria-current="page"`): green-600 fill, white text.
- Disabled Previous or Next: `<span class="pagination__link" aria-disabled="true">` in `--text-muted` with `cursor: not-allowed`.
- Ellipsis: `<span aria-hidden="true">…</span>`.

### 8.10 Modal

```html
<button class="btn btn--secondary" type="button" data-modal-open="sample-dialog">Open sample dialog</button>
<dialog class="modal" id="sample-dialog" aria-labelledby="sample-dialog-title">
  <div class="modal__header">
    <h2 class="modal__title h3" id="sample-dialog-title">Submit your request?</h2>
    <form method="dialog"><button class="btn btn--ghost" type="submit">(x icon) Close</button></form>
  </div>
  <div class="modal__body"><p>…</p></div>
  <form class="modal__footer" method="dialog">
    <button class="btn btn--secondary" type="submit" value="cancel">Cancel</button>
    <button class="btn btn--primary" type="submit" value="confirm">Submit request</button>
  </form>
</dialog>
```

- `.modal`: `width: min(100% - 2 * var(--space-2), var(--modal-width))`, `padding: 0`, `1px solid var(--border)`, `--radius`, `--shadow`. `::backdrop { background: var(--overlay) }`.
- Header: flex, space-between, `padding: var(--space-3) var(--space-3) 0`. Body: `padding: var(--space-2) var(--space-3)`. Footer: wrapping flex row, right-aligned, `gap: var(--space-2)`, `padding: 0 var(--space-3) var(--space-3)`. The three parts cover the whole dialog box, so a click on the dialog element itself is a backdrop click.
- `html:has(dialog:modal) { overflow: hidden; }` locks page scroll without JS.
- The browser traps focus, closes on Escape and returns focus to the opening button.

### 8.11 Header with mobile menu

```html
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="#"><img class="brand__logo" src="img/logo.svg" alt="" width="40" height="40"><span class="brand__name">Department of Social Welfare and Development</span></a>
    <button class="btn btn--ghost menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">(menu icon) Menu</button>
    <nav class="site-nav" id="site-nav" aria-label="Main"><ul class="site-nav__list">…</ul></nav>
  </div>
</header>
```

- Two rows at every width: the brand (and the Menu button below 1024px), then the nav. This keeps long nav labels from colliding with the agency name.
- `.site-header`: white, bottom border `--border`. `.site-header__inner`: wrapping flex row, space-between, `gap: var(--space-2)`, `padding-block: var(--space-2)`.
- `.brand`: flex, `gap: var(--space-2)`, `--green-900`, weight 600, `line-height: var(--lh-heading)`, no underline. The name wraps to two lines on phones.
- `.site-nav`: `flex-basis: 100%`. The list is a column on phones and a row from 1024px.
- `.site-nav__link`: flex, `min-height: var(--target-min)`, `padding: 0 var(--space-2)`, pill, `--text`, weight 500, no underline. Hover: `--green-700` and an underline. Current (`aria-current="page"`): the selected-state style.
- Visibility: `.menu-toggle` is hidden without JS, so the nav always shows. With JS (`html.js`), below 1024px, `.menu-toggle[aria-expanded="false"] + .site-nav` is hidden. From 1024px, the toggle is hidden and the nav always shows. The ARIA attribute is the only state.
- Sample links: Home, About us, Programs and services (current), Transparency, News, Contact us. All point to `#`.

### 8.12 Footer

- `.site-footer`: green-900 background, white text, `--focus: var(--white)`, `padding-block: var(--space-6) var(--space-4)`.
- A `.grid` of four blocks: the brand (logo, agency name, contact rows with `map-pin`, `phone` and `mail` icons and the bracketed placeholders `[Office address]`, `[Hotline number]`, `[Email address]`), then three link columns. Each column is a `<nav aria-labelledby>` with an `h2.site-footer__heading` (`--fs-body`, weight 600) and a plain list.
- Columns: About (Mandate and functions, Vision and mission, Contact us); Programs and services (Pantawid Pamilyang Pilipino Program, Sustainable Livelihood Program, Assistance to Individuals in Crisis Situations, Social Pension for Indigent Senior Citizens); Transparency (Freedom of Information, Citizen's Charter, Transparency Seal, Procurement).
- Bottom row, above a top border in `--green-700`: `© 2026 Department of Social Welfare and Development`, plus Privacy policy, Terms of use and Accessibility links.
- 1 column on phones, `span-md-6` from 768px, `span-lg-3` from 1024px.
- Links: white, underlined, `inline-flex` with `min-height: var(--target-min)`. Hover: a 2px underline. Secondary text: `--green-100` (9.13:1).

## 9. JavaScript (`js/ui.js`)

About 60 lines with no dependencies, loaded with `defer`.

1. `document.documentElement.classList.add("js")`. The mobile nav collapses only after this runs, so a script that never loads leaves the nav visible.
2. **Menu.** A click on `.menu-toggle` flips `aria-expanded`. Escape closes it and returns focus to the toggle, but only while focus is inside the header, so it does not compete with an open dialog.
3. **Tabs.** For each `[role="tablist"]`: one selected tab has `tabindex="0"` and the others `-1`. Unselected panels get `hidden`. A click selects. Left and Right arrows wrap; Home and End go to the first and last tab. Arrow keys move focus and select (automatic activation). `aria-disabled` tabs are skipped and cannot be selected. If no tab is marked selected, the first enabled tab is selected.
4. **Modal.** `[data-modal-open="id"]` calls `showModal()` on that dialog. A click whose target is the `dialog.modal` element itself (the backdrop) calls `close()`. Close, Cancel and Escape need no JS.

## 10. Preview page (`index.html`)

- `<html lang="en">`, title "Design system | DSWD", meta description and viewport, font preload, the three stylesheets, a preview-only `<style>` block, and `ui.js` with `defer`.
- Order: skip link, header (§8.11), `<main id="main" tabindex="-1">` with the breadcrumb (Home / Resources / Design system), H1 "Design system" and a two-sentence intro naming the load order, then the footer (§8.12).
- Inside main, a `.grid`: an "On this page" `<nav>` (`span-lg-3`, sticky from 1024px, a plain list at the top on phones) and the content (`span-lg-9`).
- Sections, each a `<section aria-labelledby>` with an H2, a one-line usage rule, then live examples with states side by side and a small caption under each state:
  - **Foundations**
    - Color: the §5.1 table, built with the table component, with a swatch chip in the first column.
    - Typography: `.h1`–`.h4`, body and small specimens with size, line height and weight.
    - Spacing: one bar per token.
    - Shape and elevation: pill, 16px card with border and shadow, input edge.
    - Grid: rows of 12, 6+6, 4+4+4 and 3+3+3+3 cells, with a note that columns stack below 768px.
    - Icons: every sprite icon with its name.
  - **Components**
    - Buttons: three variants × default, hover, focus, disabled, plus buttons with icons.
    - Form controls: text input (default, hover, focus, error, disabled), textarea, select (default, disabled), checkbox group (with one disabled option, plus an error example), radio group.
    - Card: four program cards.
    - Tabs: one disabled tab included.
    - Accordion: FAQs.
    - Breadcrumbs.
    - Alerts: success, warning, error.
    - Table: sample data.
    - Pagination: first page with Previous disabled; a middle page with an ellipsis.
    - Modal.
    - Header and footer: a note that they frame this page, and that below 1024px the Menu button appears. The section also lists the states that do not apply (§8).
- The preview-only `<style>` holds classes prefixed `ds-`: specimen areas (`--surface` background, `--radius`, padding, wrapping flex with gap), swatch chips (one class per color token), spacing bars, the icon grid, the state captions and the sticky contents list. Token values only.
- Weight budget: under about 120 KB uncompressed in total (HTML about 35 KB, CSS about 15 KB, JS about 2 KB, sprite about 5 KB, font 48 KB).

## 11. Content rules

- Sentence case for headings, buttons and labels. Buttons start with a verb.
- Only real program names and plain one-line descriptions with no figures. Card descriptions:
  - Pantawid Pamilyang Pilipino Program: cash grants for poor households with children, tied to health and education conditions.
  - Sustainable Livelihood Program: capacity building that helps poor families start or grow a livelihood.
  - Assistance to Individuals in Crisis Situations: medical, burial, transport, education or food help for people in crisis.
  - Social Pension for Indigent Senior Citizens: a regular stipend for senior citizens with no pension or income.
- Tab panels and FAQ answers describe how to use the component or the design system itself. They make no claims about programs.
- The table, alerts and dialog are labelled as samples and use `SAMPLE-0001`-style references.
- Contact details are bracketed placeholders. No invented hotlines, addresses, statistics, officials, or political names or images.

## 12. Accessibility requirements (WCAG 2.1 AA, with 2.2 target size)

- Every text and background pairing is at least 4.5:1 (§5.1). Control edges, focus rings and selected or current indicators are at least 3:1.
- Every component target is at least 44 × 44px: buttons, the menu toggle, nav links, tabs, accordion summaries, breadcrumb and pagination links, choice rows and footer links. Buttons and inputs are 48px tall. Links inside running text and the preview's contents list follow WCAG 2.5.8 (at least 24px).
- One `h1`. A logical `h2`/`h3` order. Landmarks: header, nav (labelled), main, footer.
- Labels are visible and linked with `for`/`id`. Hints and errors are linked with `aria-describedby`. "(required)" is text. Errors use a border, an icon and the word "Error:".
- Keyboard: everything works by keyboard with a visible focus ring. The skip link is the first Tab stop.
- No information is conveyed by color alone. No motion.
- At 400% zoom (320 CSS px) the page reflows with no sideways page scroll. The table scrolls inside its own region.

## 13. Testing and review

1. **Live view during the build:** `playwright-skill` drives a visible browser on `http://localhost/SLP/dswd/index.html`.
2. **Check script, `dswd/tests/check.js`,** run through the playwright-skill runner. At 360, 768, 1024 and 1440px it checks and fails on:
   - Sideways page scroll (`scrollWidth > clientWidth`).
   - Any console error, or any failed request (font, sprite, logo, CSS, JS).
   - Any visible form control without an accessible name.
   - The first Tab stop is not the skip link.

   At 360px:
   - Menu: Enter opens it (`aria-expanded="true"`, nav visible). Escape closes it and focus returns to the toggle.

   At 1024px:
   - Tabs: ArrowRight, ArrowLeft, Home and End move selection, skip the disabled tab, and show only the selected panel.
   - Accordion: Enter on a focused summary opens and closes it.
   - Dialog: the button opens it, Escape closes it and focus returns to the button, and a backdrop click closes it.

   It saves a full-page screenshot per width to `dswd/tests/screenshots/`.
3. **Impeccable detector:** run once on the changed files and fix the mechanical findings.
4. **Impeccable finish reviewer:** a fresh subagent reviews against this spec. At most one fix round, then a verdict.
5. **Impeccable documenter:** writes `dswd/DESIGN.md` from the finished build.
6. **SLP app:** run `npm test` once at the end to show the SLP app still passes.

## 14. Decisions for the user to confirm (delivered with the build)

1. Success and warning colors are never used as text; they appear only on icons and borders.
2. `--border-strong` (`#5A6760`) outlines form controls.
3. A white focus ring inside the green footer.
4. Smaller H1 (32px) and H2 (28px) on phones.
5. Buttons and inputs are 48px tall (the brief's minimum is 44px).
6. Selected tab and current nav item get a 1px green ring in addition to the tint.
7. Native `<details>` accordion with no accordion JS.
8. No rule at 360px except button groups, and none at 1440px.
9. States that do not apply: no error state on buttons, tabs, accordion, menu, breadcrumbs or pagination. `<details>` cannot be disabled.
10. Icons are drawn with `stroke-width="1.5"` in Lucide's 24-unit grid, so at 20px the line renders at about 1.25px.
11. The logo is a placeholder. Use of the official DSWD seal needs the agency's authorisation.
12. Contact details are bracketed placeholders.

## 15. Follow-ups (not in phase 1)

Real pages; Filipino language; search; a Latin Extended font subset if ₱ must render in Inter; copy-paste markup snippets for developers; a GOVPH bar if the agency later requires it.

Confirm-before-submit dialogs (from the code review). In phase 1 the dialog opener is a plain button, so it does nothing without JS. Before a dialog guards a real form:
- Make the opener the form's submit button, so the form still submits when ui.js is missing.
- Have ui.js intercept that click (after `checkValidity()`) and open the dialog.
- Give the dialog's confirm button `form="<form id>"`.
