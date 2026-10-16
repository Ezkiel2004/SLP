<?php
/*
   GET → everything the signed-in user may see (wiring spec §3.4).
   Staff see all rows; a leader or member sees only what the schema
   spec §7 read rules allow. Filters come from `me`, never the request.
   Prepared statements return native ints; booleans and amounts are cast here.
*/
require __DIR__ . '/_lib.php';
require_method('GET');

$db = api_db();

// An applicant (registering, or rejected and correcting the form) gets only what the form needs.
$applicant = current_user($db);
if ($applicant && in_array($applicant['status'], ['registering', 'rejected'], true)) {
    $data = $db->execute_query('SELECT data FROM profile_versions WHERE beneficiary_id = ? ORDER BY version_no DESC LIMIT 1', [$applicant['beneficiaryId']])->fetch_row();
    json_out([
        'ok' => true,
        'me' => $applicant,
        'reference' => ['barangays' => $db->execute_query('SELECT id, name FROM barangays ORDER BY id')->fetch_all(MYSQLI_ASSOC)],
        'profile' => $data ? json_decode($data[0], true) : null,
    ]);
}

$me = require_user($db);
$staff = $me['role'] === 'staff';
$ben = $me['beneficiaryId'];
$assoc = $me['associationId'];

function rows(mysqli $db, string $sql, array $params = []): array {
    return $db->execute_query($sql, $params)->fetch_all(MYSQLI_ASSOC);
}

function with_bools(array $rows, string ...$keys): array {
    foreach ($rows as &$row) foreach ($keys as $key) $row[$key] = (bool) $row[$key];
    return $rows;
}

$name = fn(string $alias) => "CONCAT_WS(' ', $alias.first_name, $alias.last_name)";

