<?php
/* POST {beneficiaryId, visitDate, progress, issue, recommendation} → {ok, id}. Staff only. */
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$me = require_user($db, 'staff');
$in = read_json();

$beneficiary = id_field($db, $in, 'beneficiaryId', 'beneficiaries', 'beneficiary');
$date = date_field($in, 'visitDate', 'Visit Date', notFuture: true);
$progress = code_field($in, 'progress', ['good', 'needs_follow_up', 'completed'], 'progress');
$issue = text_field($in, 'issue', 'Issue', 255, required: false);
$recommendation = text_field($in, 'recommendation', 'Recommendation', 2000);

$id = in_transaction($db, function () use ($db, $me, $beneficiary, $date, $progress, $issue, $recommendation) {
    $db->execute_query('INSERT INTO monitoring_visits (beneficiary_id, visit_date, progress, issue, recommendation, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [$beneficiary, $date, $progress, $issue, $recommendation, $me['userId']]);
    $id = $db->insert_id;
    [$name, $association] = beneficiary_name($db, $beneficiary);
    audit($db, $me['userId'], 'monitoring.create', 'monitoring_visit', $id, $association, "Monitoring visit recorded for $name.");
    return $id;
});

json_out(['ok' => true, 'id' => $id]);
