# SLP app wiring, sub-project A: sign-in, data loading and staff saves

Date: 13 October 2026
Status: written together with its plan, at the user's request. Review both before execution.
Builds on: `docs/superpowers/specs/2026-10-13-slp-database-schema-design.md` (the "schema spec"). Its permission table (§2), workflows (§6), read rules (§7) and integrity rules (§8) are binding here.

---

## 1. Decomposition

Wiring the prototype to `slp_monitoring` is split into three sub-projects. Each has its own plan, and each leaves a working app behind it.

| Part | What it covers |
|---|---|
| **A (this document)** | PHP API foundation; sign-in, sign-out and session; the role-filtered data snapshot; staff saves for beneficiaries, projects, field monitoring, assistance, reports, notifications (send, mark read) and accounts |
| B | Versioned records: documents (upload, versions, approve, return, download with hash check), profile (versions, submit, verify, reopen, eligibility assessment) and AA/AC/AF.1 submissions (draft, submit, staff edit with reason) |
| C | The Associations page (create, members, leader, livelihood types), the members' activity feed, association filters on staff pages, and the forced password change |

Until B ships, three things still work the old way, in browser memory only, and are lost on reload: saving the profile, uploading or approving documents, and saving a tool. They are the only writes A leaves unconnected.

---

## 2. Approach

**Snapshot plus reload.**
- After sign-in, the browser calls `GET api/bootstrap.php`. The server returns everything this user may see, already filtered by the schema spec §7 rules.
- `loadData()` copies the result into the existing `data`, `users` and `profileForms` objects. Every page then renders synchronously, as it does today.
- A save sends one `POST` to the API, and on success calls `loadData()` again before re-rendering.
- This keeps the renderer (about 4,000 lines) untouched. The server is the only place that decides what a user may see or change, and the client's role checks become courtesy checks.

Rejected alternatives:
- **Per-page fetches:** they would make every page function async, so the whole renderer would need rework.
- **A client-side cache with partial updates:** two sources of truth.

---

## 3. Server

### 3.1 Files

| File | Purpose |
|---|---|
| `database/db.php` | `db_connect()`, moved out of `install.php` unchanged. It is the only way to open a connection, so strict mode, +08:00 and `utf8mb4_unicode_ci` always apply. `install.php` requires it. |
| `api/_lib.php` | Shared helpers: session, CSRF, JSON in and out, authorization guard, audit, database error mapping |
| `api/login.php`, `api/logout.php`, `api/session.php` | Signing in and out |
| `api/bootstrap.php` | The role-filtered snapshot |
| `api/beneficiaries.php`, `api/projects.php`, `api/monitoring.php`, `api/assistance.php`, `api/reports.php`, `api/notifications.php`, `api/accounts.php` | One endpoint per resource, all `POST` only |
| `api/.htaccess` | Denies files starting with `_` over HTTP |
| `api/tests/.htaccess` | Denies everything over HTTP |

### 3.2 Rules every endpoint follows

1. **Database.** `api_db()` returns `db_connect(getenv('SLP_DB') ?: 'slp_monitoring')`. `SLP_DB` is set only by the test harness, never by a request.
2. **PHP time zone.** `date_default_timezone_set('Asia/Manila')` is set in `_lib.php`. PHP's default is Europe/Berlin.
3. **Session.**
   - PHP native session, cookie name `SLPSESSID`, with `httponly`, `SameSite=Strict` and `session.use_strict_mode=1`.
   - `session_regenerate_id(true)` runs on sign-in.
   - The session idles out after 900 s with no request, matching the client's 15-minute timer. It then answers 401.
4. **CSRF.**
   - Sign-in stores a token, `bin2hex(random_bytes(32))`, in the session and returns it.
   - Every `POST` other than `login.php` must send it in an `X-CSRF-Token` header, compared with `hash_equals`. A missing or wrong token gives 403.
5. **Response shape.** Success is `{"ok": true, …}`. Failure is `{"ok": false, "error": "<plain sentence>"}` with these statuses:

   | Status | When |
   |---|---|
   | 400 | bad JSON |
   | 401 | not signed in, or the session expired |
   | 403 | wrong role or bad CSRF token |
   | 404 | the record is not visible to this user |
   | 405 | wrong method |
   | 409 | duplicate |
   | 422 | invalid input |
   | 429 | account locked |

6. **Authorization.**
   - `require_user($db, ...$roles)` loads the user from `user_roles` joined to `users`, with status `active`.
   - It answers 401 when no one is signed in and 403 when the role is not allowed.
   - For a `POST` it also checks the CSRF token.
7. **Validation.**
   - Required fields, lengths, dates (`Y-m-d`, not later than today in Manila for visit and release dates) and ids are checked before the `INSERT`.
   - The schema is the backstop. A `mysqli_sql_exception` is mapped by code:

     | Code | Status |
     |---|---|
     | 1062 | 409 |
     | 1452, 4025, 1265, 1406, 1048 | 422 |
     | anything else | 500 "Something went wrong. Try again." (details are not leaked) |

