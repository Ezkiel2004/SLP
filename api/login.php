<?php
/*
   POST {username, password} → {ok, me, csrf}. Wiring spec §3.2 rule 9.
   Account status (registration spec §4.1): pending → 403 with no session;
   registering and rejected sign in to a restricted session; inactive → 401.
*/
require __DIR__ . '/_lib.php';
require_method('POST');

const PENDING_SENTENCE = 'Your registration is on hold. The MSWDO will review your eligibility form. You can sign in after it is approved.';

$db = api_db();
$in = read_json();
$username = strtolower(trim(is_string($in['username'] ?? null) ? $in['username'] : ''));
$password = is_string($in['password'] ?? null) ? $in['password'] : '';

$user = $db->execute_query(
    'SELECT id, password_hash, status, locked_until > NOW() AS locked FROM users WHERE username = ?', [$username]
)->fetch_assoc();

if ($user && $user['locked']) fail(429, 'Too many failed attempts. Try again in 15 minutes.');

$valid = password_verify($password, $user['password_hash'] ?? DUMMY_HASH);

if (!$user || !$valid || $user['status'] === 'inactive') {
    $db->begin_transaction();
    if ($user && !$valid) {
        // Assignments run left to right, so the IF sees the new count.
        $db->execute_query('UPDATE users SET failed_logins = failed_logins + 1,
            locked_until = IF(failed_logins >= 5, NOW() + INTERVAL 15 MINUTE, locked_until) WHERE id = ?', [$user['id']]);
    }
    audit($db, null, 'auth.login_failed', 'user', $user ? (int) $user['id'] : null, null, 'Failed sign-in for "' . mb_substr($username, 0, 50) . '".');
    $db->commit();
    fail(401, 'Wrong username or password.');
}

if ($user['status'] === 'pending') {
    json_out(['ok' => false, 'status' => 'pending', 'error' => PENDING_SENTENCE], 403);
}

$me = in_transaction($db, function () use ($db, $user) {
    $me = sign_in_session($db, (int) $user['id']);
    audit($db, $me['userId'], 'auth.login', 'user', $me['userId'], null, $me['name'] . ' signed in.');
    return $me;
});

json_out(['ok' => true, 'me' => $me, 'csrf' => $_SESSION['csrf']]);
