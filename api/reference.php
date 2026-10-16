<?php
/* GET → {ok, barangays: [{id, name}]}. Public: the registration form needs it before sign-in. */
require __DIR__ . '/_lib.php';
require_method('GET');

$db = api_db();
json_out(['ok' => true, 'barangays' => $db->execute_query('SELECT id, name FROM barangays ORDER BY id')->fetch_all(MYSQLI_ASSOC)]);
