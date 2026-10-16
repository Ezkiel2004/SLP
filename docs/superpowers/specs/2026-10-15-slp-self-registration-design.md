# SLP self-registration: design for review

Date: 15 October 2026
Status: design approved in chat; this written spec awaits review.
Builds on:
- `docs/superpowers/specs/2026-10-13-slp-database-schema-design.md` (the "schema spec")
- `docs/superpowers/specs/2026-10-13-slp-app-wiring-design.md` (the "wiring spec", part A)

Wiring part A must ship first, because registration needs server-side sign-in and the session rules.

---

## 1. What this adds

What the MSWDO asked for:
1. A **Register** button on the sign-in page.
2. After registering, the new user is **forced into the eligibility form** (Annex G.1).
3. After submitting the form, the account is **on hold**.
4. MSWDO staff **validate and approve** the registration.
5. Only then can the user **sign in** normally.

Decisions taken in the design discussion:

| # | Decision |
|---|---|
| R1 | Built on the database, as wiring **part A2**. A hold that only the browser enforces could be bypassed from the console, and an in-memory registration would vanish on reload. |
| R2 | Anyone may register, always as a **participant**. The server ignores any role sent by the client. Staff choose the association at approval. Naming a leader stays on the Associations page (part C). |
| R3 | Account status drives everything (section 2). A registration can be saved and finished later; a rejected one can be corrected and resubmitted. |
| R4 | Approval requires the personnel section (items 25–29) with an overall assessment of **Qualified**, and a track: association, individual or employment. The association track also needs an association. Rejection requires a written reason. |
| R5 | Staff see a **possible duplicate** warning when an applicant's name and birthday match someone already in the registry. |
| R6 | The user learns the decision at their next sign-in. There is no email or SMS, because no mail service is set up. |
| R7 | **Not in scope:** CAPTCHA, email verification, password reset, uploading documents while registering, and choosing to be a leader. |

---

## 2. Account status

`users.status` (participants) and what the person sees:

| Status | Set when | At sign-in |
|---|---|---|
| `registering` | Step 1 completes | Signed in to a **restricted session**: only the eligibility form |
| `pending` | The form is submitted ("on hold") | **No session.** The sign-in page shows: "Your registration is on hold. The MSWDO will review your eligibility form. You can sign in after it is approved." |
| `rejected` | Staff reject it | A restricted session, with the form and an alert: "The MSWDO returned your registration: \<reason\>. Correct your form and submit it again." |
| `active` | Staff approve it | The normal participant app |
| `inactive` | Staff deactivate the account (existing) | 401 "Wrong username or password.", unchanged |

Transitions, and the only actor allowed to make each one:

```
(none) --register--> registering --submit--> pending --approve (staff)--> active
                                                │
                                                └--reject (staff)--> rejected --submit--> pending
```

`beneficiaries.profile_status` follows along:

| Account status | Profile status |
|---|---|
| `registering` or `rejected` | `draft` |
| `pending` | `submitted` |
| `active` (approved) | `verified` |

Staff accounts are created by staff, as today, and start `active`.

---

## 3. Schema changes

`slp_monitoring` holds only demo data, so this ships as an edit to `schema.sql` and `seed-demo.sql` plus an install with `--fresh`. There is no migration script.

```sql
-- users
status        ENUM('registering','pending','active','rejected','inactive') NOT NULL DEFAULT 'active',
review_note   VARCHAR(500) NULL,        -- reason shown to a rejected applicant
submitted_at  DATETIME NULL,            -- last time the eligibility form was submitted
CONSTRAINT ck_users_rejected_note CHECK (status <> 'rejected' OR review_note IS NOT NULL),
CONSTRAINT ck_users_staff_active  CHECK (role = 'participant' OR status IN ('active','inactive')),

-- beneficiaries
enrollment_status ENUM('applicant','active','for_monitoring','completed','inactive') NOT NULL DEFAULT 'active',
```

**Demo seed.** Add one pending applicant, so the staff page has something to review:
- Username `applicant`, password `applicant123`, status `pending`.
- Beneficiary 13, Nora Santiago, Tilik, birthday 1990-04-12, enrollment `applicant`, profile `submitted`.
- One profile version that has every required field and all four consents.

---

## 4. Server (PHP, on top of wiring part A)

### 4.1 Session rules

