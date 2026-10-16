# DSWD website: phase 4 audit, fixes and pre-launch checklist

Date: 2026-10-13. Scope: the public site (16 pages in English and Filipino), the
staff dashboard (16 pages), the JSON API (6 endpoints) and the design-system
preview (`index.html`). Every issue below was verified on the running site; fixes
are in place and covered by the automated checks unless the status says otherwise.

1. [Summary](#1-summary)
2. [How the audit was done](#2-how-the-audit-was-done)
3. [Issues by priority](#3-issues-by-priority)
4. [Consistency audit](#4-consistency-audit)
5. [Accessibility (WCAG 2.1 AA)](#5-accessibility-wcag-21-aa)
6. [Pre-launch checklist](#6-pre-launch-checklist)
7. [Performance](#7-performance)
8. [Security review](#8-security-review)
9. [Functional and cross-browser testing](#9-functional-and-cross-browser-testing)
10. [Decisions to confirm](#10-decisions-to-confirm)
11. [Re-running the checks](#11-re-running-the-checks)

---

## 1. Summary

| Dimension | Before | After | Main finding |
|---|:-:|:-:|---|
| Accessibility | 3 | 4 | Targets under 44px; alert types and phone page counts not exposed |
| Performance | 2 | 3 | No caching or compression, three render-blocking stylesheets, unbounded photo sizes. Apache compression still needs a server setting |
| Responsive design | 3 | 4 | Reflow was clean at 320px; target sizes fixed |
| Theming | 3 | 3 | Every colour, size and radius is a token. Light theme only, as the brief sets |
| Implementation integrity | 3 | 4 | Header rules split across two sections, unused utilities, long reading measure |
| **Total** | **14/20 (Good)** | **18/20 (Excellent)** | |

Scores use the Impeccable audit rubric (0 to 4 for each dimension).

**Found and fixed:** 1 critical, 7 major, 15 minor. **Open:** 4 items that
need the server owner or the agency (section 6), and Firefox and Safari runs
(section 9).

**Integrity verdict: pass.** The site is built from one token file and one set of
components: one font, one icon set, one radius pair and one spacing scale on every
page, with no inline styles, no colour literals and no emoji. The detector's
remaining findings are verified false positives (section 3.4).

## 2. How the audit was done

| Area | Method |
|---|---|
| Consistency | A static scan of every PHP, HTML, CSS and JS file: fonts, colour literals, inline styles, emoji, icon use, border radii, raw lengths, unused and duplicated CSS |
| Accessibility | A browser scan of 18 public and 12 admin URLs at 360px and 1280px: text contrast on the real composited background, control-edge contrast, links that rely on colour, heading order, alt text, landmarks, page language and titles, vague link text, duplicate ids, input purpose, 44px targets, and WCAG 1.4.12 text spacing. Keyboard and focus behaviour comes from the test suites |
| Design detector | `impeccable detect` on 11 rendered pages and the preview, before and after the fixes |
| Performance | Cold and repeat page loads at 360px under two throttling profiles, with byte and request counts, render-blocking files, cache and compression headers, and `EXPLAIN` on the main queries |
| Security | Headers, directory listing, exposed files, every admin route signed out and with each role, CSRF, uploads (disguised scripts, photo metadata, oversized images), and 18 malformed requests (arrays, negative and huge numbers, path tricks, SQL and script strings, a 3,000-character search) |
| Functions | The three automated suites in Chromium and Microsoft Edge (section 9) |

## 3. Issues by priority

### 3.1 Critical

| ID | Issue | Location | Impact | Fix | Status |
|---|---|---|---|---|---|
| C1 | The rich-text editor hid a `required` textarea, so the browser refused to submit any new article, program, announcement or FAQ ("An invalid form control is not focusable") | `js/admin.js:53-63` | Staff could not publish anything with JavaScript on. Found by the phase 3 admin checks | The visible editor takes the textarea's id, required and invalid state; the server still rejects an empty field | Fixed, tested |

### 3.2 Major

| ID | Issue | Location | Impact | Fix | Status |
|---|---|---|---|---|---|
| M1 | Photo metadata was published: Exif GPS position, device, owner name, XMP, IPTC captions, PNG text chunks | `includes/upload.php:63` (JPG), `:131` (PNG) | A field-visit photo could reveal where a beneficiary lives. That is personal data under R.A. 10173 | Metadata segments and chunks are removed on upload. The orientation is kept, so photos stay upright. Data hidden after a PNG's end is dropped | Fixed, tested |
| M2 | No limit on image pixel size | `includes/upload.php:48`, `js/admin.js:74` | A 2 MB, 4,000-pixel photo became every 96–192px news thumbnail: about 11 seconds per image on 3G | At most 1600 pixels a side. The dashboard scales bigger photos in the browser before upload; the server asks for a smaller image when that cannot run | Fixed, tested with and without JavaScript |
| M3 | Static files had no `Cache-Control` (only `ETag`) | `.htaccess:15-26`, `includes/functions.php:41-55` | Every page view revalidated 8–9 files. On a 560 ms connection, each render-blocking revalidation costs a round trip | `asset()` and `bundle()` add `?v=<last change>`; those URLs are cached for a year. The font is immutable; other files are revalidated | Fixed. Repeat views transfer 3–4 KB (the HTML only) |
| M4 | No compression; Apache's `mod_deflate` is off in this XAMPP | `includes/bootstrap.php:35`, `.htaccess:27-50`, `tools/build-assets.php:38` | HTML, JSON, CSS and JS were sent raw | PHP compresses pages and JSON (home page 17.6 KB down to 3.5 KB). The build writes gzip copies of the CSS and JS bundles, which `.htaccess` serves to browsers that accept gzip (CSS 24.5 KB down to 4.9 KB), with no Apache module needed | Fixed. Turning on `deflate_module` would also compress the 6.9 KB icon sprite (optional) |
| M5 | Three render-blocking stylesheets (43.8 KB with comments) and unminified JS | `tools/build-assets.php:16`, `includes/head.php:11`, `includes/admin-layout.php:42-46` | Extra requests and bytes before the first paint | One minified stylesheet (24.5 KB, 4.9 KB gzipped) and minified JS. While a bundle is older than its sources, pages use the sources, so a forgotten build never serves stale CSS | Fixed |
| M6 | Targets under the brief's 44 × 44px: brand link 40px (every page), "See all" links 24px, table-of-contents links 32px, the admin delete page's Cancel link 24px, the preview's contents links 29px | `css/components.css:127`, `:722`, `:758`; `includes/admin-crud.php:429`; `index.html:23` | Hard to tap for older users and anyone on a small phone (WCAG 2.5.5; 2.5.8 in WCAG 2.2) | 44px rows and minimum heights; Cancel is a ghost button | Fixed. The scan is clean apart from false positives |
| M7 | The preloaded font held the first paint: with `font-display: swap`, Chrome waited for the 48 KB font before drawing any text | `css/base.css:8-21` | Home painted 0.3–1 s later than it needed to on 3G (blocking the font in a test brought first paint down to DOMContentLoaded) | `font-display: optional`: Inter when it arrives in time, otherwise system-ui for that one page view and Inter from the cache afterwards; no layout shift | Fixed. Home's cold first paint went from 1.48 s to 0.96 s (Lighthouse profile) and from 2.46 s to 1.84 s (Slow 4G) |

### 3.3 Minor

| ID | Issue | Location | Fix | Status |
|---|---|---|---|---|
| m1 | Section headings sat against the block above on About (0px) and on Program and Transparency (16px): the sections were not `.page-section`, and `* + h2` skips a heading that opens its section | `about.php:31`, `program.php:53`, `transparency.php:61` | Sections are `.page-section`, 64px apart | Fixed |
| m2 | Lines up to about 88 characters (`70ch` is wide in Inter); the privacy notice reached about 91 | `css/tokens.css:85`, `css/base.css:65`, `css/components.css` (prose lists) | New `--measure: 36em`, about 72 characters at any text size | Fixed |
| m3 | Phones could not see how many pages a list has, and wide screens listed every page number | `includes/bootstrap.php:110-145`, `css/components.css:380-390` | "Page 2 of 5" on phones; from 768px the first and last pages, the neighbours of the current page and ellipses | Fixed, tested |
| m4 | Screen readers learned an alert's type only from its title wording | `includes/functions.php:175`, `includes/lang.php` | Visually hidden "Success:", "Warning:" or "Error:" (Filipino too) | Fixed |
| m5 | Dialog: a text selection dragged onto the backdrop closed it; `returnValue` stayed stale; `::backdrop` lacked the overlay token in older browsers | `js/ui.js:55-70`, `css/tokens.css:89` | Close only when the press started on the backdrop, clear `returnValue`, give `::backdrop` the token | Fixed |
| m6 | One bad reference in `ui.js` (a missing panel, a toggle outside a header) stopped every later behaviour | `js/ui.js:16`, `:34`, `:59` | Guards skip only that behaviour | Fixed |
| m7 | Version disclosure: `X-Powered-By: PHP/8.2.12` and `Server: Apache/2.4.58 (Win64) OpenSSL/3.1.3 PHP/8.2.12` | `includes/bootstrap.php:36` | `X-Powered-By` removed. The `Server` header needs `ServerTokens Prod` in httpd.conf | PHP part fixed; Apache part on the checklist |
| m8 | `admin/_init.php` answered 200 (empty); the new `tools/` folder needed the same protection | `.htaccess:11`, `tools/.htaccess` | `_*.php` and `tools/` return 403 | Fixed |
| m9 | No `Strict-Transport-Security` header over HTTPS | `includes/bootstrap.php:38` | One year, sent only over HTTPS | Fixed |
| m10 | The API answered `HEAD` with 405 (RFC 9110 requires `HEAD` wherever `GET` works) | `includes/api.php:28` | `HEAD` allowed; `Allow: GET, HEAD` | Fixed |
| m11 | Admin forms about other people (new accounts, the DPO's name) offered the signed-in admin's own name and email for autofill | `admin/users.php:83-84`, `admin/settings.php:51-52` | `autocomplete="off"` | Fixed |
| m12 | Duplicated and dead CSS: section 14 overrode section 3's header grid, gap and nav (`components.css` old lines 106-112 and 584-585, 137 and 601); `.org-tree ul` reset then overrode itself; `.span-md-3`, `.span-md-8`, `.span-md-9` and `.span-lg-6` were never used (`base.css` old lines 109, 112, 113, 119) | `css/components.css:103-195`, `:840`; `css/base.css:108-121` | One header block in section 3; tidy org tree; unused spans removed | Fixed |
| m13 | The production error page had no `lang` attribute | `includes/bootstrap.php:27` | `lang="en"` | Fixed |
| m14 | Preview: the sticky contents list slid under the sticky header and was taller than short laptop screens | `index.html:23-34` | Sits below the header and scrolls inside itself | Fixed |
| m15 | Test gaps: no skip-link test; the id check ignored in-page links, modal openers and duplicate ids; the footer ring check ignored the outline style; the disabled-choice check only tested the browser; no access matrix | `tests/harness.js:60-68`, `tests/check.js`, `tests/site-check.js:138`, `tests/admin-check.js:130` | Each check strengthened; new checks for the skip link, pagination, every admin route and role, and uploads | Fixed |

### 3.4 Verified false positives (no change)

| Finding | Why it stays |
|---|---|
| Detector `overused-font` (Inter) | The brief requires Inter only |
| Detector `tight-leading` (headings at 1.2) | Heading line height is pinned by the phase 1 brief and DESIGN.md |
| Detector `cramped-padding` on `.table-wrap` | It is a scroll frame; the cells carry the padding |
| Detector `first-viewport-column-overflow` (Program, Contact) | Content beside a short help card is the intended sidebar layout |
| Detector `em-dash-overuse` (preview) | Documentation copy; suppressed for that file in the project's `.impeccable/config.json` |
| Scan: 20 × 20px checkbox and radio inputs | The whole 44px label row is the target |
| Scan: 24px-tall link card titles | The stretched link covers the whole card |

## 4. Consistency audit

| Check | Result | Evidence |
|---|---|---|
| Fonts | Inter only | `css/base.css:11` (`@font-face`), `:32` (`--font-sans`); no other `font-family` anywhere |
| Colours | Tokens only | No colour literal outside `css/tokens.css`. The hex codes in `index.html:208-222` are documentation text in the colour table |
| Icons | One Lucide sprite, no emoji | 25 symbols in `img/icons.svg`, all used and all present; every icon goes through `icon()` or `<use>` and sits next to visible text. The only "unused" hit, `name`, is the usage comment (`img/icons.svg:4`) |
| Button shapes | Pills and 16px radii only | All 22 `border-radius` declarations use `--radius` or `--radius-pill`; every button is a `.btn` pill with a 48px minimum height |
| Spacing | Tokens only | The remaining literal lengths are media-query breakpoints (CSS variables cannot be used in `@media`; listed in `css/tokens.css:11-16`), the 2px focus ring, 1px hairlines and `text-underline-offset: 0.2em` (`css/base.css:73`) |
| Markup hygiene | Clean | 0 inline styles, 0 inline event handlers, 0 positive `tabindex`, 0 `target="_blank"` |
| Unused or duplicated CSS | Fixed | See m12. The remaining repeated selectors are deliberate media-query overrides |

## 5. Accessibility (WCAG 2.1 AA)

| Criterion | Result | Evidence |
|---|---|---|
| 1.1.1 Non-text content | Pass | Every `<img>` has `alt` (decorative ones empty); every icon is `aria-hidden` beside text |
| 1.3.1 Info and relationships | Pass | One H1 per page and no skipped levels (30 URLs, 2 widths); landmarks; labels, fieldsets and legends; table captions and header scope |
| 1.3.5 Identify input purpose | Pass | The contact form uses `autocomplete` (name, email, tel) |
| 1.4.1 Use of colour | Pass | Links in text are underlined; status colour always comes with an icon and words |
| 1.4.3 Contrast (minimum) | Pass | Every text node checked on its composited background: 0 failures |
| 1.4.4, 1.4.10 Resize and reflow | Pass | No sideways scroll at 320, 360, 768, 1024 and 1440px |
| 1.4.11 Non-text contrast | Pass | Control edges 5.93:1, focus ring 5.33:1 |
| 1.4.12 Text spacing | Pass | With WCAG's spacing applied, nothing is clipped and nothing scrolls sideways |
| 2.1.1, 2.1.2 Keyboard, no trap | Pass | Menu, tabs, accordion and dialog by keyboard; every Tab stop shows the ring |
| 2.4.1 Bypass blocks | Pass | The skip link is the first Tab stop and moves focus to the main content (tested) |
| 2.4.2 Page titled | Pass | 30 unique titles |
| 2.4.3, 2.4.7 Focus order and visible focus | Pass | DOM order matches the visual order; 2px ring (white on the footer) |
| 2.4.4 Link purpose | Pass | No vague link text; admin "Edit" and "View" links carry the item name for screen readers |
| 3.1.1, 3.1.2 Language | Pass | `lang="en"` or `lang="fil"` on each page |
| 3.3.1–3.3.3 Errors and labels | Pass | Error summary with links, inline "Error:" messages, `aria-invalid` and `aria-describedby` |
| 4.1.2 Name, role, value | Pass | 0 unnamed controls; every ARIA, label, fragment and modal reference resolves; no duplicate ids |
| 4.1.3 Status messages | Pass | Messages inserted after load use `role="alert"`; alert titles carry their type |
| Targets (brief: 44px) | Pass | See M6 |

Automated checks cannot judge everything. Before launch, run one screen-reader pass
(checklist, section 6).

## 6. Pre-launch checklist

**Server**
- [ ] HTTPS with a valid certificate, and HTTP redirected to HTTPS. The session cookie becomes `Secure` and HSTS turns on automatically.
- [ ] Check that `css/site.min.css?v=…` returns `Content-Encoding: gzip` (the build's `.gz` copy). Optional: turn on `deflate_module` and `filter_module` in `httpd.conf` (lines 111 and 118 in this XAMPP) to compress the icon sprite as well.
- [ ] Add `ServerTokens Prod` and `ServerSignature Off` to `httpd.conf`.
- [ ] Keep `AllowOverride All` for the site folder, and check that `config/config.php` returns 403.
- [ ] In `php.ini`: `display_errors=Off`, `expose_php=Off`, `upload_max_filesize=10M`, `post_max_size=12M`.
- [ ] phpMyAdmin and the XAMPP `dashboard` folder are removed or unreachable from the internet.

**Database and accounts**
- [ ] Give MySQL `root` a password. Create `dswd_app` (SELECT, INSERT, UPDATE, DELETE) and `dswd_backup` ([phase-3-setup.md](phase-3-setup.md#4-database-accounts-least-privilege), including the privilege-table repair).
- [ ] Never load `database/seed-test-users.sql` on the server. If it was loaded: `DELETE FROM users WHERE email LIKE '%@dswd.test';`
- [ ] Create the real super administrators, then deactivate `admin@dswd.local`.

**Application**
- [ ] `config/config.local.php`: `app_env` set to `production`, a new `app_secret`, the `dswd_app` credentials. Keep a copy in the office password manager.
- [ ] After copying files to the server, run `php tools/build-assets.php`, then check that the page source links `css/site.min.css`.
- [ ] Do not copy `tests/`, `docs/`, `.superpowers/`, `.impeccable/` or the design-system preview `index.html` to the server. They are blocked or harmless, but not needed.
- [ ] Copy `uploads/images` and `uploads/files` empty (keep `uploads/.htaccess`), then upload the real content through the dashboard.

**Content and legal**
- [ ] The official logo or seal, with DSWD authorisation, replaces `img/logo.svg`.
- [ ] Every `[bracketed]` site setting and all sample content replaced: hotline, email, office list, mandate, vision, mission, officials.
- [ ] The Data Protection Officer approves the privacy notice, the privacy policy and the 365-day retention period (`feedback_retention_days`).
- [ ] Legal reviews the terms of use. The FOI and Transparency Seal links point to the official documents.
- [ ] A native speaker reviews the Filipino interface text (`includes/lang.php`).

**Quality**
- [ ] Run the three suites against the server (`TARGET_URL=https://…`).
- [ ] Test by hand in Firefox and in Safari on an iPhone (section 9).
- [ ] Screen-reader pass: NVDA with Chrome or Firefox, and VoiceOver on an iPhone. Go from Home to a program, then send the contact form with one error.
- [ ] Run Lighthouse or PageSpeed Insights on the live URL; the mobile First Contentful Paint should stay under 2 seconds.
- [ ] Check the live security headers (for example with securityheaders.com).

**Operations**
- [ ] Daily backup scheduled, one restore practised, an encrypted offsite copy arranged ([phase-3-setup.md](phase-3-setup.md#5-backups-and-restore)).
- [ ] Staff trained with the content guide ([phase-3-setup.md](phase-3-setup.md#7-staff-guide-managing-content)).

## 7. Performance

Byte and request counts are exact. Timings are medians of 5 loads at 360px on this
laptop, which varies by about ±30% between runs under 4× CPU throttling. "Before"
is a single run from the start of the audit.

| Per page | Before | After |
|---|---|---|
| Requests (first visit) | 8–9 | 6–7 |
| Render-blocking files | 3 stylesheets | 1 stylesheet |
| Transfer (first visit) | 115–121 KB | 65–67 KB (48 KB of it is the font) |
| HTML | 12–17 KB | 2.7–3.4 KB |
| Transfer (repeat visit) | 13–18 KB in 8–9 revalidations | 3–4 KB (HTML only) |
| CSS | 43.8 KB in 3 files | 1 file: 24.5 KB, sent as 4.9 KB gzip |

| First Contentful Paint, medians for Home, Programs, News, Contact | Before | After |
|---|---|---|
| Lighthouse mobile profile (150 ms RTT, 1.6 Mbps, 4× CPU), first visit | 1.10–1.24 s | 0.81–1.36 s (Home 0.96 s) |
| Lighthouse mobile profile, repeat visit | 0.49–0.61 s | 0.44–0.58 s |
| DevTools "Slow 4G" (562 ms RTT, 1.44 Mbps, 4× CPU), first visit | 2.00–2.23 s | 1.64–1.84 s |
| DevTools "Slow 4G", repeat visit | 1.03–1.12 s | 0.89–1.22 s |

What this means for the "under 2 seconds on 3G" target:
- Every measured page paints in under 2 s on both profiles. On the standard mobile
  profile (Lighthouse's, once called "Fast 3G") pages paint in about 0.8–1.4 s here.
  Connection setup on a real network (DNS, TCP, TLS) adds about 0.45 s, which still
  stays under 2 s.
- On DevTools' harsher "Slow 4G" preset pages paint in 1.6–1.8 s on localhost. A real
  connection with 562 ms of latency spends about 1.7 s more on connection setup, which
  no page can avoid. What the site controls is minimal: two round trips after
  connecting (the HTML, then one stylesheet), about 66 KB in total, and almost nothing
  to fetch again on later pages.
- Dropping the font preload would paint about 0.3 s sooner on 3G, but the first page
  would show the system font more often. It is kept for brand consistency.
- Server time is 20–60 ms per page. Images below the first screen load lazily, and
  uploaded photos are capped at 1600 pixels.
- Database: the list queries use their indexes (`EXPLAIN`: news uses
  `ix_news_status_published`, downloads use `ix_downloads_category`), with no N+1
  queries: a list page runs one query plus one count, and a program page runs four.
  Search uses `LIKE '%…%'`, which scans the table. That is fine for hundreds of
  rows; add a FULLTEXT index when content reaches thousands.
- No libraries. JavaScript is 2.1 KB on public pages (minified, deferred).

## 8. Security review

| Area | Result | Evidence |
|---|---|---|
| SQL injection | Pass | PDO prepared statements only; table and column names come from code. SQL strings in parameters were tested (`program.php?slug=' OR 1=1--` returns 404) |
| XSS | Pass | `e()` on every value; rich text cleaned by an allow-list (tested with script, `onclick`, `javascript:` and `onerror`); CSP `default-src 'self'` |
| CSRF | Pass | Token on every form and on the feedback API; a POST without it gets 403 (tested) |
| Sessions | Pass | `HttpOnly`, `SameSite=Strict`, `Secure` over HTTPS, strict mode, new id after sign-in, 30-minute idle timeout, sign-out by POST only (tested) |
| Sign-in | Pass | One generic message, equal timing for unknown emails, 5 tries per 15 minutes, Argon2id, forced change of temporary passwords (tested) |
| Uploads | Pass | Content-checked types, size and pixel limits, metadata removed, random names, no execution in `uploads/` (disguised PHP refused; tested) |
| Exposed config and errors | Pass | `config/`, `includes/`, `database/`, `docs/`, `tests/`, `tools/`, `_*.php` and `.md`, `.sql` and `.bat` files return 403; dot-files 404; production shows a plain error page; 18 malformed requests gave no 500 and no PHP warning |
| Directory listing | Pass | Off everywhere (`css/`, `js/`, `img/`, `fonts/`, `downloads/`, `api/`, `uploads/` return 403) |
| Access control | Pass | All 18 admin pages send signed-out GET and POST requests to sign-in; viewers and editors get 403 on users, audit, settings, categories and feedback; editors cannot publish (tested) |
| Clickjacking and headers | Pass | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS over HTTPS |
| Data Privacy Act | Pass | Privacy notice and consent; minimum fields; feedback visible to publishers and up only, with views audited; automatic deletion after the retention period; photo metadata removed; no beneficiary or case records |
| Version disclosure | Partial | `X-Powered-By` removed; the Apache `Server` header needs httpd.conf (checklist) |

## 9. Functional and cross-browser testing

| Suite | Checks | Chromium | Microsoft Edge |
|---|---|---|---|
| `tests/check.js`, design-system preview | 46 | 46/46 | Not run (the preview is not shipped) |
| `tests/site-check.js`, public site at 320, 360, 768, 1024 and 1440px | 129 | 129/129 | 129/129 |
| `tests/admin-check.js`, dashboard, roles, uploads, API, security | 25 | 25/25 | Not run (same engine as Chromium) |

**Firefox and Safari were not run.** They are not installed on this machine, and
installing them means downloading browsers, which needs your approval. The harness
already supports them:

```bat
cd C:\Users\julie\.claude\skills\playwright-skill
npx playwright install firefox webkit
cd C:\xampp\htdocs\SLP
set PW_BROWSER=firefox
node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/site-check.js
```

WebKit is the closest stand-in for Safari. Still test on a real iPhone, and check
these by hand in Firefox and Safari:
- The Menu button opens and closes the nav; Escape closes it; the header stays on top while scrolling.
- News at 360px shows "Page 1 of 2"; at 1024px it shows the page numbers.
- The contact form: an empty submit shows the error summary; a full submit shows a reference number.
- Dashboard: adding a news cover photo larger than 1600 pixels scales it down. If the browser cannot, the server asks for a smaller image.
- Older browsers (Firefox before 121, Safari before 15.4) lack `:has()`. News thumbnails then stack above their text and link cards lose their whole-card focus ring. Both stay usable.

## 10. Decisions to confirm

Made without asking during phase 4; each is easy to change.

1. **Reading measure:** paragraphs are capped at 36em (about 72 characters) instead of 70ch (about 88 in Inter).
2. **Pagination:** phones show "Page 2 of 5" instead of a lone number, and wide screens show a window of page numbers instead of all of them.
3. **Photos:** at most 1600 pixels a side. The dashboard scales bigger photos down, and metadata is removed (orientation kept).
4. **A build step for production:** `tools/build-assets.php` writes the minified files, while the commented sources stay the files you edit.
5. **Font loading:** Inter is preloaded with `font-display: optional`. On a slow first visit the first page can show the system font, with no delay and no layout shift. To always wait for Inter, change `optional` back to `swap` in `css/base.css`; first paint then comes 0.3–1 s later on 3G.
6. **Compression without server changes:** PHP compresses pages and JSON, and the build writes gzip copies of the CSS and JS bundles that `.htaccess` serves. Apache's `mod_deflate` becomes optional.
7. **I did not change XAMPP's own `httpd.conf` or `php.ini`.** They are outside the project and need an Apache restart; they are on the checklist.
8. **The detector findings in 3.4 are accepted as false positives.**
9. **Firefox and Safari** were not tested, because that needs a browser download (section 9).
10. **No confirmation dialogs on real pages.** Deletes in the dashboard use a confirmation page, which works without JavaScript, so the phase 1 note that a dialog opener needs JavaScript never applies.

## 11. Re-running the checks

From `C:\xampp\htdocs\SLP`, with Apache and MySQL running:

```bat
node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/check.js
node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/site-check.js
node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/admin-check.js
```

`set PW_CHANNEL=msedge` runs them in Edge, and `set PW_BROWSER=firefox` in Firefox
once it is installed. After any CSS or JS change, run `C:\xampp\php\php.exe tools\build-assets.php`.
