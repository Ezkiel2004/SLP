# SLP Database Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `slp_monitoring` MariaDB database from the approved schema spec: tables, reference data (16 barangays, livelihood types), demo data across 5 barangays, demo files with SHA-256 hashes, and a check script that proves each spec rule.

**Architecture:**
- **SQL in plain files:** `database/schema.sql`, `database/seed-reference.sql` and `database/seed-demo.sql`.
- **Installer:** one PHP CLI, `database/install.php`. It creates the database and runs the files in order. It is the only place that computes `password_hash()` and file SHA-256 values, which it passes to `seed-demo.sql` as session variables (`@pw_admin`, `@doc_sha`, …).
- **Checks:** `database/tests/schema-check.php` installs into scratch databases, runs named checks, and drops them.
- **Out of scope:** wiring the PHP API and the prototype UI to the database (spec §10). That gets its own plan.

**Tech Stack:** MariaDB 10.4.32 (XAMPP), PHP 8.2.12 CLI with mysqli, no Composer and no other dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-slp-database-schema-design.md` (read §5 DDL, §7 query rules, §9 seed, §13 checks).

**Not a git repository:** there are no commit steps. Each task ends by running its checks, and the task is done when they all print `PASS`.

## Global Constraints

- Commands run from `C:\xampp\htdocs\SLP`.
- PHP is `C:\xampp\php\php.exe`. MySQL is `C:\xampp\mysql\bin\mysql.exe`. Neither is on `PATH`.
- Connect as `root@localhost` with no password. Do not run `GRANT`, and do not repair MariaDB system tables; the privilege tables are corrupt on this machine.
- Never touch the `dswd_website` database or the `dswd/` folder.
- **Database names must match `^slp_[a-z0-9_]+$`.** The installer refuses any other name, so `--fresh` can never drop another project's database.
- **Every connection sets:**
  - `set_charset('utf8mb4')`;
  - `SET time_zone = '+08:00'`, because the server's system zone is `America/Los_Angeles`;
  - `SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'`, because the server default is not strict.
- `CREATE DATABASE` uses `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`. The server default collation is `utf8mb4_general_ci`, which must not be used.
- `schema.sql` is the spec §5 DDL verbatim, minus the `CREATE DATABASE` and `USE` lines, which the installer handles. Use no `ON DELETE CASCADE`.
- Demo data is fictional and lives only in `seed-demo.sql`. Reference data (`seed-reference.sql`) is real and loads in every install.
- The installer refuses to install into a database that already exists unless `--fresh` is given.
- MariaDB error codes the checks rely on:

  | Code | Meaning |
  |---|---|
  | 4025 | CHECK failed |
  | 1452 | foreign key child row has no parent |
  | 1062 | duplicate key |
  | 1644 | SIGNAL raised by a trigger |
  | 1048 | NULL in a NOT NULL column |
  | 1265 | data truncated, e.g. an invalid ENUM value in strict mode |
  | 1406 | data too long |

## Review Focus

1. **Re-running the installer on an existing database without `--fresh`** must stop with "already exists" and leave the database unchanged. It must not half-install or duplicate rows. Test: `installer refuses existing database` (Task 1).
2. **A failing statement in the middle of a SQL file** must stop the install with the file name and the error, and the CLI must exit 1. It must not report success; with `multi_query`, an error after the first statement surfaces only in the `next_result()` loop. Test: `run_sql_file stops at a bad statement` (Task 1).
3. **The server is not in strict mode.** An invalid ENUM value or an over-long name must be rejected, not saved as `''` or truncated. Test: `strict mode rejects bad enum and long text` (Task 1).
4. **Filipino names with ñ** (Santo Niño, Dela Peña) must round-trip unchanged. Test: `utf8mb4 round-trips ñ` (Task 1).
5. **Timestamps must be Philippine time**, not Los Angeles time. Test: `connection uses +08:00` (Task 1).

---

### Task 1: Installer, schema and reference data

**Files:**
- Create: `database/install.php`
- Create: `database/schema.sql`
- Create: `database/seed-reference.sql`
- Test: `database/tests/schema-check.php`