- **The default guard is unchanged.** `require_user()` still admits only `status = 'active'`, so every existing endpoint stays closed to applicants without any change to it.
- **A second guard for applicants.** `require_applicant($db)` admits a participant whose status is `registering` or `rejected`. Applicants get 403 from everything else.
- **What sign-in returns** (`login.php`), after the password check:

  | Status | Response |
  |---|---|
  | `pending` | 403 `{ok: false, status: "pending", error: "<the on-hold sentence above>"}`, with no session |
  | `registering`, `rejected` | 200 `{ok, me, csrf}`. `me.status` is the account status, and `me.reviewNote` is the reason when rejected. |
  | `active` | unchanged |
  | `inactive` | unchanged (401) |

- **The session check** (`session.php`) returns the same `me`, including `status`.

### 4.2 Endpoints

| Endpoint | Who | Request | Effect |
|---|---|---|---|
| `GET api/reference.php` | anyone | – | `{ok, barangays: [{id, name}]}`. The step 1 form needs the list before anyone signs in, and it is public, non-personal data. |
| `POST api/register.php` | anyone (no session, no CSRF, like login) | `{username, password, firstName, lastName, barangayId, contactNo}` | In one transaction: a beneficiary (association NULL, enrollment `applicant`, profile `draft`, contact number stored); a user (participant, `registering`, `must_change_password = 0`); and audit `registration.create`. Then signs the person in and returns `{ok, me, csrf}`. |
| `GET api/bootstrap.php` | applicant | – | A limited snapshot: `{ok, me, reference: {barangays}, profile}`. No other data. |
| `POST api/profile.php` | applicant | `{action: "save", data}` | Adds a `profile_versions` row. The server drops every personnel field (items 25–29 and the reference slip). |
| `POST api/profile.php` | applicant | `{action: "submit"}` | Checks section 4.3, sets the user `pending` with `submitted_at = NOW()`, sets the profile `submitted`, writes audit `registration.submit`, **ends the session** and returns `{ok}`. |
| `POST api/registrations.php` | staff | `{action: "approve", userId, associationId \| null, assessment: {overallAssessment: "qualified", track, data}}` | In one transaction: an `eligibility_assessments` version; the beneficiary's association, enrollment `active` and profile `verified`; the user `active` with `review_note` cleared; a notification to that beneficiary ("Your registration was approved. You can now sign in."); and audit `registration.approve`. |
| `POST api/registrations.php` | staff | `{action: "reject", userId, reason, assessment?}` | Sets the user `rejected` with `review_note = reason`, sets the profile back to `draft`, saves the assessment if one was sent, and writes audit `registration.reject`. |

The staff snapshot (`bootstrap.php`) gains `registrations`: every user in `pending` or `rejected`, as

```
{userId, username, beneficiaryId, name, barangay, contactNo, status, submittedAt, reviewNote, profile, duplicates: [{beneficiaryId, name, barangay}]}
```

`duplicates` lists other beneficiaries with the same first and last name (ignoring case) and the same `beneficiaries.birthday`. The schema spec already copies that column from each new profile version.

### 4.3 Validation

**Step 1** (`register.php`, 422 unless noted):

| Field | Rule |
|---|---|
| Username | `^[A-Za-z0-9._-]{3,50}$`, stored lowercase. A taken one gives 409 "That username is already taken." |
| Password | At least 8 characters |
| First and last name | Required, 100 characters at most |
| Barangay | One of the 16 |
| Contact number | `^(09\d{9}\|\+639\d{9})$`, with the message "Enter a mobile number like 09171234567." |

**Submit** (`profile.php` with `action: "submit"`), against the latest saved version:
- These must be filled: `firstName`, `lastName`, `birthday`, `sex`, `barangay`, `contactNo`, `participantType`.
- All four consents must be ticked: `consentAssess`, `consentPolicy`, `consentRetain`, `consentShare`.
- A failure gives 422 and lists every missing item, so the client can show its error summary.

**Approve:**
- `overallAssessment` must be `qualified`. Otherwise: 422 "Only a Qualified applicant can be approved. Reject the registration instead."
- `track` is required.
- `associationId` is required when `track = 'association'` and must be null otherwise.
- The user must be `pending`. Otherwise: 409 "This registration is not waiting for review."

**Reject:**
- `reason` is required, 500 characters at most.
- The user must be `pending`.

---

## 5. Client

### 5.1 Sign-in page

- A secondary button, **"Register"**, below Sign in, with the line "New SLP participant? Register to apply."
- It opens **"Create your account (step 1 of 2)"** in place of the sign-in card. The form is built with `formField`: Username, Password, Confirm Password (checked in the browser only), First Name, Last Name, Barangay (select), Contact No.
- "Back to sign in" returns to the sign-in card.
- The rest follows the existing create-flow conventions: an error summary, inline errors, "(required)" text and focus management.
- A 403 `pending` answer from sign-in appears as an **info** notice in `#loginNotice`, not as an error.

