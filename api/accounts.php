<?php
/*
   POST {accountType:"staff", fullName, username, password}
     or {accountType:"participant", beneficiaryId, username, password} → {ok, id}. Staff only.
   New accounts keep must_change_password = 1 (enforced in part C).
*/
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$me = require_user($db, 'staff');
$in = read_json();

$type = code_field($in, 'accountType', ['staff', 'participant'], 'account type');
$username = username_field($in);
$password = password_field($in);

$fullName = null;
$beneficiary = null;
if ($type === 'staff') {
    $fullName = text_field($in, 'fullName', 'Full Name', 150);
} else {
    $beneficiary = id_field($db, $in, 'beneficiaryId', 'beneficiaries', 'beneficiary');
    if ($db->execute_query('SELECT 1 FROM users WHERE beneficiary_id = ?', [$beneficiary])->num_rows) fail(409, 'That beneficiary already has an account.');
}
if ($db->execute_query('SELECT 1 FROM users WHERE username = ?', [$username])->num_rows) fail(409, 'That username is already taken.');

$id = in_transaction($db, function () use ($db, $me, $type, $username, $password, $fullName, $beneficiary) {
    $db->execute_query('INSERT INTO users (username, password_hash, role, beneficiary_id, full_name) VALUES (?, ?, ?, ?, ?)',
        [$username, password_hash($password, PASSWORD_DEFAULT), $type, $beneficiary, $fullName]);
    $id = $db->insert_id;
    audit($db, $me['userId'], 'account.create', 'user', $id, null, "Account \"$username\" was created.");
    return $id;
});

json_out(['ok' => true, 'id' => $id]);
