-- Demo data: FICTIONAL people and records for the prototype (spec section 9).
-- Leave this file out at go-live. Loaded by `php database/install.php --demo`,
-- which first sets @pw_admin, @pw_leader, @pw_member, @pw_applicant (password_hash) and
-- @doc_sha, @doc_size (the SHA-256 and size of database/demo/placeholder.pdf).

SET @bagong_sikat   = (SELECT id FROM barangays WHERE name = 'Bagong Sikat');
SET @tilik          = (SELECT id FROM barangays WHERE name = 'Tilik');
SET @maliig         = (SELECT id FROM barangays WHERE name = 'Maliig');
SET @vigo           = (SELECT id FROM barangays WHERE name = 'Vigo');
SET @cabra          = (SELECT id FROM barangays WHERE name = 'Cabra');
SET @araw_at_bituin = (SELECT id FROM barangays WHERE name = 'Araw at Bituin');

SET @sari_sari    = (SELECT id FROM livelihood_types WHERE name = 'Sari-sari Store');
SET @poultry      = (SELECT id FROM livelihood_types WHERE name = 'Poultry Raising');
SET @piggery      = (SELECT id FROM livelihood_types WHERE name = 'Piggery');
SET @food_vending = (SELECT id FROM livelihood_types WHERE name = 'Food Vending');
SET @fishing      = (SELECT id FROM livelihood_types WHERE name = 'Fishing');

-- Associations: 5, each in its own barangay. Leaders are set after the beneficiaries exist.
INSERT INTO associations (id, name, livelihood_type_id, barangay_id) VALUES
  (1, 'Bagong Sikat Sari-sari Store SLPA', @sari_sari, @bagong_sikat),
  (2, 'Tilik Poultry Raisers SLPA',        @poultry,   @tilik),
  (3, 'Maliig Poultry Raisers SLPA',       @poultry,   @maliig),
  (4, 'Vigo Hog Raisers SLPA',             @piggery,   @vigo),
  (5, 'Cabra Fisherfolk SLPA',             @fishing,   @cabra);

-- Beneficiaries: 12. Ana Reyes (3) is on the individual track.
INSERT INTO beneficiaries (id, association_id, first_name, last_name, sex, barangay_id, enrollment_status) VALUES
  (1,  1,    'Maria',   'Santos',     'female', @bagong_sikat,   'active'),
  (2,  1,    'Juan',    'Dela Cruz',  'male',   @bagong_sikat,   'active'),
  (3,  NULL, 'Ana',     'Reyes',      'female', @araw_at_bituin, 'for_monitoring'),
  (4,  5,    'Pedro',   'Garcia',     'male',   @cabra,          'completed'),
  (5,  1,    'Liza',    'Bautista',   'female', @bagong_sikat,   'active'),
  (6,  2,    'Ramon',   'Villanueva', 'male',   @tilik,          'active'),
  (7,  2,    'Carmen',  'Aquino',     'female', @tilik,          'active'),
  (8,  3,    'Elena',   'Ramos',      'female', @maliig,         'active'),
  (9,  3,    'Jose',    'Mendoza',    'male',   @maliig,         'active'),
  (10, 4,    'Roberto', 'Castillo',   'male',   @vigo,           'active'),
  (11, 4,    'Teresa',  'Navarro',    'female', @vigo,           'active'),
  (12, 5,    'Mario',   'Flores',     'male',   @cabra,          'active');

UPDATE associations SET leader_id = CASE id WHEN 1 THEN 1 WHEN 2 THEN 6 WHEN 3 THEN 8 WHEN 4 THEN 10 WHEN 5 THEN 4 END;

-- Accounts: the three prototype demo logins.
INSERT INTO users (id, username, password_hash, role, beneficiary_id, full_name, must_change_password) VALUES
  (1, 'admin',  @pw_admin,  'staff',       NULL, 'MSWDO Personnel', 0),
  (2, 'leader', @pw_leader, 'participant', 1,    NULL,              0),
  (3, 'member', @pw_member, 'participant', 2,    NULL,              0);

