# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SLP (Sustainable Livelihood Program) Information & Monitoring System for MSWDO Lubang, Occidental Mindoro. Plain HTML + CSS + vanilla JS on the front (no build step, no framework, no npm dependencies) and a small PHP JSON API in `api/` on the back, over the MariaDB database `slp_monitoring` (schema `database/schema.sql`, spec `docs/superpowers/specs/2026-10-13-slp-database-schema-design.md`, installed by `database/install.php`). Sign-in, the data you see and the staff saves (beneficiaries, projects, monitoring, assistance, reports, notifications, accounts) go through the API and survive a reload. **Not yet connected (part B):** profile saves, document uploads/approvals and the AA/AC/AF.1 tool saves still live in browser memory and are lost on reload. Wiring spec: `docs/superpowers/specs/2026-10-13-slp-app-wiring-design.md`.

## Commands

- **Run:** served by XAMPP at `http://localhost/SLP/` (Apache must be running). Component gallery: `http://localhost/SLP/docs/components.html`.
- **Test:** `npm test` (runs `node --test tests/system.test.js`; no npm install needed, uses only Node built-ins).
- **Single test:** `node --test --test-name-pattern="Security 2" tests/system.test.js`
- **Demo logins** (username + password, from the demo seed): `admin` / `admin123` (MSWDO Personnel), `leader` / `leader123` (Maria Santos, association leader), `member` / `member123` (Juan Dela Cruz, member).
- **API checks:** `C:\xampp\php\php.exe api\tests\api-check.php [filter]` (installs `slp_api_check`, runs PHP's built-in server on 127.0.0.1:8765 against it, drops it afterwards).
- **Install DB:** `C:\xampp\php\php.exe database\install.php --demo` (`--fresh` drops and recreates an `slp_*` database; other names are refused).
- **DB checks:** `C:\xampp\php\php.exe database\tests\schema-check.php [filter]` (builds and drops scratch databases; filter `demo` runs the demo checks).
- **Design check:** `node C:\Users\julie\.claude\skills\playwright-skill\run.js tests/ui/design-check.js` compares the app with `dswd/design-system.html` live. Set `PW_CHANNEL=msedge` for a visible browser (the bundled Chromium fails to launch visibly on this machine with `spawn UNKNOWN`), or `PW_HEADLESS=true` to hide it.

## Architecture

- `index.html` is the static app shell: sign-in screen, header, sidebar, `main`, modal, alert dialog and toast region. Every page is rendered into `main` by JS.
- `api/` is the server. `api/_lib.php` holds the shared helpers: session (cookie `SLPSESSID`, 15-minute idle), CSRF (`X-CSRF-Token` on every POST but login), `require_user($db, ...roles)`, validation helpers and `audit()`. One file per resource. Every connection goes through `db_connect()` in `database/db.php` (strict mode, +08:00, utf8mb4_unicode_ci). **The server decides what each role may see and change**; client role checks are courtesy only. Files starting with `_` and `api/tests/` are denied over HTTP (`.htaccess`).
- Data flow in `js/script.js` (§5B, §18B): after sign-in `GET api/bootstrap.php` returns a role-filtered snapshot; `applySnapshot()` maps it (codes → `LABELS`, ids → `displayId()`) into `data`, `users`, `profileForms`, `referenceData`, so pages render synchronously. Saves call `sendSave(path, body, page, message)`: one POST through `api()`, then `loadData()`. Records keep the database id as `dbId`; forms send ids, never names.
- `js/script.js` (~4000 lines) is the entire app, organised into numbered sections (listed in the header comment; §36 explains how to add a feature). Key flow:
  - `loginUser()` → `currentUser` (the password is never kept on it) → `createNavigation()` builds the role-specific sidebar.
  - `navigate(page)` handles user-initiated navigation (it guards unsaved changes and uses `#/page` URLs). `showPage(page)` does the rendering, **enforces role authorization** via allowed-page lists, and switches to a `{name}Page()` function that returns an HTML string.
  - Components (§7–8) are functions returning HTML strings: `button`, `formField`, `modalForm`, `cardHeader`, `tableToolbar`, `dataTable`, `statusBadge`, `summaryList`, `alertBox`, `emptyState`. Tables are registered and then sorted, filtered and paginated client side.
  - Create flows follow: `open{X}Form()` → `modalForm` → review step → `save{X}()`. The save functions must re-check the role themselves (the tests assert this).
  - Roles: `isStaff()`, `isLeader()`, `isMember()`. Beneficiaries only see their own records and notifications (`getVisibleNotifications`).
  - Profile form (§27): a replica of the official Annex G.1 form. Inputs bind with `form="profileForm"` and a `name` matching a property in `createEmptyProfile()`. `saveProfile()` reads them automatically. Personnel-only fields (items 25–29) are read-only for beneficiaries and must never be saved from the beneficiary form.
- **Testability:** `script.js` ends with `if (typeof module !== "undefined") module.exports = {...}`. The tests build a mock DOM on `globalThis.document` and then `require` the script. When adding a function the tests need, export it there. DOM access at load time must stay tolerant of the mock (see `isBrowser()` and `get()`). The tests stub `fetch`: `signIn(role)` serves `tests/fixtures.js` `snapshot(role)` ("staff", "leader", "member") as the login and bootstrap responses, and `fetchCalls` records each request so tests assert payloads. Server behaviour (privacy, validation, roles) is tested in `api/tests/api-check.php`, not with JS fakes.
- Monitoring tools (§27B): fillable replicas of Annex AA (MD Monitoring Tool), AC (Organization Assessment Tool) and AF.1 (MD Usbong Assessment Tool). AA and AC are for Association Leaders only (`LEADER_PAGES`, sidebar group "Association"); AF.1 is staff only (`STAFF_PAGES`, under Monitoring). `saveTool()` allows a save only when the role may open that page (`allowedPages()`). Defined in `MONITORING_TOOLS`. Inputs bind with `form="toolForm"`, and `saveTool(key)` stores them in `toolForms`. Totals use `data-add`/`data-sub` → `data-total`, and levels use `data-level-of`/`data-levels` (see `updateToolTotals()`). Blank PDFs live in `assets/forms/`.
- `css/tokens.css` holds the design tokens and loads first. `css/style.css` is organised into numbered sections. `index.html` uses `?v=3.8` cache-busting query strings on CSS/JS; bump them when shipping changes.

## Rules (from docs/DESIGN-SYSTEM.md, the source of truth for UI)

- Visuals follow the **DSWD design system**. The reference is `dswd/design-system.html`, and `css/tokens.css` carries its values under SLP's token names. Rules from it: green and white only; status colours go on icons and borders, never on text; 16px corners and pill-shaped controls; 48px controls; no transitions. The official form replicas keep square fields.

- Build UI only from the existing component helpers. No inline `style=""`, no colours or sizes outside `tokens.css`, no `div` with `onclick`.
- Every user-supplied value goes through `escapeHTML()`. Pass record **IDs or indexes** to `onclick` handlers, never free text.
- Icons: Lucide only, added to `ICON_PATHS`, always next to visible text. New statuses go in `STATUS_TONES`.
- Copy: sentence case for headings and buttons (buttons start with a verb). Title Case for field labels, column headers and status names. Tests assert on some strings ("Household Information", "Access Denied", "Profile Status").
- Accessibility targets are WCAG 2.2 AA: 44px targets, visible labels, "(required)" text, and focus management in dialogs.
- Profile drafts are deliberately **not** saved to browser storage (shared computers, R.A. 10173).
