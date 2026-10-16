# SLP Self-Registration (Part A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person can register from the sign-in page and fill in the Annex G.1 eligibility form. The account then waits on hold until MSWDO staff approve it, and only after approval can the person sign in to the normal app.

**Architecture:** This extends wiring part A.
- **Database:** account status, enforced in the schema.
- **Server guards:** the existing active-only guard, plus a new applicant guard.
- **Applicant endpoints:** `register.php`, `profile.php` (save, submit) and a public `reference.php`.
- **Staff endpoint:** `registrations.php` (approve, reject), with the pending list added to the staff snapshot.
- **Client:** a step-1 form on the sign-in page, an "applicant mode" that shows only the form, and a staff Registrations page with a review page.

**Tech Stack:** As in part A: PHP 8.2.12 with mysqli and session, MariaDB 10.4.32, vanilla JS, Node 20 `node:test`, and Playwright through the playwright-skill runner.

**Spec:** `docs/superpowers/specs/2026-10-15-slp-self-registration-design.md`.
- **Builds on:** `docs/superpowers/plans/2026-10-13-slp-app-wiring-core.md` (part A), which **must be complete first**.
- **Schema rules:** `docs/superpowers/specs/2026-10-13-slp-database-schema-design.md`.

**Not a git repository:** there are no commit steps. Each task ends by running its checks.

## Global Constraints

- Every global constraint of part A applies:
  - connections only through `db_connect()`;
  - JSON shape and status codes;
  - session and CSRF rules;
  - audit in the same transaction;
  - the UI rules from `CLAUDE.md`;
  - never touch `dswd_website`, `dswd/` or other projects' databases.
- **Copy, verbatim from the spec:**

  | Where | Text |
  |---|---|
  | Pending sign-in | "Your registration is on hold. The MSWDO will review your eligibility form. You can sign in after it is approved." |
  | Rejected alert | "The MSWDO returned your registration: \<reason\>. Correct your form and submit it again." |
  | Approval notification | Title "Registration approved", message "Your registration was approved. You can now sign in." |
  | Approve without Qualified | "Only a Qualified applicant can be approved. Reject the registration instead." |
  | Approve or reject a user who is not pending | "This registration is not waiting for review." |
  | Mobile number format | "Enter a mobile number like 09171234567." |

- **Status names:**
  - `users.status`: `registering`, `pending`, `active`, `rejected`, `inactive`;
  - `beneficiaries.enrollment_status` adds `applicant`;
  - labels: "Registering", "Pending", "Active", "Rejected", "Inactive" and "Applicant".
- **Personnel fields:** never stored from an applicant. They are `povertyThreshold`, `personnelVulnerabilityScore`, `incomeAssessment`, `vulnerabilitySeverity`, `overallAssessment`, `remarks`, `track`, `personnelSignature`, `referenceId`, `intakeDate`, `officeAddress`, `officeEmail`, `officeContact`, and any key ending in `2`. This is the same set as `saveProfile()` in `js/script.js`.
- **Required to submit:** `firstName`, `lastName`, `birthday`, `sex`, `barangay`, `contactNo`, `participantType`, and `consentAssess`, `consentPolicy`, `consentRetain`, `consentShare` set to `true`.
- **How the G.1 answers map to registry columns:**

  | Answer | Column |
  |---|---|
  | `sex` "Male" / "Female" | `male` / `female` |
  | `participantType` "4Ps" / "Non-4Ps" | `4ps` / `non_4ps` |
  | `barangay` (a barangay name) | `barangay_id` by exact name; an unknown name blocks submit |

- Bump the cache-busting version by one (`?v=3.8` becomes `?v=3.9` if part A left it at `3.8`).

## Review Focus

1. **Double-clicking Register on step 1** must create one account, not one account plus a confusing "username taken". Test: `register button is disabled while sending` (Task 5).
2. **An applicant who closes the browser halfway** must find the saved answers when they sign in again, and land on the form. Tests: `saved draft comes back after signing in again` (Task 3) and `applicant mode opens the registration page after sign-in` (Task 5).
3. **Two staff approving at once, or a repeated click,** must give one approval and one notification; the second request gets 409. Test: `approving twice gives 409 and one notification` (Task 4).
4. **A tampered request body** must not change the result: a register body carrying `role`, `status` or `associationId`, or a save carrying personnel fields. Tests: `register ignores role, status and association fields` (Task 2) and `save drops personnel fields` (Task 3).
5. **Username case:** "Member" and "member" are one username, both when registering and when signing in. Test: `username is case-insensitive at register and sign-in` (Task 2).

