---
name: DSWD Design System
description: Calm, official green-and-white parts for the DSWD website, built for phones on slow connections.
colors:
  green-900: "#0F4A2C"
  green-700: "#166039"
  green-600: "#1E7A4C"
  green-100: "#E8F4EC"
  white: "#FFFFFF"
  surface: "#F6F9F7"
  text: "#1A2420"
  text-muted: "#5A6760"
  border: "#DDE5E0"
  border-strong: "#5A6760"
  success: "#1E8E5A"
  warning: "#C77700"
  error: "#C62828"
  overlay: "rgba(26, 36, 32, 0.5)"
typography:
  h1:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
  h1-tablet-up:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.2
  h2:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
  h2-tablet-up:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
  h3:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  h4:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  radius: "16px"
  pill: "999px"
spacing:
  space-1: "8px"
  space-2: "16px"
  space-3: "24px"
  space-4: "32px"
  space-5: "48px"
  space-6: "64px"
components:
  button-primary:
    backgroundColor: "{colors.green-600}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.green-700}"
    textColor: "{colors.white}"
  button-primary-active:
    backgroundColor: "{colors.green-900}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.green-600}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.green-100}"
    textColor: "{colors.green-700}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.green-600}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.green-100}"
    textColor: "{colors.green-700}"
  button-disabled:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text-muted}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.radius}"
    padding: "12px 16px"
    height: "48px"
  input-disabled:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text-muted}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius}"
    padding: "24px"
  alert:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius}"
    padding: "16px 24px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  nav-link-current:
    backgroundColor: "{colors.green-100}"
    textColor: "{colors.green-900}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  tab-selected:
    backgroundColor: "{colors.green-100}"
    textColor: "{colors.green-900}"
  pagination-link:
    backgroundColor: "transparent"
    textColor: "{colors.green-600}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    width: "44px"
    height: "44px"
  pagination-link-current:
    backgroundColor: "{colors.green-600}"
    textColor: "{colors.white}"
  table-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    padding: "16px"
  modal:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius}"
    width: "560px"
  footer:
    backgroundColor: "{colors.green-900}"
    textColor: "{colors.white}"
    padding: "64px 0 32px"
---

# Design System: DSWD Design System

## Overview

**Creative North Star: "The Public Counter"**

A clean, well-lit government service counter: white, orderly, staffed in green, where every sign is plain and every action is within reach. The system is a reference kit for the DSWD website. Every page is built only from these tokens and components, so a citizen on a low-end phone over slow mobile data meets the same calm, trustworthy surface on every page.

Density is relaxed and generous: 48px controls, 44px minimum targets, 16px body text at a 1.5 line height, and paragraphs capped at about 72 characters. Depth is nearly flat: a hairline border and one faint shadow. Nothing moves except what the browser itself animates. Restraint is how the system shows it is official and non-partisan.

The system rejects the government-portal template of hero banners, carousels and icon-tile grids, and it rejects decoration in general: no gradients, no transitions or animations, no heavy shadows.

**Key Characteristics:**
- Green and white only; status colours appear only in feedback, on icons and borders.
- Inter alone, at weights 400, 500 and 600.
- Pills for every action, 16px-rounded boxes for everything that holds content or input.
- One 2px focus ring everywhere, offset 2px.
- Native HTML first (`<details>`, `<dialog>`, native checkboxes and selects); `ui.js` only enhances.
- Tokens only: every colour and size comes from `css/tokens.css`.

## Colors

A single green family on a white ground, with a cool green-grey for text and hairlines.

### Primary
- **Civic Green** (green-600): the action colour. Primary buttons, links, secondary-button outlines, pagination current page, checkbox and radio accent, caret, focus ring and the inset selected ring. 5.33:1 on white.
- **Deep Pine** (green-700): the hover and pressed-adjacent step. Button hover, link hover, nav and accordion hover text, the footer's inner divider.
- **Forest Ink** (green-900): the darkest green. Footer band, the brand name, text on the green-100 tint in selected states, primary button `:active`, `::selection` text. White on it is 10.31:1.
- **Mint Wash** (green-100): the tint. Hover backgrounds on secondary and ghost buttons, choices and pagination; selected and current backgrounds; `::selection`; secondary text on the footer.

