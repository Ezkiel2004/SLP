-- SLP Information and Monitoring System: schema.
-- Source: docs/superpowers/specs/2026-10-13-slp-database-schema-design.md, section 5.
-- The database itself is created by database/install.php.


-- =============================================================
-- People and groups
-- =============================================================

-- The 16 barangays of Lubang (seeded once; names per the DBM barangay list).
CREATE TABLE barangays (
  id           TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(60) NOT NULL,
  is_poblacion TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barangays_name (name)
) ENGINE=InnoDB;

-- Poultry, Sari-sari Store, Piggery, ... Managed by staff. The unicode_ci collation
-- makes the name unique regardless of case, so "piggery" cannot be added twice.
CREATE TABLE livelihood_types (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_livelihood_types_name (name)
) ENGINE=InnoDB;

-- One row per SLP Association. Every participant-visible record is scoped to one of these.
CREATE TABLE associations (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(150) NOT NULL,     -- e.g. "Tilik Poultry Raisers SLPA"
  livelihood_type_id  INT UNSIGNED NOT NULL,     -- the association's main livelihood
  barangay_id         TINYINT UNSIGNED NOT NULL,
  leader_id           INT UNSIGNED NULL,         -- beneficiaries.id of the current leader
  status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_associations_name (name),
  UNIQUE KEY uq_associations_leader (leader_id),                          -- one person leads at most one association
  UNIQUE KEY uq_associations_barangay_type (barangay_id, livelihood_type_id),  -- D3c
  KEY ix_associations_type (livelihood_type_id),
  CONSTRAINT fk_associations_type     FOREIGN KEY (livelihood_type_id) REFERENCES livelihood_types (id),
  CONSTRAINT fk_associations_barangay FOREIGN KEY (barangay_id)        REFERENCES barangays (id)
) ENGINE=InnoDB;

-- The registry row and the profile record in one.
-- The name, sex, birthday, barangay, contact number and participant type columns are
-- copied from the latest profile version in the same transaction. Only non-empty values
-- are copied, so a blank form field never wipes the registry.
CREATE TABLE beneficiaries (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  association_id         INT UNSIGNED NULL,          -- NULL = individual track
  first_name             VARCHAR(100) NOT NULL,
  middle_name            VARCHAR(100) NULL,
  last_name              VARCHAR(100) NOT NULL,
  extension_name         VARCHAR(20)  NULL,
  sex                    ENUM('male','female') NULL,
  birthday               DATE NULL,
  barangay_id            TINYINT UNSIGNED NOT NULL,  -- where the person lives
  contact_no             VARCHAR(20)  NULL,
  participant_type       ENUM('4ps','non_4ps') NULL,
  enrollment_status      ENUM('applicant','active','for_monitoring','completed','inactive') NOT NULL DEFAULT 'active',
  household_information  TEXT NULL,          -- staff note from the registry form
  profile_status         ENUM('draft','submitted','verified') NOT NULL DEFAULT 'draft',
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_beneficiaries_id_association (id, association_id),  -- target of fk_associations_leader
  KEY ix_beneficiaries_association (association_id, last_name, first_name),
  KEY ix_beneficiaries_name (last_name, first_name),
  CONSTRAINT fk_beneficiaries_association FOREIGN KEY (association_id) REFERENCES associations (id),
  CONSTRAINT fk_beneficiaries_barangay    FOREIGN KEY (barangay_id)    REFERENCES barangays (id)
) ENGINE=InnoDB;

-- A leader must be a member of the association they lead.
-- It also blocks moving a leader to another association until a new leader is named.
ALTER TABLE associations
  ADD CONSTRAINT fk_associations_leader
  FOREIGN KEY (leader_id, id) REFERENCES beneficiaries (id, association_id);

