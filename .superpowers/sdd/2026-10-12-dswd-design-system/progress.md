# SDD ledger — plan: docs/superpowers/plans/2026-10-12-dswd-design-system.md
Spec: docs/superpowers/specs/2026-10-12-dswd-design-system-design.md
Setup: Ruling: SLP is not a git repo, so no worktree, branch, commits or BASE; work happens in place in the new dswd/ folder — the SLP app is untouched — cost if wrong: no history to diff; the final review reads the files directly.
Setup: Ruling: sdd-workspace, task-start and task-done need git; the workspace was made by hand here, the brief is the plan's task section, and task-done is a manual run of the check suite with its result ledgered — cost if wrong: none.
Setup: Ruling: this harness has no todo tool; this ledger is the only tracker — cost if wrong: none.
Pre-flight: T2→T1 tokens, ds- classes, harness: consistent.
Pre-flight: T3→T2 .btn--ghost, .icon, sprite menu/map-pin/phone/mail; T1 spans span-md-6/span-lg-3: consistent.
Pre-flight: T4→T2 sprite chevron-left/right, circle-check/triangle-alert/circle-alert; T1 .num: consistent.
Pre-flight: T5→T2 chevron-down/circle-alert; T1 ds-specimen/ds-state: consistent.
Pre-flight: T6→T3 selected-state style: consistent.
Pre-flight: T7→T1 .h3, T2 .btn, sprite x: consistent.
Pre-flight: T8→T4 .table-wrap/.table/.card, T5 .input: consistent.
Pre-flight: T4 breadcrumb check takes .first() of nav[aria-label="Breadcrumb"]. Ruling: the #breadcrumbs example nav is labelled "Breadcrumb example" so the two landmarks have distinct names — cost if wrong: none.
Task 1: Ruling: visible runs use Edge (channel msedge) because Playwright's bundled chrome.exe fails with spawn UNKNOWN on this machine, even outside the sandbox; headless runs keep the bundled headless shell; PW_CHANNEL overrides — cost if wrong: Edge and Chromium share the Blink engine, so the results match.
Task 1: Ruling: the harness pins deviceScaleFactor 1, because visible Edge on this scaled display reported the 2px ring as 1.6px (device-pixel snapping); the CSS is unchanged — cost if wrong: none; the checks measure CSS pixels.
Task 1: Ruling: the base focus opt-out is main[tabindex="-1"]:focus instead of the spec's [tabindex="-1"]:focus, so roving-tabindex tabs keep their ring — cost if wrong: none.
Task 1: Ruling (replaces the deviceScaleFactor ruling, which had no effect): visible Edge reports the authored 2px ring as 1.6px at devicePixelRatio 1 (display snapping), so the ring check accepts >= 1.5px; this still fails a missing or 1px ring — cost if wrong: a 1.5–1.9px authored ring would pass; base.css authors exactly 2px.
Task 1: complete (tests: node run.js dswd/tests/check.js → 12/12 pass)
Task 2: Ruling: all 14 icons come from lucide-static v1.55.0, not 10 from the older SLP ICON_PATHS plus 4 new — one version and one license notice — cost if wrong: none; same icon set and style.
Task 2: Ruling: the first .btn-group is the action pair 'Apply now' + 'Cancel'; the icon buttons sit in a second group, because 'Download form' and 'Next' don't share a row in the 280px specimen at 360px — cost if wrong: none; both groups are shown.
Task 2: Ruling: the sprite check parses the SVG and counts <symbol> elements instead of matching text, because the usage comment's '<symbol id="name"' example matched the regex — cost if wrong: none.
Task 2: complete (tests: node run.js dswd/tests/check.js → 17/17 pass)
Task 3: Ruling: .site-header__inner is a two-column grid (minmax(0,1fr) auto) with the nav spanning both, instead of the spec's wrapping flex row, because flex-wrap pushed the Menu button under the brand on phones — cost if wrong: none; same structure and states.
Task 3: Ruling: footer links are inline-block with padding-block calc((--target-min − 1em × --lh-body) / 2), instead of inline-flex with min-height 44, so wrapped two-line links keep even spacing; one line is still a 44px target — cost if wrong: none.
Task 3: Ruling: the brand name is 14px with an 8px logo gap below 768px (mobile-first, min-width reset at 768), so the agency name fits in three lines beside Menu — cost if wrong: a slightly smaller name on phones.
Task 3: complete (tests: node run.js dswd/tests/check.js → 22/22 pass)
Task 4: Ruling: the alert side-stripe check compares borderLeftWidth with borderTopWidth (≤ 1px) instead of the literal '1px', because visible Edge snaps 1px borders to 0.8px — cost if wrong: none.
Task 4: Ruling: below 768px pagination shows only Previous, the current page and Next (li.pagination__page plus :has); all numbers return from 768px, because the full row wrapped messily at 360px — cost if wrong: phone readers don't see the total page count.
Task 4: complete (tests: node run.js dswd/tests/check.js → 26/26 pass)
Task 5: Ruling: there are no .field--error or .fieldset--error modifier classes; the error state comes from aria-invalid plus the .field__error message (the convention is state in ARIA, not classes) — cost if wrong: a later style that needs a wrapper hook would use :has([aria-invalid]) instead.
Task 5: Ruling: the checkbox error links through aria-describedby on the checkbox, not the fieldset, so it isn't announced twice, and an invalid control always names its own message — cost if wrong: none.
Task 5: Ruling: the harness separates the navigation timeout (30s) from the action timeout (5s) and catches failures in open(), because one slow Apache response crashed the whole run — cost if wrong: none.
Task 5: complete (tests: node run.js dswd/tests/check.js → 30/30 pass)
Task 6: Ruling: unselected tabs use --text, not the spec's --text-muted, so a disabled tab (--text-muted) is visibly different from an unselected one; hover adds an underline — cost if wrong: unselected tabs read slightly heavier.
Task 6: complete (tests: node run.js dswd/tests/check.js → 33/33 pass)
Task 7: complete (tests: node run.js dswd/tests/check.js → 36/36 pass)
Task 7: Ruling: the modal uses a local --modal-pad (16px on phones, 24px from 768px), and its footer stacks full-width buttons in DOM order on phones (Cancel, then Submit) and becomes a right-aligned row from 768px, because at 360px the title took three lines and the buttons wrapped unevenly — cost if wrong: none; desktop is unchanged.
Task 7: complete (tests: node run.js dswd/tests/check.js → 36/36 pass)
Task 8: Ruling: spacing-bar widths are rounded before comparison (visible Edge can report fractional px) — cost if wrong: none.
Task 8: complete (tests: node run.js dswd/tests/check.js → 40/40 pass)
Task 9: Ruling: the full-page screenshot in the sideways-scroll check gets a 30s timeout; at 1440px the long page took more than the 5s action timeout in visible Edge — cost if wrong: none.
Task 9: Ruling: the weight budget is missed: 140,462 bytes uncompressed against the spec's 'about 120 KB', because the preview HTML is 56,801 bytes of demos. What real pages load (tokens + base + components CSS, ui.js, sprite, logo, font) is 83,661 bytes, and Apache gzip shrinks the HTML and CSS about 4x — cost if wrong: about 20 KB more on a slow first load of this preview page only.
Task 9: Ruling: four detector findings are suppressed as false positives with narrow ignore-values (cramped-padding table-wrap, ds-type__row, accordion; em-dash-overuse on index.html), each with a reason in .impeccable/config.json — cost if wrong: a real cramped container of the same class would go unflagged.
Task 9: Ruling (amends the suppression ruling): the three cramped-padding findings are NOT suppressed, because the tool only offers a file-wide '*' that would hide future real findings; they go to the finish reviewer as remaining findings. Only em-dash-overuse is suppressed (file-scoped) — cost if wrong: none.
Task 9: SLP app check: npm test → 14/14 pass (the plan said 13; the suite has 14, all passing, and no SLP file was edited).
Final: Ruling: the check suite runs headless (PW_HEADLESS=true), because the visible Edge window closed twice mid-run ('browser has been closed'); the in-app Browser pane still shows the page live — cost if wrong: no live Playwright window during runs.
Final: finish review (impeccable) disposition FIX, 7 material fixes, applied in one batch:
Final: fixed state specimens (tabs, pagination, checkbox/radio focus, select/textarea focus+error, breadcrumb/card-title links, nav items) — check 'every interactive component shows hover and focus specimens' RED→GREEN.
Final: fixed accordion open example plus summary hover/focus specimens — 'accordion shows one open example' RED→GREEN.
Final: fixed checkbox error cue on the control — 'checkbox error mark shows on the control and differs from the focus ring' RED→GREEN.
Final: fixed live header aria-current removed (this page is not in the nav); current state shown as a .is-current specimen — 'live nav marks no current page here…' RED→GREEN.
Final: fixed grid specimen cells: surface + hairline + 16px radius, no green pill (preview CSS, no test).
Final: fixed tabs wrap instead of scroll on phones — 'tabs wrap and stay on screen at 360px' RED→GREEN.
Final: fixed the double hairline after Typography and Accordion (preview CSS, no test).
Final: Ruling: added .is-current as a preview-only state class next to .is-hover/.is-focus, so the current-nav look can be shown without a false aria-current — cost if wrong: one more docs-only class in components.css.
Final: code review (opus): 0 Critical, 6 Important, 9 Minor.
Final: fixed I1 long unbroken text widening the page (body overflow-wrap: anywhere) — 'long unbroken text wraps instead of widening the page at 320px' RED→GREEN.
Final: fixed I2 tab label overflow (removed flex:none + nowrap from .tabs__tab) — 'a long tab label wraps inside its tab at 320px' RED→GREEN.
Final: fixed I3 dead tab strip without JS (html:not(.js) .tabs__list hidden; each panel now starts with its own heading) — 'without JS every tab panel shows and the dead tab strip is hidden' RED→GREEN.
Final: fixed I4 error ring looked like the focus ring: the error is now a dashed red ring and focus stays solid green — the same check RED→GREEN.
Final: Ruling: I4 does not use the reviewer's suggested red border-left on the group, because Impeccable's craft floor bans colored side stripes over 1px; a dashed outline differs in shape from the focus ring and survives forced colors — cost if wrong: a dashed ring is subtler than a stripe.
Final: Ruling: I5 (the modal opener does nothing without JS) is not fixed in phase 1; the pattern (opener = the form's submit button, ui.js intercepts after checkValidity, confirm button form="id") is recorded in spec §15 and in the modal CSS comment, because phase 1 has no real form to guard — cost if wrong: a phase 2 confirm flow built from the demo would block without JS.
Final: fixed I6 bookkeeping: suite 46/46 (f3.log, headless); finish-review changes ledgered above.
Final: fixed test bug: the desktop nav check counted the specimen nav links; it is now scoped to .site-header.
Final: minor (deferred): dragging a text selection from inside the dialog onto the backdrop closes it (ui.js backdrop click; needs a pointerdown target check).
Final: minor (deferred): dialog.returnValue stays stale between openings (set returnValue = "" before showModal).
Final: minor (deferred): ::backdrop does not inherit --overlay on Chromium <122 / Firefox <120 / Safari <17.4 (add ::backdrop { --overlay: … } in tokens.css).
Final: minor (deferred): one bad reference (toggle outside a <header>, an aria-controls typo) throws and stops later ui.js behaviours (use optional chaining).
Final: minor (deferred): phone pagination hides the page count and first/last pages (reviewer disagrees with my Task 4 ruling; option: a visible 'Page 5 of 10').
Final: minor (deferred): screen readers get the alert type only from the title wording (add a visually hidden 'Warning:' prefix or require typed titles).
Final: minor (deferred): the sticky preview contents list is taller than short laptop screens (add max-height + overflow).
Final: minor (deferred): weight evidence corrected below; Apache on this XAMPP sends no compression, so enable mod_deflate before launch.
Final: minor (deferred): weak checks — the footer ring check reads outlineColor without outlineStyle; missingIdRefs skips href="#…", data-modal-open and duplicate ids; the disabled-choice check tests the browser.
Final: impeccable verdict pass (fresh reviewer; the first could not be resumed after the session restart): 7/7 fixes resolved, 1 regression (the current-nav specimen stretched to its caption width) → disposition FIX.
Final: fixed the regression: '.ds-state > a, .ds-state > button { align-self: flex-start }' (preview CSS); confirmed by screenshot at 390 and 1440; suite 46/46 headless (f4.log). Two review rounds is the unattended budget, so there is no third review round.
Final: weight re-measured: page total 150,897 B (index.html 66,229 B); real-page assets (font, CSS, JS, sprite, logo) 84,668 B.
Final: documenter wrote dswd/DESIGN.md (20 KB) and dswd/.impeccable/design.json (24 KB); it documents the pagination solid-fill current page as a deliberate exception.
Final: Ruling: the workspace and ledger are KEPT instead of deleted, because there is no git history to replace them as the record — cost if wrong: a stray .superpowers/ folder in SLP.
Final: Ruling: superpowers:finishing-a-development-branch is skipped, because there is no git branch to merge or open a PR from — cost if wrong: none.
PHASE 1: COMPLETE (suite 46/46 headless; impeccable review fix → verdict 7/7 resolved plus 1 regression fixed; code review Important 1–4 fixed, 5 recorded as a follow-up, 9 minors deferred; DESIGN.md written).
PHASE 2: IN PROGRESS (stopped at the usage limit, 2026-10-13)
- Done: docs/phase-2-sitemap-and-wireframes.md (sitemap, 3-click paths, wireframes, 13 self-answered decisions); includes/ (bootstrap, lang en/fil, data placeholders + get_*() accessors, head, header, footer, .htaccess deny); 15 pages (index, programs, program, news, article, downloads, transparency, offices, about, contact, faqs, search, privacy, terms, sitemap); CSS sections 14–32; 11 new sprite icons; img/placeholder-photo.svg; downloads/placeholder.pdf.
- Verified: every page HTTP 200 with no PHP errors (unknown slug → 404); home has no sideways scroll at 320/360/1440 (screenshots).
- Next: switch tests/check.js to tests/harness.js (written, not wired yet); write tests/site-check.js (per-page structure, 5 widths, filters, language toggle, 3-click crawl, focus rings); run both suites; then phase 3, then phase 4.
PHASE 2: COMPLETE — site-check 127/127, check 46/46 (both on the shared tests/harness.js, headless).
Phase 2 fixes found by the tests: header $current collided with the page's $current (renamed $navCurrent); visually hidden text in .table-wrap widened the page (.table-wrap position: relative); the footer logo was not lazy; footer links under 44px wide (min-width); "1 results" wording (now "Results: 1"); two test bugs (locator scope, duplicate program links).
Phase 2 rulings: brief-pinned heading line-height 1.2 (detector tight-leading 0.96x is a parent-font miscalculation); cramped-padding on full-bleed bands is a false positive; DESIGN.md gained a phase 2 section, and its card/hero Don'ts were amended for the brief-requested quick-access cards and title-band hero.
PHASE 3: STARTED
Phase 3: Ruling: MySQL 8 → MariaDB 10.4.32 (XAMPP); the SQL avoids MySQL-8-only features (utf8mb4_unicode_ci, CHECKs and ENUMs work on both) — cost if wrong: none.
Phase 3: Ruling: local DB access uses root with no password, because this MariaDB's privilege tables mysql.db and mysql.proxies_priv are corrupt (Aria checksum), so GRANT and DROP USER fail. I did NOT repair the system tables myself (a failed repair could lock the user out). Two orphan accounts dswd_app@localhost and @127.0.0.1 remain with USAGE only and an unrecorded random password. The repair and the least-privilege account are documented in docs/phase-3-setup.md — cost if wrong: the local app has full DB rights (local machine only).
Phase 3: Ruling: added tables and columns beyond the brief's list: site_settings (contact details, mandate, DPO), rate_limits (HMAC-hashed keys), users.must_change_password, programs.kind and is_featured, news.excerpt and cover_alt, downloads.program_id, audit_logs.summary, categories.slug, and status + deleted_at on every content table — cost if wrong: extra columns only.
Phase 3: built — schema.sql, seed.sql, seed-test-users.sql (local only); config/ (config.php, config.local.php, db.php); includes/ (functions, repository, csrf, auth, richtext, upload, feedback, api, admin-layout, admin-crud); 16 public pages on the DB; admin/ (login, logout, change-password, dashboard, 8 CRUD resources, feedback, users, audit, settings); api/ (programs, news, downloads, offices, faqs, feedback); uploads/ with .htaccess; root .htaccess.
Phase 3: tests/admin-check.js (19 checks) found a real bug: the rich text editor hid a required textarea, so the browser blocked every new article/program with JS on ("invalid form control is not focusable"). Fixed in js/admin.js: the editor takes the textarea's id, required and invalid states; the server still rejects an empty field.
Phase 3: Ruling: harness unnamedControls skips [hidden] subtrees (not in the accessibility tree), so the editor's hidden source textarea is not flagged — cost if wrong: a control inside a hidden tab panel is not name-checked.
Phase 3: Ruling: feedback retention has ONE source, config feedback_retention_days (365): the privacy notices print it and purge_old_feedback() deletes resolved/closed messages past it when staff open the dashboard (audited). The free-text site setting retention_period was removed (seed + DB). Open messages are never purged. The DPO must confirm the period — cost if wrong: messages kept or deleted on the wrong schedule.
Phase 3: database/backup.bat (mysqldump --single-transaction + robocopy uploads, dated folder, 30-day rotation only after success, credentials in backup.cnf). Tested: backup to scratchpad, restore into a scratch DB, row counts matched for 6 tables, uploads/.htaccess included; scratch DB dropped.
Phase 3: docs/phase-3-setup.md — ER description, XAMPP install, default admin, least-privilege accounts + MariaDB repair, backup/restore, roles table, staff guide, API, security measures, going-live list, 9 decisions to confirm.
PHASE 3: COMPLETE — admin 19/19, site 127/127, preview 46/46 (headless).
PHASE 4: STARTED
Phase 4: audit method — static scan (fonts, colours, inline styles, emoji, icons, radii, raw lengths, unused/duplicate CSS), runtime scan of 30 URLs at 360 and 1280 (contrast on composited backgrounds, control edges, colour-only links, headings, alt, landmarks, lang, titles, link text, duplicate ids, input purpose, 44px targets, WCAG 1.4.12), impeccable detect before/after, throttled perf (Lighthouse mobile and DevTools Slow 4G, medians of 5), security probes (headers, listing, exposure, access matrix, CSRF, uploads, 18 malformed requests).
Phase 4: fixed — C1 (phase 3) rich-text required textarea; M1 photo metadata stripped (orientation kept); M2 1600px image cap + in-browser downscale; M3 versioned assets + 1-year cache; M4 PHP gzip for pages/JSON + pre-compressed .gz bundles via mod_rewrite (no mod_deflate needed); M5 one minified CSS bundle (tools/build-assets.php, stale bundles fall back to sources); M6 44px targets (brand, section-head, toc, admin Cancel, preview toc); 15 minors (page-section spacing, 36em measure, pagination status/window, alert type prefix, dialog fixes, ui.js guards, X-Powered-By, _*.php and tools/ denied, HSTS, API HEAD, autocomplete off, CSS merge/unused spans, error page lang, preview sticky toc, test gaps).
Phase 4: Ruling: did NOT edit XAMPP httpd.conf/php.ini or restart Apache (outside the project; a failed restart would take the user's server down). ServerTokens, deflate_module and php.ini values are pre-launch checklist items — cost if wrong: the Server header still shows versions locally.
Phase 4: Ruling: Firefox/WebKit not installed and not downloaded (a download needs the user's approval); harness now takes PW_BROWSER, and the report lists the commands and a manual checklist — cost if wrong: engine-specific bugs found later.
Phase 4: Ruling: detector findings kept as false positives — overused-font (brief: Inter), tight-leading (brief-pinned 1.2), cramped-padding (.table-wrap), first-viewport-column-overflow (intended sidebars), em-dash-overuse (preview copy) — cost if wrong: none functional.
Phase 4: lesson — Git Bash heredocs collapse backslashes before node sees them; anything with \x, \r, \n or regex goes through the Write/Edit tools.
Phase 4: M7 found late by tracing Home's first paint: preload + font-display swap made Chrome wait for the 48 KB font (blocking the font in a test brought first paint down to DOMContentLoaded). Ruling: keep the preload, switch to font-display: optional — Home cold FCP 1.48 s to 0.96 s (Lighthouse profile), 2.46 s to 1.84 s (Slow 4G), no layout shift — cost if wrong: a slow first visit shows system-ui on its first page.
Phase 4: performance final (medians of 5, 360px): first visit 65–67 KB in 6–7 requests (was 115–121 KB in 8–9), one render-blocking stylesheet (was 3), repeat visit 3–4 KB; FCP 0.81–1.36 s Lighthouse profile, 1.64–1.84 s Slow 4G.
Phase 4: test data from the final runs removed (4 uploaded files, sample rows); DB back to seed state.
PHASE 4: COMPLETE — preview 46/46, site 129/129 (Chromium and Edge), admin 25/25; report, issue list and pre-launch checklist in dswd/docs/phase-4-audit.md.
