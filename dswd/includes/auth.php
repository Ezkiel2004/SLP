<?php
/* Staff sign-in, roles and permissions for the admin dashboard.
   Roles, lowest to highest: viewer < editor < publisher < super_admin.
   Change who can do what in ABILITIES only. */
declare(strict_types=1);

const ROLE_LEVELS = ['viewer' => 1, 'editor' => 2, 'publisher' => 3, 'super_admin' => 4];

/** Minimum role for each ability. */
const ABILITIES = [
    'view' => 'viewer',
    'create' => 'editor',
    'edit_draft' => 'editor',
    'delete_draft' => 'editor',
    'edit_published' => 'publisher',
    'publish' => 'publisher',
    'delete' => 'publisher',
    'categories' => 'publisher',
    'feedback' => 'publisher',   // personal data: publishers and super admins only
    'users' => 'super_admin',
    'settings' => 'super_admin',
    'audit' => 'super_admin',
];

// Verified when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=1$cS82aGdubHRBSDA2R2JGeA$FHLui1RONQVCfuTA3JJVS4fC+OaFykp9APGDhPIU1qA';

/** The signed-in staff member, or null. Ends idle sessions. */
function current_user(): ?array
{
    start_session();
    $uid = $_SESSION['uid'] ?? null;
    if (!$uid) {
        return null;
    }
    if (time() - (int) ($_SESSION['last_seen'] ?? 0) > CONFIG['session_idle_minutes'] * 60) {
        end_session();
        flash('warning', 'You were signed out after ' . CONFIG['session_idle_minutes'] . ' minutes without activity.');
        return null;
    }
    $user = db_one(
        'SELECT u.id, u.name, u.email, u.is_active, u.must_change_password, r.name AS role, r.label AS role_label
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
        [$uid]
    );
    if (!$user || !$user['is_active']) {
        end_session();
        return null;
    }
    $_SESSION['last_seen'] = time();
    return $user;
}

function can(string $ability, ?array $user): bool
{
    return $user !== null && ROLE_LEVELS[$user['role']] >= ROLE_LEVELS[ABILITIES[$ability] ?? 'super_admin'];
}

/** The signed-in user; otherwise go to sign in. Forces a pending password change first. */
function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        redirect('admin/login.php');
    }
    if ($user['must_change_password'] && basename($_SERVER['SCRIPT_NAME'] ?? '') !== 'change-password.php') {
        redirect('admin/change-password.php');
    }
    return $user;
}

/** Sign in. Returns the user id, or an error message for the person signing in. */
function attempt_login(string $email, string $password): int|string
{
    $email = strtolower(trim($email));
    $window = CONFIG['login_window_minutes'] * 60;
    $bucket = 'login:' . hash('sha256', $email . '|' . client_key());
    if (rate_limited($bucket, CONFIG['login_max_attempts'], $window)) {
        return 'Too many attempts. Wait ' . CONFIG['login_window_minutes'] . ' minutes, then try again.';
    }
    $user = db_one('SELECT id, password_hash, is_active FROM users WHERE email = ?', [$email]);
    $valid = password_verify($password, $user['password_hash'] ?? DUMMY_HASH);
    if (!$user || !$valid || !$user['is_active']) {
        rate_hit($bucket, $window);
        audit('login_failed', 'users', $user ? (int) $user['id'] : null, '', null);
        return 'Email or password is incorrect.';
    }
    rate_clear($bucket);
    if (password_needs_rehash($user['password_hash'], PASSWORD_ARGON2ID)) {
        db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_ARGON2ID), $user['id']]);
    }
    start_session();
    session_regenerate_id(true);
    unset($_SESSION['csrf']);
    $_SESSION['uid'] = (int) $user['id'];
    $_SESSION['last_seen'] = time();
    db_exec('UPDATE users SET last_login = NOW() WHERE id = ?', [$user['id']]);
    audit('login', 'users', (int) $user['id'], '', (int) $user['id']);
    return (int) $user['id'];
}

/** Clear the session and its cookie. */
function end_session(): void
{
    start_session();
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $params['path'], 'secure' => $params['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
}

/** A problem with a proposed password, or null when it is acceptable. */
function password_problem(string $password, string $confirm, string $email): ?string
{
    $min = CONFIG['password_min_length'];
    if (mb_strlen($password) < $min) {
        return "Use at least $min characters.";
    }
    if ($password !== $confirm) {
        return 'The two passwords do not match.';
    }
    $local = strtolower(strtok($email, '@') ?: '');
    if ($local !== '' && str_contains(strtolower($password), $local)) {
        return 'Do not include your email name in your password.';
    }
    if (preg_match('/^(.)\1+$|password|12345678|qwerty/i', $password)) {
        return 'Choose a password that is harder to guess.';
    }
    return null;
}

/** A readable one-time password for new or reset accounts (the user must change it). */
function temporary_password(): string
{
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    $out = '';
    for ($i = 0; $i < 16; $i++) {
        $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $out;
}
