<?php
/* POST {firstName, lastName, barangayId, associationId|null, householdInformation} → {ok, id}. Staff only. */
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$me = require_user($db, 'staff');
$in = read_json();

$first = text_field($in, 'firstName', 'First Name', 100);
$last = text_field($in, 'lastName', 'Last Name', 100);
$barangay = id_field($db, $in, 'barangayId', 'barangays', 'barangay');
$association = id_field($db, $in, 'associationId', 'associations', 'association', required: false);
$household = text_field($in, 'householdInformation', 'Household Information', 2000, required: false);

$id = in_transaction($db, function () use ($db, $me, $first, $last, $barangay, $association, $household) {
    $db->execute_query('INSERT INTO beneficiaries (first_name, last_name, barangay_id, association_id, household_information) VALUES (?, ?, ?, ?, ?)',
        [$first, $last, $barangay, $association, $household]);
    $id = $db->insert_id;
    audit($db, $me['userId'], 'beneficiary.create', 'beneficiary', $id, $association, "$first $last was registered.");
    return $id;
});

json_out(['ok' => true, 'id' => $id]);
