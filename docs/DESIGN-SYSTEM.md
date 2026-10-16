# SLP Information System — Design System & Redesign Handoff

**System:** Sustainable Livelihood Program (SLP) Information and Monitoring System
**Agency:** Municipal Social Welfare and Development Office (MSWDO), Municipality of Lubang, Occidental Mindoro
**Version:** 3.0 (October 2026): visual layer now follows the **DSWD design system**

> **Version 3: the DSWD design system.** The visual reference is `dswd/design-system.html` (open `http://localhost/SLP/dswd/design-system.html`). `css/tokens.css` keeps SLP's token names but carries the DSWD values. Where this document's older numbers conflict with it, `css/tokens.css` and the reference win:
>
> | | Now (DSWD) | Was (v2) |
> |---|---|---|
> | Colour | Green and white only: `#1E7A4C` primary, `#0F4A2C` footer band and selected text, `#E8F4EC` tint | `#166534` green with a blue info colour |
> | Status | Success, warning and error colour only the icon and the 1px border. Text stays `#1A2420` and backgrounds stay white. Info is brand green. | Tinted backgrounds and coloured text |
> | Shape | 16px corners for cards, fields, dialogs, alerts and tables. Pills for buttons, tabs, nav items, badges and pagination. | 4px everywhere |
> | Controls | 48px buttons and inputs; focus ring 2px green with a 2px gap | 44px; 3px ring |
> | Type | Inter self-hosted (`assets/fonts`). Page title 32px (40px from 768px). 14px is the smallest UI text; 12px is used only inside the official form replicas. | Google Fonts; 24px title; 12px captions |
> | Layout | White sidebar with pill items; current item has the green tint and a 1px inset ring. White page canvas. | Green sidebar; grey canvas |
> | Motion | None | 150–200ms transitions |
>
> The official form replicas (Annex G.1, AA, AC, AF.1) keep square, ruled fields. The check script is `tests/ui/design-check.js`; it reads every expected value live from the reference page.

