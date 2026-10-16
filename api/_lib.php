<?php
/*
   Shared helpers for the SLP JSON API. Every endpoint requires this first.
   Spec: docs/superpowers/specs/2026-10-13-slp-app-wiring-design.md §3.
*/

require_once __DIR__ . '/../database/db.php';

date_default_timezone_set('Asia/Manila');   // PHP's default here is Europe/Berlin
ini_set('display_errors', '0');             // never leak PHP warnings into a JSON response
error_reporting(E_ALL);

// password_verify() runs against this when the username does not exist, so the
// response time does not reveal which usernames exist.
const DUMMY_HASH = '$2y$10$xa1ZEd9MRxiP/AztGqEake24tg3jhOQ7Yg249Z.hrea25kNMgtuNm';

set_exception_handler(function (Throwable $e) {
    if ($e instanceof mysqli_sql_exception) db_fail($e);
    error_log('SLP API: ' . $e);
    fail(500, 'Something went wrong. Try again.');
});

function api_db(): mysqli {
    return db_connect(getenv('SLP_DB') ?: 'slp_monitoring');
}

function json_out(array $body, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $status, string $message): never {
    json_out(['ok' => false, 'error' => $message], $status);
}

/* Map a database error to a plain answer; details go to the PHP log only. */
function db_fail(mysqli_sql_exception $e): never {
    $code = $e->getCode();
    if ($code === 1062) fail(409, 'That record already exists.');
    if (in_array($code, [1452, 4025, 1265, 1406, 1048], true)) fail(422, 'Check the form: an answer is not valid.');
    error_log('SLP API database error: ' . $e);
    fail(500, 'Something went wrong. Try again.');
}

function require_method(string $method): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) fail(405, 'This address does not accept that request.');
}

/* The request body as an object (associative array). */
function read_json(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) || ($data !== [] && array_is_list($data))) fail(400, 'The request is not valid JSON.');
    return $data;
}

function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    session_name('SLPSESSID');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
    $idle = (int) (getenv('SLP_SESSION_IDLE') ?: 900);
    if (isset($_SESSION['seen']) && time() - $_SESSION['seen'] > $idle) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['seen'] = time();
}

/*
   The signed-in user as `me` (wiring spec §3.3) plus `status`
   (registering | pending | active | rejected) and `reviewNote`, or null
   when no one is signed in or the account is inactive.
*/
function current_user(mysqli $db): ?array {
    start_session();
    $id = $_SESSION['user_id'] ?? null;
    if (!$id) return null;
    $row = $db->execute_query(
        "SELECT u.id, u.username, r.role, u.status, u.review_note,
                COALESCE(u.full_name, CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name, b.extension_name)) AS name,
                u.beneficiary_id, r.association_id, a.name AS association_name
         FROM users u
         JOIN user_roles r ON r.user_id = u.id
         LEFT JOIN beneficiaries b ON b.id = u.beneficiary_id
         LEFT JOIN associations a ON a.id = r.association_id
         WHERE u.id = ? AND u.status <> 'inactive'", [$id])->fetch_assoc();
    if (!$row) return null;
    return [
        'userId' => (int) $row['id'],
        'username' => $row['username'],
        'role' => $row['role'],
        'name' => $row['name'],
        'beneficiaryId' => $row['beneficiary_id'] === null ? null : (int) $row['beneficiary_id'],
        'associationId' => $row['association_id'] === null ? null : (int) $row['association_id'],
        'associationName' => $row['association_name'],
        'status' => $row['status'],
        'reviewNote' => $row['review_note'],
    ];
}

/* Start a fresh session for $userId (sign-in or registration) and return `me`. */
function sign_in_session(mysqli $db, int $userId): array {
    start_session();
    session_regenerate_id(true);
    $_SESSION = ['user_id' => $userId, 'csrf' => bin2hex(random_bytes(32)), 'seen' => time()];
    $db->execute_query('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [$userId]);
    return current_user($db);
}

function check_csrf(): void {
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf']) || !is_string($sent) || !hash_equals($_SESSION['csrf'], $sent)) {
        fail(403, 'Your session could not be verified. Reload the page and try again.');
    }
}

