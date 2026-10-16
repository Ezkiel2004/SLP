# SLP App Wiring, Part A: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The prototype signs in against `slp_monitoring`, loads its data from a role-filtered API snapshot, and saves beneficiaries, projects, field monitoring, assistance, reports, notifications and accounts to the database.

**Architecture:**
- **Server:** a small PHP JSON API in `api/`, with one file per resource and shared helpers in `api/_lib.php`, on top of `database/db.php`.
- **Read path:** after sign-in, `GET api/bootstrap.php` returns everything the user may see, filtered on the server. `applySnapshot()` maps it into the existing `data`, `users` and `profileForms` objects, so the renderer stays synchronous.
- **Write path:** a save sends one `POST`, then reloads the snapshot.

**Tech Stack:** PHP 8.2.12 with mysqli, session and curl. MariaDB 10.4.32. Vanilla JS with `fetch`. Node 20 `node:test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-slp-app-wiring-design.md` (this part). The schema spec `docs/superpowers/specs/2026-10-13-slp-database-schema-design.md` is binding for permissions (§2) and read rules (§7).

**Not a git repository:** there are no commit steps. Each task ends by running its checks, and the task is done when they all pass.

## Global Constraints

- Commands run from `C:\xampp\htdocs\SLP`. PHP is `C:\xampp\php\php.exe`, MySQL is `C:\xampp\mysql\bin\mysql.exe` and Node is on `PATH`.
- Every database connection goes through `db_connect()` in `database/db.php`, which sets `utf8mb4_unicode_ci`, `+08:00` and strict `sql_mode`. Nothing else may call `new mysqli`.
- `api/_lib.php` calls `date_default_timezone_set('Asia/Manila')`.
- **Databases:**
  - `slp_monitoring` is the live demo database. Never `--fresh` it and never write test data to it.
  - The API checks use `slp_api_check`; the schema checks use `slp_schema_check*`.
  - Never touch `dswd_website` or the `dswd/` folder.
- **JSON:** encoded with `JSON_UNESCAPED_UNICODE`. Responses are `{"ok": true, …}`, or `{"ok": false, "error": "<plain sentence>"}` with these statuses:

  | Status | When |
  |---|---|
  | 400 | bad JSON |
  | 401 | not signed in or idle |
  | 403 | wrong role or CSRF |
  | 404 | not visible |
  | 405 | wrong method |
  | 409 | duplicate |
  | 422 | invalid input |
  | 429 | locked |
  | 500 | "Something went wrong. Try again." (database details are never sent) |

- **Session:**
  - Cookie `SLPSESSID`, with `httponly`, `SameSite=Strict` and `use_strict_mode=1`.
  - The id is regenerated on sign-in.
  - Idle limit: `getenv('SLP_SESSION_IDLE') ?: 900` seconds. The environment knob exists only so the test server can use 3.
- **CSRF:** `bin2hex(random_bytes(32))` is stored at sign-in, and every `POST` except `login.php` must send it in `X-CSRF-Token`, compared with `hash_equals`.
- **Lockout:** 5 failures set `locked_until = NOW() + INTERVAL 15 MINUTE`. Unknown usernames still run `password_verify` against a dummy hash.
- **Audit:** every write runs in one transaction with its `audit_log` row. Actions are `auth.login`, `auth.login_failed`, `auth.logout`, `beneficiary.create`, `project.create`, `monitoring.create`, `assistance.create`, `report.create`, `notification.send` and `account.create`.
- **UI rules from `CLAUDE.md`:**
  - Build only from the existing component helpers, with no inline `style=""`.
  - Every user value goes through `escapeHTML()`, and `onclick` handlers get ids, never text.
  - Sentence case for buttons and headings; Title Case for labels and statuses.
- Bump the cache-busting version from `?v=3.7` to `?v=3.8` in `index.html`.
- **Writes A leaves unconnected:** `saveProfile`, `saveDocument`, `approveDocument` and `saveTool` keep their in-memory behaviour. Part B wires them.

## Review Focus

