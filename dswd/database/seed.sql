-- =====================================================================
-- DSWD website: sample content (phase 3). Run once, after schema.sql:
--   mysql -u root dswd_website < database/seed.sql
--
-- All content is SAMPLE content marked [Sample] or [brackets]; replace it
-- in the admin dashboard. None of it is official DSWD information.
--
-- Default administrator (change at first login; the site forces it):
--   email: admin@dswd.local   temporary password: see docs/phase-3-setup.md
-- =====================================================================
USE dswd_website;
SET NAMES utf8mb4;

INSERT INTO roles (id, name, label) VALUES
    (1, 'super_admin', 'Super administrator'),
    (2, 'publisher', 'Publisher'),
    (3, 'editor', 'Editor'),
    (4, 'viewer', 'Viewer');

INSERT INTO users (id, name, email, password_hash, role_id, is_active, must_change_password) VALUES
    (1, 'Site Administrator', 'admin@dswd.local',
     '$argon2id$v=19$m=65536,t=4,p=1$UGVXTHRkSXpFc1hUSkQyVQ$WxAocFtvugsjGZoNEJZLcra7DlqKCbNkvudBZj6uIIs', 1, 1, 1);

INSERT INTO categories (id, name, slug, type, sort_order) VALUES
    (1, 'Cash grants', 'cash-grants', 'program', 1),
    (2, 'Livelihood', 'livelihood', 'program', 2),
    (3, 'Crisis assistance', 'crisis', 'program', 3),
    (4, 'Senior citizens', 'seniors', 'program', 4),
    (5, 'Community development', 'community', 'program', 5),
    (6, 'Children and youth', 'children', 'program', 6),
    (7, 'Disaster response', 'disaster', 'program', 7),
    (8, 'Press releases', 'press', 'news', 1),
    (9, 'Program updates', 'programs', 'news', 2),
    (10, 'Disaster response', 'disaster', 'news', 3),
    (11, 'Events', 'events', 'news', 4),
    (12, 'Forms', 'forms', 'download', 1),
    (13, 'Annual reports', 'reports', 'download', 2),
    (14, 'Budget and finance', 'budget', 'download', 3),
    (15, 'Issuances', 'issuances', 'download', 4),
    (16, 'Procurement', 'procurement', 'download', 5),
    (17, 'Programs and eligibility', 'programs', 'faq', 1),
    (18, 'Applying and requirements', 'applying', 'faq', 2),
    (19, 'Payouts and benefits', 'payouts', 'faq', 3),
    (20, 'Feedback and complaints', 'complaints', 'faq', 4),
    (21, 'Privacy', 'privacy', 'faq', 5);

INSERT INTO site_settings (setting_key, label, value) VALUES
    ('office_address', 'Main office address', '[Office address]'),
    ('hotline', 'Hotline number', '[Hotline number]'),
    ('contact_email', 'Public email address', '[Email address]'),
    ('office_hours', 'Office hours', 'Monday to Friday, 8:00 AM to 5:00 PM'),
    ('facebook_url', 'Facebook page link (leave empty to show a placeholder)', ''),
    ('youtube_url', 'YouTube channel link (leave empty to show a placeholder)', ''),
    ('mandate', 'Mandate', '[Placeholder: the official mandate as written in the department''s charter.]'),
    ('vision', 'Vision', '[Placeholder: the official vision statement.]'),
    ('mission', 'Mission', '[Placeholder: the official mission statement.]'),
    ('dpo_name', 'Data Protection Officer name', '[Name of the Data Protection Officer]'),
    ('dpo_email', 'Data Protection Officer email', '[DPO email address]');

