# SDD ledger — plan: docs/superpowers/plans/2026-10-15-slp-self-registration.md
Spec: docs/superpowers/specs/2026-10-15-slp-self-registration-design.md
Setup: Ruling: not a git repo — no worktree, commits or BASE; ledger by hand; task-done = a manual run of the task's checks — cost if wrong: none.
Setup: depends on part A (complete, see .superpowers/sdd/2026-10-13-slp-app-wiring-core/progress.md).
Pre-flight: T2→T1 demo applicant (user 4, pending): consistent. T3→T2 require_applicant/register_as: consistent. T4→T3 register_and_submit/complete_profile: consistent. T5→A api/applySnapshot/loginUser: consistent; T5 needs referenceData barangays before sign-in → GET api/reference.php (spec §4.2, T2): consistent. T6→T4 staff registrations key, T5 profilePage(options): consistent. T7→all: consistent.
Pre-flight: A2 Global Constraints say bump the cache version by one: part A left ?v=3.8, so A2 uses ?v=3.9.
Task 1: RED seen (5 FAIL: 3 new, 2 updated counts). Ruling: the applicant profile_version and audit rows carry the plan's timestamps explicitly (created_at 2026-10-14 10:00:00) — cost if wrong: none.
Task 1: complete (tests: schema-check 49/49 (+3); api-check 31/31 (count check updated))
Task 2: RED seen (8 FAIL). Rulings: username/password validation moved to shared username_field()/password_field() in _lib.php (accounts.php and register.php both use it); sign_in_session() shared by login.php and register.php; login.php sign-in now runs in in_transaction() — cost if wrong: none.
Task 2: complete (tests: api-check 39/39)
Task 3: RED seen (7 FAIL: 403/404). Rulings: profile.php serialises version numbers with SELECT … FOR UPDATE on the beneficiary row; an answer outside the known formats (bad date, unknown sex/type/barangay) is stored in the version but not copied to the registry row, and submit reports it as missing — cost if wrong: none. The applicant branch sits at the top of bootstrap.php (current_user, then the active-only require_user for everyone else).
Task 3: complete (tests: api-check 46/46)
Task 4: RED seen (7 FAIL: 404 / missing registrations key). Rulings: approve and reject lock the user row (SELECT … FOR UPDATE) inside the transaction and turn "not pending" into 409 through a DomainException; the staff snapshot carries "registrations" only for staff; reject stores an assessment version only when one is sent with overallAssessment — cost if wrong: none.
Task 4: complete (tests: api-check 53/53)