| Deliverable | Where |
|---|---|
| 1. Design rationale | [§1](#1-design-rationale) |
| 2. Design tokens | [`css/tokens.css`](../css/tokens.css) · reference in [§2](#2-design-tokens) |
| 3. Component library spec | [§3](#3-component-library) · live gallery: [`docs/components.html`](components.html) |
| 4. Redesigned pages | Working code: [`index.html`](../index.html), [`css/style.css`](../css/style.css), [`js/script.js`](../js/script.js) · layouts in [§4](#4-page-layouts) |
| 5. Accessibility checklist | [§5](#5-accessibility-checklist-wcag-22-aa) |
| 6. Consistency audit | [§6](#6-consistency-audit) |
| 7. Implementation notes | [§7](#7-implementation-notes) |

---

## 0. Context and assumptions

The brief's placeholders were filled from the codebase. **Flagged assumptions** are marked ⚑.

| Brief field | Value used |
|---|---|
| System & purpose | SLP Information & Monitoring System: beneficiary registry, livelihood projects, assistance grants, field monitoring, reports, notices, accounts, and the SLP Eligibility Assessment & Profile Form |
| Primary users | MSWDO personnel (staff), SLP Association Leaders, SLP Participants/Members |
| Platform | Responsive web (phone → desktop), served by XAMPP |
| Stack | Plain HTML + CSS + vanilla JavaScript, in-memory demo data; PHP + MySQL planned |
| Languages | English UI; the official form contains Filipino questions (items 15–17) ⚑ bilingual hints added to those items only; full Filipino localisation is a follow-up (§7.6) |
| Accent colours | **Zero.** One brand colour (SLP green) plus status colours ⚑ |
| Brand colour | SLP green `#166534` (chosen by the client; the old navy, green and gold were merged into one hue) |
| Seal / logo | Not supplied ⚑ placeholder at `assets/img/seal.svg`, referenced everywhere a seal appears |

Other assumptions ⚑:

- **Label casing.** Field labels, column headers and status names use Title Case (they are data names, and match the official SLP form). Headings, buttons, descriptions and messages use sentence case. Existing tests assert on several of these strings ("Household Information", "Access Denied", "Profile Status").
- **Functionality preserved.** Nothing was removed. The additions are usability and safety features the brief asked for: review steps, confirmations, a session-timeout warning, sorting, filtering, pagination, CSV export, print views, and calculation helpers.
- **The prototype's demo sign-in buttons are kept**, labelled "Prototype only", and commented for removal before deployment.
- **Dark mode was not built.** These are official records that get printed and are mostly used in daylight field and office conditions. The token layer makes a dark theme possible later.

---

## 1. Design rationale

### What changed and why

| Change | Why |
|---|---|
| **One typeface (Inter), 6 sizes, 3 weights; base size up from 14px to 16px** | The old UI used 3 font families and about 15 sizes, from 9.5px to 30px. Older adults and users on small phones need 16px body text. Fewer sizes make the hierarchy obvious. |
| **One brand colour (SLP green) + neutral grays + 4 status colours** | The old palette had 4 hue families (navy, green, gold, plus status colours) used decoratively. Colour now carries meaning only (interactive or status), which reads as calm and official. |
| **Flat surfaces, 1px borders, one 4px radius, shadows only on overlays** | Gradients, glass blur, hover lift and 5 shadow levels were visual noise. Flat surfaces render faster on low-end devices and print cleanly. |
| **Solid SLP-green sidebar** (client request) | White text on `#166534` (7.13:1). Hover: white background, green text. Current page: darker green `#0F3F22` (11.97:1) with a white inset bar. Focus ring turns white inside the sidebar. |
| **One page title (h1) with breadcrumb in the content area** | Previously a topbar title and a card title restated each other ("Beneficiaries Management" / "Beneficiary Registry"). Now there is one h1 per page with sections below it. |
| **Agency identity in header, footer and print header** | Required for official systems. The seal and office name are in the header and footer, and every printout carries a header. The GOV.PH "Republic of the Philippines" banner was removed at the client's request. |
| **Forms: one column, visible labels, hints, inline validation, error summary, review step, confirmation** | Required for government forms and for users with low digital literacy. Every modal form now goes Form → *Check your answers* → Save. |
| **SLP profile form became a 6-step guided form** | 29 items on one page was overwhelming. Steps are Consent → Personal → Household → Expenses → Personnel (view only) → Review. The print view still produces the three-page official layout. |
| **Tables: sortable headers, labelled search, status filter, pagination, CSV export, print** | Staff manage registries. These are standard affordances, all keyboard-accessible. |
| **Safety: confirmation dialogs, unsaved-changes guard, 15-minute session timeout with a 2-minute warning, role badge always visible** | Security-conscious UX: people should always know who they are signed in as and never lose work silently. |
| **Icons: one set (Lucide), one stroke, fixed meanings, always next to text** | Icons used to vary in stroke and size. Now each meaning maps to exactly one icon (§3.13). |

### Principles (use these to settle disputes)

1. **Meaning before decoration.** If an element doesn't help someone finish a task, remove it.
2. **Same thing, same look, same place.** Primary action at the top right of the card; record actions in the modal footer; status shown as a badge.
3. **Say it plainly.** Use verbs on buttons, give examples in hints, and write errors that say how to fix the problem.
4. **Never rely on one cue.** Colour always has an icon and text with it; required fields say "(required)"; errors use a border, an icon and text.
5. **Protect the user's work and data.** Confirm before irreversible actions, warn before data is lost, and show only what each role may see.

---

## 2. Design tokens

Source of truth: [`css/tokens.css`](../css/tokens.css). Components use **semantic** tokens (`--color-*`, `--space-*`), never palette values.

### 2.1 Colour

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `--color-text` | `#161A21` | 17.44:1 on white | Body, headings, table data |
| `--color-text-secondary` | `#525A66` | 6.97:1 on white · 6.50:1 on bg | Hints, descriptions, metadata |
| `--color-text-disabled` | `#6B7280` | 4.20:1 on sunken (exempt) | Disabled controls |
| `--color-bg` | `#F6F7F9` | — | Page canvas |
| `--color-surface` | `#FFFFFF` | — | Cards, header, sidebar, inputs |
| `--color-surface-muted` | `#F6F7F9` | — | Table header, read-only fields, hover |
| `--color-surface-sunken` | `#EDEFF2` | — | Disabled fields, gov banner |
| `--color-border` | `#DCDFE4` | 1.34:1 (decorative only) | Card outlines, dividers |
| `--color-border-strong` | `#6B7280` | **4.83:1** (≥ 3:1 non-text) | Input and secondary-button outlines |
| `--color-primary` | `#166534` | 7.13:1 with white | Primary buttons, links, selected states |
| `--color-primary-hover` | `#14532D` | 9.11:1 | Hover; selected nav text |
| `--color-primary-active` | `#0F3F22` | — | Pressed |
| `--color-primary-subtle` | `#EEF6F0` | 8.28:1 with hover-green text | Selected nav, selected step |
| `--color-primary-pressed` | `#D7EBDD` | 7.30:1 with hover-green text | Tertiary pressed, text selection |
| `--color-focus` | `#14532D` | 9.11:1 on white | Focus ring (3px, 2px offset) |
| `--color-sidebar` / `-hover` / `-active` | `#166534` / `#FFFFFF` / `#0F3F22` | 7.13:1 · 7.13:1 · 11.97:1 | Sidebar background, hover (white bg + green text), current page |
| `--color-icon` | `#166534` | 7.13:1 on white | Default icon colour. Icons on filled buttons, in badges and in error messages keep their context colour |
| `--color-success` / `-bg` / `-border` | `#1E6B34` / `#EDF7EF` / `#B7DEC0` | 5.97:1 text on bg | Approved, Active, Completed |
| `--color-warning` / … | `#7A4A00` / `#FFF6E5` / `#F5D48F` | 6.97:1 | For Review, Needs Follow-up |
| `--color-error` / … | `#A21C14` / `#FDEEEE` / `#F2B8B5` | 6.87:1 · 7.74:1 white on fill | Errors, destructive buttons, count dot |
| `--color-info` / … | `#183E70` / `#EEF3FA` / `#B3C9E6` | 9.60:1 | Ongoing, informational alerts (kept blue so info never looks like success) |

All ratios were computed with the WCAG 2.x relative-luminance formula.

**Light/dark usage rules**
- Text goes only on `surface`, `bg`, `surface-muted` or a status `-bg`. Never put secondary text on a coloured fill.
- White text goes only on `primary` (any state) or `error` fills.
- Status text uses the status's own `-700/800` colour on its own `-bg`. Don't mix them (no warning text on a success background).
- `--color-border` is decorative only. Anything that marks the edge of a control uses `--color-border-strong`.

### 2.2 Typography — Inter only

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `--font-size-32` | 32 / 40 | Semibold | Sign-in title, stat values |
| `--font-size-24` | 24 / 32 | Semibold | Page title `h1` |
| `--font-size-20` | 20 / 28 | Semibold | Card / section heading `h2`, modal title |
| `--font-size-16` | 16 / 24 | Regular · Medium for labels/buttons/nav · Semibold for `h3` | Body, inputs, buttons, form labels |
| `--font-size-14` | 14 / 20 | Regular · Semibold for table headers | Table text, hints, card descriptions, toolbar labels, badges |
| `--font-size-12` | 12 / 16 | Semibold | Count dot, stepper numbers, captions only |

Weights: 400 regular, 500 medium, 600 semibold. No bold (700), no light (300), no uppercase micro-labels. IDs use `font-variant-numeric: tabular-nums` instead of a monospace font.

### 2.3 Spacing and layout

- **Spacing:** `--space-half` 4 · `--space-1` 8 · `--space-2` 16 · `--space-3` 24 · `--space-4` 32 · `--space-5` 40 · `--space-6` 48 · `--space-8` 64. The 4px half step is only for icon-to-text gaps.
- **Grid:** `.grid-12`, 12 columns, 24px gutter. Spans: `.span-sm-6` (≥600px), `.span-lg-3/4/6/8` (≥1200px). Everything is full width below those breakpoints.
- **Breakpoints:** `sm 600px` · `md 900px` (the sidebar becomes persistent) · `lg 1200px`.
- **Page margin:** 16px → 24px (≥600) → 32px (≥1200). **Max content width** 1280px. **Form width** 640px.
- **Card padding:** 24px (16px under 600px). **Header** 64px. **Sidebar** 256px.
- **Minimum target:** 44 × 44px.

### 2.4 Shape, elevation, motion

- **Radius:** `--radius` 4px for everything. `--radius-round` is reserved for the count dot, avatar, stepper number and spinner.
- **Border:** `--border` (1px solid `--color-border`) everywhere. Inputs use `--border-input`. Indicators (selected tab underline, selected nav inset bar) are 3px.
- **Elevation:** `--elevation-1` for toasts, `--elevation-2` for modals and the open drawer. Cards never have a shadow.
- **Motion:** 150ms for colour changes, 200ms for dialog fade and drawer slide. Nothing moves on hover. `prefers-reduced-motion` turns all motion off.

---

## 3. Component library

Live with all states: **[`docs/components.html`](components.html)** (uses the production CSS and JS). JS helpers live in `js/script.js` §7–8. **Always build from these. Never hand-write one-off markup.**

### 3.1 Button — `button(label, onclick, {variant, icon, type})`

| Variant | Use | Rule |
|---|---|---|
| `btn--primary` | The one main action in a card, modal or step | **Max one per area.** Placed last (rightmost) in modal footers and first in card headers |
| `btn--secondary` | Supporting actions: Export, Print, Cancel, Back | |
| `btn--tertiary` | Row actions in tables ("View"), "Change" in review lists, "Mark as read" | Underlined like a link, with a 44px target |
| `btn--destructive` | Only inside a confirmation dialog, for the risky choice | Never on a page directly |
| `btn--icon` | Menu, close, dismiss | Must have `aria-label` and `title` |

States: default · hover (darker fill or border) · focus (3px ring) · active (darkest) · disabled (gray fill, `cursor: not-allowed`).
✅ "Add beneficiary", "Confirm and save profile". ❌ "+ Add New", "Submit", "OK", all caps, two primary buttons together.

### 3.2 Form field — `formField({id, label, required, hint, options, type})`

Structure: `label` → `hint` → `control` → `error`. The label is always visible and linked with `for`/`id`. Hints are linked with `aria-describedby`.
- Mark required fields `(required)` in text. Don't mark optional fields.
- Use **placeholders only for examples in search boxes**. Never put a label or an instruction in a placeholder.
- States: default · hover · focus (ring + green border) · error (red border + inset, icon + "Error:" text below, `aria-invalid`) · disabled · read-only (muted background, still focusable, used for personnel fields).
- **Selects** have a custom chevron and stay native for accessibility. **Date pickers** use native `type="date"`, which gives localisation, works with screen readers, and costs no JS on low-end phones. **Files** are a native input with a styled button.
- **Checkboxes and radios** are native, 20px, `accent-color: primary`, in a `label.choice` with a 44px row. Groups use `fieldset` + `legend` (`radioGroup()`).

### 3.3 Validation

- Validate **on submit**: show the error summary at the top, linking to each field, and move focus to the summary.
- **Inline:** check a field when the user leaves it (if they typed something) and re-check while they type once an error is showing.
- **Messages say how to fix it:** "Enter last name", "Select a beneficiary", "Enter the amount in numbers only, for example 5000".

### 3.4 Review step and confirmation — `modalForm()` + `reviewForm()`

Every create form: **Continue to review** → *Check your answers* (summary list with Change links) → **Confirm**. After saving, staff see a toast naming the new record ID. Participants see a confirmation screen (profile saved, document submitted) with next steps.

### 3.5 Alert — `alertBox(type, title, body)`

Types: `info` · `success` · `warning` · `error` · `neutral`. Inline and persistent, made of icon + title + body. Use for context (role notice, read-only section, "nothing saved yet"), not for transient feedback.

### 3.6 Toast — `showToast(message, type)`

Confirms an action that just happened. Lives in a `aria-live="polite"` region (errors use `role="alert"`). Lasts 5s (8s for errors) and has a dismiss button. ❌ Never put the only copy of important information in a toast.

### 3.7 Badge — `statusBadge(status)`, `roleBadge(role)`

Always **icon + text**. Status map: Active/Approved/Completed/Submitted/Good → success ✓ · For Review/For Monitoring → warning (clock) · Needs Follow-up → warning (triangle) · Ongoing → info (arrow) · Rejected/Inactive → error (×) · anything else → neutral. Add new statuses to `STATUS_TONES`, never inline.

### 3.8 Card, stat, action tile

- **Card:** white, 1px border, 4px radius, 24px padding, no shadow. Header: `cardHeader(title, description, actions)`.
- **Stat:** `statCard(label, value, icon)`. The label goes above a 32px value. No coloured icon boxes.
- **Action tile:** `quickAction(icon, title, action, description)`. A real `<button>` with an icon, title, description and chevron.

### 3.9 Data table — `tableToolbar()` + `dataTable()`

- Toolbar: labelled **Search**, an optional **filter select**, and a live record count ("Showing 2 of 5 beneficiaries").
- Sortable headers are `<button>`s inside `<th aria-sort>`, with a sort icon that reflects the state.
- Numbers and money are right-aligned with tabular figures. IDs use `.text-id`. Row actions use tertiary "View" buttons with a hidden record name for screen readers.
- Pagination appears automatically above 10 rows. Printing ignores pagination and prints every matching row.
- Empty table → empty state. No search matches → "No matching records" state.
- Wide tables scroll inside a focusable, labelled region.

### 3.10 Tabs, breadcrumbs, stepper, sidebar

- **Tabs:** ARIA tabs pattern (`role=tab`, `aria-selected`, arrow-key navigation). Used for All / Unread notifications.
- **Breadcrumb:** `nav > ol`. "Home" is a link and the current page has `aria-current="page"`.
- **Stepper:** numbered buttons, current step `aria-current="step"`. Labels collapse to numbers on phones except the current step.
- **Sidebar item:** 44px, icon + label. The current page is marked by `aria-current="page"`, shown with a green tint and a 3px inset bar.

### 3.11 Modal and alert dialog

- **Modal** (`openModal`): forms and record details. Focus moves to the first field (or the title), Tab is trapped inside, Escape and the backdrop close it, and focus returns to the trigger. The background is `inert`. On phones it becomes a bottom sheet with full-width, stacked buttons.
- **Alert dialog** (`confirmAction`, session warning): sits above the modal, so an open form is never lost. **Focus starts on the safe choice.** Escape means cancel.

### 3.12 Summary list, empty / error / loading states

- **Summary list** (`summaryList`): label/value rows for record details and review steps. Missing answers show "⚠ Not provided".
- **Empty state** (`emptyState`): icon, title, a one-line explanation, and an optional action.
- **Error state:** the same component with `state--error` and an eyebrow ("Error 403"), used for Access Denied and Page Not Found.
- **Loading:** `.spinner` (static under reduced motion) with visible text, or `.skeleton` blocks. No shimmer.

### 3.13 Icon map (Lucide outline, 2px stroke, round caps)

| Meaning | Icon | Meaning | Icon |
|---|---|---|---|
| Dashboard | `layout-dashboard` | Add / create | `plus` |
| Beneficiaries · Leader role | `users` | View record | (text button "View") |
| Member role | `user` | Change / edit | `pencil` |
| Profile | `square-user` | Review step | `clipboard-list` |
| Livelihood projects | `briefcase` | Confirm · approve · mark read | `check` |
| Assistance | `wallet` | Mark all read | `check-check` |
| Field monitoring | `clipboard-check` | Export CSV | `download` |
| Reports | `file-text` | Upload | `upload` |
| Notifications | `bell` | Print | `printer` |
| User accounts | `user-cog` | Send | `send` |
| Documents | `folder` | Calculate | `calculator` |
| Home | `home` | Sign out | `log-out` |
| Staff role | `shield-check` | Close / dismiss | `x` |
| Read-only · access denied · privacy | `lock` | Back / Next | `arrow-left` / `arrow-right` |
| Success | `circle-check` | Pending | `clock` |
| Needs attention · not provided | `triangle-alert` | Field error | `circle-alert` |
| Rejected | `circle-x` | Ongoing | `circle-arrow-right` |
| Info | `info` | Empty list / no results | `inbox` / `search-x` |
| Date · recipient | `calendar` · `mail` | Sort | `chevrons-up-down` / `arrow-up` / `arrow-down` |

Sizes: 16 (inside badges and 14px text), 20 (default), 24 (action tiles, states). Icons are always `aria-hidden`; the text next to them carries the meaning. To add an icon, add the Lucide path data to `ICON_PATHS` and add a row to this table.

---

## 4. Page layouts

All pages share one shell: **header (menu · seal + "MSWDO Lubang" · notification bell with unread count · name + role badge · Sign out) → sidebar | main (breadcrumb · h1 · description · content) → footer (seal, office, privacy, session note).** Below 900px the sidebar becomes a drawer that holds the user's identity and Sign out.

| Page | Layout |
|---|---|
| **Sign in** | Agency identity → card: "Sign in" (32px), subtitle, *Sign in as* select with hint, password + Show/Hide button, full-width primary button, error text, privacy note, demo accounts (prototype only) → footer. A notice appears after sign-out or timeout. |
| **Dashboard (staff)** | 4 stat tiles (3+3+3+3 cols) · *Recent beneficiaries* table (8 cols) · *Quick actions* tiles (4 cols) |
| **Dashboard (participant)** | Role notice for leaders · 4 stat tiles · *My beneficiary information* summary list (8) · *Quick actions* (4) |
| **Beneficiaries · Projects · Assistance · Monitoring · Reports · Accounts · Documents** | One registry card: header (title, description, Export CSV · Print · **Add …**) → toolbar (Search, status/type filter, count; Assistance adds the total disbursed) → sortable table → pagination. **View** opens a record modal with a summary list, related documents (with Approve for staff), and footer actions (Print record · secondary · **primary**). |
| **Monitoring tools** (staff) | One sidebar item per tool under Monitoring: MD Monitoring Tool (Association) · Organization Assessment Tool · MD Usbong Assessment Tool. Each is a fillable replica of its annex (AA, AC, AF.1) built from the paper-form components, with scored rubric tables, totals and status levels calculated automatically, Save, Print / save as PDF, and a download of the blank official PDF. |
| **Notifications** | Card: header (Mark all as read · **Send notification**) → tabs All / Unread → list of notices (Unread/Read badge, recipient, date, title, message, Mark as read) |
| **Manage profile** | A fillable replica of **Annex G.1** (official wording and layout): instruction alert · Print form / **Review and save** · Page 1 (masthead, 16-box PCN, Participant ID, I. Declaration with 4 consent check boxes, signature/date/thumbmark, II. items 1–14) · Page 2 (items 15–17 in Filipino, 18 household table, 19–21 income, IV.A item 22 expenses in the paper arrangement with Calculate, 23 net income, 24 vulnerability with Filipino translations and 3/2/1 scores) · Page 3 (personnel only, read-only: IV.B items 25–28, V. track 29, both reference slips). Review modal with Change links → **Confirm and save** → confirmation. Ruled lines use `--color-paper-line`; under 760px the grid collapses to one column. |
| **Access denied / not found** | Error state card: lock or search icon, "Error 403/404", title, explanation, **Return to dashboard** |
| **Print** | A4. Print header with seal, office and print date. No navigation or buttons. Tables show every matching row with repeated headers. The profile prints all steps in the official three-page bordered layout (page breaks before items 15 and 25). Printing from a record modal prints only that record. |

---

## 5. Accessibility checklist (WCAG 2.2 AA)

| # | Requirement | How it is met |
|---|---|---|
| 1.1.1 | Non-text content | Icons are `aria-hidden` with visible text. Seal images use `alt=""` next to the office name. Icon-only buttons have `aria-label`. |
| 1.3.1 | Info & relationships | Semantic landmarks (`header`, `nav`, `main`, `aside`, `footer`). One `h1` per page with an `h2`/`h3` hierarchy. Tables have `caption`, `th scope`. Radio groups are `fieldset` + `legend`. Labels linked with `for`/`id`. Hints and errors linked with `aria-describedby`. Household and vulnerability inputs have accessible names. |
| 1.3.5 | Identify input purpose | `autocomplete` on name, birthday, phone, email and password fields |
| 1.4.1 | Use of colour | Status = icon + text. Errors = border + icon + "Error:" text. Required = "(required)". Unread = "Unread" badge. Links are underlined. |
| 1.4.3 | Contrast (text) | Every text pairing ≥ 4.5:1 (lowest: 5.97:1). See §2.1. |
| 1.4.4 / 1.4.10 | Resize & reflow | rem units based on the user's browser size. Verified at 375px with no horizontal page scroll. Wide tables scroll inside their region. |
| 1.4.11 | Non-text contrast | Input borders 4.83:1, focus ring 10.70:1, selected states ≥ 3:1 |
| 1.4.12 | Text spacing | No fixed heights on text containers |
| 1.4.13 | Content on hover/focus | No hover-only content. Tooltips are native `title` on icon buttons only. |
| 2.1.1 / 2.1.2 | Keyboard, no trap | Everything is a native button, link or input. Quick-action cards were `div`s and are now buttons. Dialogs trap Tab and release it on close. |
| 2.2.1 | Timing adjustable | Session warning 2 minutes before timeout, with *Stay signed in*. Toasts last 5–8s and can be dismissed. |
| 2.4.1 | Bypass blocks | "Skip to main content" link |
| 2.4.2 | Page titled | `document.title` updates per page |
| 2.4.3 | Focus order | Focus moves to the `h1` on navigation, into dialogs on open, back to the trigger on close, and into the drawer when opened |
| 2.4.6 | Headings & labels | Descriptive, plain-language headings and labels |
| 2.4.7 / 2.4.11 | Focus visible / not obscured | 3px ring with 2px offset on every focusable element. Sticky header leaves content visible. |
| 2.5.3 | Label in name | Visible text matches the accessible name ("View" plus a hidden record name) |
| 2.5.8 | Target size | All targets ≥ 44 × 44px (exceeds the 24px AA minimum) |
| 3.1.1 / 3.1.2 | Language | `lang="en"`. Filipino questions are marked `lang="fil"`. |
| 3.2.2 | On input | No context changes on input. Filters update the table and announce the count. |
| 3.3.1 / 3.3.3 | Error identification & suggestion | Inline messages and an error summary that say how to fix each problem |
| 3.3.2 | Labels or instructions | Visible labels, hints with examples |
| 3.3.4 | Error prevention (legal, financial, data) | Review step before every save. Confirmation for approvals. Unsaved-changes guard. |
| 3.3.7 | Redundant entry | Calculate buttons fill totals from figures already entered |
| 4.1.2 | Name, role, value | `aria-current`, `aria-selected`, `aria-sort`, `aria-expanded`, `aria-pressed`, `aria-invalid`, `aria-modal`, `inert` background |
| 4.1.3 | Status messages | Toast region `aria-live="polite"` (errors `role="alert"`), live record counts, sign-in error `role="alert"` |
| — | Reduced motion · forced colours | `prefers-reduced-motion` turns off animation. `forced-colors` keeps borders and selected states visible. |

**UI/UX audit (ui-ux-pro-max checklist, October 2026):** an automated audit of every page, dialog and role at 375px and 1280px checks contrast, 44px targets, accessible names, form labels, heading order, sideways scroll, minimum text size and line length. It now passes. Fixes from that pass: 44px targets in the Annex G.1 form, breadcrumb, error-summary links and skip link; 16px form text; paragraphs capped at 65ch; `100dvh` on mobile; seal images given width/height; `touch-action: manipulation`; page URLs (`#/page`) so Back/Forward and bookmarks work, with the unsaved-changes guard on Back. Exception: the 16 PCN digit boxes are 32px wide (44px tall) to keep the official layout; they auto-advance and accept a pasted number. Drafts are deliberately **not** auto-saved to the browser (shared computers, R.A. 10173).

**Still to do before go-live:** test with NVDA + Firefox and TalkBack + Chrome, and run a usability session with 3–5 participants (including older adults) on the profile form.

---

## 6. Consistency audit

Each item in the old UI that broke the new system, and how it was fixed.

| # | Old UI | Violation | Fix |
|---|---|---|---|
| 1 | Inter + a monospace stack + Arial (official form) | 3 font families | Inter only. IDs use tabular figures. |
| 2 | Weights 300–700 loaded; ~15 sizes (9.5–30px); 14px root | Uncontrolled scale, small text | 6 sizes, 3 weights, 16px base |
| 3 | Navy (11 steps), green (9), gold (8) used decoratively | Too many hues, decorative colour | 1 brand hue + gray + 4 status colours |
| 4 | Gradients: login background, login card stripe, avatar, leader banner | Constraint: no gradients | Removed. Flat surfaces. |
| 5 | `backdrop-filter: blur` on modal, drawer backdrop, login header | Constraint: no glassmorphism | Removed. Solid scrim. |
| 6 | 5 radii + pill shapes | Single radius | 4px everywhere. Round only for dots/avatar. |
| 7 | 5 shadow levels; hover `translateY` lift on buttons and cards | Max 2 elevations, minimal motion | Shadows on overlays only. No hover motion. |
| 8 | Uppercase letter-spaced micro labels (table headers, badges, stats, nav, "OFFICIAL REGISTRY" tag) | Readability, noise | Sentence/Title Case at 14px. Tag removed. |
| 9 | Dark navy sidebar with its own rgba colours | Second colour system | White sidebar using the shared tokens |
| 10 | Topbar title + card title restating each other | Duplicate hierarchy | One `h1` per page, cards use `h2` |
| 11 | Quick actions were clickable `div`s | Not keyboard accessible | `<button class="action-tile">` |
| 12 | Modal form labels had no `for`/`id` | Unlabelled inputs | `formField()` always links them |
| 13 | Placeholders used as hints ("₱0.00", "September 2026") | Placeholder-only guidance | Persistent hints with examples |
| 14 | Required fields unmarked; a red asterisk on sign-in only | Inconsistent, colour-only | "(required)" text everywhere |
| 15 | `<textarea>` with whitespace inside saved spaces into records | Data quality bug | Clean templates |
| 16 | ~25 inline `style=""` attributes in JS markup | One-off styles | Replaced with components and utilities |
| 17 | "+ Add Beneficiary", "+ Create Report", "View All", "Save Monitoring" | Inconsistent labels, "+" as icon | Verb + noun, Lucide `plus` icon |
| 18 | Ad-hoc emoji-free SVGs at different sizes and strokes | Icon inconsistency | One registry (`ICON_PATHS`), 3 sizes, fixed meanings |
| 19 | Unknown statuses fell back to orange ("Ongoing" looked like a warning) | Wrong meaning | Explicit map, neutral default, "Ongoing" = info |
| 20 | Status shown as a coloured dot + text | Dot is a colour-only cue | Status icon + text |
| 21 | Notification count showed **all** users' unread items to beneficiaries | Privacy / wrong number | Counts only notices visible to the signed-in user |
| 22 | Account search count hard-coded to "of 3" | Bug | Generic table controller |
| 23 | Toast lasted 2.5s, not announced, not dismissible | Timing, status messages | Live region, 5s/8s, dismiss button |
| 24 | Modal: no focus management, background still interactive | Keyboard/screen-reader trap | Focus in, trap, return, `inert` background |
| 25 | Mobile menu: no `aria-expanded`, Escape did nothing | Disclosure state hidden | Fixed, plus a close button and focus handling |
| 26 | Breadcrumb was plain spans with no link | Not navigable | `nav > ol` with a Home link |
| 27 | Household table inputs and vulnerability radios had no accessible name | Unlabelled controls | `aria-label` / `aria-describedby` |
| 28 | `approveDocument('<escaped name>')` in `onclick` (HTML entities decode inside the attribute) | Injection risk via document names | Passes the numeric index, with a confirmation dialog |
| 29 | Filipino items 15–17 read "Ilak ba ay… paghahanapbuhay" | Did not match Annex G.1 | Exact Annex G.1 wording ("Ikaw ba ay… pagnenegosyo") |
| 30 | Duplicate `escapeHTML()` definitions | Code duplication | One definition |
| 31 | Print styles only for the profile form | No print view for records/reports | Print header, registries, record modals, profile |
| 32 | `scroll-behavior: smooth` always on | Motion without opt-out | Removed. Reduced motion respected. |
| 33 | No session timeout, no unsaved-changes warning | Security UX gaps | 15-minute idle timeout with 2-minute warning; leave/sign-out guards |
| 34 | Item 22 on Annex G.1 letters the expenses A, B, C, D, **C**, E, F, G (duplicate C) with total (A+B+C+D+E+F+G) | Ambiguous lettering ⚑ | Lettered A–H (Healthcare = E, Others = H), total (A+B+C+D+E+F+G+H); positions match the paper |

---

## 7. Implementation notes

### 7.1 File structure

```
SLP/
├─ index.html              App shell: banner, sign in, header, sidebar, main, footer, modal, alert dialog, toast region
├─ assets/img/seal.svg     PLACEHOLDER seal; replace with the official artwork (same file name)
├─ css/
│  ├─ tokens.css           Design tokens (load first)
│  └─ style.css            Base, layout, components, pages, print (numbered sections)
├─ js/script.js            Data, auth, session, components (§7–8), pages, dialogs
├─ docs/
│  ├─ DESIGN-SYSTEM.md     This document
│  └─ components.html      Live component gallery (open via http://localhost/SLP/docs/components.html)
├─ database/slp_database.sql
└─ tests/system.test.js    `npm test`: 13 security and behaviour tests, all passing
```

### 7.2 Naming conventions

- **CSS:** BEM-style `block`, `block__element`, `block--modifier` (`.card__header`, `.btn--primary`). Prefer **ARIA attributes for state** (`[aria-current]`, `[aria-selected]`, `[aria-invalid]`, `[aria-sort]`, `[hidden]`) over state classes. The only state classes are `.hidden`, `.open` (drawer), `.is-filtered-out` and `.is-paged-out` (table rows), and the docs-only `.is-hover/.is-focus/.is-active`.
- **Tokens:** `--color-{role}[-variant]`, `--space-{n}`, `--font-size-{px}`, `--line-height-{px}`.
- **JS:** components are camelCase functions that return HTML strings (`button`, `formField`, `dataTable`). Pages are `{name}Page()`. Element IDs are camelCase. Every user value goes through `escapeHTML()`.
- **Copy:** sentence case for headings and buttons. Title Case for field labels, column headers and status names. Buttons start with a verb.

### 7.3 Do / don't for developers

- ✅ Build pages from `cardHeader` + `tableToolbar` + `dataTable` + `formField` + `modalForm`.
- ✅ Use `navigate()` for user-initiated navigation (it guards unsaved changes). Use `showPage()` after saves.
- ✅ Pass record **IDs or indexes** to `onclick` handlers, never free text.
- ❌ No `style=""`, no new colours or sizes outside `tokens.css`, no second icon set, no `div` with `onclick`.

### 7.4 Migration order (to PHP + MySQL)

1. **Tokens + base CSS.** No markup dependencies, so this is safe to ship first.
2. **Shell** (`index.html` banner, header, sidebar, footer) as a PHP layout include.
3. **Components.** Port the JS helpers to PHP partials (or keep client rendering) with the same class names.
4. **Registries** (read-only lists first, then the add forms with review steps).
5. **Profile form.** Keep the `form="profileForm"` binding and the personnel field allow-list **on the server**.
6. **Print views** and **CSV export** as server endpoints (export filtered results; keep the formula-injection guard).
7. **Security hardening.** Enforce the session timeout and role checks on the server. The client warning is UX only. Hash passwords. Remove the demo accounts section.

### 7.5 Adding a page

Follow the steps in `js/script.js` §36: add a nav item → allowed-pages list → title/description → `switch` case → `{name}Page()` built from components.

### 7.6 Known limitations and follow-ups

- **Fonts load from Google Fonts** with a system fallback. For offline/slow sites, self-host Inter (400/500/600 WOFF2, about 90 KB).
- **Filipino localisation:** move UI strings into a string table (`en`/`fil`) and add a language switch in the header.
- **Export** writes all records, not the filtered view. **Pagination and sorting** run on the client (fine for prototype data volumes).
- **Required profile items** are flagged "Not provided" in the review step but not enforced, to keep the existing behaviour. Decide with SLP personnel which items to make mandatory.
- **Seal** is a placeholder (see `assets/img/seal.svg`).
- **Manual assistive-technology testing** is pending (§5).