**Interfaces:**
- Produces (`database/install.php`, functions usable via `require`; the CLI runs only when the file is executed directly, i.e. `realpath($argv[0]) === __FILE__`):
  - `db_connect(?string $dbName = null): mysqli`: root@localhost, with the three session settings from Global Constraints. mysqli reporting is `MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT`.
  - `run_sql_file(mysqli $db, string $path): void`: runs every statement through `multi_query` and loops `next_result()`. It throws `RuntimeException("<basename>: statement <n>: <error>")` on any error, and on any statement that leaves `warning_count > 0` (the message includes the `SHOW WARNINGS` text).
  - `install(string $dbName, bool $demo = false, bool $fresh = false, ?string $storageDir = null): mysqli`:
    - validates the name;
    - if the database exists and `$fresh` is false, throws `RuntimeException("Database '<name>' already exists. Re-run with --fresh to drop and recreate it.")`;
    - with `$fresh`, drops it first;
    - creates the database, then runs `schema.sql` and `seed-reference.sql`;
    - when `$demo` is true, also does Task 2's demo steps;
    - returns a connection on the new database.
  - CLI usage: `php database/install.php [--db=slp_monitoring] [--demo] [--fresh]`. On success it prints `Installed <db>: 18 tables, 1 view, 10 triggers` and adds `, demo data` with `--demo`, then exits 0. On error it prints the message to STDERR and exits 1.
- Produces (`database/tests/schema-check.php`):
  - Usage: `php database/tests/schema-check.php [name-filter]`.
  - It registers checks with `check(string $name, callable $fn, bool $demo = false)`, where `$fn` receives a `mysqli`. A check passes unless it throws.
  - A check with `$demo = false` runs against `slp_schema_check`, installed once with `install(..., demo: false, fresh: true)`. A check with `$demo = true` runs against `slp_schema_check_demo`, installed once with `demo: true, fresh: true` and a temporary storage directory.
  - Helper `expect_error(mysqli $db, int $code, string $sql): void` passes only if `$sql` throws `mysqli_sql_exception` with that code.
  - Each check prints `PASS <name>` or `FAIL <name>: <message>`, and the run ends with `<p> passed, <f> failed`. Both scratch databases and the temporary storage are dropped in a `finally` block. The script exits 1 if anything failed.

- [ ] **Step 1: Write the failing checks** (all `$demo = false`):

| Check name | Asserts |
|---|---|
| `schema imports with no warnings` | `install()` returned without throwing |
| `object counts` | `information_schema` for the scratch database has 18 `BASE TABLE`s, 1 `VIEW` (`user_roles`) and 10 triggers |
| `16 barangays, 8 poblacion` | `COUNT(*) = 16`, `SUM(is_poblacion) = 8`, and names equal exactly: Araw at Bituin, Bagong Sikat, Banaag at Pag-asa, Binakas, Cabra, Likas ng Silangan, Maginhawa, Maligaya, Maliig, Ninikat ng Pag-asa, Paraiso, Surville, Tagbac, Tangal, Tilik, Vigo |
| `poblacion flags` | `is_poblacion = 1` for exactly Araw at Bituin, Bagong Sikat, Banaag at Pag-asa, Likas ng Silangan, Maginhawa, Ninikat ng Pag-asa, Paraiso, Surville |
| `7 livelihood types` | names in id order: Sari-sari Store, Poultry Raising, Piggery, Food Vending, Fishing, Livestock Raising, Farming |
| `installer refuses existing database` | a second `install('slp_schema_check')` without `fresh` throws `RuntimeException` containing `already exists`, and `COUNT(*) FROM barangays` is still 16 |
| `installer refuses non-slp names` | `install('dswd_website', fresh: true)` throws before connecting to that database. Afterwards `SHOW DATABASES LIKE 'dswd_website'` still returns 1 row |
| `run_sql_file stops at a bad statement` | a temporary file `SELECT 1; SELEC 2; SELECT 3;` throws `RuntimeException` whose message contains `statement 2` |
| `connection uses +08:00` | `SELECT @@session.time_zone` returns `+08:00` |
| `strict mode rejects bad enum and long text` | `expect_error(1265, "INSERT INTO livelihood_types (name, status) VALUES ('X', 'maybe')")` and `expect_error(1406, "INSERT INTO livelihood_types (name) VALUES (REPEAT('a', 101))")` |
| `utf8mb4 round-trips ñ` | inserting `Piña Processing` into `livelihood_types` and reading it back gives exactly `Piña Processing`; delete the row after |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php`
Expected: the script fails, because `database/install.php` does not exist yet. (A fatal `require` error is the expected failure.)

- [ ] **Step 3: Write `database/install.php`** with the three functions and the CLI described under Interfaces. Run the files in this order: `schema.sql`, then `seed-reference.sql`. Build `CREATE DATABASE` only after the name passes `^slp_[a-z0-9_]+$`.

- [ ] **Step 4: Write `database/schema.sql`**: the spec §5 DDL, from `CREATE TABLE barangays` through the last trigger, without the `CREATE DATABASE` and `USE` lines.

- [ ] **Step 5: Write `database/seed-reference.sql`**:
  - the 16 barangays, inserted in the alphabetical order of the check above (ids 1–16), with `is_poblacion` as listed;
  - the 7 livelihood types, in the order of the check (ids 1–7).

- [ ] **Step 6: Run the checks to verify they pass**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php`
Expected: `11 passed, 0 failed`, exit code 0. Then `C:\xampp\mysql\bin\mysql.exe -u root -e "SHOW DATABASES LIKE 'slp_schema_check%'"` prints nothing.

