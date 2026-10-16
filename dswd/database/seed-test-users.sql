-- =====================================================================
-- LOCAL TESTING ONLY. Never load this file on a server the public can reach.
-- One account per role for the automated checks (tests/admin-check.js).
-- Password for all four: Test-Only-Pass-2026  (no forced change, for tests)
-- Remove before launch:  DELETE FROM users WHERE email LIKE '%@dswd.test';
-- =====================================================================
USE dswd_website;

INSERT INTO users (name, email, password_hash, role_id, is_active, must_change_password) VALUES
    ('Test Super Admin', 'super@dswd.test', '$argon2id$v=19$m=65536,t=4,p=1$cS82aGdubHRBSDA2R2JGeA$FHLui1RONQVCfuTA3JJVS4fC+OaFykp9APGDhPIU1qA', 1, 1, 0),
    ('Test Publisher', 'publisher@dswd.test', '$argon2id$v=19$m=65536,t=4,p=1$cS82aGdubHRBSDA2R2JGeA$FHLui1RONQVCfuTA3JJVS4fC+OaFykp9APGDhPIU1qA', 2, 1, 0),
    ('Test Editor', 'editor@dswd.test', '$argon2id$v=19$m=65536,t=4,p=1$cS82aGdubHRBSDA2R2JGeA$FHLui1RONQVCfuTA3JJVS4fC+OaFykp9APGDhPIU1qA', 3, 1, 0),
    ('Test Viewer', 'viewer@dswd.test', '$argon2id$v=19$m=65536,t=4,p=1$cS82aGdubHRBSDA2R2JGeA$FHLui1RONQVCfuTA3JJVS4fC+OaFykp9APGDhPIU1qA', 4, 1, 0);
