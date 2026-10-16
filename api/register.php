<?php
/*
   POST {username, password, firstName, lastName, barangayId, contactNo} → {ok, me, csrf}.
   Anyone may register, always as a participant (registration spec R2): any other
   field (role, status, association) is ignored. Creates an applicant beneficiary
   and a "registering" account, then signs the person in to fill in the form.
*/
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$in = read_json();

$username = username_field($in);
$password = password_field($in);
$first = text_field($in, 'firstName', 'First Name', 100);
$last = text_field($in, 'lastName', 'Last Name', 100);
$barangay = id_field($db, $in, 'barangayId', 'barangays', 'barangay');
$contact = $in['contactNo'] ?? null;
if (!is_string($contact) || !preg_match('/^(09\d{9}|\+639\d{9})$/', $contact)) fail(422, 'Enter a mobile number like 09171234567.');
if ($db->execute_query('SELECT 1 FROM users WHERE username = ?', [$username])->num_rows) fail(409, 'That username is already taken.');

$me = in_transaction($db, function () use ($db, $username, $password, $first, $last, $barangay, $contact) {
    $db->execute_query("INSERT INTO beneficiaries (first_name, last_name, barangay_id, contact_no, enrollment_status, profile_status)
                        VALUES (?, ?, ?, ?, 'applicant', 'draft')", [$first, $last, $barangay, $contact]);
    $beneficiary = $db->insert_id;
    $db->execute_query("INSERT INTO users (username, password_hash, role, beneficiary_id, status, must_change_password)
                        VALUES (?, ?, 'participant', ?, 'registering', 0)", [$username, password_hash($password, PASSWORD_DEFAULT), $beneficiary]);
    $userId = $db->insert_id;
    audit($db, $userId, 'registration.create', 'user', $userId, null, "$first $last registered.");
    return sign_in_session($db, $userId);
});

json_out(['ok' => true, 'me' => $me, 'csrf' => $_SESSION['csrf']]);