-- Microenterprises (Annex AA "New / Additional Enterprise"). An association may run more
-- than one. An individual-track beneficiary owns their project directly. Exactly one owner.
CREATE TABLE projects (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  association_id      INT UNSIGNED NULL,
  beneficiary_id      INT UNSIGNED NULL,
  livelihood_type_id  INT UNSIGNED NOT NULL,
  name                VARCHAR(150) NOT NULL,
  status              ENUM('ongoing','for_monitoring','completed') NOT NULL DEFAULT 'ongoing',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_projects_association (association_id),
  KEY ix_projects_beneficiary (beneficiary_id),
  CONSTRAINT fk_projects_association FOREIGN KEY (association_id)     REFERENCES associations (id),
  CONSTRAINT fk_projects_beneficiary FOREIGN KEY (beneficiary_id)     REFERENCES beneficiaries (id),
  CONSTRAINT fk_projects_type        FOREIGN KEY (livelihood_type_id) REFERENCES livelihood_types (id),
  CONSTRAINT ck_projects_one_owner CHECK ((association_id IS NULL) <> (beneficiary_id IS NULL))
) ENGINE=InnoDB;

CREATE TABLE users (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username              VARCHAR(50)  NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,      -- PHP password_hash()
  role                  ENUM('staff','participant') NOT NULL,
  beneficiary_id        INT UNSIGNED NULL,
  full_name             VARCHAR(150) NULL,          -- staff only; participants use their beneficiary name
  status                ENUM('registering','pending','active','rejected','inactive') NOT NULL DEFAULT 'active',
  review_note           VARCHAR(500) NULL,          -- reason shown to a rejected applicant
  submitted_at          DATETIME NULL,              -- last time the eligibility form was submitted
  must_change_password  TINYINT(1) NOT NULL DEFAULT 1,
  failed_logins         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until          DATETIME NULL,
  last_login_at         DATETIME NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_beneficiary (beneficiary_id),   -- one account per participant
  CONSTRAINT fk_users_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id),
  CONSTRAINT ck_users_role_shape CHECK (
       (role = 'staff'       AND beneficiary_id IS NULL     AND full_name IS NOT NULL)
    OR (role = 'participant' AND beneficiary_id IS NOT NULL AND full_name IS NULL)),
  CONSTRAINT ck_users_rejected_note CHECK (status <> 'rejected' OR review_note IS NOT NULL),
  -- Only participants go through registration; staff are created active by staff.
  CONSTRAINT ck_users_staff_active  CHECK (role = 'participant' OR status IN ('active','inactive'))
) ENGINE=InnoDB;

-- The one place the app reads a signed-in user's effective role from.
CREATE VIEW user_roles AS
SELECT u.id AS user_id,
       CASE WHEN u.role = 'staff' THEN 'staff'
            WHEN a.id IS NOT NULL THEN 'leader'
            ELSE 'member' END AS role,
       u.beneficiary_id,
       b.association_id
FROM users u
LEFT JOIN beneficiaries b ON b.id = u.beneficiary_id
LEFT JOIN associations  a ON a.leader_id = u.beneficiary_id;

-- =============================================================
-- Profile (Annex G.1)
-- =============================================================

-- Items 1–24 plus the household rows. Participants and staff write here.
CREATE TABLE profile_versions (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  beneficiary_id  INT UNSIGNED NOT NULL,
  version_no      SMALLINT UNSIGNED NOT NULL,
  data            JSON NOT NULL,
  reason          VARCHAR(255) NULL,          -- required (app) when staff saves
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profile_versions (beneficiary_id, version_no),
  CONSTRAINT fk_profile_versions_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id),
  CONSTRAINT fk_profile_versions_user        FOREIGN KEY (created_by)     REFERENCES users (id)
) ENGINE=InnoDB;

-- Items 25–29 plus the reference slip. Staff only. Kept in its own table, so a
-- participant's save cannot touch it by construction.
CREATE TABLE eligibility_assessments (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  beneficiary_id      INT UNSIGNED NOT NULL,
  version_no          SMALLINT UNSIGNED NOT NULL,
  overall_assessment  ENUM('qualified','not_qualified') NULL,
  track               ENUM('association','individual','employment') NULL,
  data                JSON NOT NULL,
  reason              VARCHAR(255) NULL,      -- required (app) from version 2 onwards
  created_by          INT UNSIGNED NOT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_eligibility_assessments (beneficiary_id, version_no),
  CONSTRAINT fk_eligibility_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id),
  CONSTRAINT fk_eligibility_user        FOREIGN KEY (created_by)     REFERENCES users (id)
) ENGINE=InnoDB;

-- =============================================================
-- Documents sent to the MSWDO
-- =============================================================

