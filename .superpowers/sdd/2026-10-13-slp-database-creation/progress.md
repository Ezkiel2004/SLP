# SDD ledger — plan: docs/superpowers/plans/2026-10-13-slp-database-creation.md
Spec: docs/superpowers/specs/2026-10-13-slp-database-schema-design.md
Setup: Ruling: SLP is not a git repo, so there is no worktree, branch, commit or BASE; the workspace and ledger are made by hand, and task-done is a manual run of the task's check command with its result ledgered — cost if wrong: no history to diff; the final review reads the files directly.
Setup: user asked for Task 1 only this turn; stop after Task 1 and report.
Pre-flight: T2→T1 install()/run_sql_file()/check()/expect_error(): consistent.
Pre-flight: T2 step 2 runs `schema-check.php demo`, but most demo check names do not contain "demo" (e.g. "every association has a leader…"). Ruling: the runner treats the filter "demo" as "every check registered with $demo = true", and any other filter as a substring of the check name — cost if wrong: none; one extra condition in the runner.
Pre-flight: T3→T2 demo ids: consistent (leader-from-another check already uses non-leader beneficiary 7).
Pre-flight: T4→T1 CLI flags --db/--demo/--fresh: consistent.
Task 1: Ruling: the "installer refuses non-slp names" check calls install('not_slp_schema_check', fresh: true) and asserts no such database was created, instead of calling install('dswd_website', fresh: true) — a broken name gate would have dropped the user's real dswd_website database during the test — cost if wrong: none; the same gate is exercised.
Task 1: Ruling: run_sql_file() splits each file into statements in PHP (quote- and "--"-comment-aware) and runs them one at a time, instead of multi_query, because SHOW WARNINGS cannot run while multi-statement results are pending, so the warning text the interface promises would be lost; one extra check pins the splitter ("run_sql_file ignores semicolons in comments and strings"), so Task 1 has 12 checks, not 11 — cost if wrong: an SQL construct the splitter does not know (/* */ comments, DELIMITER) fails the import loudly, never silently.
Task 1: Ruling: install() throws InvalidArgumentException for a name outside ^slp_[a-z0-9_]+$ (the plan named no exception type) — cost if wrong: none.
Task 1: Ruling: added the check "run_sql_file stops on a warning" (13 checks in Task 1, not 11 or 12), because without it "schema imports with no warnings" passes even if warning detection is broken — cost if wrong: none; one more check.
Task 1: RED seen: all checks failed on the missing install.php (fatal require), as the plan expected. Mutation probes: disabling the warning check, and separately the strict sql_mode line, made "run_sql_file stops on a warning" and "strict mode rejects bad enum and long text" FAIL (11/13); restored → 13/13.
Task 1: CLI verified by hand on slp_cli_check: install exit 0 ("18 tables, 1 view, 10 triggers"), re-run refused exit 1, --fresh exit 0, --db=dswd_website refused exit 1; slp_cli_check dropped; dswd_website untouched. npm test 14/14.
Task 1: complete (no commits — not a git repo; tests: C:\xampp\php\php.exe database\tests\schema-check.php → 13 passed, 0 failed, exit 0)
Task 2: RED seen: `schema-check.php demo` → 0 passed, 7 failed ("seed-demo.sql: file not found"), as the plan expected.
Task 2: Ruling: the demo branch lives in a separate function install_demo($db, $storageDir), called from install() — same interface, smaller install() — cost if wrong: none.
Task 2: Ruling: "every association has a leader and 2+ members" asserts the exact member counts (3,2,2,2,2) rather than ">= 2" — stricter and still what the plan's table says — cost if wrong: none.
Task 2: Ruling: notification created_at values use the plan's dates with no time (stored as 00:00:00) — cost if wrong: none.
Task 2: complete (no commits; tests: C:\xampp\php\php.exe database\tests\schema-check.php → 20 passed, 0 failed, exit 0)
Task 3: Ruling: the 16 rejection checks are table-driven (const REJECTIONS + one loop), each still its own named check, and every data-changing check runs inside rolled_back() — cost if wrong: none.
Task 3: Ruling: expect_error() now returns the error message (was void) so the append-only check can assert "append-only" in it — cost if wrong: none.
Task 3: first run 42/42, as the plan expected (the rules already exist in schema.sql). Mutation probe: removing ck_documents_one_owner, uq_associations_barangay_type and trg_audit_log_bd from a copy of schema.sql → 38 passed, 4 failed (object counts, two-owner document, second Tilik Poultry, append-only); restored → 42/42.
Task 3: complete (no commits; tests: C:\xampp\php\php.exe database\tests\schema-check.php → 42 passed, 0 failed, exit 0)
Task 4: installed slp_monitoring with --demo: "Installed slp_monitoring: 18 tables, 1 view, 10 triggers, demo data", exit 0; 4 PDFs in storage/documents/; counts 16/5/12; user_roles staff / leader (assoc 1) / member (assoc 1); database collation utf8mb4_unicode_ci.
Task 4: Ruling: found that Apache served database/ (seed-demo.sql 200, and tests/schema-check.php would run over HTTP and create/drop databases as root). Added database/.htaccess (Require all denied) with the check "database folder is not web-readable" (RED→GREEN); curl now gives 403 for database/seed-demo.sql, database/install.php, database/tests/schema-check.php and storage/documents/1/… — cost if wrong: none; the folder is command-line only. Suite is now 43 checks.
Task 4: Ruling: sed mangled the backslashes in the new CLAUDE.md command lines; rewrote them with a PHP script using chr(92) — cost if wrong: none.
Task 4: deleted database/slp_database.sql (replaced, per the approved spec and plan); CLAUDE.md (overview + Commands) and README.txt folder tree updated.
Task 4: complete (no commits; tests: C:\xampp\php\php.exe database\tests\schema-check.php → 43 passed, 0 failed; npm test → 14 pass, 0 fail)
Final: review by a fresh opus reviewer: 0 Critical, 2 Important, 9 Minor (+ notes for the next plan).
Final: Ruling (re-grade): reviewer Minor 4 (ñ check passes with a wrong connection charset) raised to Important — it is the only guard for Review Focus 4, so a regression would store mojibake unnoticed — cost if wrong: one extra assertion.
Final: Ruling (re-grade): reviewer Minor 5 (connection collation utf8mb4_general_ci) raised to Important — it breaks a Global Constraint and is baked into the stored user_roles view, so later joins can fail with error 1267 — cost if wrong: one SET NAMES line and a reinstall.
Final: fixed I1 half-built database on a failed install — "failed install removes the partial database" RED→GREEN, suite 46/46.
Final: fixed I2 CLI silently ignored unknown/positional arguments (--database=x --fresh would drop slp_monitoring) — "CLI rejects unknown arguments" RED→GREEN, suite 46/46.
Final: fixed ñ check vacuous — server-side CHAR_LENGTH = 15 assertion; RED shown by a latin1 mutation of db_connect(), restored → GREEN, suite 46/46.
Final: fixed connection collation general_ci — "connection and view use utf8mb4_unicode_ci" RED→GREEN, suite 46/46; slp_monitoring reinstalled with --demo --fresh (demo-only data from this session) so its user_roles view is unicode_ci.
Final: Ruling: TRUNCATE bypasses the append-only triggers and the app connects as root — stands; spec §8.1 limits the guarantee to the application, and GRANT is ruled out on this machine — cost if wrong: root or TRUNCATE can still erase history.
Final: Ruling: --fresh drops without asking and leaves old files in storage/documents/ — stands; --fresh is destructive by definition, and the slp_ name gate plus strict argument parsing now stop typos — cost if wrong: orphan files after a fresh reinstall.
Final: Ruling: storage/ sits inside the web root, protected only by .htaccess (spec D9 says outside the web area, §8.3 prescribes the .htaccess) — stands for now, 403 verified on this Apache — cost if wrong: if AllowOverride is ever turned off, uploaded documents become public; move storage outside htdocs in the app plan.
Final: Ruling: the view and triggers have DEFINER=root@localhost — stands; the installer, not a dump, is the install path — cost if wrong: a dump restored without root@localhost breaks them.
Final: Ruling: split_sql() treats a backslash as an escape inside backtick names — stands; no such names exist — cost if wrong: a loud import error.
Final: Ruling: user_roles ignores inactive users and associations — stands; that is the spec's design, so sign-in must check users.status — cost if wrong: an inactive account keeps its role if the app forgets the check.
Final: Ruling: unicode_ci makes ñ equal to n in unique keys — stands; it blocks near-duplicate names — cost if wrong: two genuinely different names that differ only by ñ/n cannot coexist.
Final: Ruling: document_versions ids have gaps after INSERT … SELECT — stands; harmless — cost if wrong: none.
Final: minor (deferred): sha256 CHECK accepts uppercase hex (REGEXP is case-insensitive under unicode_ci); fix spec + schema with `sha256 COLLATE utf8mb4_bin REGEXP '^[0-9a-f]{64}$'` and a REPEAT('A',64) test case.
Final: minor (deferred): a check filter that matches nothing prints "0 passed, 0 failed" and exits 0.
Final: minor (deferred): no checks for an association in a non-existent barangay or with a non-existent livelihood type (fk_associations_barangay / fk_associations_type).
Final: minor (deferred): "run_sql_file stops at a bad statement" does not assert the file name in the message.
Final: minor (deferred): split_sql() fails loudly but confusingly on a UTF-8 BOM, # comments and /* */ comments; strip a leading BOM.
Final: minor (deferred): docs/DESIGN-SYSTEM.md:364 still lists database/slp_database.sql in its file tree.
Final: Ruling: the workspace and ledger are KEPT instead of deleted, because there is no git history to replace them as the record — cost if wrong: a stray .superpowers/ folder.
PLAN COMPLETE: schema-check 46/46, npm test 14/14, slp_monitoring installed with demo data.
