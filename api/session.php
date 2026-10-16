<?php
/* GET → {ok, me, csrf} for a signed-in user, else 401. Used on page load. */
require __DIR__ . '/_lib.php';
require_method('GET');

$db = api_db();
$me = current_user($db);
if (!$me) fail(401, 'Your session has ended. Sign in again.');
json_out(['ok' => true, 'me' => $me, 'csrf' => $_SESSION['csrf']]);