---

### Task 2: Demo data and stored files

**Files:**
- Create: `database/seed-demo.sql`
- Create: `database/demo/placeholder.pdf`: a valid one-page PDF reading "Demo document - not an official record"
- Create: `storage/.htaccess`
- Modify: `database/install.php` (the `$demo` branch of `install()`)
- Test: `database/tests/schema-check.php` (add the checks below)

**Interfaces:**
- Consumes: `install()`, `run_sql_file()`, `check()`, `expect_error()` from Task 1.
- Produces: the demo rows below, at fixed ids. Task 3 refers to them by id.
- Session variables set by `install()` before running `seed-demo.sql`:
  - `@pw_admin`, `@pw_leader`, `@pw_member`: `password_hash('admin123' | 'leader123' | 'member123', PASSWORD_DEFAULT)`;
  - `@doc_sha`: the lowercase `hash_file('sha256', ...)` of `placeholder.pdf`;
  - `@doc_size`: its `filesize()`.
- File placement: after `seed-demo.sql`, `install()` copies `placeholder.pdf` to `<storageDir>/<file_path>` for every `document_versions` row, creating folders as needed. `$storageDir` defaults to `<project>/storage`. `file_path` uses forward slashes: `documents/<document_id>/v<version_no>-<LEFT(@doc_sha,12)>.pdf`.
- `storage/.htaccess` contains exactly these two lines:

```
# Uploaded files are served only through PHP after a permission check.
Require all denied
```

**Demo rows** (`seed-demo.sql`; look up barangay and livelihood ids by name with subqueries):

Associations. Insert them with `leader_id` NULL, insert the beneficiaries, then set each leader with an `UPDATE`:

| id | name | type | barangay | leader (beneficiary id) |
|---|---|---|---|---|
| 1 | Bagong Sikat Sari-sari Store SLPA | Sari-sari Store | Bagong Sikat | 1 |
| 2 | Tilik Poultry Raisers SLPA | Poultry Raising | Tilik | 6 |
| 3 | Maliig Poultry Raisers SLPA | Poultry Raising | Maliig | 8 |
| 4 | Vigo Hog Raisers SLPA | Piggery | Vigo | 10 |
| 5 | Cabra Fisherfolk SLPA | Fishing | Cabra | 4 |

Beneficiaries. `barangay_id` is the association's barangay, except Ana's. `profile_status` is `draft`.

| id | first / last | sex | association | barangay | enrollment_status |
|---|---|---|---|---|---|
| 1 | Maria / Santos | female | 1 | Bagong Sikat | active |
| 2 | Juan / Dela Cruz | male | 1 | Bagong Sikat | active |
| 3 | Ana / Reyes | female | NULL (individual) | Araw at Bituin | for_monitoring |
| 4 | Pedro / Garcia | male | 5 | Cabra | completed |
| 5 | Liza / Bautista | female | 1 | Bagong Sikat | active |
| 6 | Ramon / Villanueva | male | 2 | Tilik | active |
| 7 | Carmen / Aquino | female | 2 | Tilik | active |
| 8 | Elena / Ramos | female | 3 | Maliig | active |
| 9 | Jose / Mendoza | male | 3 | Maliig | active |
| 10 | Roberto / Castillo | male | 4 | Vigo | active |
| 11 | Teresa / Navarro | female | 4 | Vigo | active |
| 12 | Mario / Flores | male | 5 | Cabra | active |

Users. All have `must_change_password = 0` and `status = 'active'`:

| id | username | role | beneficiary | full_name | password variable |
|---|---|---|---|---|---|
| 1 | admin | staff | NULL | MSWDO Personnel | `@pw_admin` |
| 2 | leader | participant | 1 | NULL | `@pw_leader` |
| 3 | member | participant | 2 | NULL | `@pw_member` |