---

### Task 1: Schema and demo applicant

**Files:**
- Modify: `database/schema.sql`. The `users` table gets the new status ENUM, `review_note`, `submitted_at`, `ck_users_rejected_note` and `ck_users_staff_active`. `beneficiaries.enrollment_status` adds `applicant`. Exact DDL: spec section 3.
- Modify: `database/seed-demo.sql`, adding the applicant.
- Modify: `database/install.php`: `install_demo()` also sets `@pw_applicant` to `password_hash('applicant123', …)`.
- Modify: `database/tests/schema-check.php`
- Modify: `api/tests/api-check.php` (part A's count checks)

**Interfaces:**
- **Consumes:** part A, and the database plan's installer.
- **Produces:** the demo applicant, whose fixed ids later tasks rely on.

| Record | Values |
|---|---|
| beneficiary 13 | Nora Santiago, association NULL, sex `female`, birthday `1990-04-12`, barangay Tilik, contact `09171234567`, participant type `non_4ps`, enrollment `applicant`, profile `submitted` |
| user 4 | `applicant` / `@pw_applicant`, participant, beneficiary 13, status `pending`, `submitted_at` `2026-10-14 10:00:00`, `must_change_password` 0 |
| profile version | beneficiary 13, version 1, `created_by` 4. Data: `{"firstName":"Nora","lastName":"Santiago","birthday":"1990-04-12","sex":"Female","barangay":"Tilik","municipality":"Lubang","province":"Occidental Mindoro","contactNo":"09171234567","participantType":"Non-4Ps","consentAssess":true,"consentPolicy":true,"consentRetain":true,"consentShare":true}` |
| audit row 1 | association NULL, actor 4, `registration.create`, `user`, 4, "Nora Santiago registered.", `2026-10-14 09:30:00` |
| audit row 2 | association NULL, actor 4, `registration.submit`, `user`, 4, "Nora Santiago submitted the eligibility form.", `2026-10-14 10:00:00` |

- [ ] **Step 1: Write the failing checks** in `schema-check.php` (all `$demo = true`):

| Check | Asserts |
|---|---|
| `rejected account needs a note` | 4025: `UPDATE users SET status='rejected', review_note=NULL WHERE id=4` |
| `staff account cannot be an applicant` | 4025: `UPDATE users SET status='registering' WHERE id=1` |
| `demo applicant is pending` | User 4 is `pending` with `submitted_at` set. Beneficiary 13 has enrollment `applicant`, profile `submitted`, association NULL and birthday `1990-04-12`. |

Then update the existing checks:
- `demo counts`: beneficiaries 13, users 4, profile_versions 3, audit_log 9.
- `user_roles for demo accounts`: add the row `['4', 'member', null]`.
- In `api-check.php`, `staff snapshot has everything`: beneficiaries 13, users 4.

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php`
Expected: the 3 new checks and the 2 updated ones FAIL.

- [ ] **Step 3: Change `schema.sql`, `seed-demo.sql` and `install.php`** as described above.

- [ ] **Step 4: Run all checks**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php`, then `C:\xampp\php\php.exe api\tests\api-check.php`.
Expected: everything passes. Schema checks are 3 more than before Task 1. The API check count is unchanged.

---

### Task 2: Account status at sign-in, and registration step 1 on the server

**Files:**
- Modify: `api/_lib.php` (`current_user`, `require_user`, a new `require_applicant`)
- Modify: `api/login.php`, `api/session.php`
- Create: `api/register.php`, `api/reference.php`
- Test: `api/tests/api-check.php`

**Interfaces:**
- **Consumes:** from part A, `api_db()`, `start_session()`, `json_out()`, `fail()`, `read_json()`, `require_method()`, `audit()`, `db_fail()`, and `Browser` / `login_as()`.
- **Produces:**
  - `current_user(mysqli $db): ?array` returns `me` plus `status` (`registering|pending|active|rejected`) and `reviewNote` (string or null). It returns `null` for `inactive` or when no one is signed in.
  - `require_user($db, ...$roles)` is unchanged for active users. For any other status it gives 403 "Your account cannot use this yet."
  - `require_applicant(mysqli $db): array` returns `me` for `registering` or `rejected`. Otherwise it gives 401 (no session) or 403. On `POST` it checks CSRF.
  - `login.php`:
    - `pending` gives 403 `{ok: false, status: "pending", error: <pending sentence>}` and starts no session.
    - `registering` and `rejected` give 200 `{ok, me, csrf}`.
    - Lockout and `inactive` behave as in part A.
  - `POST api/register.php` and `GET api/reference.php`, as in spec section 4.2.
  - **Validation messages** (422):
    - "Username must be 3 to 50 letters, numbers, dots, dashes or underscores."
    - "Password must be at least 8 characters."
    - "First Name is required." / "First Name is too long." (the same pattern for Last Name)
    - "Choose a valid barangay."
    - "Enter a mobile number like 09171234567."
  - A taken username gives 409 "That username is already taken."
  - The username is stored lowercase. Any field other than the six listed in the spec is ignored.
  - Test helper: `register_as(string $username): Browser` registers `{username, password: "applicant-pass1", firstName: "Lea", lastName: "Cruz", barangayId: 15, contactNo: "09181234567"}` and returns the signed-in browser.

- [ ] **Step 1: Write the failing checks**

| Check | Asserts |
|---|---|
| `register creates an applicant and signs in` | `register_as('lea1')` gives 200 with `me.status` "registering", `me.role` "member" and a 64-hex `csrf`. In the database: the user is a participant, `registering`, with `must_change_password` 0. The beneficiary has enrollment `applicant`, profile `draft`, association NULL, barangay 15 and contact `09181234567`. An audit row `registration.create` exists. |
| `register validates each field` | Each gives 422 with the exact message: username `"ab"`; password `"short"`; empty firstName; 101-character lastName; `barangayId` 99; contactNo `"12345"` |
| `username is case-insensitive at register and sign-in` | Registering `"Member"` gives 409 "That username is already taken.". `login_as('MEMBER', 'member123')` gives 200. |
| `register ignores role, status and association fields` | A body with `role: "staff"`, `status: "active"` and `associationId: 1` creates a participant that is `registering`, with association NULL |
| `pending account cannot sign in` | `applicant` / `applicant123` gives 403, `status` "pending", the exact pending sentence, and then `session.php` gives 401 |
| `rejected account signs in with the reason` | Set user 4 to `rejected` with note "Birthday is missing." in the database. Sign-in gives 200 with `me.status` "rejected" and `me.reviewNote` "Birthday is missing.". Restore user 4 to `pending` with a NULL note. |
| `applicants cannot use active-only endpoints` | `register_as('lea2')`, then `POST beneficiaries.php` (valid body) gives 403 and `POST notifications.php {action: "read_all"}` gives 403 |
| `reference lists the barangays without a session` | `GET reference.php` with no sign-in gives 200 with 16 barangays |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: the 8 new checks FAIL (404 or wrong status); part A's checks still pass.

- [ ] **Step 3: Implement the `_lib.php` changes, `login.php`, `session.php`, `register.php` and `reference.php`.**

- [ ] **Step 4: Run the checks to verify they pass**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: all pass, 8 more than before.

---

### Task 3: Applicant form (save and submit) and the limited snapshot

**Files:**
- Create: `api/profile.php`
- Modify: `api/bootstrap.php` (the applicant branch)
- Test: `api/tests/api-check.php`

**Interfaces:**
- **Consumes:** `require_applicant()` and `register_as()` from Task 2.
- **Produces:**
  - `POST api/profile.php {action: "save", data}`, for applicants only (part B opens it to active participants).
    - `data` must be a JSON object whose values are strings, numbers or booleans, each at most 500 characters. Otherwise 422 "The form contains an answer that is too long or not valid."
    - It drops the personnel fields (Global Constraints).
    - It inserts the next `profile_versions` row, with `created_by` set to me.
    - It copies the non-empty mapped answers to the beneficiary row (Global Constraints, plus `firstName`, `middleName`, `lastName`, `extensionName` and `contactNo`), all in one transaction.
    - It returns `{ok, version}`.
  - `POST api/profile.php {action: "submit"}` checks the latest version against the required list.
    - **Something missing:** 422 `{ok: false, error: "Complete these items before you submit.", missing: [<keys>]}`. An unknown barangay name counts as missing `barangay`.
    - **Success:** in one transaction, the user becomes `pending` with `submitted_at = NOW()` and `review_note` NULL, the profile becomes `submitted`, and an audit row `registration.submit` is written. Then the session is destroyed, and the endpoint returns `{ok}`.
  - `GET api/bootstrap.php` for an applicant returns exactly the keys `ok`, `me`, `reference` (with only `barangays`) and `profile` (the latest version's data, or null).
  - Test helpers:
    - `complete_profile(): array` returns the full required set: Lea Cruz, `birthday` "1992-05-01", `sex` "Female", `barangay` "Tilik", `contactNo` "09181234567", `participantType` "Non-4Ps", and all four consents `true`.
    - `register_and_submit(string $username): array` returns `[userId, beneficiaryId]`.

- [ ] **Step 1: Write the failing checks**

| Check | Asserts |
|---|---|
| `applicant snapshot is limited` | After `register_as('lea3')`, the bootstrap's top-level keys are exactly `ok`, `me`, `reference` and `profile`, and `reference` has only `barangays` |
| `save drops personnel fields` | Saving `{firstName: "Lea", overallAssessment: "Qualified", track: "Association", referenceId2: "x"}` stores the latest version's data with `firstName` and none of the other three keys |
| `saved draft comes back after signing in again` | Save `{firstName: "Lea", lastName: "Cruz"}`. In a new `Browser`, sign in with the same credentials: the bootstrap's `profile.firstName` is "Lea", and `me.status` is "registering". |
| `save copies answers to the registry row` | Saving `complete_profile()` sets the beneficiary's birthday 1992-05-01, sex `female`, participant type `non_4ps`, barangay `Tilik` and contact `09181234567` |
| `save rejects oversized or nested answers` | A 501-character value gives 422; `{household: {a: 1}}` gives 422 |
| `submit lists what is missing` | With only `{firstName: "Lea"}` saved, submit gives 422, and `missing` contains `birthday` and `consentShare` but not `firstName` |
| `submit puts the account on hold` | Save `complete_profile()`, then submit: 200. Then `session.php` gives 401 and signing in gives 403 `pending`. In the database: `pending`, `submitted_at` set, profile `submitted`, and an audit row `registration.submit`. |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: the 7 new checks FAIL.

- [ ] **Step 3: Implement `api/profile.php` and the applicant branch of `bootstrap.php`.**

- [ ] **Step 4: Run the checks to verify they pass**

Expected: all pass, 7 more than before.

---

### Task 4: Staff review (approve and reject)

**Files:**
- Create: `api/registrations.php`
- Modify: `api/bootstrap.php` (the staff `registrations` key)
- Test: `api/tests/api-check.php`

**Interfaces:**
- **Consumes:** `require_user($db, 'staff')`, and `register_and_submit()` from Task 3.
- **Produces:**
  - **The staff snapshot `registrations`:** every participant user in `pending` or `rejected`, as `{userId, username, beneficiaryId, name, barangay, contactNo, status, submittedAt, reviewNote, profile, duplicates: [{beneficiaryId, name, barangay}]}`.
    - `duplicates` holds other beneficiaries whose first and last names match (unicode_ci) and whose `birthday` is equal and not NULL.
  - **`POST api/registrations.php`, approve:** the effects are spec section 4.2.
    - The assessment is stored as an `eligibility_assessments` version. `overall_assessment` and `track` are the codes. `data` holds `povertyThreshold`, `personnelVulnerabilityScore`, `incomeAssessment`, `vulnerabilitySeverity` and `remarks`.
    - The notification goes to the beneficiary with the copy from Global Constraints.
  - **Reject:** per spec section 4.2. `reason` is required, 500 characters at most.
  - The approve and reject rules and messages are spec section 4.3, verbatim.

- [ ] **Step 1: Write the failing checks**

| Check | Asserts |
|---|---|
| `staff snapshot lists registrations with duplicates` | The staff snapshot's `registrations` contains user 4 with `duplicates` `[]`. Insert a beneficiary Nora Santiago with birthday `1990-04-12` directly in the database; user 4's `duplicates` then lists it. Delete it afterwards. |
| `participants cannot review registrations` | As `leader`, `POST registrations.php` with an approve body gives 403 |
| `approve needs Qualified and a track` | For a fresh `register_and_submit('lea4')`: `not_qualified` gives 422 with the exact message; track `association` without an association gives 422; no track gives 422 |
| `approve activates the account` | Approve `lea4` with association 2, track `association` and `qualified`: 200. In the database: the user is `active`, the beneficiary's association is 2, enrollment `active`, profile `verified`; one `eligibility_assessments` row; a notification with title "Registration approved" for that beneficiary; and an audit row `registration.approve`. Signing in as `lea4` gives `me.status` "active" and `me.associationId` 2, and the bootstrap's `beneficiaries` holds that one beneficiary. |
| `approving twice gives 409 and one notification` | Approving `lea4` again gives 409 "This registration is not waiting for review.", and the beneficiary has exactly 1 notification |
| `reject needs a reason and returns the form` | For `register_and_submit('lea5')`: reject without a reason gives 422; with reason "Birthday does not match the ID." it gives 200. Signing in then gives `me.status` "rejected" with that `reviewNote`, and the profile is `draft`. |
| `a rejected applicant can resubmit` | `lea5` saves `complete_profile()` and submits: 200. The user is `pending` with a NULL `review_note`. |

- [ ] **Step 2: Run the checks to verify they fail**

Expected: the 7 new checks FAIL.

- [ ] **Step 3: Implement `api/registrations.php` and the staff `registrations` key.** Lock the user row with `SELECT … FOR UPDATE` before checking that it is `pending`, so two approvals cannot both pass.

- [ ] **Step 4: Run the checks to verify they pass**

Expected: all pass, 7 more than before.

---

### Task 5: Client sign-in, registration step 1 and applicant mode

**Files:**
- Modify: `index.html`:
  - give the sign-in card `id="signInCard"`;
  - below the Sign in button, add `<p class="login__register">New SLP participant? Register to apply.</p>` and `<button type="button" id="registerButton" class="btn btn--secondary btn--block">Register</button>`;
  - add an empty `<div id="registerCard" class="login__card" hidden></div>`;
  - bump the version.
- Modify: `js/script.js` (sign-in section, navigation, §27 profile), `css/style.css` (`.login__register`: the hint style, using tokens only)
- Modify: `tests/fixtures.js` (`snapshot("applicant")`), `tests/system.test.js`

**Interfaces:**
- **Consumes:** `api`, `ApiError`, `csrfToken`, `loadData`, `applySnapshot` and `loginUser` from part A.
- **Produces (`js/script.js`):**
  - `openRegistration()` hides `#signInCard` and shows `#registerCard`. It renders the step 1 form into it with `formField`:
    - ids `regUsername`, `regPassword`, `regPasswordConfirm`, `regFirstName`, `regLastName`, `regBarangay` (options from `GET api/reference.php`) and `regContactNo`;
    - heading "Create your account (step 1 of 2)";
    - buttons "Create account" (primary, submit) and "Back to sign in".
  - `closeRegistration()` reverses it.
  - `async submitRegistrationStart(event)`:
    - validates with `validateForm`, and a confirmation mismatch shows the field error "Passwords do not match";
    - disables the submit button and sets `aria-busy` while sending;
    - posts `{username, password, firstName, lastName, barangayId: Number, contactNo}`;
    - on success, sets `csrfToken` and continues exactly like a successful `loginUser`;
    - on an `ApiError`, shows the message in the form's error summary and re-enables the button.
  - `applySnapshot()` also sets `currentUser.status` and `currentUser.reviewNote` from `me`.
  - `isApplicant()` is true when `currentUser.status` is `registering` or `rejected`.
    - `allowedPages()` returns `["registration"]` for an applicant.
    - `NAV_ITEMS.applicant` is `[{heading: "Registration"}, {page: "registration", label: "Eligibility form", icon: "clipboard-pen"}]`.
    - `initialPage()` returns `"registration"` for an applicant.
    - `PAGE_TITLES.registration` is "Eligibility form".
  - `registrationPage()`: for `registering`, `alertBox("info", "Step 2 of 2: complete your eligibility form", …)`. For `rejected`, `alertBox("warning", …)` with the rejected sentence and the escaped `reviewNote`. Either way, followed by `profilePage({ mode: "registration" })`.
  - `profilePage(options = {})`:
    - `options.mode` is `"profile"` (the default and current behaviour), `"registration"` or `"review"`;
    - `options.profile` defaults to `getCurrentProfile()`;
    - the registration toolbar has "Save and finish later" (`saveRegistrationDraft()`) and "Submit for review" (`openProfileReview("registration")`);
    - the review mode has no toolbar.
  - `readProfileForm(): object`: the field-reading loop moved out of `saveProfile()`, with the same personnel exclusions. `saveProfile()` now calls it.
  - `openProfileReview(mode = "profile")`: in `"registration"` mode the confirm button reads "Submit for review" and calls `submitRegistrationForm()`.
  - `async saveRegistrationDraft()` posts `{action: "save", data: readProfileForm()}`, then shows the toast "Saved. You can finish later." and sets `profileDirty = false`.
  - `async submitRegistrationForm()` sends save, then `{action: "submit"}`. A 422 keeps the modal open and lists `missing` in the error summary, using the field labels. Success calls `logoutUser("submitted")`.
  - `logoutUser("submitted")` shows this notice: "Thank you. Your registration is on hold. The MSWDO will review your eligibility form. You can sign in after it is approved."
  - `loginUser()`: a 403 whose `status` is `"pending"` puts the server's message in `#loginNotice` as an info alert, leaves `#loginError` empty, and returns `false`.

- [ ] **Step 1: Write the failing tests**

| Test | Asserts |
|---|---|
| `Register button shows step 1` | After `openRegistration()`, `#registerCard` contains "Create your account (step 1 of 2)" and the ids `regUsername` and `regContactNo`, and `#signInCard` is hidden |
| `step 1 sends the registration and enters applicant mode` | The stubbed `register.php` returns the applicant `me`. The request body is exactly the six fields. Afterwards `getCurrentUser().status` is "registering", the navigation HTML contains only "Eligibility form", and `showPage("dashboard")` renders "Access Denied". |
| `passwords must match` | A mismatch sends no request and sets the `regPasswordConfirm` error to "Passwords do not match" |
| `register button is disabled while sending` | While the stubbed `fetch` is pending, the submit button is `disabled`; after a 409 it is enabled again |
| `pending sign-in shows the on-hold notice` | A stubbed 403 with `status` "pending" makes `loginUser` resolve `false`; `#loginNotice` holds the pending sentence and `#loginError` is empty |
| `rejected applicant sees the reason` | With `snapshot("applicant")` set to status `rejected` and note "Birthday is missing.", `registrationPage()` contains "The MSWDO returned your registration: Birthday is missing." |
| `submit saves, submits and returns to sign-in with the notice` | `fetchCalls` shows `profile.php` save, then submit; `getCurrentUser()` is null; and `#loginNotice` holds the submitted notice |
| `submit shows missing items` | A stubbed 422 with `missing: ["birthday", "consentShare"]` keeps the modal open, and the error summary lists both |
| `applicant mode opens the registration page after sign-in` | After `signIn("applicant")`, `#pageTitle` is "Eligibility form" |

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the 9 new tests FAIL; the earlier tests still pass.

- [ ] **Step 3: Implement the `index.html`, `js/script.js` and `css/style.css` changes.**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: every test passes.

---

### Task 6: Staff Registrations page and review page

**Files:**
- Modify: `js/script.js` (navigation, pages, `STATUS_TONES`, `LABELS`, `ICON_PATHS`, dashboard, `applySnapshot`)
- Modify: `tests/fixtures.js`: the staff snapshot gets `registrations` with one pending applicant (Nora Santiago, user 4) whose `duplicates` has one entry.
- Modify: `tests/system.test.js`

**Interfaces:**
- **Consumes:** the staff snapshot's `registrations` (Task 4), and `profilePage({ profile, mode: "review" })` (Task 5).
- **Produces:**
  - **Data:** `applySnapshot` fills `data.registrations` with the server records unchanged, plus `statusLabel = LABELS.accountStatus[status]`.
  - **Labels and statuses:**
    - `LABELS.accountStatus` is `{registering: "Registering", pending: "Pending", active: "Active", rejected: "Rejected", inactive: "Inactive"}`, and `LABELS.enrollment.applicant` is "Applicant".
    - `STATUS_TONES` gains "Registering" (neutral), "Pending" (warning), "Rejected" (error), "Applicant" (neutral) and "Possible Duplicate" (attention).
  - **Icon:** `ICON_PATHS["user-check"]` is `<path d="m16 11 2 2 4-4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>`.
  - **Navigation:** the staff "Administration" group gets `{page: "registrations", label: "Registrations", icon: "user-check"}`, which `createNavigation()` renders with a `.count` badge showing the number of pending registrations, plus the visually hidden text " pending". `STAFF_PAGES` adds `"registrations"` and `"registrationreview"`.
  - **Dashboard:** the staff dashboard gets `statCard("Pending registrations", <count>, "user-check")`.
  - **`registrationsPage()`** is a `dataTable` with the columns Applicant, Barangay, Contact No., Submitted, Status, and a hidden-label Actions column. When `duplicates` is not empty, the Status cell also shows `statusBadge("Possible Duplicate")`. The action is `button("Review", "reviewRegistration(<userId>)")`.
  - **`reviewRegistration(userId)`** sets `reviewingUserId`, then calls `navigate("registrationreview")`.
  - **`registrationReviewPage()`**, from top to bottom:
    1. `summaryList` with the applicant's name, username, barangay, contact number and submitted date.
    2. When there are duplicates: `alertBox("warning", "Possible duplicate", …)` listing them.
    3. `<fieldset disabled>`, then `profilePage({ profile, mode: "review" })`, then `</fieldset>`.
    4. A card "MSWDO assessment" with `formField`s:
       - `assessPovertyThreshold` (number), `assessVulnerabilityScore` (number);
       - `assessIncome` (select: "" plus `less` "Net income ≤ poverty threshold" and `greater` "Net income > poverty threshold");
       - `assessSeverity` (select High, Medium, Low);
       - `assessOverall` (select, required: `qualified` "Qualified", `not_qualified` "Not Qualified");
       - `assessTrack` (select, required: `association` "Association", `individual` "Individual", `employment` "Employment");
       - `assessAssociation` (select: "" plus `referenceData.associations`);
       - `assessRemarks` (textarea);
       - `rejectReason` (textarea, hint "Required to reject. The applicant will see this.").
    5. The buttons "Approve registration" (primary, `approveRegistration()`) and "Reject registration" (`rejectRegistration()`).
  - **`async approveRegistration()`** validates `assessOverall` and `assessTrack`, then asks with `confirmAction`, then posts:

    ```
    {action: "approve", userId, associationId: <Number or null>, assessment: {overallAssessment, track, data: {povertyThreshold, personnelVulnerabilityScore, incomeAssessment, vulnerabilitySeverity, remarks}}}
    ```

    On success: `loadData()`, `navigate("registrations")` and the toast "Registration approved.". An `ApiError` shows its message in the page's error summary, `#reviewErrors` (rendered hidden above the buttons), and moves focus there.
  - **`async rejectRegistration()`** requires `rejectReason`, which is client-validated with the error "Enter the reason for rejecting". It then posts `{action: "reject", userId, reason}`, adding `assessment` when `assessOverall` is set. On success: `loadData()`, `navigate("registrations")` and the toast "Registration returned to the applicant.". An `ApiError` goes to `#reviewErrors`, as with approve.

- [ ] **Step 1: Write the failing tests**

| Test | Asserts |
|---|---|
| `staff sees Registrations with the pending count` | After `signIn("staff")`, the navigation HTML contains "Registrations" and a `.count` of 1 |
| `registrations table flags a possible duplicate` | `registrationsPage()` contains "Possible Duplicate" and `reviewRegistration(4)` |
| `review page shows the form read-only with the assessment fields` | With `reviewingUserId = 4`, `registrationReviewPage()` contains `<fieldset disabled`, the ids `assessOverall` and `rejectReason`, and "Possible duplicate" |
| `approve sends the assessment` | With the fields set (qualified, association, association 1), the request body after the confirm equals the approve shape with `associationId` 1 |
| `reject needs a reason` | An empty reason sends no request and shows "Enter the reason for rejecting". With the reason "Birthday does not match the ID." the body is `{action: "reject", userId: 4, reason: "Birthday does not match the ID."}`. |
| `server errors show in the review error summary` | A stubbed 409 "This registration is not waiting for review." on approve shows that text in `#reviewErrors` and makes it visible |
| `participants cannot open the registration pages` | Signed in as member, `showPage("registrations")` and `showPage("registrationreview")` both render "Access Denied" |

- [ ] **Step 2: Run the tests to verify they fail**

Expected: the 7 new tests FAIL.

- [ ] **Step 3: Implement the staff pages and helpers.**

- [ ] **Step 4: Run all suites**

Run: `npm test` and `C:\xampp\php\php.exe api\tests\api-check.php`
Expected: all pass.

---

### Task 7: Live check, design check and docs

**Files:**
- Modify: `tests/ui/design-check.js` (one new check)
- Modify: `CLAUDE.md` (demo logins: `applicant` / `applicant123`, pending; one Architecture line on account status and applicant mode), `README.txt` (the DEMO LOGIN section)

**Interfaces:**
- **Consumes:** all earlier tasks.

- [ ] **Step 1: Add the design check `register card matches the reference`.** On the sign-in page, click "Register". `#registerCard` must match the reference card's `border-top-left-radius` and `box-shadow`. "Create account" must match the reference primary button's properties, and "Back to sign in" the secondary button's. Run `node C:\Users\julie\.claude\skills\playwright-skill\run.js tests/ui/design-check.js` with `PW_CHANNEL=msedge`. Expected: all pass.

- [ ] **Step 2: Reinstall the live demo database** so it has the new schema.
  - Run: `C:\xampp\php\php.exe database\install.php --demo --fresh`
  - Expected: `Installed slp_monitoring: 18 tables, 1 view, 10 triggers, demo data`.
  - `slp_monitoring` holds only installer demo data. If `SELECT COUNT(*) FROM slp_monitoring.users` is more than 3 before this step, stop and ask the user first.

- [ ] **Step 3: Smoke test** in the in-app browser at `http://localhost/SLP/`:
  1. Choose Register and create `smoke_applicant`, password `smoke-pass1`, Lea Smoke, Tilik, `09181230000`. The Eligibility form opens.
  2. Choose "Save and finish later", then reload the page. You are still on the form, with the answers kept.
  3. Fill in the required items and the four consents, then choose "Submit for review" and confirm. The sign-in page shows the on-hold notice.
  4. Sign in as `smoke_applicant`. The sign-in page shows the pending sentence.
  5. Sign in as `admin`, open Registrations and choose Review for Lea Smoke. Choose Qualified, Association, then "Tilik Poultry Raisers SLPA", then "Approve registration" and confirm.
  6. Sign out, then sign in as `smoke_applicant`. The participant dashboard shows.

  Expected: each step as described, with no console errors.

- [ ] **Step 4: Reset the demo data.** Run `C:\xampp\php\php.exe database\install.php --demo --fresh` again, which removes the smoke-test account. Then update the docs.

- [ ] **Step 5: Final run of all suites**
  - Run: `npm test`, `C:\xampp\php\php.exe api\tests\api-check.php`, `C:\xampp\php\php.exe database\tests\schema-check.php` and the design check.
  - Expected: all pass.