INSERT INTO projects (id, association_id, beneficiary_id, livelihood_type_id, name, status) VALUES
  (1, 1,    NULL, @sari_sari,    'Bagong Sikat Sari-sari Store', 'ongoing'),
  (2, 2,    NULL, @poultry,      'Tilik Poultry Farm',           'ongoing'),
  (3, 3,    NULL, @poultry,      'Maliig Poultry Farm',          'for_monitoring'),
  (4, 4,    NULL, @piggery,      'Vigo Hog Farm',                'ongoing'),
  (5, 5,    NULL, @fishing,      'Cabra Fish Trading',           'completed'),
  (6, NULL, 3,    @food_vending, 'Reyes Food Stall',             'for_monitoring');

-- Documents. Association 1 is Maria's; association 2's document is uploaded by staff
-- and must stay invisible to association 1 (the separation demo).
INSERT INTO documents (id, association_id, beneficiary_id, title, category, status, review_note, created_by, created_at) VALUES
  (1, 1,    NULL, 'Project Proposal - Sari-sari Store',    'project',  'approved',   NULL, 2, '2026-09-12 10:00:00'),
  (2, 1,    NULL, 'Monthly Sales Record - September 2026', 'progress', 'returned',   'Page 2 is missing. Send the complete record.', 2, '2026-09-25 14:00:00'),
  (3, 2,    NULL, 'Attendance Sheet - Poultry Training',   'other',    'for_review', NULL, 1, '2026-10-01 09:30:00'),
  (4, NULL, 1,    'Beneficiary Profile - Maria Santos',    'profile',  'approved',   NULL, 1, '2026-09-10 08:30:00');

INSERT INTO document_versions (document_id, version_no, file_path, original_name, mime_type, size_bytes, sha256, created_by, created_at)
SELECT id, 1, CONCAT('documents/', id, '/v1-', LEFT(@doc_sha, 12), '.pdf'), 'placeholder.pdf', 'application/pdf',
       @doc_size, @doc_sha, created_by, created_at
FROM documents ORDER BY id;

-- One submitted Annex AA by the leader of association 1.
INSERT INTO tool_submissions (id, tool, association_id, visit_date, status, submitted_at, created_by, created_at) VALUES
  (1, 'aa', 1, '2026-09-15', 'submitted', '2026-09-15 15:00:00', 2, '2026-09-15 15:00:00');
INSERT INTO tool_submission_versions (submission_id, version_no, data, created_by, created_at) VALUES
  (1, 1, '{}', 2, '2026-09-15 15:00:00');

INSERT INTO profile_versions (beneficiary_id, version_no, data, created_by) VALUES
  (1, 1, '{"firstName":"Maria","lastName":"Santos","municipality":"Lubang","province":"Occidental Mindoro"}', 2),
  (2, 1, '{"firstName":"Juan","lastName":"Dela Cruz","municipality":"Lubang","province":"Occidental Mindoro"}', 3);

-- Staff records carried over from the prototype, now linked by ID.
INSERT INTO monitoring_visits (beneficiary_id, visit_date, progress, issue, recommendation, created_by) VALUES
  (1, '2026-09-15', 'good',            NULL,                      'Continue monitoring',   1),
  (3, '2026-09-18', 'needs_follow_up', 'Incomplete sales record', 'Submit updated record', 1);

INSERT INTO assistance (beneficiary_id, support_type, release_date, amount, created_by) VALUES
  (1, 'livelihood_capital', '2026-08-20', 10000.00, 1),
  (2, 'training_support',   '2026-08-28', 5000.00,  1);