8. **Audit.**
   - Every write runs inside a transaction that also inserts one `audit_log` row.
   - Actions are `auth.login`, `auth.login_failed`, `auth.logout`, `beneficiary.create`, `project.create`, `monitoring.create`, `assistance.create`, `report.create`, `notification.send` and `account.create`.
   - `association_id` is set when the record belongs to an association.
   - Marking a notification read is not audited.
9. **Passwords.** `password_hash()` and `password_verify()` only.
   - **Lockout:** five failed sign-ins set `locked_until = NOW() + INTERVAL 15 MINUTE`.
   - **Unknown usernames:** the password is still checked against a dummy hash, so the response time does not reveal which usernames exist.
   - **Success** resets `failed_logins`, clears `locked_until` and sets `last_login_at`.
   - Inactive accounts get the same 401 as a wrong password.

### 3.3 Endpoints

| Endpoint | Who | Request | Success |
|---|---|---|---|
| `POST api/login.php` | anyone | `{username, password}` | `{ok, me, csrf}`. Wrong details: 401 "Wrong username or password." Locked: 429 "Too many failed attempts. Try again in 15 minutes." |
| `POST api/logout.php` | signed in | – | `{ok}`. The session is destroyed. |
| `GET api/session.php` | anyone | – | `{ok, me, csrf}`, or 401 |
| `GET api/bootstrap.php` | signed in | – | see §3.4 |
| `POST api/beneficiaries.php` | staff | `{firstName, lastName, barangayId, associationId \| null, householdInformation}` | `{ok, id}` |
| `POST api/projects.php` | staff | `{name, associationId \| null, beneficiaryId \| null, livelihoodTypeId, status}` (exactly one owner) | `{ok, id}` |
| `POST api/monitoring.php` | staff | `{beneficiaryId, visitDate, progress, issue, recommendation}` | `{ok, id}` |
| `POST api/assistance.php` | staff | `{beneficiaryId, supportType, releaseDate, amount \| null}` | `{ok, id}` |
| `POST api/reports.php` | staff | `{reportType, period, details}` (created `for_review`, not shared) | `{ok, id}` |
| `POST api/notifications.php` | staff for `send`, anyone signed in for `read` and `read_all` | `{action:"send", beneficiaryId \| null, title, message}`, `{action:"read", id}` or `{action:"read_all"}` | `{ok, id}` or `{ok}`. `read` on a notification the user cannot see answers 404. |
| `POST api/accounts.php` | staff | `{accountType:"staff", fullName, username, password}` or `{accountType:"participant", beneficiaryId, username, password}` | `{ok, id}`. A taken username or a beneficiary that already has an account gives 409. |

`me` is `{userId, username, role: "staff" | "leader" | "member", name, beneficiaryId, associationId, associationName}`. Its `name` is the staff `full_name`, or the beneficiary's name for participants.

### 3.4 The snapshot (`GET api/bootstrap.php`)

The server returns codes and joined names. The JS maps codes to labels and formats display ids (§4.2), so presentation lives in one place.

```
{ ok, me,
  reference: { barangays: [{id, name}], livelihoodTypes: [{id, name}],
               associations: [{id, name, barangay, livelihoodType, leaderName}] },
  beneficiaries: [{id, firstName, middleName, lastName, extensionName, barangay, associationId, associationName,
                   livelihood, enrollmentStatus, profileStatus, householdInformation, hasAccount}],
  projects:      [{id, name, ownerName, associationName, livelihood, status}],
  monitoring:    [{id, beneficiaryId, beneficiaryName, visitDate, progress, issue, recommendation}],
  assistance:    [{id, beneficiaryId, beneficiaryName, supportType, releaseDate, amount}],
  reports:       [{id, reportType, period, details, status, shared, createdAt}],
  documents:     [{id, title, category, status, reviewNote, ownerName, ownerBeneficiaryId, createdAt}],
  notifications: [{id, title, message, recipientName, beneficiaryId, createdAt, read}],
  users:         [{id, username, role, name, status, beneficiaryId}],
  profile:       {…latest profile_versions.data…} | null }
```

| Key | Staff | Leader / member (schema spec §7) |
|---|---|---|
| `reference.associations` | all | own association only |
| `beneficiaries` | all | own record only |
| `projects` | all | their association's projects, or the project they own on the individual track (the dashboard's "Project Status" card) |
| `monitoring`, `assistance`, `users` | all | `[]` |
| `reports` | all | `shared_with_participants = 1` |
| `documents` | all | `association_id = :my_assoc OR beneficiary_id = :my_ben` |
| `notifications` | all; `read` means read by this user | `beneficiary_id IS NULL OR beneficiary_id = :my_ben` |
| `profile` | `null` | own latest version, or `null` |

`livelihood` is the association's livelihood type, or for an individual-track beneficiary, the type of their own project. No password hash appears in any response.

---

## 4. Client (`js/script.js`, `index.html`)

### 4.1 What changes

