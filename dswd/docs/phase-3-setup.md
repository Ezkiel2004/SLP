# DSWD website: phase 3 setup, data model and staff guide

The public site now reads from a MySQL/MariaDB database, staff manage content in
`/admin`, and a small JSON API serves the same published content. This file covers:

1. [Data model (ER description)](#1-data-model-er-description)
2. [Install on XAMPP](#2-install-on-xampp)
3. [First sign-in and the default administrator](#3-first-sign-in-and-the-default-administrator)
4. [Database accounts (least privilege)](#4-database-accounts-least-privilege)
5. [Backups and restore](#5-backups-and-restore)
6. [Roles and permissions](#6-roles-and-permissions)
7. [Staff guide: managing content](#7-staff-guide-managing-content)
8. [JSON API](#8-json-api)
9. [Security and privacy measures](#9-security-and-privacy-measures)
10. [Going live](#10-going-live)
11. [Automated checks](#11-automated-checks)
12. [Decisions to confirm](#12-decisions-to-confirm)

---

## 1. Data model (ER description)

Database `dswd_website`, InnoDB, `utf8mb4_unicode_ci`. Full definitions with
comments: `database/schema.sql`.

```
roles 1 ──< users 1 ──< news_articles.author_id      (optional, SET NULL)
                  └──< audit_logs.user_id            (optional, SET NULL)

categories 1 ──< programs.category_id                (optional, SET NULL)
           1 ──< news_articles.category_id           (optional, SET NULL)
           1 ──< downloads.category_id               (optional, SET NULL)
           1 ──< faqs.topic_id                       (optional, SET NULL)
           (categories.type says which: program, news, download or faq)

programs 1 ──< program_requirements                  (CASCADE: "What to bring")
         1 ──< program_steps                         (CASCADE: "How to apply")
         1 ──< downloads.program_id                  (optional: the program's forms)

Standalone: announcements, offices, officials, site_settings, feedback, rate_limits
```

| Table | Holds | Notes |
|---|---|---|
| `roles` | super_admin, publisher, editor, viewer | Fixed list; permissions are in `includes/auth.php`. |
| `users` | Staff accounts | Unique email, Argon2id hash, `is_active`, `must_change_password`, `last_login`. |
| `categories` | Groups for programs, news, downloads and FAQ topics | Unique per (`type`, `slug`). |
| `site_settings` | Editable text: hotline, email, hours, social links, mandate, vision, mission, DPO name and email | Key/value. |
| `programs` | Programs and services | English and Filipino title, summary, rich-text description, eligibility (one per line), featured flag. |
| `program_requirements`, `program_steps` | Ordered lists for each program | Replaced as a set when the program is saved. |
| `news_articles` | News | Excerpt, rich-text body, optional cover photo with required description, `published_at`. |
| `announcements` | Short notices with a start and end date | Shown only between the dates; pinned first. |
| `downloads` | Files: forms, reports, budgets, issuances | Category, year, size, optional program link. |
| `offices` | Office directory | Region code, address, phone, email, hours. |
| `faqs` | Questions and answers | Grouped by topic category. |
| `officials` | Officials on the About page | Optional photo, sort order. |
| `feedback` | Messages from the contact form | **Personal data.** Reference number, type, status, consent time. |
| `audit_logs` | Who did what and when | Sign-ins, failed sign-ins, creates, updates, publishing, deletes, feedback views, purges. |
| `rate_limits` | Counters for sign-in and feedback limits | Keys are HMAC hashes; raw IP addresses are never stored. |

Conventions:

- **Draft and published.** Every content table has `status` (`draft` or
  `published`) and `deleted_at`. The public site and the API show a row only when
  `status = 'published' AND deleted_at IS NULL` (news also needs `published_at <= NOW()`).
- **Soft delete.** Deleting content sets `deleted_at`. The row stays in the
  database and in backups, so it can be recovered.
- **No beneficiary or case records.** The database holds website content and
  website feedback only. Do not add tables for applicants, beneficiaries or cases.

## 2. Install on XAMPP

Tested with XAMPP 8.2 (PHP 8.2.12, MariaDB 10.4.32) on Windows 11. MySQL 8 works too.

1. Install XAMPP. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Put the site in `C:\xampp\htdocs\SLP\dswd`.
3. Create the database and load the sample content (Command Prompt):

   ```bat
   cd C:\xampp\htdocs\SLP\dswd
   C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
   C:\xampp\mysql\bin\mysql.exe -u root dswd_website < database\seed.sql
   ```

4. Create `config\config.local.php`. It overrides `config\config.php` and must
   never be shared, emailed or committed:

   ```php
   <?php
   return [
       'db_user' => 'dswd_app',            // see section 4; 'root' only on a local test machine
       'db_pass' => 'the database password',
       'app_secret' => 'paste 64 random hex characters here',
   ];
   ```

   Make the secret with:

   ```bat
   C:\xampp\php\php.exe -r "echo bin2hex(random_bytes(32));"
   ```

5. Build the minified CSS and JS (run it again after any CSS or JS change;
   until then the pages use the source files):

   ```bat
   C:\xampp\php\php.exe tools\build-assets.php
   ```

6. Open <http://localhost/SLP/dswd/> (public site) and
   <http://localhost/SLP/dswd/admin/> (staff dashboard).

Apache needs `AllowOverride All` for the site folder (the XAMPP default for
`htdocs`) because the `.htaccess` files block `config/`, `includes/`, `database/`,
`docs/` and `tests/`, and stop scripts from running in `uploads/`. Check it:
<http://localhost/SLP/dswd/config/config.php> must answer **403 Forbidden**.

## 3. First sign-in and the default administrator

`seed.sql` creates one super administrator:

- Email: `admin@dswd.local`
- Temporary password: `Change-Me-2026!`

At the first sign-in the site sends this account to **Change password** and
blocks every other page until a new password is set (at least 12 characters; a
short sentence works well). Then:

1. Open **Users** and add an account for each staff member with the lowest role
   they need (section 6). The site shows a one-time temporary password; give it
   to the person in person or by phone, never by email or chat. They must change
   it at their first sign-in.
2. Add at least one more super administrator, sign in as that person, and
   deactivate `admin@dswd.local` (or change its email to a real, monitored address).
3. Open **Site settings** and replace every `[bracketed]` value: hotline, email,
   office hours, social media links, mandate, vision, mission, Data Protection
   Officer name and email.

A forgotten password: a super administrator opens **Users**, chooses the person
and selects **Reset password**. The person gets a new temporary password and must
change it at the next sign-in.

## 4. Database accounts (least privilege)

The website should connect with an account that can only read and change rows in
`dswd_website`; it never needs to create or drop tables. Backups use a separate
read-only account. Run as the MySQL root user:

```sql
CREATE USER 'dswd_app'@'localhost' IDENTIFIED BY 'long-random-password-1';
CREATE USER 'dswd_app'@'127.0.0.1' IDENTIFIED BY 'long-random-password-1';
GRANT SELECT, INSERT, UPDATE, DELETE ON dswd_website.* TO 'dswd_app'@'localhost', 'dswd_app'@'127.0.0.1';

CREATE USER 'dswd_backup'@'localhost' IDENTIFIED BY 'long-random-password-2';
GRANT SELECT, LOCK TABLES, SHOW VIEW, TRIGGER ON dswd_website.* TO 'dswd_backup'@'localhost';
FLUSH PRIVILEGES;
```

Then put `dswd_app` and its password in `config\config.local.php`, and give the
MySQL `root` account a password (XAMPP ships it empty).

**This development machine:** `CREATE USER` and `GRANT` currently fail because two
MariaDB system tables are damaged ("Index for table 'db' is corrupt"). The site
therefore uses `root` with no password locally. Two half-created accounts,
`dswd_app@localhost` and `dswd_app@127.0.0.1`, exist with no rights. To fix it:

1. Stop MySQL in the XAMPP Control Panel and copy `C:\xampp\mysql\data\mysql` somewhere safe.
2. Start MySQL and run:

   ```sql
   REPAIR TABLE mysql.db, mysql.proxies_priv;
   FLUSH PRIVILEGES;
   DROP USER IF EXISTS 'dswd_app'@'localhost', 'dswd_app'@'127.0.0.1';
   ```

3. Run the `CREATE USER` and `GRANT` statements above.

## 5. Backups and restore

`database\backup.bat` saves the database and the `uploads` folder into a dated
folder, for example `C:\dswd-backups\2026-10-13_0200\`, and removes backup folders
older than 30 days, but only after a successful backup.

**Set up once:**

1. Create `C:\dswd-backups` and allow only administrators to read it. Backups
   contain personal data from the feedback form.
2. Create `C:\dswd-backups\backup.cnf` with the backup account:

   ```ini
   [client]
   user=dswd_backup
   password=long-random-password-2
   ```

   Without this file the script signs in as `root` with no password, which works
   only on a local XAMPP install.
3. Schedule it every day at 2:00 AM (Command Prompt as administrator):

   ```bat
   schtasks /create /tn "DSWD website backup" /tr "C:\xampp\htdocs\SLP\dswd\database\backup.bat" /sc daily /st 02:00 /ru SYSTEM
   ```

4. Every week, copy the newest backup to encrypted storage away from the server.
5. Keep a copy of `config\config.local.php` in the office password manager; it is
   not part of the backup.

Options: set `BACKUP_ROOT`, `KEEP_DAYS` or `XAMPP` as environment variables to
change the folder, how long backups are kept, or the XAMPP location.

**Restore** (replace the folder name with the backup you need):

1. Stop visitors from changing data: stop Apache, or restore during a quiet hour.
2. Restore the database:

   ```bat
   C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS dswd_website CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   C:\xampp\mysql\bin\mysql.exe -u root dswd_website < C:\dswd-backups\2026-10-13_0200\dswd_website.sql
   ```

   The dump replaces each table it contains with the backed-up version.
3. Restore the uploaded files (this also restores `uploads\.htaccess`):

   ```bat
   robocopy C:\dswd-backups\2026-10-13_0200\uploads C:\xampp\htdocs\SLP\dswd\uploads /E
   ```

4. Start Apache, sign in to `/admin`, and check a news article, a download and the
   feedback list.

Practise a restore every three months on a test machine. The procedure above was
tested on 2026-10-13: every table restored with matching row counts.

Recover one deleted item without a full restore: deleted content keeps its row
with `deleted_at` set. A super administrator with database access can run, for
example, `UPDATE news_articles SET deleted_at = NULL WHERE id = 12;`.

## 6. Roles and permissions

Give each person the lowest role that covers their work.

| What they can do | Viewer | Editor | Publisher | Super administrator |
|---|:-:|:-:|:-:|:-:|
| See all content in the dashboard | Yes | Yes | Yes | Yes |
| Add content and change drafts | | Yes | Yes | Yes |
| Delete drafts | | Yes | Yes | Yes |
| Publish, unpublish, change or delete published content | | | Yes | Yes |
| Manage categories | | | Yes | Yes |
| Read and update feedback (personal data) | | | Yes | Yes |
| Permanently delete a feedback message | | | | Yes |
| Users, site settings, audit log | | | | Yes |

Pages check the role on the server for every request; hiding a button is not the
only protection. A role change takes effect at the person's next page load.

## 7. Staff guide: managing content

**Signing in.** Go to `/admin`. After 5 wrong passwords in 15 minutes, sign-in
for that email address is paused on that connection; wait 15 minutes. The session ends after 30 minutes
without activity. Always select **Sign out** on a shared computer.

**Adding something.** Open the section in the left menu (for example **News**)
and select **Add article**. Fields marked "(required)" must be filled in. Select
**Save**. New items are saved as **drafts**, which visitors cannot see.

**Publishing.** A publisher opens the draft and selects **Publish**. It appears
on the website at once. **Unpublish** hides
it again without deleting it. Editors can change drafts but not published items:
ask a publisher to unpublish first.

**Deleting.** Open the item and select **Delete**, then confirm. It disappears
from the website and the dashboard but stays in the database and backups.

**Writing for the website.**
- Use plain words and short sentences. Put the most important point first.
- Use the editor's **Heading** button for section titles, and lists for steps
  and requirements. Do not use bold text as a heading.
- Make link text say where it goes ("Download the application form"), not "click here".
- Program titles have a Filipino field; fill it in when a translation is approved.
- Write one requirement or step per line in "What to bring" and "How to apply".

**Photos and files.**
- Photos: JPG or PNG, up to 2 MB and 1600 pixels on the longest side. The
  dashboard makes bigger photos smaller before they upload; if it asks you for a
  smaller image, resize the photo first. Files: PDF, JPG or PNG, up to 10 MB.
- The website removes location, camera and owner details from photos when you
  upload them. Still, check that a photo shows nothing private (addresses, IDs, faces
  of beneficiaries who did not agree to be photographed).
- Always describe a cover photo for people who cannot see it ("Volunteers packing
  relief goods in a warehouse"). The site asks for it.
- Uploaded files get a new random name. The **Title** is what visitors see.
- Do not upload documents with personal data (lists of beneficiaries, IDs,
  case files). The website is public.

**Announcements** show only between their start and end dates. Pin one to show it first.

**Feedback** (publishers and super administrators). Each message has a reference
number such as `FB-20261013-7K2Q9X`; quote it when replying to the sender. Set the
status as you work: New, In progress, Resolved, Closed. Opening a message is
recorded in the audit log. Resolved and closed messages are deleted automatically
365 days after their last update (section 12). If a sender asks for their data to
be deleted, a super administrator can delete the message permanently.

**Audit log** (super administrators) lists sign-ins, failed sign-ins and every
change, with the person and time. Check it monthly and after any incident.

## 8. JSON API

Read-only endpoints return published content only and may be cached for 5 minutes.

| Endpoint | Parameters | Returns |
|---|---|---|
| `GET api/programs.php` | `q`, `kind` (program or service), `category`, or `slug` for one | Programs; one program with requirements, steps and forms |
| `GET api/news.php` | `q`, `category`, `page` (10 per page), or `slug` for one | News list; one article with its body |
| `GET api/downloads.php` | `q`, `category`, `year`, `page` (20 per page) | Files with links and sizes |
| `GET api/offices.php` | `region` | Offices |
| `GET api/faqs.php` | none | Questions grouped by topic |
| `GET api/feedback.php` | none | `{"csrf_token": "…"}` for this site's own pages |
| `POST api/feedback.php` | JSON or form fields: `type`, `name`, `email`, `mobile`, `subject`, `message`, `consent`; header `X-CSRF-Token` | 201 `{"reference_no"}`, 422 `{"errors"}`, 429 too many, 403 bad token |

Add `lang=fil` for Filipino messages and program titles. There is no
cross-origin access (no CORS headers), so only this website can post feedback.

## 9. Security and privacy measures

| Area | Measure | Where |
|---|---|---|
| Passwords | Argon2id, at least 12 characters, rehashed when settings change, forced change for temporary passwords | `includes/auth.php`, `admin/change-password.php` |
| Sign-in | Same message for wrong email and wrong password, equal timing for unknown emails, 5 tries per 15 minutes per email and IP, new session ID after sign-in, 30-minute idle timeout, sign-out by POST only | `includes/auth.php` |
| Session cookie | `HttpOnly`, `SameSite=Strict`, `Secure` on HTTPS, strict mode | `includes/functions.php` |
| SQL injection | PDO prepared statements only; table and column names come from code, never from the request | `config/db.php`, `includes/admin-crud.php` |
| XSS | Every value escaped with `e()`; rich text cleaned by an allow-list on save; Content-Security-Policy | `includes/richtext.php`, `includes/bootstrap.php` |
| CSRF | Token on every form and on `POST api/feedback.php` | `includes/csrf.php` |
| Uploads | PDF, JPG and PNG only, checked by content (not the extension), size limits, images at most 1600 pixels, photo metadata (GPS position, device, owner) removed, random file names, no script execution or directory listing in `uploads/` | `includes/upload.php`, `uploads/.htaccess` |
| Abuse | Sign-in and feedback rate limits stored as HMAC hashes | `includes/functions.php` |
| Exposure | `config/`, `includes/`, `database/`, `docs/`, `tests/` blocked; `.sql`, `.bak`, `.log`, `.ini`, `.bat`, `.md` files blocked; dot-files return 404; no directory listings; admin pages `noindex` and `no-store` | `.htaccess` files |
| Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, CSP, HSTS over HTTPS; no `X-Powered-By` | `includes/bootstrap.php` |
| Data Privacy Act (R.A. 10173) | Privacy notice and consent on the form; only name, email, optional mobile and message collected; feedback visible to publishers and super administrators only; views audited; automatic deletion after the retention period; no beneficiary or case records | `contact.php`, `privacy.php`, `admin/feedback.php` |

## 10. Going live

The final pre-launch checklist is in [phase-4-audit.md](phase-4-audit.md#6-pre-launch-checklist).
It includes everything that used to be listed here.

## 11. Automated checks

With Apache and MySQL running, from `C:\xampp\htdocs\SLP`:

```bat
node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/site-check.js
node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/admin-check.js
```

`admin-check.js` needs the local test accounts (`database\seed-test-users.sql`,
local machines only). It signs in with each role and checks sign-in limits,
cookies, permissions, the draft and publish flow, rich-text cleaning, CSRF,
uploads, forced password changes, the audit log, the feedback form and API, and
the retention purge. It removes the sample data of its previous run.

Results at the end of phase 3: site 127/127, admin 19/19, design-system preview 46/46.
Phase 4 results (more checks, Edge too) are in [phase-4-audit.md](phase-4-audit.md).

## 12. Decisions to confirm

Made without asking during phase 3; each is easy to change.

1. **MariaDB 10.4** (bundled with XAMPP) instead of MySQL 8. The schema runs on both.
2. **Feedback retention: 365 days** after a message is resolved or closed, then
   automatic deletion (runs when staff open the dashboard). Open messages are
   never deleted automatically. The privacy notices show the same number. Set
   `feedback_retention_days` in `config.local.php` once the DPO confirms it.
3. **Four roles** (viewer, editor, publisher, super administrator). Feedback is
   personal data, so editors and viewers cannot see it.
4. **Content is deleted softly; feedback is deleted permanently**, so erasure
   requests under the Data Privacy Act can be honoured.
5. **Content is in English**, with an optional Filipino title for programs. Page
   labels and messages switch fully between English and Filipino. The admin is English only.
6. **Rich text is limited** to paragraphs, two heading levels, bold, italic,
   lists, quotes and links. Articles have one cover photo; photos inside the text
   are not supported.
7. **Uploaded files are renamed** to random names; visitors see the title instead.
8. **Backups are kept 30 days** in `C:\dswd-backups`. The script does not
   encrypt them; the offsite copy should be encrypted.
9. **Rate limits use the database**, not a cache server: 5 sign-in tries per 15
   minutes and 5 feedback messages per hour.