### 5.2 Applicant mode (`me.status` is `registering` or `rejected`)

- **Navigation:** the sidebar has one item, "Eligibility form". `allowedPages()` returns only `["registration"]`, so every other page shows Access Denied.
- **The `registration` page** renders the existing Annex G.1 replica (`profilePage()`) with:
  - a header alert: "Step 2 of 2: complete your eligibility form", or the returned reason when the registration was rejected;
  - **"Save and finish later"**, which saves and shows a toast;
  - **"Submit for review"**, which opens the existing review modal and then submits.
- **The personnel section** stays read-only, and its fields are never sent (the existing rule).
- **After a successful submit:** the app returns to the sign-in page, with the on-hold notice in `#loginNotice`.

### 5.3 Staff

- **Sidebar:** a new item, "Registrations", under Administration, with the pending count in its label.
- **Dashboard:** a stat card, "Pending registrations".
- **The `registrations` page:** a table of applicant, barangay, submitted date and status. A possible duplicate shows a warning badge: "Possible duplicate".
- **"Review"** opens the applicant's form read-only, with these editable:
  - the personnel section (items 25–29);
  - the association, as a select that includes "Individual track (no association)".
- **The decision:**
  - **"Approve registration"** opens the existing confirmation dialog.
  - **"Reject registration"** asks for a reason (required).
  - The server's 422 and 409 messages show in the form's error summary.
- **New statuses** go in `STATUS_TONES`: "Registering" (neutral), "Pending" (warning), "Rejected" (error) and "Applicant" (neutral).

---

## 6. Security and privacy

- **Applicants cannot reach any active-only endpoint.** That is the default guard, so a forgotten check fails closed.
- **Participant role only.** `register.php` never creates staff and never sets an association or a leader.
- **Own record only.** An applicant can read and change only their own profile. The `userId` sent by staff is checked to be a participant in `pending`.
- **Passwords:** stored with `password_hash()`. The sign-in lockout applies to applicants too.
- **Consent (R.A. 10173):** submission requires the four consents in Annex G.1. Data from rejected applicants is kept under the retention rule already sent to the Data Protection Officer (schema spec, section 11).
- **Known risk: spam registrations.** There is no CAPTCHA and no per-IP limit (R7). Staff can reject spam, and the database rows stay small. Add a CAPTCHA before the site is reachable from the internet.

---

## 7. Testing

**API checks** (`api/tests/api-check.php`, with new checks):
- **Step 1:** register validation, covering each 422 rule and the 409 for a taken username.
- **Applicant restrictions:** an applicant gets 403 from the staff endpoints and gets the limited snapshot only. A tampered `data` that includes personnel fields is stored without them.
- **Submit:** a submit missing consents gives 422 with the list. A submit ends the session, and the next sign-in gives 403 `pending` with the on-hold sentence.
- **Approve:** without Qualified gives 422; the association track without an association gives 422. A valid approve makes the user active, sets their association, verifies the profile, adds the notification, and makes their next sign-in show the normal snapshot.
- **Reject and resubmit:** reject without a reason gives 422. After a reject, sign-in shows the reason, and the applicant can save, then submit again (back to `pending`).
- **Duplicates:** the warning appears for a matching name and birthday.
- **Audit:** a row for each step.

**Schema checks** (`database/tests/schema-check.php`):
- A rejected user with no note is rejected.
- A staff account cannot be `registering`.
- The enrollment ENUM accepts `applicant`.
- The demo applicant exists, with status `pending`.

**JS tests** (`tests/system.test.js`, with stubbed `fetch`):
- The Register button shows step 1.
- Applicant mode limits navigation to "Eligibility form".
- The on-hold notice shows after submit.
- The Registrations page renders the duplicate badge.
- The approve and reject payloads are right.

**Design check** (`tests/ui/design-check.js`): the register card and buttons match the reference card, the primary button and the secondary button.

---

## 8. Order of work

1. **Wiring part A**, as planned.
2. **Part A2, this spec.** Its profile `save` and `submit` and its eligibility-assessment write are the **first slice of part B's profile work**. Part B then adds version history, staff edits with a reason, and verify/reopen for existing participants, reusing these endpoints rather than duplicating them.
3. **Parts B and C**, as planned.
