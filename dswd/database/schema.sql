-- =====================================================================
-- DSWD website database (phase 3)
-- MySQL 8 or MariaDB 10.4+ (XAMPP), InnoDB, utf8mb4.
--
-- Fresh install:   mysql -u root < database/schema.sql
--                  mysql -u root dswd_website < database/seed.sql
-- This file never drops anything. To start over, run
--   DROP DATABASE dswd_website;  (this deletes all content)
--
-- Conventions
-- - Content tables have status ('draft' | 'published') and deleted_at
--   (soft delete: NULL = live). The public site shows only
--   status = 'published' AND deleted_at IS NULL.
-- - The database holds website content and website feedback only. It
--   must never hold beneficiary or case records (Data Privacy Act).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS dswd_website CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dswd_website;
SET NAMES utf8mb4;

-- ---------- people and access ----------

CREATE TABLE IF NOT EXISTS roles (
    id    TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    name  VARCHAR(30)  NOT NULL,            -- super_admin, publisher, editor, viewer
    label VARCHAR(60)  NOT NULL,
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(120) NOT NULL,
    email                VARCHAR(190) NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    role_id              TINYINT UNSIGNED NOT NULL,
    is_active            TINYINT(1)   NOT NULL DEFAULT 1,
    must_change_password TINYINT(1)   NOT NULL DEFAULT 1,
    last_login           DATETIME     NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    KEY ix_users_role (role_id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- shared lookups ----------

CREATE TABLE IF NOT EXISTS categories (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    slug       VARCHAR(100) NOT NULL,
    type       ENUM('program', 'news', 'download', 'faq') NOT NULL,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    UNIQUE KEY uq_categories_type_slug (type, slug),
    KEY ix_categories_type (type, sort_order),
    CONSTRAINT ck_categories_slug CHECK (slug REGEXP '^[a-z0-9-]+$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Editable site text: contact details, mandate, privacy contacts.
CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(60)  NOT NULL PRIMARY KEY,
    label       VARCHAR(120) NOT NULL,
    value       TEXT         NOT NULL,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- programs and services ----------

CREATE TABLE IF NOT EXISTS programs (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug        VARCHAR(160) NOT NULL,
    kind        ENUM('program', 'service') NOT NULL DEFAULT 'program',
    title_en    VARCHAR(200) NOT NULL,
    title_fil   VARCHAR(200) NOT NULL DEFAULT '',
    summary     VARCHAR(300) NOT NULL,
    description TEXT         NOT NULL,          -- sanitized rich text (HTML subset)
    eligibility TEXT         NOT NULL,          -- one item per line
    category_id INT UNSIGNED NULL,
    is_featured TINYINT(1)   NOT NULL DEFAULT 0,
    status      ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME     NULL,
    UNIQUE KEY uq_programs_slug (slug),
    KEY ix_programs_status (status, deleted_at),
    KEY ix_programs_category (category_id),
    CONSTRAINT fk_programs_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT ck_programs_slug CHECK (slug REGEXP '^[a-z0-9-]+$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_requirements (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    program_id  INT UNSIGNED NOT NULL,
    requirement VARCHAR(300) NOT NULL,
    sort_order  SMALLINT     NOT NULL DEFAULT 0,
    KEY ix_requirements_program (program_id, sort_order),
    CONSTRAINT fk_requirements_program FOREIGN KEY (program_id) REFERENCES programs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_steps (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    program_id  INT UNSIGNED NOT NULL,
    step_no     SMALLINT     NOT NULL,
    instruction VARCHAR(500) NOT NULL,
    UNIQUE KEY uq_steps_program_no (program_id, step_no),
    CONSTRAINT fk_steps_program FOREIGN KEY (program_id) REFERENCES programs (id) ON DELETE CASCADE,
    CONSTRAINT ck_steps_no CHECK (step_no > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- news and announcements ----------

CREATE TABLE IF NOT EXISTS news_articles (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(160) NOT NULL,
    title        VARCHAR(200) NOT NULL,
    excerpt      VARCHAR(300) NOT NULL DEFAULT '',
    body         MEDIUMTEXT   NOT NULL,         -- sanitized rich text (HTML subset)
    cover_image  VARCHAR(255) NULL,             -- path under uploads/images
    cover_alt    VARCHAR(200) NOT NULL DEFAULT '',
    category_id  INT UNSIGNED NULL,
    author_id    INT UNSIGNED NULL,
    status       ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    published_at DATETIME     NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME     NULL,
    UNIQUE KEY uq_news_slug (slug),
    KEY ix_news_status_published (status, deleted_at, published_at),
    KEY ix_news_category (category_id),
    CONSTRAINT fk_news_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT fk_news_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_news_slug CHECK (slug REGEXP '^[a-z0-9-]+$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    body       TEXT         NOT NULL,
    starts_at  DATE         NOT NULL,
    ends_at    DATE         NOT NULL,
    is_pinned  TINYINT(1)   NOT NULL DEFAULT 0,
    status     ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME     NULL,
    KEY ix_announcements_live (status, deleted_at, starts_at, ends_at),
    CONSTRAINT ck_announcements_dates CHECK (ends_at >= starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- downloads, offices, FAQs, officials ----------

CREATE TABLE IF NOT EXISTS downloads (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    category_id INT UNSIGNED NULL,
    program_id  INT UNSIGNED NULL,              -- set when the file is a program's form
    file_path   VARCHAR(255) NOT NULL,
    year        SMALLINT     NOT NULL,
    file_size   INT UNSIGNED NOT NULL DEFAULT 0, -- bytes
    status      ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME     NULL,
    KEY ix_downloads_status (status, deleted_at),
    KEY ix_downloads_category (category_id),
    KEY ix_downloads_year (year),
    KEY ix_downloads_program (program_id),
    CONSTRAINT fk_downloads_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT fk_downloads_program FOREIGN KEY (program_id) REFERENCES programs (id) ON DELETE SET NULL,
    CONSTRAINT ck_downloads_year CHECK (year BETWEEN 1990 AND 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offices (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    region     VARCHAR(20)  NOT NULL,           -- region code, e.g. NCR, VII
    address    VARCHAR(300) NOT NULL,
    phone      VARCHAR(60)  NOT NULL DEFAULT '',
    email      VARCHAR(190) NOT NULL DEFAULT '',
    hours      VARCHAR(120) NOT NULL DEFAULT '',
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    status     ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME     NULL,
    KEY ix_offices_region (region, sort_order),
    KEY ix_offices_status (status, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faqs (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    question   VARCHAR(300) NOT NULL,
    answer     TEXT         NOT NULL,
    topic_id   INT UNSIGNED NULL,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    status     ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME     NULL,
    KEY ix_faqs_topic (topic_id, sort_order),
    KEY ix_faqs_status (status, deleted_at),
    CONSTRAINT fk_faqs_topic FOREIGN KEY (topic_id) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS officials (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    position   VARCHAR(200) NOT NULL,
    photo      VARCHAR(255) NULL,               -- path under uploads/images
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    status     ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME     NULL,
    KEY ix_officials_order (status, deleted_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- feedback (personal data: restricted access, retention) ----------

CREATE TABLE IF NOT EXISTS feedback (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reference_no VARCHAR(20)  NOT NULL,          -- e.g. FB-20261013-7K2Q9X
    type         ENUM('feedback', 'complaint', 'question') NOT NULL,
    name         VARCHAR(120) NOT NULL,
    email        VARCHAR(190) NOT NULL,
    mobile       VARCHAR(20)  NULL,
    subject      VARCHAR(150) NOT NULL,
    message      TEXT         NOT NULL,
    status       ENUM('new', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'new',
    consent_at   DATETIME     NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_feedback_reference (reference_no),
    KEY ix_feedback_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- audit and abuse protection ----------

CREATE TABLE IF NOT EXISTS audit_logs (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NULL,
    action     VARCHAR(40)  NOT NULL,           -- login, create, update, publish, unpublish, delete, …
    table_name VARCHAR(40)  NOT NULL DEFAULT '',
    record_id  INT UNSIGNED NULL,
    summary    VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_audit_created (created_at),
    KEY ix_audit_record (table_name, record_id),
    KEY ix_audit_user (user_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Counters for login and feedback rate limits. Keys are HMAC hashes, not raw IPs.
CREATE TABLE IF NOT EXISTS rate_limits (
    bucket       VARCHAR(100) NOT NULL PRIMARY KEY,
    hits         INT UNSIGNED NOT NULL DEFAULT 0,
    window_start DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