1. **Double-clicking a confirm button** must create one record, not two. Test: `confirm button is disabled while saving` (Task 6).
2. **Server down or network error during a save.** The user sees "Cannot reach the server. Check your connection and try again.", the modal stays open, and nothing is lost. Test: `network failure keeps the form open` (Task 5).
3. **Garbage in the request body** (`"barangayId": "abc"`, an array where a string belongs, non-JSON) gets 400 or 422, never a 500 or a PHP warning. Test: `bad types are rejected, not crashed on` (Task 3).
4. **Filipino names with ñ go through the API unchanged.** Creating "Santo Niño" gives "Santo Niño" back in the snapshot. Test: `ñ survives the API round trip` (Task 3).
5. **A session that expires while a form is open** makes the server answer 401. The client signs out with the timeout notice; it does not show a raw error. Test: `a 401 signs the user out` (Task 5).

---

### Task 1: Shared connection, API foundation, sign-in

**Files:**
- Create: `database/db.php` (`db_connect()` moved verbatim from `install.php`, plus the `SQL_MODE` constant)
- Modify: `database/install.php` (remove both, add `require __DIR__ . '/db.php';`)
- Create: `database/tests/_check-lib.php` (check registry and assertions moved out of `schema-check.php`)
- Modify: `database/tests/schema-check.php`: require `_check-lib.php`, keep its checks, and replace its runner loop with `run_checks()`. Its `$argFor` installs the scratch database for the demo flag, and its `$cleanup` drops the scratch databases and storage. Because of the "nothing matched" rule, a mistyped filter now exits 1, which also fixes the deferred minor from the database plan.
- Create: `api/_lib.php`, `api/login.php`, `api/logout.php`, `api/session.php`, `api/.htaccess`, `api/tests/.htaccess`
- Test: `api/tests/api-check.php`

**Interfaces:**
- **Produces (`database/tests/_check-lib.php`):**
  - moved unchanged from `schema-check.php`: `check(string $name, callable $fn, bool $demo = false)`, `expect_error(mysqli, int, string): string`, `ok(bool, string)`, `scalar(mysqli, string)`, `column(mysqli, string): array`, `same(array, array, string)` and `remove_tree(string)`;
  - new: `run_checks(string $filter, callable $argFor, callable $cleanup): never`.
    - Filter: `""` selects every check, `"demo"` selects every check registered with `$demo = true`, and anything else matches part of a check name.
    - It runs the selected checks with `$argFor($demo)` as each check's argument, and prints `PASS`/`FAIL` lines and `<p> passed, <f> failed`.
    - It calls `$cleanup()` in `finally`, and exits with 1 if anything failed or nothing matched the filter.
- **Produces (`api/_lib.php`):**
  - `api_db(): mysqli`: returns `db_connect(getenv('SLP_DB') ?: 'slp_monitoring')`.
  - `start_session(): void`: cookie settings and idle limit. An idle session is destroyed and the next guard answers 401.
  - `json_out(array $body, int $status = 200): never` and `fail(int $status, string $message): never`.
  - `require_method(string $method): void` (405 otherwise) and `read_json(): array` (400 on invalid JSON or a non-object).
  - `current_user(mysqli $db): ?array` returns `me` (wiring spec §3.3) for an active user in the session.
  - `require_user(mysqli $db, string ...$roles): array` gives 401 or 403. For `POST` it also checks CSRF (403).
  - `audit(mysqli $db, ?int $actorId, string $action, ?string $entityType, ?int $entityId, ?int $associationId, string $summary): void`, which stores `REMOTE_ADDR`.
  - `db_fail(mysqli_sql_exception $e): never` maps codes: 1062 to 409; 1452, 4025, 1265, 1406 and 1048 to 422; anything else to 500.
- **Produces (endpoints):** `login.php`, `logout.php` and `session.php`, as in wiring spec §3.3.
- **Produces (`api/tests/api-check.php` helpers):**
  - `const BASE = 'http://127.0.0.1:8765/'`.
  - `class Browser { public ?string $csrf; function request(string $method, string $path, mixed $body = null, bool $csrf = true): array }` returns `[int $status, ?array $json]` and keeps a curl cookie jar per instance. `$body` is JSON-encoded unless it is a string, which is sent raw.
  - `login_as(string $username, string $password): Browser`.
  - The harness installs `slp_api_check` with `install(..., demo: true, fresh: true, storageDir: <temp>)`. It starts `php -S 127.0.0.1:8765 -t <project root>` through `proc_open` with `SLP_DB=slp_api_check` and `SLP_SESSION_IDLE=3`, waits up to 5 s for the port, and passes a `db_connect('slp_api_check')` handle to every check. Cleanup stops the server, drops the database and removes the temp folders.
- **Contents of `api/.htaccess`:** `<FilesMatch "^_">` with `Require all denied`. `api/tests/.htaccess` contains `Require all denied`.

