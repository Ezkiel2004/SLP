# SDD ledger — plan: docs/superpowers/plans/2026-10-13-slp-app-wiring-core.md
Spec: docs/superpowers/specs/2026-10-13-slp-app-wiring-design.md
Setup: Ruling: not a git repo — no worktree, commits or BASE; workspace and ledger made by hand; task-done = a manual run of the task's check command, ledgered — cost if wrong: no history to diff.
Setup: next plan in this run: docs/superpowers/plans/2026-10-15-slp-self-registration.md (A2), own ledger.
Pre-flight: T2→T1 require_user/json_out/Browser/login_as: consistent. T3,T4→T1: consistent. T5→T2 snapshot shape (spec §3.4): consistent. T6→T5 api/loadData/LABELS/referenceData/displayId: consistent. T7→all: consistent.
Pre-flight: cross-plan: A's Global Constraint "never --fresh slp_monitoring" vs A2 Task 7 reinstall. Ruling: A2's approved spec §3 requires the reinstall for its schema change; A2 Task 7 guards it (stop if users > demo count) — cost if wrong: demo-only data replaced.
Task 1: RED seen (fatal: _check-lib.php missing). schema-check after the move: 46/46. Ruling: rolled_back() and ids() stay in schema-check.php (the plan lists only the seven moved helpers) — cost if wrong: none. Ruling: login failures audit actor_id NULL for known users too (no one is signed in), entity_id = the user — cost if wrong: none.
Task 1: complete (no commits; tests: C:\xampp\php\php.exe api\tests\api-check.php → 10 passed, 0 failed; schema-check 46/46)
Task 2: RED seen (7 FAIL, 404). Ruling: queries use execute_query (binary protocol) so ids come back as native ints; booleans and DECIMAL amount are cast in PHP — cost if wrong: none.
Task 2: complete (tests: C:\xampp\php\php.exe api\tests\api-check.php → 17 passed, 0 failed)
Task 3: RED seen (10 FAIL, 404). Ruling: shared validators (text_field, id_field, code_field, date_field, in_transaction, beneficiary_name) live in api/_lib.php, as the plan allows for helpers used by 2+ endpoints. Messages not pinned by the plan: "Choose a valid owner." (projects owner rule), "Amount is not valid.", "<Label> is not a valid date.", "Username must be 3 to 50 letters, numbers, dots, dashes or underscores.", "Password must be at least 8 characters." — cost if wrong: copy tweaks.
Task 3: complete (tests: C:\xampp\php\php.exe api\tests\api-check.php → 27 passed, 0 failed)
Task 4: RED seen (4 FAIL, 404). Ruling: the visibility clause is built from me.beneficiaryId cast to int (not request input); read_all uses INSERT IGNORE … SELECT — cost if wrong: none.
Task 4: complete (tests: C:\xampp\php\php.exe api\tests\api-check.php → 31 passed, 0 failed)
Task 5: RED seen (21/21 fail before the change). Rulings:
- api() signs out on a 401 only while someone is signed in (currentUser set), not "anything but login.php", so the page-load session check (session.php 401) does not show a timeout notice — cost if wrong: none.
- logoutUser() also clears the in-memory records (clearSignedInData) so the next person on a shared computer sees nothing of the last one — cost if wrong: none.
- The leader notice shows the association name and livelihood from the snapshot instead of the hard-coded "Lubang Chapter"/"Community Store" — cost if wrong: copy.
- Tests that relied on in-memory cross-user behaviour were trimmed to what the client still owns: "Critical Fix 2" keeps the recipient assertion (who sees it is the API check "send to one or to all"); "Medium Fix" drops signing in with the new account (API check "account create"); "Security 3" compares the whole profileForms object, because staff have no profile — cost if wrong: none; the server checks cover the removed parts.
- The sign-in form no longer has autocomplete="off", so password managers work with the username field — cost if wrong: none.
- tests/ui/design-check.js selects demo buttons by data-username (the attribute was renamed) — cost if wrong: none.
Task 5: complete (tests: npm test → 21 pass, 0 fail)
Task 6: RED seen: 7 FAIL (Critical Fix 1/2, Medium Fix, and the 4 new tests). "Security 4" and "Medium Issue 1" passed on their first run after conversion: they test rendering from the snapshot, which Task 5 already made work. Rulings:
- The confirm button is found by id="confirmButton" (data-confirm kept), because the test mock DOM only supports getElementById — cost if wrong: none.
- All saves share one helper, sendSave(path, body, page, message), in a new section "18B. SAVING TO THE SERVER"; it also refreshes the notification count and suppresses the error toast on a 401 (the sign-out notice already shows) — cost if wrong: none.
- The account form's "Account For" select replaces the role select; the password field gets minlength="8" and a hint matching the server rule; the assistance release date gets max=today like the visit date — cost if wrong: copy.
Task 6: complete (tests: npm test → 25 pass; api-check 31/31; schema-check 46/46)
Task 7: Apache: 403 for api/_lib.php, api/tests/api-check.php, database/db.php; session.php 401 {"ok":false,…}. Smoke test (in-app browser, live slp_monitoring): admin dashboard 12 beneficiaries; added "Smoke Test" (Tilik, Tilik Poultry Raisers SLPA) → B-013, livelihood "Poultry Raising"; a real reload kept the session and the row; sign-out ended the server session (session.php 401); member: Beneficiaries Access Denied, notifications = general notice only; leader: Monitoring Schedule + general notice. Smoke row deleted (count back to 12).
Task 7: Ruling: the console shows "Failed to load resource: 401" for the page-load session check when nobody is signed in (and for a manual probe); these are browser network log lines, not script errors, and session.php's 401 is the spec'd contract (API checks pin it) — kept — cost if wrong: one console line per fresh visit.
Task 7: complete (tests: npm test 25/25; api-check 31/31; schema-check 46/46)
PLAN COMPLETE (part A). Final review deferred to after part A2, per the user's instruction ("run all tasks, then one final review").