INSERT INTO programs (id, slug, kind, title_en, title_fil, summary, description, eligibility, category_id, is_featured, status) VALUES
    (1, 'pantawid-pamilyang-pilipino-program', 'program', 'Pantawid Pamilyang Pilipino Program (4Ps)', 'Pantawid Pamilyang Pilipino Program (4Ps)',
     'Cash grants for poor households with children, tied to health and education conditions.',
     '<p>The program gives cash grants to poor households so children can stay healthy and in school. Families receive the grants as long as they meet the health and education conditions.</p>',
     'Households identified as poor in the national household targeting system\nHouseholds with children aged 0 to 18, or a pregnant member\nWilling to meet the health and education conditions',
     1, 1, 'published'),
    (2, 'sustainable-livelihood-program', 'program', 'Sustainable Livelihood Program', 'Sustainable Livelihood Program',
     'Capacity building that helps poor families start or grow a livelihood.',
     '<p>The program helps families earn a steady income through skills training, seed capital for small businesses, and help finding work.</p>',
     'Members of poor households, with priority for 4Ps families\nAt least 18 years old\nWilling to join training and a livelihood association',
     2, 1, 'published'),
    (3, 'assistance-to-individuals-in-crisis-situations', 'service', 'Assistance to Individuals in Crisis Situations (AICS)', 'Tulong sa mga Indibidwal na nasa Krisis (AICS)',
     'Medical, burial, transport, education or food help for people in crisis.',
     '<p>AICS gives immediate help to people facing a crisis they cannot handle alone, such as a hospital bill, a death in the family, or being stranded far from home.</p>',
     'Individuals or families in a crisis situation\nNot able to pay for the needed help on their own',
     3, 1, 'published'),
    (4, 'social-pension-for-indigent-senior-citizens', 'program', 'Social Pension for Indigent Senior Citizens', 'Social Pension para sa mga Mahihirap na Senior Citizen',
     'A regular stipend for indigent senior citizens who have no pension or regular income.',
     '<p>The program gives a regular stipend to senior citizens who are frail, sick or living with a disability and have no pension or regular support.</p>',
     '60 years old or older\nFrail, sick or living with a disability\nNo regular income, pension or support from family',
     4, 0, 'published'),
    (5, 'kalahi-cidss', 'program', 'KALAHI-CIDSS', 'KALAHI-CIDSS',
     'Communities choose, build and manage small projects such as roads, water systems and day care centers.',
     '<p>Barangays decide together which small projects they need most, then plan, build and maintain them with support from DSWD.</p>',
     'Municipalities chosen for the program\nResidents who take part in barangay assemblies',
     5, 0, 'published'),
    (6, 'supplementary-feeding-program', 'program', 'Supplementary Feeding Program', 'Supplementary Feeding Program',
     'Hot meals for young children in child development centers and supervised neighborhood play.',
     '<p>Children in child development centers and supervised neighborhood play groups receive hot meals to support healthy growth.</p>',
     'Children 2 to 5 years old enrolled in a child development center or supervised neighborhood play',
     6, 0, 'published'),
    (7, 'disaster-response-and-relief', 'service', 'Disaster response and relief', 'Pagtugon at tulong sa sakuna',
     'Food packs, shelter help and other relief for families affected by disasters.',
     '<p>DSWD prepares and delivers relief to families hit by typhoons, floods, earthquakes and other disasters, working with local governments.</p>',
     'Families affected by a disaster in the affected area',
     7, 0, 'published'),
    (8, 'tara-basa-tutoring-program', 'program', 'Tara, Basa! Tutoring Program', 'Tara, Basa! Tutoring Program',
     'College students tutor young learners who struggle with reading.',
     '<p>College students from poor families tutor grade school learners who struggle with reading and receive cash-for-work in return.</p>',
     'College students from poor households who want to serve as tutors\nGrade school learners who struggle with reading',
     6, 0, 'published');

-- MySQL keeps \n in the string literals above as real line breaks.