$reference = [
    'barangays' => rows($db, 'SELECT id, name FROM barangays ORDER BY id'),
    'livelihoodTypes' => rows($db, "SELECT id, name FROM livelihood_types WHERE status = 'active' ORDER BY id"),
    'associations' => rows($db,
        "SELECT a.id, a.name, g.name AS barangay, t.name AS livelihoodType, {$name('l')} AS leaderName
         FROM associations a
         JOIN barangays g ON g.id = a.barangay_id
         JOIN livelihood_types t ON t.id = a.livelihood_type_id
         LEFT JOIN beneficiaries l ON l.id = a.leader_id
         " . ($staff ? '' : 'WHERE a.id = ?') . ' ORDER BY a.id', $staff ? [] : [$assoc]),
];

$beneficiaries = with_bools(rows($db,
    "SELECT b.id, b.first_name AS firstName, b.middle_name AS middleName, b.last_name AS lastName,
            b.extension_name AS extensionName, g.name AS barangay, b.association_id AS associationId,
            a.name AS associationName,
            COALESCE(t.name, (SELECT pt.name FROM projects p JOIN livelihood_types pt ON pt.id = p.livelihood_type_id
                              WHERE p.beneficiary_id = b.id ORDER BY p.id LIMIT 1), '') AS livelihood,
            b.enrollment_status AS enrollmentStatus, b.profile_status AS profileStatus,
            b.household_information AS householdInformation, (u.id IS NOT NULL) AS hasAccount
     FROM beneficiaries b
     JOIN barangays g ON g.id = b.barangay_id
     LEFT JOIN associations a ON a.id = b.association_id
     LEFT JOIN livelihood_types t ON t.id = a.livelihood_type_id
     LEFT JOIN users u ON u.beneficiary_id = b.id
     " . ($staff ? '' : 'WHERE b.id = ?') . ' ORDER BY b.id', $staff ? [] : [$ben]), 'hasAccount');

// Participants see their association's projects, or the project they own (dashboard "Project Status").
$projects = rows($db,
    "SELECT p.id, p.name,
            CASE WHEN p.association_id IS NOT NULL THEN {$name('l')} ELSE {$name('o')} END AS ownerName,
            a.name AS associationName, t.name AS livelihood, p.status
     FROM projects p
     JOIN livelihood_types t ON t.id = p.livelihood_type_id
     LEFT JOIN associations a ON a.id = p.association_id
     LEFT JOIN beneficiaries l ON l.id = a.leader_id
     LEFT JOIN beneficiaries o ON o.id = p.beneficiary_id
     " . ($staff ? '' : 'WHERE p.association_id = ? OR p.beneficiary_id = ?') . ' ORDER BY p.id', $staff ? [] : [$assoc, $ben]);

$monitoring = $staff ? rows($db,
    "SELECT m.id, m.beneficiary_id AS beneficiaryId, {$name('b')} AS beneficiaryName, m.visit_date AS visitDate,
            m.progress, m.issue, m.recommendation
     FROM monitoring_visits m JOIN beneficiaries b ON b.id = m.beneficiary_id ORDER BY m.id") : [];

$assistance = [];
if ($staff) {
    $assistance = rows($db,
        "SELECT s.id, s.beneficiary_id AS beneficiaryId, {$name('b')} AS beneficiaryName, s.support_type AS supportType,
                s.release_date AS releaseDate, s.amount
         FROM assistance s JOIN beneficiaries b ON b.id = s.beneficiary_id ORDER BY s.id");
    foreach ($assistance as &$row) $row['amount'] = $row['amount'] === null ? null : (float) $row['amount'];
    unset($row);
}

$reports = with_bools(rows($db,
    'SELECT id, report_type AS reportType, period, details, status, shared_with_participants AS shared, created_at AS createdAt
     FROM reports ' . ($staff ? '' : 'WHERE shared_with_participants = 1') . ' ORDER BY id'), 'shared');

$documents = rows($db,
    "SELECT d.id, d.title, d.category, d.status, d.review_note AS reviewNote,
            COALESCE(a.name, {$name('b')}) AS ownerName, d.beneficiary_id AS ownerBeneficiaryId, d.created_at AS createdAt
     FROM documents d
     LEFT JOIN associations a ON a.id = d.association_id
     LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id
     " . ($staff ? '' : 'WHERE d.association_id = ? OR d.beneficiary_id = ?') . ' ORDER BY d.id', $staff ? [] : [$assoc, $ben]);

$notifications = with_bools(rows($db,
    "SELECT n.id, n.title, n.message, IF(n.beneficiary_id IS NULL, NULL, {$name('b')}) AS recipientName,
            n.beneficiary_id AS beneficiaryId, n.created_at AS createdAt, (r.notification_id IS NOT NULL) AS `read`
     FROM notifications n
     LEFT JOIN beneficiaries b ON b.id = n.beneficiary_id
     LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
     " . ($staff ? '' : 'WHERE n.beneficiary_id IS NULL OR n.beneficiary_id = ?') . ' ORDER BY n.id',
    $staff ? [$me['userId']] : [$me['userId'], $ben]), 'read');

$users = $staff ? rows($db,
    "SELECT u.id, u.username, r.role, COALESCE(u.full_name, {$name('b')}) AS name, u.status, u.beneficiary_id AS beneficiaryId
     FROM users u JOIN user_roles r ON r.user_id = u.id LEFT JOIN beneficiaries b ON b.id = u.beneficiary_id ORDER BY u.id") : [];

// Staff: registrations waiting for review or returned to the applicant, with possible duplicates.
$registrations = [];
if ($staff) {
    $registrations = rows($db,
        "SELECT u.id AS userId, u.username, b.id AS beneficiaryId, {$name('b')} AS name, g.name AS barangay,
                b.contact_no AS contactNo, u.status, u.submitted_at AS submittedAt, u.review_note AS reviewNote,
                b.first_name, b.last_name, b.birthday
         FROM users u JOIN beneficiaries b ON b.id = u.beneficiary_id JOIN barangays g ON g.id = b.barangay_id
         WHERE u.role = 'participant' AND u.status IN ('pending', 'rejected') ORDER BY u.submitted_at, u.id");
    foreach ($registrations as &$registration) {
        $data = $db->execute_query('SELECT data FROM profile_versions WHERE beneficiary_id = ? ORDER BY version_no DESC LIMIT 1', [$registration['beneficiaryId']])->fetch_row();
        $registration['profile'] = $data ? json_decode($data[0], true) : null;
        $registration['duplicates'] = rows($db,
            "SELECT b.id AS beneficiaryId, {$name('b')} AS name, g.name AS barangay
             FROM beneficiaries b JOIN barangays g ON g.id = b.barangay_id
             WHERE b.id <> ? AND b.first_name = ? AND b.last_name = ? AND b.birthday IS NOT NULL AND b.birthday = ?",
            [$registration['beneficiaryId'], $registration['first_name'], $registration['last_name'], $registration['birthday']]);
        unset($registration['first_name'], $registration['last_name'], $registration['birthday']);
    }
    unset($registration);
}

$profile = null;
if (!$staff) {
    $data = $db->execute_query('SELECT data FROM profile_versions WHERE beneficiary_id = ? ORDER BY version_no DESC LIMIT 1', [$ben])->fetch_row();
    $profile = $data ? json_decode($data[0], true) : null;
}

json_out(($staff ? ['registrations' => $registrations] : []) + [
    'ok' => true,
    'me' => $me,
    'reference' => $reference,
    'beneficiaries' => $beneficiaries,
    'projects' => $projects,
    'monitoring' => $monitoring,
    'assistance' => $assistance,
    'reports' => $reports,
    'documents' => $documents,
    'notifications' => $notifications,
    'users' => $users,
    'profile' => $profile,
]);