-- Exactly one owner. An association document is visible to the whole association;
-- a personal document is visible only to that person and to staff.
CREATE TABLE documents (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  association_id  INT UNSIGNED NULL,
  beneficiary_id  INT UNSIGNED NULL,
  title           VARCHAR(200) NOT NULL,
  category        ENUM('profile','project','progress','other') NOT NULL,
  status          ENUM('for_review','approved','returned') NOT NULL DEFAULT 'for_review',
  review_note     VARCHAR(500) NULL,          -- why the MSWDO returned it; shown to the leader
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_documents_association (association_id, status),
  KEY ix_documents_beneficiary (beneficiary_id),
  CONSTRAINT fk_documents_association FOREIGN KEY (association_id) REFERENCES associations (id),
  CONSTRAINT fk_documents_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id),
  CONSTRAINT fk_documents_user        FOREIGN KEY (created_by)     REFERENCES users (id),
  CONSTRAINT ck_documents_one_owner     CHECK ((association_id IS NULL) <> (beneficiary_id IS NULL)),
  CONSTRAINT ck_documents_returned_note CHECK (status <> 'returned' OR review_note IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE document_versions (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id    INT UNSIGNED NOT NULL,
  version_no     SMALLINT UNSIGNED NOT NULL,
  file_path      VARCHAR(255) NOT NULL,       -- relative to storage/; never served directly
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  sha256         CHAR(64) NOT NULL,
  reason         VARCHAR(255) NULL,           -- required (app) for staff versions and re-sends
  created_by     INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_versions (document_id, version_no),
  UNIQUE KEY uq_document_versions_path (file_path),
  CONSTRAINT fk_document_versions_document FOREIGN KEY (document_id) REFERENCES documents (id),
  CONSTRAINT fk_document_versions_user     FOREIGN KEY (created_by)  REFERENCES users (id),
  CONSTRAINT ck_document_versions_sha CHECK (sha256 REGEXP '^[0-9a-f]{64}$')
) ENGINE=InnoDB;

-- =============================================================
-- Monitoring tools: Annex AA, AC (leader) and AF.1 (staff)
-- =============================================================

-- One row per filled-in form. AA and AC are filled in at every monitoring visit,
-- so an association builds up many rows over time.
CREATE TABLE tool_submissions (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tool            ENUM('aa','ac','af1') NOT NULL,
  association_id  INT UNSIGNED NOT NULL,
  visit_date      DATE NULL,
  status          ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
  submitted_at    DATETIME NULL,
  total_score     DECIMAL(6,2) NULL,          -- copied from the latest version, for reports
  level           ENUM('level_1','level_2','level_3') NULL,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_tool_submissions_association (association_id, tool, status),
  CONSTRAINT fk_tool_submissions_association FOREIGN KEY (association_id) REFERENCES associations (id),
  CONSTRAINT fk_tool_submissions_user        FOREIGN KEY (created_by)     REFERENCES users (id),
  CONSTRAINT ck_tool_submissions_submitted CHECK ((status = 'submitted') = (submitted_at IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE tool_submission_versions (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id  INT UNSIGNED NOT NULL,
  version_no     SMALLINT UNSIGNED NOT NULL,
  data           JSON NOT NULL,
  reason         VARCHAR(255) NULL,           -- required (app) when staff edits a submitted form
  created_by     INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tool_submission_versions (submission_id, version_no),
  CONSTRAINT fk_tool_versions_submission FOREIGN KEY (submission_id) REFERENCES tool_submissions (id),
  CONSTRAINT fk_tool_versions_user       FOREIGN KEY (created_by)    REFERENCES users (id)
) ENGINE=InnoDB;

-- =============================================================
-- Staff records (not versioned; changes go to the audit log)
-- =============================================================

CREATE TABLE monitoring_visits (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  beneficiary_id  INT UNSIGNED NOT NULL,
  visit_date      DATE NOT NULL,
  progress        ENUM('good','needs_follow_up','completed') NOT NULL,
  issue           VARCHAR(255) NULL,
  recommendation  TEXT NOT NULL,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_monitoring_beneficiary (beneficiary_id, visit_date),
  CONSTRAINT fk_monitoring_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id),
  CONSTRAINT fk_monitoring_user        FOREIGN KEY (created_by)     REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE assistance (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  beneficiary_id  INT UNSIGNED NOT NULL,
  support_type    ENUM('livelihood_capital','training_support','equipment','other') NOT NULL,
  release_date    DATE NOT NULL,
  amount          DECIMAL(12,2) NULL,         -- pesos; NULL = non-cash support
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_assistance_beneficiary (beneficiary_id, release_date),
  CONSTRAINT fk_assistance_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id),
  CONSTRAINT fk_assistance_user        FOREIGN KEY (created_by)     REFERENCES users (id),
  CONSTRAINT ck_assistance_amount CHECK (amount IS NULL OR amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE reports (
  id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_type               ENUM('project','progress','status','beneficiary_status','accomplishment') NOT NULL,
  period                    VARCHAR(50) NOT NULL,
  details                   TEXT NOT NULL,
  status                    ENUM('for_review','submitted') NOT NULL DEFAULT 'for_review',
  shared_with_participants  TINYINT(1) NOT NULL DEFAULT 0,
  created_by                INT UNSIGNED NOT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_reports_user FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT ck_reports_share_final CHECK (shared_with_participants = 0 OR status = 'submitted')
) ENGINE=InnoDB;

-- beneficiary_id NULL = sent to all participants.
CREATE TABLE notifications (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  beneficiary_id  INT UNSIGNED NULL,
  title           VARCHAR(150) NOT NULL,
  message         TEXT NOT NULL,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notifications_beneficiary (beneficiary_id, created_at),
  CONSTRAINT fk_notifications_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id),
  CONSTRAINT fk_notifications_user        FOREIGN KEY (created_by)     REFERENCES users (id)
) ENGINE=InnoDB;

-- Read state is per person, not one flag for everyone.
CREATE TABLE notification_reads (
  notification_id  INT UNSIGNED NOT NULL,
  user_id          INT UNSIGNED NOT NULL,
  read_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT fk_reads_notification FOREIGN KEY (notification_id) REFERENCES notifications (id),
  CONSTRAINT fk_reads_user         FOREIGN KEY (user_id)         REFERENCES users (id)
) ENGINE=InnoDB;

-- =============================================================
-- Audit log (every write, sign-in and sign-out)
-- =============================================================

CREATE TABLE audit_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id        INT UNSIGNED NULL,          -- NULL = not signed in (e.g. a failed login)
  action          VARCHAR(50)  NOT NULL,      -- e.g. document.submit, profile.verify
  entity_type     VARCHAR(30)  NULL,
  entity_id       INT UNSIGNED NULL,
  association_id  INT UNSIGNED NULL,          -- set on association activity; feeds the members' view
  summary         VARCHAR(255) NOT NULL,      -- plain words; no personal data beyond names
  ip_address      VARCHAR(45)  NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_association (association_id, created_at),
  KEY ix_audit_entity (entity_type, entity_id),
  KEY ix_audit_actor (actor_id, created_at),
  CONSTRAINT fk_audit_actor       FOREIGN KEY (actor_id)       REFERENCES users (id),
  CONSTRAINT fk_audit_association FOREIGN KEY (association_id) REFERENCES associations (id)
) ENGINE=InnoDB;

-- =============================================================
-- History can be added to, never changed or removed
-- =============================================================

CREATE TRIGGER trg_profile_versions_bu BEFORE UPDATE ON profile_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'profile_versions is append-only';
CREATE TRIGGER trg_profile_versions_bd BEFORE DELETE ON profile_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'profile_versions is append-only';

CREATE TRIGGER trg_eligibility_bu BEFORE UPDATE ON eligibility_assessments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'eligibility_assessments is append-only';
CREATE TRIGGER trg_eligibility_bd BEFORE DELETE ON eligibility_assessments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'eligibility_assessments is append-only';

CREATE TRIGGER trg_document_versions_bu BEFORE UPDATE ON document_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'document_versions is append-only';
CREATE TRIGGER trg_document_versions_bd BEFORE DELETE ON document_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'document_versions is append-only';

CREATE TRIGGER trg_tool_versions_bu BEFORE UPDATE ON tool_submission_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tool_submission_versions is append-only';
CREATE TRIGGER trg_tool_versions_bd BEFORE DELETE ON tool_submission_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tool_submission_versions is append-only';

CREATE TRIGGER trg_audit_log_bu BEFORE UPDATE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
CREATE TRIGGER trg_audit_log_bd BEFORE DELETE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