INSERT INTO program_requirements (program_id, requirement, sort_order) VALUES
    (1, 'Valid ID of the household head', 1), (1, 'Birth certificates of the children', 2), (1, 'School enrollment records of the children', 3),
    (2, 'Valid ID', 1), (2, 'Barangay certificate of residency', 2), (2, 'Completed SLP application and profile form', 3),
    (3, 'Valid ID of the client', 1), (3, 'Barangay certificate of indigency', 2), (3, 'Documents for the kind of help, such as a medical abstract, a prescription, or a funeral contract', 3),
    (4, 'Valid ID that shows your date of birth, such as a senior citizen ID', 1), (4, 'Completed social pension application form', 2),
    (5, 'Attendance at the barangay assembly', 1),
    (6, 'Enrollment in a child development center or supervised neighborhood play', 1),
    (7, 'Disaster Assistance Family Access Card (DAFAC) or a barangay certification', 1),
    (8, 'Certificate of enrollment (for college tutors)', 1), (8, 'Valid school ID', 2);

INSERT INTO program_steps (program_id, step_no, instruction) VALUES
    (1, 1, 'Ask your city or municipal social welfare office whether your household is in the targeting list.'),
    (1, 2, 'Attend the community assembly when you are invited.'),
    (1, 3, 'Submit your documents and sign the agreement.'),
    (1, 4, 'Follow the health and school conditions to keep receiving the grants.'),
    (2, 1, 'Get the application and profile form from this page or from the field office.'),
    (2, 2, 'Fill out the form and attach your documents.'),
    (2, 3, 'Submit them to the SLP project development officer in your area.'),
    (2, 4, 'Join the orientation and skills training once you are accepted.'),
    (3, 1, 'Go to a DSWD field office or satellite office with your documents.'),
    (3, 2, 'Fill out the general intake sheet.'),
    (3, 3, 'Talk to a social worker, who will assess your situation.'),
    (3, 4, 'Receive the assistance or a guarantee letter.'),
    (4, 1, 'Get the application form from this page or from your city or municipal social welfare office.'),
    (4, 2, 'Submit the form with a copy of your ID.'),
    (4, 3, 'Wait for the validation visit from a social worker.'),
    (4, 4, 'Once approved, receive the stipend on the announced payout dates.'),
    (5, 1, 'Join the barangay assembly when the program starts in your area.'),
    (5, 2, 'Help choose and plan the community project.'),
    (5, 3, 'Volunteer for the project committees.'),
    (5, 4, 'Help run and maintain the finished project.'),
    (6, 1, 'Enroll your child at the nearest child development center.'),
    (6, 2, 'Ask the child development worker about the feeding schedule.'),
    (6, 3, 'Attend the parent sessions when invited.'),
    (7, 1, 'Register with your barangay or evacuation center after the disaster.'),
    (7, 2, 'Get your family access card or certification.'),
    (7, 3, 'Receive relief at the distribution point announced by your local government.'),
    (8, 1, 'Watch for the call for tutors in Announcements.'),
    (8, 2, 'Apply through your school or the field office.'),
    (8, 3, 'Attend the tutor training.'),
    (8, 4, 'Tutor learners on the scheduled days.');

SET @body = '<p>This is sample text for the redesigned news page. The final article will come from the content system and will be written by the DSWD communications team.</p><p>Each article explains what happened, who it helps, and what readers should do next, in short paragraphs and plain words.</p><p>For questions, call the hotline or visit the DSWD office in your region.</p>';