/*
   The signed-in ACTIVE user, limited to $roles when given; POSTs also need
   the CSRF token. Applicants (registering, pending, rejected) get 403 here,
   so an endpoint that forgets a check fails closed.
*/
function require_user(mysqli $db, string ...$roles): array {
    $me = current_user($db);
    if (!$me) fail(401, 'Your session has ended. Sign in again.');
    if ($me['status'] !== 'active') fail(403, 'Your account cannot use this yet.');
    if ($roles && !in_array($me['role'], $roles, true)) fail(403, 'Your account cannot do this.');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') check_csrf();
    return $me;
}

/* An applicant still filling in the eligibility form: registering, or rejected and correcting it. */
function require_applicant(mysqli $db): array {
    $me = current_user($db);
    if (!$me) fail(401, 'Your session has ended. Sign in again.');
    if (!in_array($me['status'], ['registering', 'rejected'], true)) fail(403, 'Your account cannot do this.');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') check_csrf();
    return $me;
}

function username_field(array $in): string {
    $username = $in['username'] ?? null;
    if (!is_string($username) || !preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
        fail(422, 'Username must be 3 to 50 letters, numbers, dots, dashes or underscores.');
    }
    return strtolower($username);
}

function password_field(array $in): string {
    $password = $in['password'] ?? null;
    if (!is_string($password) || mb_strlen($password) < 8) fail(422, 'Password must be at least 8 characters.');
    if (mb_strlen($password) > 200) fail(422, 'Password is too long.');
    return $password;
}

/* ---- Input validation: each helper answers 422 with a plain sentence. ---- */

/* Trimmed text, or null when optional and empty. Labels are Title Case ("First Name"). */
function text_field(array $in, string $key, string $label, int $max, bool $required = true): ?string {
    $value = $in[$key] ?? null;
    if ($value !== null && !is_string($value) && !is_int($value) && !is_float($value)) fail(422, "$label is not valid.");
    $value = trim((string) ($value ?? ''));
    if ($value === '') {
        if ($required) fail(422, "$label is required.");
        return null;
    }
    if (mb_strlen($value) > $max) fail(422, "$label is too long.");
    return $value;
}

/* An id that must exist in $table (a constant table name from code, never from input). */
function id_field(mysqli $db, array $in, string $key, string $table, string $thing, bool $required = true): ?int {
    $value = $in[$key] ?? null;
    if ($value === null || $value === '') {
        if ($required) fail(422, "Choose a valid $thing.");
        return null;
    }
    if (!is_int($value) && !(is_string($value) && ctype_digit($value))) fail(422, "Choose a valid $thing.");
    if (!$db->execute_query("SELECT 1 FROM `$table` WHERE id = ?", [(int) $value])->num_rows) fail(422, "Choose a valid $thing.");
    return (int) $value;
}

function code_field(array $in, string $key, array $codes, string $thing): string {
    $value = $in[$key] ?? null;
    if (!is_string($value) || !in_array($value, $codes, true)) fail(422, "Choose a valid $thing.");
    return $value;
}

/* A Y-m-d date; with $notFuture it must not be after today in Manila. */
function date_field(array $in, string $key, string $label, bool $notFuture = false): string {
    $value = $in[$key] ?? null;
    if (!is_string($value) || $value === '') fail(422, "$label is required.");
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) fail(422, "$label is not a valid date.");
    if ($notFuture && $value > date('Y-m-d')) fail(422, ucfirst(strtolower($label)) . ' cannot be in the future.');
    return $value;
}

/* Run $fn in one transaction and return its result. */
function in_transaction(mysqli $db, callable $fn): mixed {
    $db->begin_transaction();
    try {
        $result = $fn();
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
}

function beneficiary_name(mysqli $db, int $id): array {
    $row = $db->execute_query("SELECT CONCAT_WS(' ', first_name, last_name), association_id FROM beneficiaries WHERE id = ?", [$id])->fetch_row();
    return [$row[0], $row[1] === null ? null : (int) $row[1]];
}

function audit(mysqli $db, ?int $actorId, string $action, ?string $entityType, ?int $entityId, ?int $associationId, string $summary): void {
    $db->execute_query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, association_id, summary, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$actorId, $action, $entityType, $entityId, $associationId, mb_substr($summary, 0, 255), $_SERVER['REMOTE_ADDR'] ?? null]
    );
}
