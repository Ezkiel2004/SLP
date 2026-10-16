<?php
/* POST → {ok}. Ends the session. */
require __DIR__ . '/_lib.php';
require_method('POST');

$db = api_db();
$me = require_user($db);
audit($db, $me['userId'], 'auth.logout', 'user', $me['userId'], null, $me['name'] . ' signed out.');
$_SESSION = [];
session_destroy();
json_out(['ok' => true]);
