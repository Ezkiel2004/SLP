<?php
/* POST {reportType, period, details} → {ok, id}. Staff only; created For Review and not shared. */
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$me = require_user($db, 'staff');
$in = read_json();

$type = code_field($in, 'reportType', ['project', 'progress', 'status', 'beneficiary_status', 'accomplishment'], 'report type');
$period = text_field($in, 'period', 'Report Period', 50);
$details = text_field($in, 'details', 'Report Details', 5000);

$id = in_transaction($db, function () use ($db, $me, $type, $period, $details) {
    $db->execute_query('INSERT INTO reports (report_type, period, details, created_by) VALUES (?, ?, ?, ?)', [$type, $period, $details, $me['userId']]);
    $id = $db->insert_id;
    audit($db, $me['userId'], 'report.create', 'report', $id, null, "Report for $period was created.");
    return $id;
});

json_out(['ok' => true, 'id' => $id]);