INSERT INTO reports (report_type, period, details, status, shared_with_participants, created_by, created_at) VALUES
  ('project',  'August 2026',    'Demo report.', 'submitted',  1, 1, '2026-09-20 09:00:00'),
  ('progress', 'September 2026', 'Demo report.', 'submitted',  0, 1, '2026-09-21 09:00:00'),
  ('status',   'Q3 2026',        'Demo report.', 'for_review', 0, 1, '2026-09-22 09:00:00');

INSERT INTO notifications (id, beneficiary_id, title, message, created_by, created_at) VALUES
  (1, 1,    'Monitoring Schedule',                    'Your field monitoring visit is scheduled.',                                          1, '2026-09-23'),
  (2, 3,    'Correction Request',                     'Your project record is incomplete. Please submit the missing pages.',                1, '2026-09-22'),
  (3, NULL, 'General Assembly & Program Orientation', 'All SLP participants in Lubang are invited to the MSWDO Community Hall on Oct 10.', 1, '2026-09-24');

-- One activity row per seeded action, so the members' feed is not empty.
INSERT INTO audit_log (association_id, actor_id, action, entity_type, entity_id, summary, created_at) VALUES
  (1,    2, 'document.submit', 'document',        1, 'Maria Santos sent "Project Proposal - Sari-sari Store".',                                 '2026-09-12 10:00:00'),
  (1,    1, 'document.review', 'document',        1, 'MSWDO approved "Project Proposal - Sari-sari Store".',                                   '2026-09-13 09:00:00'),
  (1,    2, 'tool.submit',     'tool_submission', 1, 'Maria Santos submitted the MD Monitoring Tool (Annex AA).',                              '2026-09-15 15:00:00'),
  (1,    2, 'document.submit', 'document',        2, 'Maria Santos sent "Monthly Sales Record - September 2026".',                             '2026-09-25 14:00:00'),
  (1,    1, 'document.review', 'document',        2, 'MSWDO returned "Monthly Sales Record - September 2026": page 2 is missing.',             '2026-09-26 10:00:00'),
  (2,    1, 'document.submit', 'document',        3, 'MSWDO uploaded "Attendance Sheet - Poultry Training".',                                  '2026-10-01 09:30:00'),
  (NULL, 1, 'document.submit', 'document',        4, 'MSWDO uploaded "Beneficiary Profile - Maria Santos".',                                   '2026-09-10 08:30:00');

-- A registration waiting for review (self-registration, part A2): Nora Santiago
-- registered and submitted her eligibility form; staff have not decided yet.
INSERT INTO beneficiaries (id, association_id, first_name, last_name, sex, birthday, barangay_id, contact_no, participant_type, enrollment_status, profile_status) VALUES
  (13, NULL, 'Nora', 'Santiago', 'female', '1990-04-12', @tilik, '09171234567', 'non_4ps', 'applicant', 'submitted');

INSERT INTO users (id, username, password_hash, role, beneficiary_id, full_name, status, submitted_at, must_change_password) VALUES
  (4, 'applicant', @pw_applicant, 'participant', 13, NULL, 'pending', '2026-10-14 10:00:00', 0);

INSERT INTO profile_versions (beneficiary_id, version_no, data, created_by, created_at) VALUES
  (13, 1, '{"firstName":"Nora","lastName":"Santiago","birthday":"1990-04-12","sex":"Female","barangay":"Tilik","municipality":"Lubang","province":"Occidental Mindoro","contactNo":"09171234567","participantType":"Non-4Ps","consentAssess":true,"consentPolicy":true,"consentRetain":true,"consentShare":true}', 4, '2026-10-14 10:00:00');

INSERT INTO audit_log (association_id, actor_id, action, entity_type, entity_id, summary, created_at) VALUES
  (NULL, 4, 'registration.create', 'user', 4, 'Nora Santiago registered.',                     '2026-10-14 09:30:00'),
  (NULL, 4, 'registration.submit', 'user', 4, 'Nora Santiago submitted the eligibility form.', '2026-10-14 10:00:00');
