<?php
/*
   The applicant's Annex G.1 eligibility form (registration spec §4.2, §4.3).
   POST {action:"save", data}  → {ok, version}: a new profile version; personnel
                                 fields (items 25–29) are dropped, never stored.
   POST {action:"submit"}      → {ok}: the account goes on hold ("pending") and
                                 the session ends.
   Applicants only (registering or rejected); part B opens "save" to active participants.
*/
require __DIR__ . '/_lib.php';
require_method('POST');

// Items 25–29 and the reference slip: only MSWDO staff fill these in.
const PERSONNEL_FIELDS = ['povertyThreshold', 'personnelVulnerabilityScore', 'incomeAssessment', 'vulnerabilitySeverity', 'overallAssessment',
    'remarks', 'track', 'personnelSignature', 'referenceId', 'intakeDate', 'officeAddress', 'officeEmail', 'officeContact'];
const REQUIRED_TEXT = ['firstName', 'lastName', 'birthday', 'sex', 'barangay', 'contactNo', 'participantType'];
const REQUIRED_CONSENTS = ['consentAssess', 'consentPolicy', 'consentRetain', 'consentShare'];
const SEX = ['Male' => 'male', 'Female' => 'female'];
const PARTICIPANT_TYPE = ['4Ps' => '4ps', 'Non-4Ps' => 'non_4ps'];

$db = api_db();
$me = require_applicant($db);
$in = read_json();
$action = code_field($in, 'action', ['save', 'submit'], 'action');
$beneficiary = $me['beneficiaryId'];

function is_date(mixed $value): bool {
    if (!is_string($value)) return false;
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    return $date && $date->format('Y-m-d') === $value;
}

function barangay_id(mysqli $db, mixed $name): ?int {
    if (!is_string($name) || $name === '') return null;
    $row = $db->execute_query('SELECT id FROM barangays WHERE name = ?', [$name])->fetch_row();
    return $row ? (int) $row[0] : null;
}

if ($action === 'save') {
    $data = $in['data'] ?? null;
    if (!is_array($data) || ($data !== [] && array_is_list($data))) fail(422, 'The form contains an answer that is too long or not valid.');
    $answers = [];
    foreach ($data as $key => $value) {
        if (!is_string($key) || (!is_string($value) && !is_int($value) && !is_float($value) && !is_bool($value))) {
            fail(422, 'The form contains an answer that is too long or not valid.');
        }
        if (is_string($value) && mb_strlen($value) > 500) fail(422, 'The form contains an answer that is too long or not valid.');
        if (in_array($key, PERSONNEL_FIELDS, true) || str_ends_with($key, '2')) continue;
        $answers[$key] = $value;
    }

    $version = in_transaction($db, function () use ($db, $me, $beneficiary, $answers) {
        $db->execute_query('SELECT id FROM beneficiaries WHERE id = ? FOR UPDATE', [$beneficiary]);
        $version = (int) $db->execute_query('SELECT COALESCE(MAX(version_no), 0) + 1 FROM profile_versions WHERE beneficiary_id = ?', [$beneficiary])->fetch_row()[0];
        $db->execute_query('INSERT INTO profile_versions (beneficiary_id, version_no, data, created_by) VALUES (?, ?, ?, ?)',
            [$beneficiary, $version, json_encode($answers ?: new stdClass(), JSON_UNESCAPED_UNICODE), $me['userId']]);

        // Copy the non-empty answers the registry shows. A blank answer never wipes a column.
        $copy = [];
        foreach (['firstName' => 'first_name', 'middleName' => 'middle_name', 'lastName' => 'last_name', 'extensionName' => 'extension_name'] as $key => $column) {
            $value = trim((string) ($answers[$key] ?? ''));
            if ($value !== '' && mb_strlen($value) <= ($column === 'extension_name' ? 20 : 100)) $copy[$column] = $value;
        }
        $contact = trim((string) ($answers['contactNo'] ?? ''));
        if ($contact !== '' && mb_strlen($contact) <= 20) $copy['contact_no'] = $contact;
        if (isset(SEX[$answers['sex'] ?? ''])) $copy['sex'] = SEX[$answers['sex']];
        if (isset(PARTICIPANT_TYPE[$answers['participantType'] ?? ''])) $copy['participant_type'] = PARTICIPANT_TYPE[$answers['participantType']];
        if (is_date($answers['birthday'] ?? null)) $copy['birthday'] = $answers['birthday'];
        $barangay = barangay_id($db, $answers['barangay'] ?? null);
        if ($barangay !== null) $copy['barangay_id'] = $barangay;
        if ($copy) {
            $set = implode(', ', array_map(fn($column) => "$column = ?", array_keys($copy)));   // column names are fixed above
            $db->execute_query("UPDATE beneficiaries SET $set WHERE id = ?", [...array_values($copy), $beneficiary]);
        }
        return $version;
    });
    json_out(['ok' => true, 'version' => $version]);
}

// Submit: check the latest saved answers.
$row = $db->execute_query('SELECT data FROM profile_versions WHERE beneficiary_id = ? ORDER BY version_no DESC LIMIT 1', [$beneficiary])->fetch_row();
$answers = $row ? json_decode($row[0], true) : [];
$missing = [];
foreach (REQUIRED_TEXT as $key) {
    $value = $answers[$key] ?? '';
    $filled = match ($key) {
        'birthday' => is_date($value),
        'sex' => isset(SEX[$value]),
        'participantType' => isset(PARTICIPANT_TYPE[$value]),
        'barangay' => barangay_id($db, $value) !== null,
        default => is_string($value) && trim($value) !== '',
    };
    if (!$filled) $missing[] = $key;
}
foreach (REQUIRED_CONSENTS as $key) {
    if (($answers[$key] ?? false) !== true) $missing[] = $key;
}
if ($missing) json_out(['ok' => false, 'error' => 'Complete these items before you submit.', 'missing' => $missing], 422);

in_transaction($db, function () use ($db, $me, $beneficiary) {
    $db->execute_query("UPDATE users SET status = 'pending', submitted_at = NOW(), review_note = NULL WHERE id = ?", [$me['userId']]);
    $db->execute_query("UPDATE beneficiaries SET profile_status = 'submitted' WHERE id = ?", [$beneficiary]);
    audit($db, $me['userId'], 'registration.submit', 'user', $me['userId'], null, $me['name'] . ' submitted the eligibility form.');
});

$_SESSION = [];
session_destroy();
json_out(['ok' => true]);
