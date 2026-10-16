-- SLP Monitoring System - MySQL schema for XAMPP
-- Import this file in phpMyAdmin (http://localhost/phpmyadmin)

CREATE DATABASE IF NOT EXISTS slp_monitoring
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE slp_monitoring;

-- -------------------------------------------------------------
-- Users (login accounts)
-- Passwords below are password_hash() of: admin123, leader123, member123
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('MSWDO Personnel', 'Beneficiary Leader', 'Beneficiary Member') NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Beneficiaries
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beneficiaries (
  id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  livelihood VARCHAR(150) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  location VARCHAR(150) NOT NULL,
  household_information TEXT NULL,
  linked_username VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (linked_username)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Projects
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  leader VARCHAR(150) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Ongoing',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Monitoring records
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitoring (
  id VARCHAR(20) PRIMARY KEY,
  beneficiary VARCHAR(150) NOT NULL,
  visit_date DATE NOT NULL,
  progress VARCHAR(50) NOT NULL,
  issue VARCHAR(255) NOT NULL DEFAULT 'None',
  recommendation TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Assistance records
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assistance (
  id VARCHAR(20) PRIMARY KEY,
  recipient VARCHAR(150) NOT NULL,
  support_type VARCHAR(100) NOT NULL,
  assistance_date DATE NOT NULL,
  amount VARCHAR(50) NOT NULL DEFAULT '—',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Reports
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(20) PRIMARY KEY,
  report_type VARCHAR(100) NOT NULL,
  report_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Documents
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  doc_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'For Review',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Notifications
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  notify_date DATE NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- SLP eligibility / profile forms (JSON blob per beneficiary user)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  username VARCHAR(50) PRIMARY KEY,
  profile_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Seed demo users
-- password_hash for admin123 / leader123 / member123 (PASSWORD_DEFAULT)
-- Generated with PHP password_hash; re-run setup if needed.
-- -------------------------------------------------------------
INSERT INTO users (username, password_hash, role, full_name, status) VALUES
('admin', '$2y$10$92IXZpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'MSWDO Personnel', 'MSWDO Personnel', 'Active'),
('leader', '$2y$10$92IXZpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Beneficiary Leader', 'Beneficiary Leader', 'Active'),
('member', '$2y$10$92IXZpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Beneficiary Member', 'Beneficiary Member', 'Active')
ON DUPLICATE KEY UPDATE username = username;

-- NOTE: The hash above is Laravel's well-known hash for "password", NOT the demo passwords.
-- Use database/seed_passwords.php once after import to set admin123/leader123/member123 correctly,
-- OR import via php/install.php which creates users with the correct hashes.

INSERT INTO beneficiaries (id, first_name, last_name, name, livelihood, status, location, household_information, linked_username) VALUES
('B-001', 'Maria', 'Santos', 'Maria Santos', 'Community Store', 'Active', 'Lubang', 'Household of 4', 'leader'),
('B-002', 'Juan', 'Dela Cruz', 'Juan Dela Cruz', 'Poultry Raising', 'Active', 'Tilik', 'Household of 3', 'member'),
('B-003', 'Ana', 'Reyes', 'Ana Reyes', 'Food Vending', 'For Monitoring', 'Arawat', NULL, NULL),
('B-004', 'Pedro', 'Garcia', 'Pedro Garcia', 'Fishing', 'Completed', 'Cabra', NULL, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO projects (id, name, leader, status) VALUES
('P-001', 'Community Store', 'Maria Santos', 'Ongoing'),
('P-002', 'Poultry Raising', 'Juan Dela Cruz', 'Ongoing'),
('P-003', 'Food Vending', 'Ana Reyes', 'For Monitoring')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO monitoring (id, beneficiary, visit_date, progress, issue, recommendation) VALUES
('M-001', 'Maria Santos', '2026-09-15', 'Good', 'None', 'Continue monitoring'),
('M-002', 'Ana Reyes', '2026-09-18', 'Needs Follow-up', 'Incomplete sales record', 'Submit updated record')
ON DUPLICATE KEY UPDATE beneficiary = VALUES(beneficiary);

INSERT INTO assistance (id, recipient, support_type, assistance_date, amount) VALUES
('A-001', 'Maria Santos', 'Livelihood Capital', '2026-08-20', '₱10,000'),
('A-002', 'Juan Dela Cruz', 'Training Support', '2026-08-28', '₱5,000')
ON DUPLICATE KEY UPDATE recipient = VALUES(recipient);

INSERT INTO reports (id, report_type, report_date, status) VALUES
('R-001', 'Project Report', '2026-09-20', 'Submitted'),
('R-002', 'Progress Report', '2026-09-21', 'Submitted'),
('R-003', 'Status Report', '2026-09-22', 'For Review')
ON DUPLICATE KEY UPDATE report_type = VALUES(report_type);

INSERT INTO documents (name, doc_type, status) VALUES
('Beneficiary Profile - Maria Santos', 'Profile', 'Approved'),
('Project Proposal - Community Store', 'Project', 'Approved');

INSERT INTO notifications (title, message, notify_date, is_read) VALUES
('Monitoring Schedule', 'Maria Santos is scheduled for monitoring.', '2026-09-23', 0),
('Correction Request', 'Ana Reyes has an incomplete project record.', '2026-09-22', 0);
