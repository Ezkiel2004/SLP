<?php
/* POST {name, associationId|null, beneficiaryId|null, livelihoodTypeId, status} → {ok, id}. Staff only; exactly one owner. */
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$me = require_user($db, 'staff');
$in = read_json();

$name = text_field($in, 'name', 'Project Name', 150);
$association = id_field($db, $in, 'associationId', 'associations', 'association', required: false);
$beneficiary = id_field($db, $in, 'beneficiaryId', 'beneficiaries', 'owner', required: false);
if (($association === null) === ($beneficiary === null)) fail(422, 'Choose a valid owner.');
$type = id_field($db, $in, 'livelihoodTypeId', 'livelihood_types', 'livelihood type');
$status = code_field($in, 'status', ['ongoing', 'for_monitoring', 'completed'], 'status');

$id = in_transaction($db, function () use ($db, $me, $name, $association, $beneficiary, $type, $status) {
    $db->execute_query('INSERT INTO projects (name, association_id, beneficiary_id, livelihood_type_id, status) VALUES (?, ?, ?, ?, ?)',
        [$name, $association, $beneficiary, $type, $status]);
    $id = $db->insert_id;
    audit($db, $me['userId'], 'project.create', 'project', $id, $association, "Project \"$name\" was added.");
    return $id;
});

json_out(['ok' => true, 'id' => $id]);