- [ ] **Step 1: Write the failing checks** in `api/tests/api-check.php`:

| Check name | Asserts |
|---|---|
| `login succeeds for each demo account` | For admin/admin123, leader/leader123 and member/member123: 200, `me.role` is `staff`, `leader` and `member` respectively, `me.username` matches, and `csrf` matches `^[0-9a-f]{64}$`. `me.name` is "MSWDO Personnel", "Maria Santos" and "Juan Dela Cruz". |
| `login rejects a wrong password` | 401, error "Wrong username or password.", and `users.failed_logins` for leader is 1. Reset it afterwards. |
| `unknown username gets the same answer` | `nobody`/`x` gives 401 with the same error |
| `five failures lock the account` | Five wrong passwords for `member`, then the correct one, gives 429 "Too many failed attempts. Try again in 15 minutes.", and `locked_until > NOW()`. Reset `failed_logins` and `locked_until` afterwards. |
| `inactive account cannot sign in` | Set `admin` to inactive; the correct password gives 401. Restore it. |
| `session survives and logout ends it` | After sign-in, `GET session.php` gives 200 with the same `me`. `POST logout.php` gives 200. Then `session.php` gives 401. |
| `POST without CSRF is refused` | A signed-in `POST logout.php` with `csrf: false` gives 403, and the session is still valid |
| `idle session expires` | Sign in, `sleep(4)`, then `session.php` gives 401 |
| `sign-in is audited` | One success and one failure add `auth.login` and `auth.login_failed` rows. The failure row has `actor_id` NULL when the username is unknown. |
| `internals are not served` | `api/.htaccess` contains `<FilesMatch "^_">` and `Require all denied`; `api/tests/.htaccess` contains `Require all denied` |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: a fatal error or FAILs, because `api/_lib.php` and `database/db.php` do not exist yet.

- [ ] **Step 3: Move the shared code.** Create `database/db.php`, `database/tests/_check-lib.php` and the `require` lines. Then run `C:\xampp\php\php.exe database\tests\schema-check.php`. Expected: `46 passed, 0 failed`.

- [ ] **Step 4: Implement `api/_lib.php`, the three endpoints and the two `.htaccess` files** as described under Interfaces.

- [ ] **Step 5: Run the checks to verify they pass**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: `10 passed, 0 failed`, exit code 0. `SHOW DATABASES LIKE 'slp_api_check'` prints nothing afterwards.

---

### Task 2: The role-filtered snapshot

**Files:**
- Create: `api/bootstrap.php`
- Test: `api/tests/api-check.php` (add checks)

**Interfaces:**
- **Consumes:** `require_user()`, `json_out()` and `Browser`/`login_as()` from Task 1.
- **Produces:** `GET api/bootstrap.php`, returning the JSON shape in wiring spec §3.4.
  - Field names are camelCase as listed there.
  - Ids are integers, `amount` is a number or `null`, `read`/`shared`/`hasAccount` are booleans, and dates are `Y-m-d` or `Y-m-d H:i:s` strings.
  - Filters follow the table in spec §3.4.
- **`livelihood`:** the association's livelihood type name. For an individual-track beneficiary it is the type of the project they own; with no project, `""`.

- [ ] **Step 1: Write the failing checks**