INSERT INTO news_articles (slug, title, excerpt, body, category_id, author_id, status, published_at) VALUES
    ('help-desks-extend-hours-during-payout-week', '[Sample] Help desks extend their hours during payout week', 'Field offices keep their help desks open longer so beneficiaries can ask questions on payout days.', @body, 9, 1, 'published', '2026-10-09 09:00:00'),
    ('food-packs-prepositioned-for-typhoon-season', '[Sample] Family food packs prepositioned ahead of typhoon season', 'Relief goods are stored near provinces that are often hit by typhoons, so help arrives sooner.', @body, 10, 1, 'published', '2026-10-06 09:00:00'),
    ('beware-of-fake-pages-offering-cash-aid', '[Sample] Beware of fake social media pages that offer cash aid', 'DSWD never asks for payment to join a program. Report pages that ask for fees or personal details.', @body, 8, 1, 'published', '2026-10-02 09:00:00'),
    ('livelihood-association-completes-training', '[Sample] Livelihood association completes skills training', 'Members finished food processing training and will open a small store in their barangay.', @body, 9, 1, 'published', '2026-09-28 09:00:00'),
    ('childrens-month-activities', '[Sample] Field offices hold activities for children', 'Play sessions, storytelling and parent talks were held in child development centers.', @body, 11, 1, 'published', '2026-09-22 09:00:00'),
    ('social-pension-payouts-begin', '[Sample] Social pension payouts begin in partner municipalities', 'Senior citizens can check the payout schedule with their city or municipal social welfare office.', @body, 9, 1, 'published', '2026-09-15 09:00:00'),
    ('volunteers-pack-relief-goods', '[Sample] Volunteers help pack relief goods', 'Students and employees joined weekend shifts at a relief warehouse.', @body, 10, 1, 'published', '2026-09-08 09:00:00'),
    ('tutoring-program-opens-slots', '[Sample] Tutoring program opens slots for college students', 'College students can apply as tutors and receive cash-for-work.', @body, 9, 1, 'published', '2026-09-01 09:00:00'),
    ('new-online-feedback-form', '[Sample] New online form for feedback and complaints', 'Send feedback or a complaint online and get a reference number to follow up.', @body, 8, 1, 'published', '2026-08-25 09:00:00');

-- Announcement dates are relative to the install date so the samples are always current.
INSERT INTO announcements (title, body, starts_at, ends_at, is_pinned, status) VALUES
    ('[Sample] Offices are closed on 1 November', 'All DSWD offices are closed for All Saints'' Day. Online forms stay open.', CURDATE() - INTERVAL 3 DAY, CURDATE() + INTERVAL 20 DAY, 1, 'published'),
    ('[Sample] Feedback form maintenance on 20 October', 'The online feedback form is unavailable from 10:00 PM to 12:00 midnight.', CURDATE() - INTERVAL 1 DAY, CURDATE() + INTERVAL 8 DAY, 0, 'published'),
    ('[Sample] Call for tutors for the tutoring program', 'College students can apply until the end of the month.', CURDATE() - INTERVAL 12 DAY, CURDATE() + INTERVAL 18 DAY, 0, 'published');

INSERT INTO downloads (title, category_id, program_id, file_path, year, file_size, status) VALUES
    ('[Sample] AICS general intake sheet', 12, 3, 'downloads/placeholder.pdf', 2026, 184320, 'published'),
    ('[Sample] SLP application and profile form', 12, 2, 'downloads/placeholder.pdf', 2026, 256000, 'published'),
    ('[Sample] Social pension application form', 12, 4, 'downloads/placeholder.pdf', 2026, 143360, 'published'),
    ('[Sample] Freedom of Information request form', 12, NULL, 'downloads/placeholder.pdf', 2025, 98304, 'published'),
    ('[Sample] Annual report 2025', 13, NULL, 'downloads/placeholder.pdf', 2025, 4404019, 'published'),
    ('[Sample] Annual report 2024', 13, NULL, 'downloads/placeholder.pdf', 2024, 3984588, 'published'),
    ('[Sample] Approved budget 2026', 14, NULL, 'downloads/placeholder.pdf', 2026, 716800, 'published'),
    ('[Sample] Approved budget 2025', 14, NULL, 'downloads/placeholder.pdf', 2025, 688128, 'published'),
    ('[Sample] Financial accountability report, second quarter 2026', 14, NULL, 'downloads/placeholder.pdf', 2026, 512000, 'published'),
    ('[Sample] Memorandum circular No. [00], series of 2026', 15, NULL, 'downloads/placeholder.pdf', 2026, 327680, 'published'),
    ('[Sample] Administrative order No. [00], series of 2025', 15, NULL, 'downloads/placeholder.pdf', 2025, 296960, 'published'),
    ('[Sample] Annual procurement plan 2026', 16, NULL, 'downloads/placeholder.pdf', 2026, 421888, 'published');