### Neutral
- **Paper White** (white): page ground, cards, inputs, alerts, modals, the header.
- **Sage Mist** (surface): table header rows and the scrollbar track. Never a card ground.
- **Slate Ink** (text): all body copy and headings (15.94:1 on white). Also the input hover border.
- **Field Grey** (text-muted): hints, breadcrumb current item and separators, disabled text, pagination ellipsis (5.93:1 on white).
- **Hairline** (border): decorative 1px lines only: card, table, header, nav row, tabs, accordion dividers. Also the disabled-control fill. It is 1.28:1, so it never marks the edge of something interactive.
- **Control Edge** (border-strong): the 1px edge of every form control and the scrollbar thumb. Same value as text-muted, kept as its own token for its role (WCAG 1.4.11 needs 3:1).
- **Dialog Scrim** (overlay): slate ink at 50%, behind an open modal only.

### Status
- **Success** (success), **Warning** (warning), **Error** (error): feedback only. They colour the 1px alert border and the alert icon.

### Named Rules
**The Green-and-White Rule.** The brand is green-600/700/900, green-100 and white. No other hue appears outside feedback. No gradients.

**The Feedback-Only Rule.** Status colours appear only on icons and 1px borders inside feedback messages. Success (4.14:1) and warning (3.46:1) are never text. Error is the one status colour allowed as text, and only in a field error message.

**The Tint Is Not Enough Rule.** The green-100 tint is 1.12:1 against white, so a selected or current state always adds green-900 text, 600 weight and a 1px inset green-600 ring.

## Typography

**Display Font:** Inter (with system-ui, sans-serif)
**Body Font:** Inter (with system-ui, sans-serif)

**Character:** One self-hosted Inter variable file (Latin subset, weights 100 to 900) does every job. Hierarchy comes from size and three weights, never from a second family. The Latin subset has no peso sign (₱); it falls back to system-ui.

### Hierarchy
- **H1** (600, 32px on phones and 40px from 768px, 1.2): the page title, one per page.
- **H2** (600, 28px on phones and 32px from 768px, 1.2): page sections; 48px space above.
- **H3** (600, 24px, 1.2): sub-sections; 32px space above.
- **H4** (600, 20px, 1.2): card titles and small groups; 32px space above.
- **Body** (400, 16px, 1.5): all running text; paragraphs max `--measure` (36em, about 72 characters of Inter at any size; 70ch was about 88).
- **Small** (400, 14px, 1.5): hints, breadcrumbs, footer bottom line, the brand name on phones.
- **Label** (500, 16px, 1.25): buttons, nav links, tabs, pagination, field labels and legends. Field error messages also use 500.

Headings use `text-wrap: balance` and 16px space below. The `.h1` to `.h4` classes copy a heading's look onto any element without changing the outline.

### Named Rules
**The Three Weights Rule.** 400 for reading, 500 for things you press or label, 600 for headings and for selected or current states. No other weights.

**The One Family Rule.** Inter only. No system display face, no second font, no icon font.

## Layout

A centred container of at most 1200px with side padding of 16px on phones, 24px from 768px and 32px from 1024px. Inside it, a 12-column grid with a 16px gap (24px from 768px). Children span all 12 columns until a span class narrows them: `span-md-4` or `span-md-6` from 768px, `span-lg-3`, `span-lg-4`, `span-lg-8` or `span-lg-9` from 1024px. Spans no page used were removed in phase 4; add one back in base.css when a page needs it.

Spacing is an 8px scale (8, 16, 24, 32, 48, 64) and nothing else. Section rhythm: 48px before an H2, 32px before an H3 or H4, 24px between form fields and inside cards.

Breakpoints are mobile-first `min-width`, written literally in queries: 360px (button groups go from a full-width stack to a wrapping row), 768px (larger H1 and H2, wider padding and gap, md spans, full pagination, modal footer row), 1024px (desktop nav row, lg spans). There is no rule at 1440px because content already stops at 1200px. Every page reflows at 320px with no sideways scroll; long words wrap (`overflow-wrap: anywhere`), and wide tables scroll inside their own frame.

## Elevation & Depth