Projects:

| id | name | owner | type | status |
|---|---|---|---|---|
| 1 | Bagong Sikat Sari-sari Store | association 1 | Sari-sari Store | ongoing |
| 2 | Tilik Poultry Farm | association 2 | Poultry Raising | ongoing |
| 3 | Maliig Poultry Farm | association 3 | Poultry Raising | for_monitoring |
| 4 | Vigo Hog Farm | association 4 | Piggery | ongoing |
| 5 | Cabra Fish Trading | association 5 | Fishing | completed |
| 6 | Reyes Food Stall | beneficiary 3 | Food Vending | for_monitoring |

Documents. Each has version 1: `original_name` `placeholder.pdf`, `mime_type` `application/pdf`, `size_bytes` `@doc_size`, `sha256` `@doc_sha`, and `created_by` the same as the document's:

| id | owner | title | category | status | review_note | created_by | created_at |
|---|---|---|---|---|---|---|---|
| 1 | association 1 | Project Proposal - Sari-sari Store | project | approved | NULL | 2 | 2026-09-12 10:00:00 |
| 2 | association 1 | Monthly Sales Record - September 2026 | progress | returned | Page 2 is missing. Send the complete record. | 2 | 2026-09-25 14:00:00 |
| 3 | association 2 | Attendance Sheet - Poultry Training | other | for_review | NULL | 1 | 2026-10-01 09:30:00 |
| 4 | beneficiary 1 | Beneficiary Profile - Maria Santos | profile | approved | NULL | 1 | 2026-09-10 08:30:00 |

Other rows:
- **`tool_submissions` id 1:**
  - `tool` 'aa', association 1, `visit_date` 2026-09-15;
  - status `submitted`, `submitted_at` 2026-09-15 15:00:00;
  - `created_by` 2;
  - one version, with `data` `'{}'` and `created_by` 2.
- **`profile_versions`:**
  - version 1 for beneficiary 1: `{"firstName":"Maria","lastName":"Santos","municipality":"Lubang","province":"Occidental Mindoro"}`, `created_by` 2;
  - version 1 for beneficiary 2: the same keys for Juan Dela Cruz, `created_by` 3.
- **`monitoring_visits`** (`created_by` 1):
  - beneficiary 1, 2026-09-15, good, issue NULL, "Continue monitoring";
  - beneficiary 3, 2026-09-18, needs_follow_up, "Incomplete sales record", "Submit updated record".
- **`assistance`** (`created_by` 1):
  - beneficiary 1, livelihood_capital, 2026-08-20, 10000.00;
  - beneficiary 2, training_support, 2026-08-28, 5000.00.
- **`reports`** (`created_by` 1, with `created_at` 2026-09-20, 09-21 and 09-22 at 09:00:00; details "Demo report."):
  - project, "August 2026", submitted, shared 1;
  - progress, "September 2026", submitted, shared 0;
  - status, "Q3 2026", for_review, shared 0.
- **`notifications`** (`created_by` 1):
  - id 1, to beneficiary 1, "Monitoring Schedule", "Your field monitoring visit is scheduled.", 2026-09-23;
  - id 2, to beneficiary 3, "Correction Request", "Your project record is incomplete. Please submit the missing pages.", 2026-09-22;
  - id 3, to all (NULL), "General Assembly & Program Orientation", "All SLP participants in Lubang are invited to the MSWDO Community Hall on Oct 10.", 2026-09-24.
- **`audit_log`** (7 rows; `entity_type` is `document` or `tool_submission`):
  1. association 1, actor 2, `document.submit`, document 1, `Maria Santos sent "Project Proposal - Sari-sari Store".`, 2026-09-12 10:00:00
  2. association 1, actor 1, `document.review`, document 1, `MSWDO approved "Project Proposal - Sari-sari Store".`, 2026-09-13 09:00:00
  3. association 1, actor 2, `tool.submit`, tool_submission 1, `Maria Santos submitted the MD Monitoring Tool (Annex AA).`, 2026-09-15 15:00:00
  4. association 1, actor 2, `document.submit`, document 2, `Maria Santos sent "Monthly Sales Record - September 2026".`, 2026-09-25 14:00:00
  5. association 1, actor 1, `document.review`, document 2, `MSWDO returned "Monthly Sales Record - September 2026": page 2 is missing.`, 2026-09-26 10:00:00
  6. association 2, actor 1, `document.submit`, document 3, `MSWDO uploaded "Attendance Sheet - Poultry Training".`, 2026-10-01 09:30:00
  7. association NULL, actor 1, `document.submit`, document 4, `MSWDO uploaded "Beneficiary Profile - Maria Santos".`, 2026-09-10 08:30:00

