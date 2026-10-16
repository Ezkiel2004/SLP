<?php
/*
   Staff review of a registration (registration spec §4.2, §4.3).
   POST {action:"approve", userId, associationId|null, assessment:{overallAssessment, track, data}} → {ok}
   POST {action:"reject", userId, reason, assessment?}                                              → {ok}
   Only a user who is "pending" can be reviewed; the row is locked so two
   approvals cannot both pass (the second gets 409).
*/
require __DIR__ . '/_lib.php';
require_method('POST');

const ASSESSMENT_FIELDS = ['povertyThreshold', 'personnelVulnerabilityScore', 'incomeAssessment', 'vulnerabilitySeverity', 'remarks'];

$db = api_db();
$me = require_user($db, 'staff');
$in = read_json();
$action = code_field($in, 'action', ['approve', 'reject'], 'action');
$userId = $in['userId'] ?? null;
if (!is_int($userId)) fail(422, 'Choose a valid registration.');

/* The assessment answers (items 25–29) staff may send: short scalar values only. */
function assessment_data(mixed $data): array {
    if (!is_array($data)) return [];
    $kept = [];
    foreach (ASSESSMENT_FIELDS as $key) {
        $value = $data[$key] ?? null;
        if ((is_string($value) || is_int($value) || is_float($value)) && mb_strlen((string) $value) <= 500) $kept[$key] = $value;
    }
    return $kept;
}

/* Lock the applicant's row; anything but a pending participant gives 409. */
function lock_pending(mysqli $db, int $userId): array {
    $row = $db->execute_query(
        "SELECT u.status, u.beneficiary_id, CONCAT_WS(' ', b.first_name, b.last_name) AS name
         FROM users u JOIN beneficiaries b ON b.id = u.beneficiary_id
         WHERE u.id = ? AND u.role = 'participant' FOR UPDATE", [$userId])->fetch_assoc();
    if (!$row || $row['status'] !== 'pending') throw new DomainException('not pending');
    return $row;
}

function save_assessment(mysqli $db, int $beneficiary, string $overall, ?string $track, array $data, int $staffId): void {
    $version = (int) $db->execute_query('SELECT COALESCE(MAX(version_no), 0) + 1 FROM eligibility_assessments WHERE beneficiary_id = ?', [$beneficiary])->fetch_row()[0];
    $db->execute_query('INSERT INTO eligibility_assessments (beneficiary_id, version_no, overall_assessment, track, data, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [$beneficiary, $version, $overall, $track, json_encode($data ?: new stdClass(), JSON_UNESCAPED_UNICODE), $staffId]);
}

$assessment = $in['assessment'] ?? null;

try {
    if ($action === 'approve') {
        if (!is_array($assessment)) fail(422, 'Complete the MSWDO assessment.');
        $overall = code_field($assessment, 'overallAssessment', ['qualified', 'not_qualified'], 'overall assessment');
        if ($overall !== 'qualified') fail(422, 'Only a Qualified applicant can be approved. Reject the registration instead.');
        $track = code_field($assessment, 'track', ['association', 'individual', 'employment'], 'track');
        $association = id_field($db, $in, 'associationId', 'associations', 'association', required: $track === 'association');
        if ($track !== 'association' && $association !== null) fail(422, 'Choose an association only for the association track.');
        $data = assessment_data($assessment['data'] ?? []);

        in_transaction($db, function () use ($db, $me, $userId, $association, $overall, $track, $data) {
            $row = lock_pending($db, $userId);
            $beneficiary = (int) $row['beneficiary_id'];
            save_assessment($db, $beneficiary, $overall, $track, $data, $me['userId']);
            $db->execute_query("UPDATE beneficiaries SET association_id = ?, enrollment_status = 'active', profile_status = 'verified' WHERE id = ?", [$association, $beneficiary]);
            $db->execute_query("UPDATE users SET status = 'active', review_note = NULL WHERE id = ?", [$userId]);
            $db->execute_query("INSERT INTO notifications (beneficiary_id, title, message, created_by)
                                VALUES (?, 'Registration approved', 'Your registration was approved. You can now sign in.', ?)", [$beneficiary, $me['userId']]);
            audit($db, $me['userId'], 'registration.approve', 'user', $userId, $association, "Registration of {$row['name']} was approved.");
        });
        json_out(['ok' => true]);
    }

    $reason = text_field($in, 'reason', 'Reason', 500);
    $overall = null;
    $track = null;
    if (is_array($assessment) && isset($assessment['overallAssessment'])) {
        $overall = code_field($assessment, 'overallAssessment', ['qualified', 'not_qualified'], 'overall assessment');
        $track = isset($assessment['track']) ? code_field($assessment, 'track', ['association', 'individual', 'employment'], 'track') : null;
    }
    in_transaction($db, function () use ($db, $me, $userId, $reason, $overall, $track, $assessment) {
        $row = lock_pending($db, $userId);
        $beneficiary = (int) $row['beneficiary_id'];
        if ($overall !== null) save_assessment($db, $beneficiary, $overall, $track, assessment_data($assessment['data'] ?? []), $me['userId']);
        $db->execute_query("UPDATE users SET status = 'rejected', review_note = ? WHERE id = ?", [$reason, $userId]);
        $db->execute_query("UPDATE beneficiaries SET profile_status = 'draft' WHERE id = ?", [$beneficiary]);
        audit($db, $me['userId'], 'registration.reject', 'user', $userId, null, "Registration of {$row['name']} was returned to the applicant.");
    });
    json_out(['ok' => true]);
} catch (DomainException $e) {
    fail(409, 'This registration is not waiting for review.');
}