Nearly flat. Depth comes from a white surface, a 1px hairline and one faint ambient shadow; there is no elevation scale, and nothing lifts on hover.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06)`): cards and the modal only.
- **Inset selected ring** (`box-shadow: inset 0 0 0 1px` green-600): current nav link and selected tab. A state marker, not elevation.
- **Invalid ring** (`box-shadow: inset 0 0 0 1px` error): doubles an invalid input's border to 2px.

### Named Rules
**The One Shadow Rule.** The rest shadow is the only drop shadow, and only cards and the modal carry it. No hover lifts, no heavier shadows, no offset shadows.

**The Still Surface Rule.** No transitions and no animations. State changes are instant. The accordion chevron flips 180° with no motion.

## Shapes

Two radii. Fully rounded pills (999px) for everything you press or that marks position: buttons, nav links, tabs, pagination links, the skip link, and the hover row behind a checkbox or radio. A 16px radius for everything that holds content or input: cards, inputs, textareas, selects, alerts, the table frame and the modal. Edges are 1px: hairline on containers, border-strong on controls, a status colour on alerts. Lucide icons use a 1.5 stroke with round caps and joins.

## Components

### Buttons
Confident, compact pills; one primary per area; labels start with a verb.
- **Shape:** pill (999px), 48px min height, 12px 24px padding, 1px border, 8px gap to an icon.
- **Primary:** green-600 fill and border, white label. Hover green-700; active green-900.
- **Secondary:** white with a green-600 border and label. Hover: green-100 fill, green-700 border and label.
- **Ghost:** transparent, green-600 label, no visible border. Hover: green-100 fill, green-700 label. Used for the header Menu toggle.
- **Disabled:** `disabled` on a `<button>`, or `aria-disabled="true"` with no href on an `<a>`. Hairline fill, field-grey label, not-allowed cursor. A disabled ghost stays transparent.
- **Focus:** the global 2px green-600 outline, offset 2px.
- **Group:** stacked full width under 360px, a wrapping row with 16px gaps from 360px.
- No error state.

### Inputs / Fields
- **Structure:** label, then hint, then error, then the control, 8px apart; fields 24px apart. Required fields say "(required)" in the label at 400 weight; optional fields are not marked.
- **Style:** white, 1px border-strong edge, 16px radius, 48px min height, 12px 16px padding. Textareas resize vertically at a 1.5 line height.
- **Hover:** edge darkens to text colour.
- **Focus:** the global 2px green-600 ring.
- **Error:** `aria-invalid="true"`; edge and an inset 1px ring in error red (2px total). The message is error-red text at 500 weight with a circle-alert icon, linked by `aria-describedby`.
- **Disabled:** hairline fill and edge, field-grey text.
- **Select:** native `<select>` with `appearance: none` and a Lucide chevron-down on the right; the chevron goes field-grey when disabled.
- **Checkbox and radio:** native 20px controls with green-600 `accent-color`, inside 44px rows in a fieldset with a legend. The whole row is the target and gets a green-100 pill on hover. Invalid: a 2px dashed error outline offset 2px, which turns to the solid focus ring on focus. Dashed so it never reads as focus. Disabled rows are field grey with no hover.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** white.
- **Shadow Strategy:** rest shadow (see Elevation).
- **Border:** 1px hairline.
- **Internal Padding:** 24px; the H4-size title sits 8px above its content.
- The card is never clickable as a whole; its title link carries hover and focus. Never nest cards.

### Alerts
Feedback messages only. White, 16px radius, 16px 24px padding, a 1px border in the status colour and a 20px status icon (circle-check, triangle-alert, circle-alert) in the same colour. Title (600) and body stay slate ink. The title starts with a visually hidden type ("Success:", "Warning:", "Error:"), so screen readers hear the kind of message, not only its wording. Add `role="alert"` only when the alert is inserted after load.

### Navigation
- **Header:** white, a hairline bottom border. Row one is the brand (40px logo and agency name in forest ink at 600; 14px on phones, 16px from 768px). Row two is the nav, above a hairline.
- **Links:** pill, 44px min height, 0 16px padding, slate ink at 500. Hover: green-700 and underline. Current (`aria-current="page"`): green-100 fill, green-900 text at 600, inset green-600 ring.
- **Mobile:** below 1024px the nav stacks vertically and hides behind a ghost Menu button, but only once `ui.js` adds `html.js`; `aria-expanded` is the only state and Escape closes it. From 1024px the nav is a wrapping row and the toggle disappears.
- **Breadcrumbs:** 14px, Lucide chevron-right separators in field grey, links at least 44 × 44px, the current page a field-grey `<span aria-current="page">`. Sits 24px above the H1.
- **Footer:** forest ink band, white text, 64px top and 32px bottom padding. It sets the focus ring to white. Links are white and padded to 44px targets; contact rows and the bottom line are green-100, the bottom line at 14px above a green-700 divider.
- **Skip link:** first Tab stop, a primary-style pill visible only on focus.

### Tabs
WAI-ARIA tabs with automatic activation; arrows, Home and End move between enabled tabs. A wrapping row of pill tabs (44px, 0 16px, 500 weight) above a hairline; they wrap rather than scroll. Hover underlines. Selected: green-100 fill, green-900 at 600, inset green-600 ring. `aria-disabled="true"`: field grey, skipped by the keyboard. Without JS the tab list hides and every panel shows with its own heading.

### Accordion
Native `<details>`/`<summary>` between hairline dividers. The summary is 600 weight, at least 44px tall, 16px vertical padding, with a chevron-down on the right that flips when open. Hover: green-700. No script and no disabled state.

### Table
Always with a `<caption>` (600). Wrapped in a hairline frame with a 16px radius that scrolls sideways on its own (`role="region"`, `tabindex="0"`, labelled by the caption). Cells: 16px padding, hairline row dividers, no wrapping; the header row sits on surface at 600. Numbers align right with tabular figures.

### Pagination
Pill links at least 44 × 44px, green-600 at 500. Hover: green-100 fill, green-700 text. Current page: a solid green-600 fill with white text. This is the one current state that uses a solid fill instead of the tint and ring, so it reads as a position marker in a row of links. A disabled Previous or Next is a field-grey `<span role="link" aria-disabled="true">`. Phones show Previous, a "Page 2 of 5" status (`.pagination__status`) and Next; from 768px the numbers replace the status. The numbers are the first and last page and the pages next to the current one, with an ellipsis (`aria-hidden`) for a longer gap.

### Modal
Native `<dialog>` opened with `showModal()` via `data-modal-open`. White, 1px hairline, 16px radius, rest shadow, width min(100% − 32px, 560px), slate scrim. Padding 16px on phones and 24px from 768px. Footer buttons stack full width on phones and form a right-aligned row from 768px. Close and Cancel are buttons in a `<form method="dialog">`; a backdrop click closes it when the press also started on the backdrop, and `returnValue` is cleared on each opening. Use a dialog only to confirm an action.

### Icons
Lucide only, from the `img/icons.svg` sprite. 20px default, 24px large. They take `currentColor`, are always `aria-hidden` and always sit beside visible text. To add one, copy its Lucide paths into a new `<symbol>`.

## Site Components (phase 2)

These are added in `css/components.css` sections 14–32 for the PHP pages. They use the same tokens and rules.

- **Sticky header** (`.site-header`): CSS `position: sticky`. `--header-offset` (88px, or 140px from 1024px) drives `scroll-padding-top`, so anchors and focused fields stay visible.
  - Phones: logo plus "DSWD" (the link's `aria-label` carries the full name), Search, Menu.
  - From 768px: the full name.
  - From 1024px: a nav row with the **language toggle** (`.lang-toggle`) at its end. The current language uses the selected-state style.
- **Title band** (`.title-band`): the top of every page, on `--green-100`. It holds breadcrumbs (none on Home), the one H1 in `--green-900`, a lead sentence at 20px/1.5 and, when it belongs there, the page's one primary action. `.title-band--hero` is the Home version with the search form.
- **Search form** (`.search-form`): label, field and primary button. Stacked on phones, one row from 768px. Use `role="search"`.
- **Filters** (`.filters`): a GET form on `--surface` above a list. Fields sit in a row from 768px. Each list page has exactly one primary button, in the filters or the title band.
- **Link card** (`.card--link`): one stretched title link covers the card, so the card is one Tab stop and one target. Hover gives a green border, and keyboard focus puts the ring on the card. Quick access and program grids use it.
- **Media list** (`.media`): news and announcements. A thumbnail (96px on phones, 192px from 768px, lazy-loaded), then `.meta` (date and category in 14px muted text), the title link and an excerpt.
- **Section head** (`.section-head`): an H2 with a "See all" link on the right, in a 44px row.
- **Table of contents** (`.toc`): an "On this page" box for long pages; each link is a 44px row.
- **Checklist** (`.checklist`): requirements, each with a green check icon.
- **Steps** (`.steps`): a numbered list with `role="list"`. The numbers sit on green-100 circles.
- **File list** (`.file-list`): download links with the format and size.
- **Details** (`.details`): contact rows with an icon each and a visually hidden label.
- **Note** (`.note`): neutral information on `--surface`, such as the sample-content notice. Not for feedback.
- **Person** (`.person`): an official, with a photo or placeholder, name and position.
- **Org tree** (`.org-tree`): the organizational chart as nested lists, with 1px tree lines.
- **Band** (`.band`): a full-width call to action on `--surface` between sections.
- **Empty state** (`.empty`): a short title and a recovery hint.
- **Form stack** (`.form-stack`): 24px between the parts of a long form.
- **Prose** (`.prose`): long content from the content system.

Rules added in phase 2:
- **One primary per page:** each page has exactly one `.btn--primary`.
- **Below the fold is lazy:** every `<img>` below the first screen has `loading="lazy"`. The article cover is the exception and loads eagerly with `fetchpriority="high"`.
- **Placeholders are visible:** sample content carries `[Sample]` or `[brackets]` and a `data-placeholder` attribute, and dynamic regions carry `data-dynamic`.
- **Positioned scroll areas:** a scroll container (`.table-wrap`) is `position: relative`, so visually hidden text inside it cannot widen the page.

Rules added in phase 4:
- **Sections are `.page-section`:** every `<section>` of a long page carries it, so sections sit 64px apart. An H2 that opens a section gets no space from `* + h2`.
- **Standalone links are 44px rows:** section-head, table-of-contents and footer links pad to the target size; links inside sentences are exempt.
- **Assets go through `asset()` and `bundle()`:** they add `?v=<last change>` so browsers keep files for a year. After any CSS or JS change, run `php tools/build-assets.php`; until then pages fall back to the source files.
- **Photos:** at most 1600 pixels a side (the admin scales bigger ones before upload) and stored without metadata.
- **Font loading:** Inter is preloaded with `font-display: optional`. When the font arrives in time the page uses it; otherwise that one page view uses system-ui and later pages get Inter from the cache. With `swap`, Chrome held the first paint until the preloaded font arrived.

## Do's and Don'ts

### Do:
- **Do** take every colour, size, radius and shadow from `css/tokens.css`; if a value is missing, add a commented token there.
- **Do** load `tokens.css`, `base.css`, `components.css` in that order, then `ui.js` with `defer`.
- **Do** use pills (999px) for actions and position markers, and the 16px radius for cards, fields, alerts, tables and modals.
- **Do** give every form control a 1px border-strong edge, and use the hairline only for decorative lines.
- **Do** mark a selected or current state with green-100, green-900 text, 600 weight and a 1px inset green-600 ring.
- **Do** keep controls 48px tall and every target at least 44 × 44px.
- **Do** show focus with the one 2px solid ring offset 2px; set `--focus` to white on any dark green ground.
- **Do** drive state with native pseudo-classes and ARIA attributes (`:hover`, `:disabled`, `aria-invalid`, `aria-current`, `aria-selected`, `aria-expanded`, `[open]`).
- **Do** put a Lucide icon next to visible text, and pair every colour cue with text or an icon.
- **Do** use bracketed placeholders for content the agency has not supplied.

### Don't:
- **Don't** use success or warning colours as text, or any status colour outside a feedback message.
- **Don't** add hues beyond the green family and white, or any gradient.
- **Don't** add transitions, animations, hover lifts or shadows beyond the rest shadow on cards and the modal.
- **Don't** use a second font, a system display face or an icon font.
- **Don't** make a whole card clickable with a script or with links nested inside it; when the whole card must be a target, use `.card--link` (one stretched title link). Never nest cards.
- **Don't** hide navigation or content behind script that may never run; collapse only under `html.js`.
- **Don't** use the `ds-*` preview classes or the `.is-hover`, `.is-focus`, `.is-current` state classes on real pages.
- **Don't** build image hero banners or carousels. The Home "hero" is the title band with one message and the search form. The quick-access link cards are the only icon-card grid, because the brief asks for them; don't add others.
- **Don't** show officials' names or photos, political branding, or the official seal without DSWD authorisation.