- [ ] **Step 1: Write the failing checks** (all `$demo = true`):

| Check name | Asserts |
|---|---|
| `demo counts` | associations 5; `COUNT(DISTINCT barangay_id)` in associations = 5; beneficiaries 12; users 3; projects 6; documents 4; document_versions 4; tool_submissions 1; tool_submission_versions 1; profile_versions 2; monitoring_visits 2; assistance 2; reports 3; notifications 3; audit_log 7 |
| `every association has a leader and 2+ members` | for ids 1–5, `leader_id` matches the table above and the member count is ≥ 2 (association 1 has 3) |
| `same livelihood, different barangays` | associations 2 and 3 both have type Poultry Raising, with barangays Tilik and Maliig |
| `demo passwords` | `password_verify` holds for admin/admin123, leader/leader123 and member/member123, and fails for `password` on all three |
| `user_roles for demo accounts` | `user_roles` gives user 1 `staff` with association NULL; user 2 `leader` with association 1; user 3 `member` with association 1 |
| `stored files match their hashes` | for every `document_versions` row: the file exists at `<storage>/<file_path>`, `hash_file('sha256')` equals `sha256`, `filesize` equals `size_bytes`, and the first 5 bytes are `%PDF-` |
| `storage is not web-readable` | `storage/.htaccess` in the project contains the line `Require all denied` |

- [ ] **Step 2: Run the checks to verify they fail**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php demo`
Expected: every demo check FAILs, because `seed-demo.sql` does not exist yet.

- [ ] **Step 3: Create `database/demo/placeholder.pdf`** (any small valid PDF with the text above) and `storage/.htaccess`.

- [ ] **Step 4: Write `database/seed-demo.sql`** with the rows above, in the insert order: associations (no leader), beneficiaries, leader updates, users, projects, documents and versions, tool submission and version, profile versions, monitoring visits, assistance, reports, notifications, audit_log.

- [ ] **Step 5: Add the `$demo` branch to `install()`**: set the session variables, run `seed-demo.sql`, then place the files.

- [ ] **Step 6: Run all checks to verify they pass**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php`
Expected: `18 passed, 0 failed`, exit code 0.

---

### Task 3: Spec rule checks (§7 and §13)

These checks exercise rules that Task 1's DDL already contains. If one fails, fix `schema.sql` to match spec §5, and never weaken the check.

**Files:**
- Test: `database/tests/schema-check.php` (add the checks below)
- Modify, only if a check fails: `database/schema.sql`

**Interfaces:**
- Consumes: `check()`, `expect_error()`, and the demo ids from Task 2.
- Every check that changes data starts with `$db->begin_transaction()` and ends with `$db->rollback()`, so the checks don't depend on their order.

- [ ] **Step 1: Write the checks** (all `$demo = true`):