| Check name | Asserts |
|---|---|
| `bootstrap needs a session` | Without signing in: 401 |
| `staff snapshot has everything` | Counts: beneficiaries 12, projects 6, monitoring 2, assistance 2, reports 3, documents 4, notifications 3, users 3, `reference.barangays` 16, `reference.livelihoodTypes` 7, `reference.associations` 5. `profile` is null. |
| `member snapshot is filtered` | As `member`: beneficiary ids `[2]`; project ids `[1]` (their association's); monitoring, assistance and users `[]`; report ids `[1]`; document ids `[1, 2]`; notification ids `[3]`; association ids `[1]`; `profile.firstName` is "Juan" |
| `leader snapshot is filtered` | As `leader`: beneficiary ids `[1]`; document ids `[1, 2, 4]`; notification ids `[1, 3]`; `profile.firstName` is "Maria" |
| `no password hash in any snapshot` | The raw response text for all three roles contains neither `$2y$` nor `password` |
| `read state is per user` | Insert into `notification_reads` (3, user 3). The member's snapshot then has notification 3 `read: true` and the leader's has `read: false`. Delete the row. |
| `livelihood comes from association or own project` | In the staff snapshot, beneficiary 1 has livelihood "Sari-sari Store" and beneficiary 3 has "Food Vending" |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: the 7 new checks FAIL (404 from the built-in server, because `bootstrap.php` is missing). The 10 checks from Task 1 still pass.

- [ ] **Step 3: Implement `api/bootstrap.php`.** Use one query per key. Participant filters are bound parameters taken from `me`, never from the request.

- [ ] **Step 4: Run the checks to verify they pass**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: `17 passed, 0 failed`.

---

### Task 3: Staff create endpoints

**Files:**
- Create: `api/beneficiaries.php`, `api/projects.php`, `api/monitoring.php`, `api/assistance.php`, `api/reports.php`, `api/accounts.php`
- Modify, only if a helper is shared by two or more of them: `api/_lib.php`
- Test: `api/tests/api-check.php` (add checks)

**Interfaces:**
- **Consumes:** everything Task 1 produces.
- **Produces:** the six `POST` endpoints in wiring spec §3.3. Each one:
  - runs `require_method('POST')`, then `require_user($db, 'staff')`;
  - validates;
  - inserts the row and its audit row in one transaction;
  - answers `{ok: true, id}`.
- **Validation messages** (422):
  - `"<Field label> is required."`;
  - `"<Field label> is too long."`;
  - `"Choose a valid <thing>."` for an unknown or garbage id or code;
  - `"Visit date cannot be in the future."` and `"Release date cannot be in the future."`.
- **Field labels:** First Name, Last Name, Barangay, Association, Project Name, Owner, Livelihood Type, Status, Beneficiary, Visit Date, Progress, Recommendation, Support Type, Release Date, Amount, Report Type, Report Period, Report Details, Username, Password, Full Name.
- **Account rules:**
  - The username must match `^[A-Za-z0-9._-]{3,50}$` and is stored lowercase.
  - The password must be at least 8 characters.
  - New accounts keep the database default `must_change_password = 1`.
  - Errors: "That username is already taken." (409) and "That beneficiary already has an account." (409).
- **Amount:** a number of at least 0 with at most 2 decimals, or `null` / `""`, which mean non-cash.

- [ ] **Step 1: Write the failing checks**

| Check name | Asserts |
|---|---|
| `participants cannot call staff endpoints` | As leader and as member, a valid payload to each of the 6 endpoints gives 403, and the table row counts are unchanged |
| `beneficiary create` | Staff `{firstName:"Rosa", lastName:"Lim", barangayId:15, associationId:2, householdInformation:"Household of 3"}` gives 200 with an `id`. The row has barangay 15 and association 2, and an audit row `beneficiary.create` exists with `association_id` 2. |
| `beneficiary create validates` | `barangayId` 99 gives 422 "Choose a valid barangay."; an empty `firstName` gives 422 "First Name is required."; a 101-character `firstName` gives 422 "First Name is too long." |
| `bad types are rejected, not crashed on` | `barangayId:"abc"` gives 422; `firstName:["x"]` gives 422; a raw body `not json` gives 400. No response is 500, and no response text contains "Warning" or "Fatal". |
| `ñ survives the API round trip` | Create `{firstName:"Santo", lastName:"Niño", …}`. The staff snapshot then contains a beneficiary with `lastName` exactly "Niño". |
| `project create needs exactly one owner` | Both `associationId` and `beneficiaryId` give 422; neither gives 422; `associationId` 4 with `livelihoodTypeId` 3 and `status` "ongoing" gives 200 |
| `monitoring create rejects a future date` | Tomorrow (Manila) gives 422 "Visit date cannot be in the future."; today gives 200 with an audit row `monitoring.create` |
| `assistance amount rules` | `-5` gives 422; `"5000.50"` stores 5000.50; `null` stores NULL |
| `report create` | 200, and the row has `status` 'for_review' and `shared_with_participants` 0 |
| `account create` | A staff account `{fullName:"Carla Mendoza", username:"pdo_officer", password:"securepass123"}` gives 200, and `login_as('pdo_officer','securepass123')` then works. The same username again gives 409. A participant account for beneficiary 1 gives 409. A participant account for beneficiary 5 gives 200, and `user_roles` shows `member`. A 7-character password gives 422. |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: the 10 new checks FAIL; the previous 17 pass.

- [ ] **Step 3: Implement the six endpoints.**

- [ ] **Step 4: Run the checks to verify they pass**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: `27 passed, 0 failed`.

---

### Task 4: Notifications endpoint

**Files:**
- Create: `api/notifications.php`
- Test: `api/tests/api-check.php` (add checks)

**Interfaces:**
- **Consumes:** Task 1 and the Task 2 read rule for notifications.
- **Produces:** `POST api/notifications.php` with three actions:
  - `send` is staff only. It validates Title (max 150) and Message (required). `beneficiaryId` is null for everyone, otherwise it must be an existing beneficiary. It is audited as `notification.send`.
  - `read {id}` uses `INSERT IGNORE INTO notification_reads`. A notification outside the user's read rule gives 404.
  - `read_all` inserts a read row for every notification the user can see.
  - An unknown action gives 422.

- [ ] **Step 1: Write the failing checks**

| Check name | Asserts |
|---|---|
| `send to one or to all` | Staff sends to beneficiary 2. The member's snapshot includes it and the leader's does not. Staff sends with `beneficiaryId` null; both snapshots include that one. |
| `participants cannot send` | As member, `send` gives 403 |
| `read marks only visible notifications` | As member, `read` for id 1 (Maria's) gives 404; `read` for id 3 gives 200, after which the member's snapshot has `read: true` for id 3. Reading id 3 again gives 200 (idempotent). |
| `read_all marks every visible notification` | As member, `read_all` gives 200, and the `notification_reads` count for user 3 equals the number of notifications in the member's snapshot |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: the 4 new checks FAIL.

- [ ] **Step 3: Implement `api/notifications.php`.**

- [ ] **Step 4: Run the checks to verify they pass**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: `31 passed, 0 failed`.

---

### Task 5: Client sign-in, session and snapshot mapping

**Files:**
- Modify: `js/script.js`:
  - §1–3: remove the `users` passwords, the demo `data` arrays and the `profileForms` seeds. `data`, `users` and `profileForms` start empty but keep their keys.
  - §11 sign-in: new `loginUser`, `resumeSession`, `api` and `ApiError`.
  - §12: `logoutUser`.
  - §29: `getCurrentBeneficiary`.
  - §17 participant dashboard:
    - **Project Status:** reads `data.projects[0]`, since the participant snapshot holds only their own projects. The prototype's name match (`project.name === beneficiary.livelihood`) cannot work with database names.
    - **Profile Status:** shows `beneficiary.profileStatus` (Draft, Submitted or Verified) instead of the session-only "Saved" / "Not started".
  - §27: `getCurrentProfile`.
  - §23: `getVisibleNotifications`.
  - §28: `documentsPage`.
  - §24: `accountsPage` and the `EXPORTS.accounts` rows read `users[key].status`; nothing hard-codes "Active" any more.
  - New: `LABELS`, `displayId` and `applySnapshot`.
  - `STATUS_TONES` gains "Returned" (attention) and "Draft" (neutral).
  - Add the new functions to the exports.
- Modify: `index.html`: the "Sign in as" select becomes `<input type="text" id="username" autocomplete="username" required>` with the label "Username". The demo buttons use `data-username`.
- Create: `tests/fixtures.js`: `snapshot(role)` returns a bootstrap response for `staff`, `leader` or `member`, built from the seed-demo values.
- Modify: `tests/system.test.js`: the `fetch` stub, async sign-in, and the tests below.

**Interfaces:**
- **Produces (`js/script.js`):**
  - `class ApiError extends Error { constructor(status, message) }`, which also stores `.status`.
  - `async function api(path, body)`: `GET` when `body` is `undefined`, otherwise `POST` with JSON, `credentials: "same-origin"` and `X-CSRF-Token: csrfToken`.
    - It resolves the parsed JSON, or throws `ApiError(status, json.error)`.
    - A rejected `fetch` becomes `ApiError(0, "Cannot reach the server. Check your connection and try again.")`.
    - A 401 from anything other than `login.php` calls `logoutUser("timeout")` before throwing.
  - `let csrfToken = null;`
  - `function displayId(prefix, id)`, e.g. `displayId("B", 1) === "B-001"`.
  - `const LABELS`: the code-to-label maps in wiring spec §4.2, plus `role: { staff: "MSWDO Personnel", leader: "Beneficiary Leader", member: "Beneficiary Member" }` and `userStatus: { active: "Active", inactive: "Inactive" }`.
  - `function applySnapshot(snapshot)`:
    - sets `currentUser = { userId, username, role: LABELS.role[me.role], name, beneficiaryId, associationId, associationName }`;
    - replaces the contents of `data.beneficiaries`, `data.projects`, `data.monitoring`, `data.assistance`, `data.reports`, `data.documents`, `data.notifications`, `users` and `profileForms` in place;
    - sets `referenceData = snapshot.reference`;
    - uses the mapped record shapes below.
  - `async function loadData()`: `applySnapshot(await api("api/bootstrap.php"))`.
  - `async function loginUser(username, password)`: on success, sets `csrfToken`, runs `loadData()` and the existing post-sign-in steps, and returns `true`. On an `ApiError` it shows the server's message in `#loginError` and returns `false`.
  - `async function resumeSession()`: called once on page load in the browser. A 200 from `session.php` signs the user in silently; a 401 leaves the sign-in screen.
- **Mapped record shapes:**

| Record | Fields |
|---|---|
| beneficiary | `{dbId, id: displayId("B"), name: first [middle] last [ext], firstName, lastName, livelihood, status: LABELS.enrollment, location: barangay, associationId, associationName, profileStatus: LABELS.profileStatus, householdInformation, hasAccount}` |
| project | `{dbId, id: "P-…", name, leader: ownerName, status: LABELS.project, associationName, livelihood}` |
| monitoring | `{dbId, id: "M-…", beneficiary: beneficiaryName, beneficiaryId: displayId("B", beneficiaryId), date: visitDate, progress: LABELS.progress, issue: issue \|\| "None", recommendation}` |
| assistance | `{dbId, id: "A-…", recipient: beneficiaryName, type: LABELS.support, date: releaseDate, amount: amount === null ? "—" : formatPeso(amount, 0)}` |
| report | `{dbId, id: "R-…", type: LABELS.reportType, period, details, date: createdAt.slice(0, 10), status: LABELS.reportStatus, shared}` |
| document | `{dbId, name: title, type: LABELS.docCategory, status: LABELS.docStatus, reviewNote, beneficiary: ownerName, date: createdAt.slice(0, 10)}` |
| notification | `{dbId, title, message, date: createdAt.slice(0, 10), recipient: recipientName \|\| "All Beneficiaries", read}` |
| user | `users[username] = {dbId, role: LABELS.role, name, status: LABELS.userStatus, beneficiaryId}` |
| profile | for participants, `profileForms[me.username] = Object.assign(createEmptyProfile(me.name), snapshot.profile \|\| {})` |

- **Produces (tests):**
  - `stubFetch(routes)` replaces `globalThis.fetch`. `routes` maps a path to `(body) => ({ status, json })`. Every call is recorded in `fetchCalls` as `{ path, method, body, headers }`.
  - `signIn(role)` stubs login and bootstrap with `snapshot(role)` and awaits `app.loginUser`.

- [ ] **Step 1: Write the failing tests** in `tests/system.test.js`:
  - Change "Security 1" and "Security 2" to `await signIn(...)`. Their assertions stay the same. `user.password` is still `undefined`, and `"password" in user` is false.
  - Remove "Low Issue 1" (`nextId`). Server ids make collisions impossible.
  - Add these tests:

| Test name | Asserts |
|---|---|
| `applySnapshot maps codes to labels and display ids` | After `applySnapshot(snapshot("staff"))`: `data.beneficiaries[0]` has `id` "B-001", `status` "Active" and `location` "Bagong Sikat". `data.assistance[0].amount` is "₱10,000". `data.reports[0].type` is "Project Report". A notification with `recipientName` null shows "All Beneficiaries". |
| `getCurrentBeneficiary uses the signed-in beneficiary` | After `signIn("member")`, `getCurrentBeneficiary().name` is "Juan Dela Cruz", and `getCurrentProfile().firstName` is "Juan" |
| `failed sign-in shows the server message` | With a stubbed 401 "Wrong username or password.", `loginUser` resolves `false` and `#loginError` has that text |
| `sign-in sends no CSRF header but later posts do` | `fetchCalls` for `login.php` has no `X-CSRF-Token`. After sign-in, `api("api/logout.php", {})` sends the token from the login response. |
| `a 401 signs the user out` | Signed in, a stubbed 401 from `bootstrap.php` during `loadData()` makes `getCurrentUser()` null and shows the timeout notice in `#loginNotice` |
| `network failure keeps the form open` | `fetch` rejects with `TypeError`, so `api()` throws `ApiError` with status 0 and "Cannot reach the server. Check your connection and try again." |
| `client holds no passwords` | The source text of `js/script.js` contains none of `admin123`, `leader123` or `member123` |

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new tests FAIL (for example "app.applySnapshot is not a function"), and the converted tests FAIL because `loginUser` is not async yet.

- [ ] **Step 3: Implement the `js/script.js` and `index.html` changes** as described under Files and Interfaces.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: every test passes, including the unchanged "Medium Issue 2/3", "Low Issue 2", "Critical Fix 3" and "Monitoring tools" tests, which now use `await signIn(...)`.

---

### Task 6: Client saves and forms

**Files:**
- Modify: `js/script.js`:
  - `openBeneficiaryForm`/`saveBeneficiary`, `openProjectForm`/`saveProject`, `openMonitoringForm`/`saveMonitoring`, `openAssistanceForm`/`saveAssistance`, `openReportForm`/`saveReport`, `openNotificationForm`/`saveNotification`, `markNotificationAsRead` and `markAllNotificationsAsRead`, `openAccountForm`/`saveAccount`;
  - `reviewForm()`'s confirm button;
  - delete `nextId`.
- Modify: `tests/system.test.js`
- Modify: `index.html` (`?v=3.8`)

**Interfaces:**
- **Consumes:** `api`, `ApiError`, `loadData`, `LABELS`, `referenceData` and `displayId` from Task 5.
- **Produces:** each save is `async`.
  - It keeps its role check and sends no request when the role is wrong.
  - It sends the payload in wiring spec §3.3, using the field ids below, then `await loadData()`, `closeModal()`, `showPage(<page>)` and the existing success toast.
  - On an `ApiError` it keeps the modal open and calls `showToast(error.message, "error")`.

| Form | Field ids → payload keys |
|---|---|
| Beneficiary | `beneficiaryFirstName` → `firstName`; `beneficiaryLastName` → `lastName`; `beneficiaryBarangay` (select of `referenceData.barangays`) → `barangayId`; `beneficiaryAssociation` (select with "" = "Individual track (no association)", then `referenceData.associations`) → `associationId` (null for ""); `householdInformation` → `householdInformation` |
| Project | `projectName` → `name`; `projectOwner` (values `a:<associationId>` / `b:<beneficiaryId>`, the latter for beneficiaries with `associationId === null`) → `associationId` / `beneficiaryId`; `projectLivelihood` (select of `referenceData.livelihoodTypes`) → `livelihoodTypeId`; `projectStatus` (codes from `LABELS.project`) → `status` |
| Monitoring | `monitoringBeneficiary` (value = `dbId`; `openMonitoringForm(displayId)` preselects by display id) → `beneficiaryId`; `monitoringDate` → `visitDate`; `monitoringProgress` (codes) → `progress`; `monitoringIssue` → `issue`; `monitoringRecommendation` → `recommendation` |
| Assistance | `assistanceRecipient` (`dbId`) → `beneficiaryId`; `assistanceType` (codes) → `supportType`; `assistanceDate` → `releaseDate`; `assistanceAmount` → `amount` (strip "₱" and ","; "" becomes null) |
| Report | `reportType` (codes) → `reportType`; `reportPeriod` → `period`; `reportDetails` → `details` |
| Notification | `notificationRecipient` ("" = "All beneficiaries", else `dbId`) → `beneficiaryId`; `notificationTitle` → `title`; `notificationMessage` → `message`; `action: "send"` |
| Account | `newAccountFor` ("staff" = "MSWDO Personnel", else the `dbId` of a beneficiary with `hasAccount === false`) → `accountType` + `beneficiaryId`; `newFullName` (hint: "MSWDO Personnel only. Participants use their registry name.") → `fullName` (staff only); `newUsername` → `username`; `newPassword` → `password` |

- `markNotificationAsRead(index)` sends `{action: "read", id: data.notifications[index].dbId}`. `markAllNotificationsAsRead()` sends `{action: "read_all"}`.
- **Double-submit guard:** `reviewForm()` renders the confirm button with `data-confirm`. The save sets `disabled` and `aria-busy="true"` on it before sending, and clears both on error.

- [ ] **Step 1: Write the failing tests**
  - Convert "Security 3": signed in as member, `await saveBeneficiary()` sends no request (`fetchCalls` has no `beneficiaries.php`), and staff `saveProfile` still leaves `profileForms.member` unchanged.
  - Convert "Security 4" and "Medium Issue 1": the XSS strings and household text come in through the stubbed bootstrap (a `snapshot("staff")` variant). The escaping assertions on `beneficiaryTable()` and `viewBeneficiary()` stay. `openMonitoringForm` still receives the display id.
  - Convert "Critical Fix 1": the `saveReport` request body has `period` "Q3 2026" and `details` "Livelihood enterprise sales rose 18% following grant disbursement.". `viewReport` then renders both from a snapshot that contains them.
  - Convert "Critical Fix 2": the `saveNotification` request body has the leader's `beneficiaryId` (1). The privacy part now lives in the API check `send to one or to all`.
  - Convert "Medium Fix": the `saveAccount` request body is `{accountType: "staff", fullName: "Carla Mendoza", username: "pdo_officer", password: "securepass123"}`.
  - Add these tests:

| Test name | Asserts |
|---|---|
| `each save sends its payload` | One case per row of the field table above: field values are set on the mock elements, the save is awaited, and the last `fetchCalls` entry has the exact path and body. Then `bootstrap.php` is called again. |
| `server error keeps the modal open` | A stubbed 422 "Choose a valid barangay." makes `saveBeneficiary` leave `#modal` without `hidden` and show an error toast with that text |
| `confirm button is disabled while saving` | While the stubbed `fetch` promise is pending, the `[data-confirm]` button has `disabled` set. After a 422 it is enabled again. |
| `mark as read sends the notification id` | `markNotificationAsRead(0)` sends `{action: "read", id: <dbId of data.notifications[0]>}` |

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the converted and new save tests FAIL, because the saves are still synchronous and in-memory.

- [ ] **Step 3: Implement the forms and async saves.** Delete `nextId`, and set `?v=3.8` in `index.html` (all three references).

- [ ] **Step 4: Run all suites**

Run: `npm test`, `C:\xampp\php\php.exe api\tests\api-check.php` and `C:\xampp\php\php.exe database\tests\schema-check.php`
Expected: every JS test passes, `31 passed, 0 failed`, and `46 passed, 0 failed`.

---

### Task 7: Live check against Apache and docs

**Files:**
- Modify: `CLAUDE.md`:
  - "What this is": data now comes from `slp_monitoring` through `api/` and survives a reload. Documents, profile and tool saves are still in memory until part B.
  - Commands: add "API checks: `C:\xampp\php\php.exe api\tests\api-check.php [filter]`".
  - Architecture: one bullet on `api/`, `applySnapshot()` and "saves post, then `loadData()`".
  - Testability: tests stub `fetch` with `tests/fixtures.js`.
- Modify: `README.txt` (DEMO LOGIN: type the username; data is now kept in the database)

**Interfaces:**
- **Consumes:** all earlier tasks.

- [ ] **Step 1: Confirm HTTP protection on Apache**

Run: `curl -s -o NUL -w "%{http_code}\n"` for `http://localhost/SLP/api/_lib.php`, `http://localhost/SLP/api/tests/api-check.php` and `http://localhost/SLP/database/db.php`.
Expected: `403` three times. Then `curl -s http://localhost/SLP/api/session.php` gives `{"ok":false,"error":…}` with status 401.

- [ ] **Step 2: Smoke test in the in-app browser** at `http://localhost/SLP/`. This uses the live `slp_monitoring` demo data:
  1. Sign in as `admin`. The dashboard shows 12 beneficiaries.
  2. Add the beneficiary "Smoke Test" in Tilik, association "Tilik Poultry Raisers SLPA".
  3. Reload the page. You are still signed in, and "Smoke Test" is in the registry.
  4. Sign out, then sign in as `member`. "Beneficiaries" says Access Denied. Notifications shows only the general assembly notice.
  5. Sign in as `leader`. Notifications shows "Monitoring Schedule".

  Expected: each step as described, and no console errors (`read_console_messages` with `onlyErrors`).

- [ ] **Step 3: Remove the smoke-test data.** Delete the "Smoke Test" beneficiary row from `slp_monitoring`. Its `audit_log` row stays, because the audit log is append-only; that is acceptable demo history. Then update the docs.

- [ ] **Step 4: Final run of all suites**

Run: `npm test`, `C:\xampp\php\php.exe api\tests\api-check.php` and `C:\xampp\php\php.exe database\tests\schema-check.php`
Expected: all pass (`31 passed` and `46 passed`).