INSERT INTO offices (name, region, address, phone, email, hours, sort_order, status) VALUES
    ('DSWD Central Office', 'NCR', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 0, 'published'),
    ('DSWD Field Office NCR', 'NCR', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 1, 'published'),
    ('DSWD Field Office Cordillera Administrative Region (CAR)', 'CAR', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 2, 'published'),
    ('DSWD Field Office Region I (Ilocos Region)', 'I', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 3, 'published'),
    ('DSWD Field Office Region II (Cagayan Valley)', 'II', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 4, 'published'),
    ('DSWD Field Office Region III (Central Luzon)', 'III', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 5, 'published'),
    ('DSWD Field Office Region IV-A (CALABARZON)', 'IV-A', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 6, 'published'),
    ('DSWD Field Office MIMAROPA Region', 'MIMAROPA', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 7, 'published'),
    ('DSWD Field Office Region V (Bicol Region)', 'V', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 8, 'published'),
    ('DSWD Field Office Region VI (Western Visayas)', 'VI', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 9, 'published'),
    ('DSWD Field Office Region VII (Central Visayas)', 'VII', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 10, 'published'),
    ('DSWD Field Office Region VIII (Eastern Visayas)', 'VIII', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 11, 'published'),
    ('DSWD Field Office Region IX (Zamboanga Peninsula)', 'IX', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 12, 'published'),
    ('DSWD Field Office Region X (Northern Mindanao)', 'X', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 13, 'published'),
    ('DSWD Field Office Region XI (Davao Region)', 'XI', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 14, 'published'),
    ('DSWD Field Office Region XII (SOCCSKSARGEN)', 'XII', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 15, 'published'),
    ('DSWD Field Office Caraga', 'Caraga', '[Office address]', '[Phone number]', '[Email address]', 'Monday to Friday, 8:00 AM to 5:00 PM', 16, 'published');

INSERT INTO faqs (question, answer, topic_id, sort_order, status) VALUES
    ('How do I know which program fits my family?', 'Open Programs and services. Each program lists who can apply. You can also ask a social worker at your city or municipal social welfare office.', 17, 1, 'published'),
    ('Do I need to pay anyone to join a DSWD program?', 'No. DSWD programs are free. Report anyone who asks for payment through the Contact us page.', 17, 2, 'published'),
    ('What ID can I use?', '[Sample] Bring any valid government-issued ID. If you have none, ask your barangay for a certification and tell the social worker.', 18, 1, 'published'),
    ('Can someone apply for me?', '[Sample] In many cases a family member can apply with an authorization letter and both IDs. Check the program page for details.', 18, 2, 'published'),
    ('How will I know my payout schedule?', 'Your city or municipal social welfare office or DSWD field office announces the schedule. We also post it under Announcements.', 19, 1, 'published'),
    ('My payout did not arrive. What should I do?', 'Contact the field office in your region or send a complaint through Contact us. Include your full name and the program.', 19, 2, 'published'),
    ('How do I file a complaint?', 'Use the Contact us form and choose Complaint. You get a reference number to follow up.', 20, 1, 'published'),
    ('Can I complain without giving my name?', '[Sample] We need a way to reply, so the form asks for your name and email. We use them only for your complaint.', 20, 2, 'published'),
    ('What do you do with my personal information?', 'We use it only to answer your message, keep it secure, and delete it when it is no longer needed, as the Data Privacy Act of 2012 requires.', 21, 1, 'published'),
    ('Can I ask to see or delete my information?', 'Yes. Write to our Data Protection Officer through the Contact us page.', 21, 2, 'published');

INSERT INTO officials (name, position, sort_order, status) VALUES
    ('[Name of the Secretary]', 'Secretary', 1, 'published'),
    ('[Name]', '[Sample] Undersecretary, Operations', 2, 'published'),
    ('[Name]', '[Sample] Undersecretary, Policy and Plans', 3, 'published'),
    ('[Name]', '[Sample] Undersecretary, General Administration and Support Services', 4, 'published'),
    ('[Name]', '[Sample] Undersecretary, Disaster Response Management', 5, 'published'),
    ('[Name]', '[Sample] Assistant Secretary, Operations', 6, 'published');