- **Demo data removed from the client.** The hard-coded demo arrays, the `users` object (which held passwords) and the `profileForms` seeds go. `data`, `users` and `profileForms` start empty and are filled only by `loadData()`.
- **`api(path, body)`.** A `fetch` wrapper with `credentials: "same-origin"`, a JSON body and the CSRF header.
  - It throws `ApiError` with the server's message.
  - On a 401 it signs the user out with the timeout notice.
- **Sign-in.** `async loginUser(username, password)` posts to `login.php`, then runs `loadData()` and the existing post-sign-in steps, and returns `true` or `false`.
- **Page load.** `session.php` is called first, so reloading the page keeps the user signed in. The prototype used to reset to the sign-in screen.
- **Sign-out.** `logoutUser()` posts to `logout.php` without waiting, then resets the screen as it does today.
- **Roles.** `me.role` is mapped to the existing role names ("MSWDO Personnel", "Beneficiary Leader", "Beneficiary Member"). `isStaff()`, `isLeader()`, `isMember()` and the page allow-lists are unchanged.
- **Current person.** `getCurrentBeneficiary()` becomes `data.beneficiaries.find(b => b.dbId === currentUser.beneficiaryId)`, replacing the hard-coded Maria and Juan. `getCurrentProfile()` becomes `profileForms[currentUser.username]`.
- **Lists the server filters.** `getVisibleNotifications()` and `documentsPage()` now use the server-filtered list as is. Name matching is gone.
- **Sign-in form.** The "Sign in as" select becomes a "Username" text input, still `id="username"`, with `autocomplete="username"`. The demo buttons fill the username and password.
- **Forms.**
  - **Beneficiary:** the free-text location becomes a select of the 16 barangays. "Association" is a select with an "Individual track (no association)" option. The livelihood select is removed, because livelihood comes from the association or project.
  - **Monitoring, assistance and notification:** the recipient selects use beneficiary ids as values; "All beneficiaries" becomes `""`.
  - **Project:** the owner is a select of associations and individual-track beneficiaries (values `a:<id>` and `b:<id>`), plus a livelihood type select.
  - **Account:** an "Account for" select offers "MSWDO Personnel" plus every beneficiary without an account. Full name is only for staff.
  - Status and type selects send codes.
- **Saves.** `saveBeneficiary`, `saveProject`, `saveMonitoring`, `saveAssistance`, `saveReport`, `saveNotification`, `markNotificationAsRead`, `markAllNotificationsAsRead` and `saveAccount` become `async`.
  - Each keeps its role check, sends one request, runs `loadData()`, then closes the modal, shows the page and shows the toast.
  - On an `ApiError` the modal stays open and the error toast shows the server's message.
- **Removed.** `nextId()` and its test go: ids now come from `AUTO_INCREMENT`, so collisions cannot happen.
- **New statuses** in `STATUS_TONES`: "Returned" → attention, "Draft" → neutral.
- **Cache-busting:** bump `?v=3.7` to `?v=3.8`.

### 4.2 Labels (the one map from codes to the names shown on screen)

| Code family | Codes → labels |
|---|---|
| enrollment | active → Active, for_monitoring → For Monitoring, completed → Completed, inactive → Inactive |
| project status | ongoing → Ongoing, for_monitoring → For Monitoring, completed → Completed |
| progress | good → Good, needs_follow_up → Needs Follow-up, completed → Completed |
| support type | livelihood_capital → Livelihood Capital, training_support → Training Support, equipment → Equipment, other → Other Assistance |
| report type | project → Project Report, progress → Progress Report, status → Status Report, beneficiary_status → Beneficiary Status Report, accomplishment → Accomplishment Report |
| report status | for_review → For Review, submitted → Submitted |
| document category / status | profile, project, progress, other → Profile, Project, Progress, Other; for_review → For Review, approved → Approved, returned → Returned |
| profile status | draft → Draft, submitted → Submitted, verified → Verified |

Display ids are `B-`, `P-`, `M-`, `A-` and `R-` followed by the id padded to 3 digits. Each mapped record keeps the database id as `dbId`.

---

## 5. Testing

- **API checks.** `api/tests/api-check.php` installs a scratch `slp_api_check` with demo data through `install()`. It starts `php -S 127.0.0.1:8765` with `SLP_DB=slp_api_check`, then drives the endpoints over HTTP with curl cookie jars, one per simulated browser. It stops the server and drops the database in `finally`.
- **JS tests.** `tests/system.test.js` stubs `globalThis.fetch` with canned API responses per role. The tests then cover rendering, escaping, client role checks and request payloads. Server behaviour, including privacy, is covered by the API checks, not by JS fakes.
- **Smoke test.** A manual pass in the in-app browser against Apache: sign in as each role, create a beneficiary, reload, and confirm it is still there.

## 6. Known limits (carried, not solved here)

- The app connects as `root` with no password, because GRANT fails on this MariaDB (its privilege tables are damaged). A least-privilege account is a go-live item.
- The session cookie has no `secure` flag, because the site is served over HTTP on localhost. It must be turned on under HTTPS at go-live.
- `must_change_password` is stored but not enforced until C.
- `storage/` is protected only by `.htaccess` inside the web root. Moving it out is a B item, because B is where files are first written by the app.