| Check name | Asserts |
|---|---|
| `rejects staff with a beneficiary` | `expect_error(4025, …)`: insert a user with role `staff`, `beneficiary_id` 5 and `full_name` 'X' |
| `rejects participant without beneficiary` | 4025: role `participant`, `beneficiary_id` NULL |
| `rejects document with two owners or none` | 4025 twice: `association_id` 1 with `beneficiary_id` 1, and both NULL |
| `rejects project with two owners or none` | 4025 twice, the same pattern on `projects` |
| `rejects returned document without note` | 4025: `UPDATE documents SET status='returned', review_note=NULL WHERE id=1` |
| `rejects invalid JSON` | 4025: insert a profile version with `data` `'{not json'` |
| `rejects malformed sha256` | 4025: insert a document version with `sha256` `'ABC'` |
| `rejects tool submitted without time` | 4025: `UPDATE tool_submissions SET submitted_at=NULL WHERE id=1` |
| `rejects sharing a draft report` | 4025: `UPDATE reports SET shared_with_participants=1 WHERE status='for_review'` |
| `rejects negative assistance` | 4025: `UPDATE assistance SET amount=-1 WHERE id=1` |
| `rejects association without livelihood type` | 1048: insert an association with `livelihood_type_id` NULL |
| `rejects duplicate livelihood type` | 1062: insert `piggery` (lowercase) |
| `rejects second Poultry association in Tilik` | 1062: insert "Tilik Poultry Two SLPA" with type Poultry Raising, barangay Tilik |
| `rejects unknown barangay` | 1452: insert a beneficiary with `barangay_id` 99 |
| `rejects leader from another association` | 1452: `UPDATE associations SET leader_id=7 WHERE id=1`. Carmen is a non-leader member of association 2; using a non-leader keeps the unique-leader key from firing first |
| `rejects duplicate version number` | 1062: insert a `document_versions` row for document 1 with `version_no` 1, `file_path` `dup`, and `sha256` of 64 zeros (spec §8, concurrent saves) |
| `history tables are append-only` | for each of `profile_versions`, `eligibility_assessments`, `document_versions`, `tool_submission_versions` and `audit_log`: `UPDATE` (set `created_at = created_at`) and `DELETE` on an existing row each fail with 1644, with a message containing `append-only`. `eligibility_assessments` has no demo row, so insert one first (beneficiary 1, version 1, `data` `'{}'`, `created_by` 1) inside the transaction |
| `changing the leader changes roles only` | `UPDATE associations SET leader_id=2 WHERE id=1`, then `user_roles` gives user 3 `leader` and user 2 `member`, with no other table touched |
| `Juan sees only his association's documents` | the spec §7 documents query with `:my_assoc`=1 and `:my_ben`=2 returns ids `[1, 2]` (not 3: another association; not 4: Maria's personal record) |
| `Juan sees submitted tools of his association` | the §7 tools query with `:my_assoc`=1 and `:me`=3 returns `[1]` |
| `notifications reach the right people` | the §7 notifications query gives `[3]` for `:my_ben`=2 and `[1, 3]` for `:my_ben`=1 |
| `activity feed is per association` | the §7 feed query returns 5 rows for association 1 and 1 row for association 2 |

- [ ] **Step 2: Run the checks**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php`
Expected: `40 passed, 0 failed`, exit code 0. On any FAIL, correct `schema.sql` against spec §5 and re-run until all pass.

---

### Task 4: Install `slp_monitoring` and retire the old schema

**Files:**
- Delete: `database/slp_database.sql` (replaced, per the spec header)
- Modify: `CLAUDE.md` (Commands; the Architecture line that mentions `database/slp_database.sql`)
- Modify: `README.txt` (the `FUTURE PHP + MYSQL VERSION` section's mention of `slp_database.sql`)

**Interfaces:**
- Consumes: the `database/install.php` CLI.

- [ ] **Step 1: Confirm the target is free**

Run: `C:\xampp\mysql\bin\mysql.exe -u root -e "SHOW DATABASES LIKE 'slp_monitoring'"`
Expected: no output. If `slp_monitoring` exists, stop and ask the user before using `--fresh`, because it drops that database.

- [ ] **Step 2: Install**

Run: `C:\xampp\php\php.exe database\install.php --demo`
Expected: `Installed slp_monitoring: 18 tables, 1 view, 10 triggers, demo data`, exit code 0, and 4 PDFs under `storage\documents\`.

- [ ] **Step 3: Verify the live database**

Run: `C:\xampp\mysql\bin\mysql.exe -u root slp_monitoring -e "SELECT (SELECT COUNT(*) FROM barangays) b, (SELECT COUNT(*) FROM associations) a, (SELECT COUNT(*) FROM beneficiaries) p; SELECT * FROM user_roles;"`
Expected: `16 5 12`, then roles `staff`, `leader` (association 1) and `member` (association 1).

- [ ] **Step 4: Retire the old file and update the docs**
  - Delete `database/slp_database.sql`.
  - In `CLAUDE.md` Commands, add:
    - **Install DB:** `C:\xampp\php\php.exe database\install.php --demo` (`--fresh` drops and recreates an `slp_*` database)
    - **DB checks:** `C:\xampp\php\php.exe database\tests\schema-check.php [filter]`
  - In `CLAUDE.md` Architecture, replace the sentence about `database/slp_database.sql` with: the schema is `database/schema.sql` (spec `docs/superpowers/specs/2026-10-13-slp-database-schema-design.md`), installed by `database/install.php`, and the prototype is not wired to it yet.
  - In `README.txt`, point the `slp_database.sql` mentions to `database/install.php`.

- [ ] **Step 5: Final run of both suites**

Run: `C:\xampp\php\php.exe database\tests\schema-check.php` and then `npm test`.
Expected: `40 passed, 0 failed` and `# pass 14` / `# fail 0`.
