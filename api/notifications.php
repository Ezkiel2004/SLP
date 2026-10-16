<?php
/*
   POST {action:"send", beneficiaryId|null, title, message}  staff only → {ok, id}
        {action:"read", id}                                   anyone signed in → {ok}
        {action:"read_all"}                                    anyone signed in → {ok}
   A participant can only mark notifications they can see (schema spec §7).
*/
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$in = read_json();
$action = code_field($in, 'action', ['send', 'read', 'read_all'], 'action');
$me = $action === 'send' ? require_user($db, 'staff') : require_user($db);

// What this user may see: everything for staff; general notices plus their own otherwise.
$visible = $me['role'] === 'staff' ? '1 = 1' : '(beneficiary_id IS NULL OR beneficiary_id = ' . (int) $me['beneficiaryId'] . ')';

if ($action === 'send') {
    $beneficiary = id_field($db, $in, 'beneficiaryId', 'beneficiaries', 'recipient', required: false);
    $title = text_field($in, 'title', 'Title', 150);
    $message = text_field($in, 'message', 'Message', 2000);
    $id = in_transaction($db, function () use ($db, $me, $beneficiary, $title, $message) {
        $db->execute_query('INSERT INTO notifications (beneficiary_id, title, message, created_by) VALUES (?, ?, ?, ?)', [$beneficiary, $title, $message, $me['userId']]);
        $id = $db->insert_id;
        $association = $beneficiary === null ? null : beneficiary_name($db, $beneficiary)[1];
        audit($db, $me['userId'], 'notification.send', 'notification', $id, $association, "Notification \"$title\" was sent.");
        return $id;
    });
    json_out(['ok' => true, 'id' => $id]);
}

if ($action === 'read') {
    $id = $in['id'] ?? null;
    if (!is_int($id)) fail(422, 'Choose a valid notification.');
    if (!$db->execute_query("SELECT 1 FROM notifications WHERE id = ? AND $visible", [$id])->num_rows) fail(404, 'That notification was not found.');
    $db->execute_query('INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)', [$id, $me['userId']]);
    json_out(['ok' => true]);
}

$db->execute_query("INSERT IGNORE INTO notification_reads (notification_id, user_id) SELECT id, ? FROM notifications WHERE $visible", [$me['userId']]);
json_out(['ok' => true]);
