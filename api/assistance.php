<?php
/* POST {beneficiaryId, supportType, releaseDate, amount|null} → {ok, id}. Staff only. */
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$me = require_user($db, 'staff');
$in = read_json();

$beneficiary = id_field($db, $in, 'beneficiaryId', 'beneficiaries', 'beneficiary');
$type = code_field($in, 'supportType', ['livelihood_capital', 'training_support', 'equipment', 'other'], 'support type');
$date = date_field($in, 'releaseDate', 'Release Date', notFuture: true);

// Pesos, at least 0, at most 2 decimals; null or "" means non-cash support.
$amount = $in['amount'] ?? null;
if ($amount === '') $amount = null;
if ($amount !== null) {
    $text = is_int($amount) || is_float($amount) ? (string) $amount : $amount;
    if (!is_string($text) || !preg_match('/^\d{1,10}(\.\d{1,2})?$/', $text)) fail(422, 'Amount is not valid.');
    $amount = $text;
}

$id = in_transaction($db, function () use ($db, $me, $beneficiary, $type, $date, $amount) {
    $db->execute_query('INSERT INTO assistance (beneficiary_id, support_type, release_date, amount, created_by) VALUES (?, ?, ?, ?, ?)',
        [$beneficiary, $type, $date, $amount, $me['userId']]);
    $id = $db->insert_id;
    [$name, $association] = beneficiary_name($db, $beneficiary);
    audit($db, $me['userId'], 'assistance.create', 'assistance', $id, $association, "Assistance recorded for $name.");
    return $id;
});

json_out(['ok' => true, 'id' => $id]);
