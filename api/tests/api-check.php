<?php
/*
   SLP API checks.
   Usage: php api/tests/api-check.php [name-filter]

   Installs the demo data into a scratch database (slp_api_check),
   starts PHP's built-in server on 127.0.0.1:8765 pointed at it
   (SLP_DB=slp_api_check, SLP_SESSION_IDLE=3), drives the endpoints
   over HTTP, then stops the server and drops the database.
   Spec: docs/superpowers/specs/2026-10-13-slp-app-wiring-design.md
*/

require __DIR__ . '/../../database/install.php';
require __DIR__ . '/../../database/tests/_check-lib.php';

const API_DB = 'slp_api_check';
const BASE = 'http://127.0.0.1:8765/';

/* A browser: one cookie jar, plus the CSRF token from its sign-in. */
class Browser {
    public ?string $csrf = null;
    public string $raw = '';
    private string $jar;

    function __construct() {
        $this->jar = tempnam(sys_get_temp_dir(), 'slpjar');
    }

    function __destruct() {
        @unlink($this->jar);
    }

    /* Returns [status, decoded JSON or null]. A string body is sent raw. */
    function request(string $method, string $path, mixed $body = null, bool $csrf = true): array {
        $curl = curl_init(BASE . $path);
        $headers = ['Accept: application/json'];
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_COOKIEJAR => $this->jar,
            CURLOPT_COOKIEFILE => $this->jar,
            CURLOPT_TIMEOUT => 15,
        ]);
        if ($body !== null) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body, JSON_UNESCAPED_UNICODE));
            $headers[] = 'Content-Type: application/json';
        }
        if ($csrf && $this->csrf !== null && $method !== 'GET') {
            $headers[] = 'X-CSRF-Token: ' . $this->csrf;
        }
        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
        $this->raw = (string) curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        return [$status, json_decode($this->raw, true)];
    }
}

function login_as(string $username, string $password): Browser {
    $browser = new Browser();
    [$status, $json] = $browser->request('POST', 'api/login.php', ['username' => $username, 'password' => $password]);
    ok($status === 200, "sign-in as $username gave $status: " . $browser->raw);
    $browser->csrf = $json['csrf'];
    return $browser;
}

function start_server(string $logFile) {
    $env = array_merge(getenv(), ['SLP_DB' => API_DB, 'SLP_SESSION_IDLE' => '3']);
    $process = proc_open(
        [PHP_BINARY, '-S', '127.0.0.1:8765', '-t', realpath(__DIR__ . '/../..')],
        [0 => ['pipe', 'r'], 1 => ['file', $logFile, 'a'], 2 => ['file', $logFile, 'a']],
        $pipes, null, $env
    );
    for ($i = 0; $i < 50; $i++) {
        $socket = @fsockopen('127.0.0.1', 8765, $code, $message, 0.1);
        if ($socket) { fclose($socket); return $process; }
        usleep(100000);
    }
    throw new RuntimeException('The test server did not start on 127.0.0.1:8765.');
}


/* ---------------- Task 1: sign-in ---------------- */

check('login succeeds for each demo account', function (mysqli $db) {
    foreach ([['admin', 'admin123', 'staff', 'MSWDO Personnel'], ['leader', 'leader123', 'leader', 'Maria Santos'], ['member', 'member123', 'member', 'Juan Dela Cruz']] as [$user, $password, $role, $name]) {
        $browser = new Browser();
        [$status, $json] = $browser->request('POST', 'api/login.php', ['username' => $user, 'password' => $password]);
        ok($status === 200, "$user: status $status " . $browser->raw);
        same([$role, $user, $name], [$json['me']['role'], $json['me']['username'], $json['me']['name']], "$user me");
        ok((bool) preg_match('/^[0-9a-f]{64}$/', $json['csrf'] ?? ''), "$user: bad csrf");
    }
});

check('login rejects a wrong password', function (mysqli $db) {
    [$status, $json] = (new Browser())->request('POST', 'api/login.php', ['username' => 'leader', 'password' => 'wrong']);
    try {
        ok($status === 401 && $json['error'] === 'Wrong username or password.', "got $status " . json_encode($json));
        ok((int) scalar($db, "SELECT failed_logins FROM users WHERE username = 'leader'") === 1, 'failed_logins should be 1');
    } finally {
        $db->query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE username = 'leader'");
    }
});

check('unknown username gets the same answer', function (mysqli $db) {
    [$status, $json] = (new Browser())->request('POST', 'api/login.php', ['username' => 'nobody', 'password' => 'x']);
    ok($status === 401 && $json['error'] === 'Wrong username or password.', "got $status " . json_encode($json));
});

check('five failures lock the account', function (mysqli $db) {
    try {
        for ($i = 0; $i < 5; $i++) (new Browser())->request('POST', 'api/login.php', ['username' => 'member', 'password' => 'wrong']);
        [$status, $json] = (new Browser())->request('POST', 'api/login.php', ['username' => 'member', 'password' => 'member123']);
        ok($status === 429 && $json['error'] === 'Too many failed attempts. Try again in 15 minutes.', "got $status " . json_encode($json));
        ok((int) scalar($db, "SELECT locked_until > NOW() FROM users WHERE username = 'member'") === 1, 'locked_until not in the future');
    } finally {
        $db->query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE username = 'member'");
    }
});

check('inactive account cannot sign in', function (mysqli $db) {
    $db->query("UPDATE users SET status = 'inactive' WHERE username = 'admin'");
    try {
        [$status] = (new Browser())->request('POST', 'api/login.php', ['username' => 'admin', 'password' => 'admin123']);
        ok($status === 401, "got $status");
    } finally {
        $db->query("UPDATE users SET status = 'active' WHERE username = 'admin'");
    }
});

check('session survives and logout ends it', function (mysqli $db) {
    $browser = login_as('leader', 'leader123');
    [$status, $json] = $browser->request('GET', 'api/session.php');
    ok($status === 200 && $json['me']['username'] === 'leader', "session: $status " . $browser->raw);
    [$status] = $browser->request('POST', 'api/logout.php', '{}');
    ok($status === 200, "logout: $status " . $browser->raw);
    [$status] = $browser->request('GET', 'api/session.php');
    ok($status === 401, "after logout: $status");
});

check('POST without CSRF is refused', function (mysqli $db) {
    $browser = login_as('leader', 'leader123');
    [$status] = $browser->request('POST', 'api/logout.php', '{}', csrf: false);
    ok($status === 403, "got $status");
    [$status] = $browser->request('GET', 'api/session.php');
    ok($status === 200, "session should still be valid, got $status");
});

check('idle session expires', function (mysqli $db) {
    $browser = login_as('leader', 'leader123');
    sleep(4);
    [$status] = $browser->request('GET', 'api/session.php');
    ok($status === 401, "got $status");
});

check('sign-in is audited', function (mysqli $db) {
    $before = (int) scalar($db, 'SELECT COALESCE(MAX(id), 0) FROM audit_log');
    login_as('leader', 'leader123');
    (new Browser())->request('POST', 'api/login.php', ['username' => 'ghost', 'password' => 'x']);
    $rows = $db->query("SELECT action, actor_id FROM audit_log WHERE id > $before ORDER BY id")->fetch_all();
    same([['auth.login', '2'], ['auth.login_failed', null]], $rows, 'audit rows');
});

check('internals are not served', function (mysqli $db) {
    $lines = fn(string $file) => is_file($file) ? array_map('trim', file($file)) : [];
    $api = $lines(__DIR__ . '/../.htaccess');
    ok(in_array('<FilesMatch "^_">', $api, true) && in_array('Require all denied', $api, true), 'api/.htaccess must deny files starting with _');
    ok(in_array('Require all denied', $lines(__DIR__ . '/.htaccess'), true), 'api/tests/.htaccess must deny everything');
});


/* ---------------- Task 2: the role-filtered snapshot ---------------- */

function snapshot(Browser $browser): array {
    [$status, $json] = $browser->request('GET', 'api/bootstrap.php');
    ok($status === 200, "bootstrap gave $status: " . substr($browser->raw, 0, 300));
    return $json;
}

function ids_of(array $records): array {
    return array_column($records, 'id');
}

check('bootstrap needs a session', function (mysqli $db) {
    [$status] = (new Browser())->request('GET', 'api/bootstrap.php');
    ok($status === 401, "got $status");
});

check('staff snapshot has everything', function (mysqli $db) {
    $s = snapshot(login_as('admin', 'admin123'));
    $counts = [];
    foreach (['beneficiaries', 'projects', 'monitoring', 'assistance', 'reports', 'documents', 'notifications', 'users'] as $key) $counts[$key] = count($s[$key]);
    foreach (['barangays', 'livelihoodTypes', 'associations'] as $key) $counts[$key] = count($s['reference'][$key]);
    same(['beneficiaries' => 13, 'projects' => 6, 'monitoring' => 2, 'assistance' => 2, 'reports' => 3, 'documents' => 4, 'notifications' => 3, 'users' => 4,
          'barangays' => 16, 'livelihoodTypes' => 7, 'associations' => 5], $counts, 'staff counts');
    ok($s['profile'] === null, 'staff profile should be null');
});

check('member snapshot is filtered', function (mysqli $db) {
    $s = snapshot(login_as('member', 'member123'));
    same([2], ids_of($s['beneficiaries']), 'beneficiaries');
    same([1], ids_of($s['projects']), 'projects');
    same([[], [], []], [$s['monitoring'], $s['assistance'], $s['users']], 'monitoring, assistance, users');
    same([1], ids_of($s['reports']), 'reports');
    same([1, 2], ids_of($s['documents']), 'documents');
    same([3], ids_of($s['notifications']), 'notifications');
    same([1], ids_of($s['reference']['associations']), 'associations');
    ok(($s['profile']['firstName'] ?? null) === 'Juan', 'profile.firstName should be Juan');
});

check('leader snapshot is filtered', function (mysqli $db) {
    $s = snapshot(login_as('leader', 'leader123'));
    same([1], ids_of($s['beneficiaries']), 'beneficiaries');
    same([1, 2, 4], ids_of($s['documents']), 'documents');
    same([1, 3], ids_of($s['notifications']), 'notifications');
    ok(($s['profile']['firstName'] ?? null) === 'Maria', 'profile.firstName should be Maria');
});

check('no password hash in any snapshot', function (mysqli $db) {
    foreach ([['admin', 'admin123'], ['leader', 'leader123'], ['member', 'member123']] as [$user, $password]) {
        $browser = login_as($user, $password);
        snapshot($browser);
        ok(!str_contains($browser->raw, '$2y$') && !str_contains(strtolower($browser->raw), 'password'), "$user snapshot mentions a password");
    }
});

check('read state is per user', function (mysqli $db) {
    $db->query('INSERT INTO notification_reads (notification_id, user_id) VALUES (3, 3)');
    try {
        $read = fn(array $s) => array_column($s['notifications'], 'read', 'id')[3];
        ok($read(snapshot(login_as('member', 'member123'))) === true, 'member should see notification 3 as read');
        ok($read(snapshot(login_as('leader', 'leader123'))) === false, 'leader should see notification 3 as unread');
    } finally {
        $db->query('DELETE FROM notification_reads WHERE notification_id = 3 AND user_id = 3');
    }
});

check('livelihood comes from association or own project', function (mysqli $db) {
    $livelihood = array_column(snapshot(login_as('admin', 'admin123'))['beneficiaries'], 'livelihood', 'id');
    same(['Sari-sari Store', 'Food Vending'], [$livelihood[1], $livelihood[3]], 'livelihoods of beneficiaries 1 and 3');
});


/* ---------------- Task 3: staff create endpoints ---------------- */

function manila(string $when): string {
    return (new DateTime($when, new DateTimeZone('Asia/Manila')))->format('Y-m-d');
}

/* POST as $browser; returns [status, json] and fails the check on a 500 or a PHP warning in the text. */
function post(Browser $browser, string $path, mixed $body): array {
    $result = $browser->request('POST', $path, $body);
    ok($result[0] !== 500, "$path gave 500: {$browser->raw}");
    ok(!preg_match('/Warning|Fatal|Notice|Deprecated/', $browser->raw), "$path leaked a PHP message: {$browser->raw}");
    return $result;
}

const VALID_CREATES = [
    'api/beneficiaries.php' => ['firstName' => 'Test', 'lastName' => 'Person', 'barangayId' => 15, 'associationId' => null, 'householdInformation' => ''],
    'api/projects.php' => ['name' => 'Test Project', 'associationId' => 4, 'beneficiaryId' => null, 'livelihoodTypeId' => 3, 'status' => 'ongoing'],
    'api/monitoring.php' => ['beneficiaryId' => 1, 'visitDate' => '2026-10-01', 'progress' => 'good', 'issue' => '', 'recommendation' => 'Keep going'],
    'api/assistance.php' => ['beneficiaryId' => 1, 'supportType' => 'equipment', 'releaseDate' => '2026-10-01', 'amount' => null],
    'api/reports.php' => ['reportType' => 'progress', 'period' => 'October 2026', 'details' => 'Test report'],
    'api/accounts.php' => ['accountType' => 'staff', 'fullName' => 'Test Staff', 'username' => 'test_staff', 'password' => 'longenough1'],
];

check('participants cannot call staff endpoints', function (mysqli $db) {
    $count = fn() => $db->query('SELECT (SELECT COUNT(*) FROM beneficiaries), (SELECT COUNT(*) FROM projects), (SELECT COUNT(*) FROM monitoring_visits),
        (SELECT COUNT(*) FROM assistance), (SELECT COUNT(*) FROM reports), (SELECT COUNT(*) FROM users)')->fetch_row();
    $before = $count();
    foreach ([['leader', 'leader123'], ['member', 'member123']] as [$user, $password]) {
        $browser = login_as($user, $password);
        foreach (VALID_CREATES as $path => $body) {
            [$status] = post($browser, $path, $body);
            ok($status === 403, "$user $path: got $status");
        }
    }
    same($before, $count(), 'row counts');
});

check('beneficiary create', function (mysqli $db) {
    [$status, $json] = post(login_as('admin', 'admin123'), 'api/beneficiaries.php',
        ['firstName' => 'Rosa', 'lastName' => 'Lim', 'barangayId' => 15, 'associationId' => 2, 'householdInformation' => 'Household of 3']);
    ok($status === 200 && is_int($json['id'] ?? null), "got $status " . json_encode($json));
    same(['15', '2'], $db->query("SELECT barangay_id, association_id FROM beneficiaries WHERE id = {$json['id']}")->fetch_row(), 'row');
    ok((int) scalar($db, "SELECT COUNT(*) FROM audit_log WHERE action = 'beneficiary.create' AND entity_id = {$json['id']} AND association_id = 2") === 1, 'audit row missing');
});

check('beneficiary create validates', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    $base = VALID_CREATES['api/beneficiaries.php'];
    foreach ([[['barangayId' => 99], 'Choose a valid barangay.'], [['firstName' => ''], 'First Name is required.'],
              [['firstName' => str_repeat('a', 101)], 'First Name is too long.']] as [$change, $message]) {
        [$status, $json] = post($admin, 'api/beneficiaries.php', array_merge($base, $change));
        ok($status === 422 && $json['error'] === $message, json_encode($change) . ": got $status " . json_encode($json));
    }
});

check('bad types are rejected, not crashed on', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    $base = VALID_CREATES['api/beneficiaries.php'];
    [$status] = post($admin, 'api/beneficiaries.php', array_merge($base, ['barangayId' => 'abc']));
    ok($status === 422, "barangayId abc: $status");
    [$status] = post($admin, 'api/beneficiaries.php', array_merge($base, ['firstName' => ['x']]));
    ok($status === 422, "firstName array: $status");
    [$status] = post($admin, 'api/beneficiaries.php', 'not json');
    ok($status === 400, "raw text: $status");
});

check('ñ survives the API round trip', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    [$status] = post($admin, 'api/beneficiaries.php', array_merge(VALID_CREATES['api/beneficiaries.php'], ['firstName' => 'Santo', 'lastName' => 'Niño']));
    ok($status === 200, "create: $status");
    ok(in_array('Niño', array_column(snapshot($admin)['beneficiaries'], 'lastName'), true), 'Niño not found in the snapshot');
});

check('project create needs exactly one owner', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    $base = VALID_CREATES['api/projects.php'];
    [$status] = post($admin, 'api/projects.php', array_merge($base, ['associationId' => 4, 'beneficiaryId' => 3]));
    ok($status === 422, "two owners: $status");
    [$status] = post($admin, 'api/projects.php', array_merge($base, ['associationId' => null, 'beneficiaryId' => null]));
    ok($status === 422, "no owner: $status");
    [$status] = post($admin, 'api/projects.php', $base);
    ok($status === 200, "valid: $status");
});

check('monitoring create rejects a future date', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    $base = VALID_CREATES['api/monitoring.php'];
    [$status, $json] = post($admin, 'api/monitoring.php', array_merge($base, ['visitDate' => manila('tomorrow')]));
    ok($status === 422 && $json['error'] === 'Visit date cannot be in the future.', "tomorrow: $status " . json_encode($json));
    [$status, $json] = post($admin, 'api/monitoring.php', array_merge($base, ['visitDate' => manila('today')]));
    ok($status === 200, "today: $status " . json_encode($json));
    ok((int) scalar($db, "SELECT COUNT(*) FROM audit_log WHERE action = 'monitoring.create' AND entity_id = {$json['id']}") === 1, 'audit row missing');
});

check('assistance amount rules', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    $base = VALID_CREATES['api/assistance.php'];
    [$status] = post($admin, 'api/assistance.php', array_merge($base, ['amount' => -5]));
    ok($status === 422, "-5: $status");
    [$status, $json] = post($admin, 'api/assistance.php', array_merge($base, ['amount' => '5000.50']));
    ok($status === 200 && scalar($db, "SELECT amount FROM assistance WHERE id = {$json['id']}") === '5000.50', "5000.50: $status");
    [$status, $json] = post($admin, 'api/assistance.php', $base);
    ok($status === 200 && scalar($db, "SELECT amount FROM assistance WHERE id = {$json['id']}") === null, "null: $status");
});

check('report create', function (mysqli $db) {
    [$status, $json] = post(login_as('admin', 'admin123'), 'api/reports.php', VALID_CREATES['api/reports.php']);
    ok($status === 200, "got $status");
    same(['for_review', '0'], $db->query("SELECT status, shared_with_participants FROM reports WHERE id = {$json['id']}")->fetch_row(), 'report row');
});

check('account create', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    [$status] = post($admin, 'api/accounts.php', ['accountType' => 'staff', 'fullName' => 'Carla Mendoza', 'username' => 'pdo_officer', 'password' => 'securepass123']);
    ok($status === 200, "staff account: $status");
    login_as('pdo_officer', 'securepass123');
    [$status, $json] = post($admin, 'api/accounts.php', ['accountType' => 'staff', 'fullName' => 'Other', 'username' => 'pdo_officer', 'password' => 'securepass123']);
    ok($status === 409 && $json['error'] === 'That username is already taken.', "same username: $status");
    [$status, $json] = post($admin, 'api/accounts.php', ['accountType' => 'participant', 'beneficiaryId' => 1, 'username' => 'maria2', 'password' => 'securepass123']);
    ok($status === 409 && $json['error'] === 'That beneficiary already has an account.', "beneficiary 1: $status");
    [$status, $json] = post($admin, 'api/accounts.php', ['accountType' => 'participant', 'beneficiaryId' => 5, 'username' => 'liza', 'password' => 'securepass123']);
    ok($status === 200, "beneficiary 5: $status " . json_encode($json));
    ok(scalar($db, "SELECT role FROM user_roles WHERE user_id = {$json['id']}") === 'member', 'Liza should be a member');
    [$status] = post($admin, 'api/accounts.php', ['accountType' => 'staff', 'fullName' => 'Short', 'username' => 'short_pw', 'password' => 'seven77']);
    ok($status === 422, "7-character password: $status");
});


/* ---------------- Task 4: notifications ---------------- */

function titles(Browser $browser): array {
    return array_column(snapshot($browser)['notifications'], 'title');
}

check('send to one or to all', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    [$status] = post($admin, 'api/notifications.php', ['action' => 'send', 'beneficiaryId' => 2, 'title' => 'For Juan only', 'message' => 'Private note.']);
    ok($status === 200, "send to Juan: $status");
    ok(in_array('For Juan only', titles(login_as('member', 'member123')), true), 'member should see it');
    ok(!in_array('For Juan only', titles(login_as('leader', 'leader123')), true), 'leader must not see it');
    [$status] = post($admin, 'api/notifications.php', ['action' => 'send', 'beneficiaryId' => null, 'title' => 'For everyone', 'message' => 'General note.']);
    ok($status === 200, "send to all: $status");
    ok(in_array('For everyone', titles(login_as('member', 'member123')), true) && in_array('For everyone', titles(login_as('leader', 'leader123')), true), 'both should see it');
});

check('participants cannot send', function (mysqli $db) {
    [$status] = post(login_as('member', 'member123'), 'api/notifications.php', ['action' => 'send', 'beneficiaryId' => null, 'title' => 'x', 'message' => 'y']);
    ok($status === 403, "got $status");
});

check('read marks only visible notifications', function (mysqli $db) {
    $member = login_as('member', 'member123');
    [$status] = post($member, 'api/notifications.php', ['action' => 'read', 'id' => 1]);
    ok($status === 404, "Maria's notification: $status");
    [$status] = post($member, 'api/notifications.php', ['action' => 'read', 'id' => 3]);
    ok($status === 200, "read 3: $status");
    ok(array_column(snapshot($member)['notifications'], 'read', 'id')[3] === true, 'notification 3 should be read');
    [$status] = post($member, 'api/notifications.php', ['action' => 'read', 'id' => 3]);
    ok($status === 200, "read 3 again: $status");
});

check('read_all marks every visible notification', function (mysqli $db) {
    $member = login_as('member', 'member123');
    [$status] = post($member, 'api/notifications.php', ['action' => 'read_all']);
    ok($status === 200, "got $status");
    ok((int) scalar($db, 'SELECT COUNT(*) FROM notification_reads WHERE user_id = 3') === count(snapshot($member)['notifications']), 'read rows should match the visible notifications');
});


/* ---------------- Part A2, Task 2: registration step 1 and account status ---------------- */

const PENDING_SENTENCE = 'Your registration is on hold. The MSWDO will review your eligibility form. You can sign in after it is approved.';
const REGISTRATION = ['password' => 'applicant-pass1', 'firstName' => 'Lea', 'lastName' => 'Cruz', 'barangayId' => 15, 'contactNo' => '09181234567'];

function register_as(string $username): Browser {
    $browser = new Browser();
    [$status, $json] = $browser->request('POST', 'api/register.php', ['username' => $username] + REGISTRATION);
    ok($status === 200, "register $username gave $status: " . $browser->raw);
    $browser->csrf = $json['csrf'];
    return $browser;
}

check('register creates an applicant and signs in', function (mysqli $db) {
    $browser = new Browser();
    [$status, $json] = $browser->request('POST', 'api/register.php', ['username' => 'lea1'] + REGISTRATION);
    ok($status === 200, "got $status " . $browser->raw);
    same(['registering', 'member'], [$json['me']['status'], $json['me']['role']], 'me');
    ok((bool) preg_match('/^[0-9a-f]{64}$/', $json['csrf'] ?? ''), 'bad csrf');
    same(['participant', 'registering', '0'], $db->query("SELECT role, status, must_change_password FROM users WHERE username = 'lea1'")->fetch_row(), 'user row');
    same(['applicant', 'draft', null, '15', '09181234567'], $db->query(
        "SELECT b.enrollment_status, b.profile_status, b.association_id, b.barangay_id, b.contact_no FROM beneficiaries b JOIN users u ON u.beneficiary_id = b.id WHERE u.username = 'lea1'")->fetch_row(), 'beneficiary row');
    ok((int) scalar($db, "SELECT COUNT(*) FROM audit_log a JOIN users u ON u.id = a.entity_id WHERE a.action = 'registration.create' AND u.username = 'lea1'") === 1, 'audit row missing');
});

check('register validates each field', function (mysqli $db) {
    $cases = [
        [['username' => 'ab'], 'Username must be 3 to 50 letters, numbers, dots, dashes or underscores.'],
        [['password' => 'short'], 'Password must be at least 8 characters.'],
        [['firstName' => ''], 'First Name is required.'],
        [['lastName' => str_repeat('a', 101)], 'Last Name is too long.'],
        [['barangayId' => 99], 'Choose a valid barangay.'],
        [['contactNo' => '12345'], 'Enter a mobile number like 09171234567.'],
    ];
    foreach ($cases as [$change, $message]) {
        [$status, $json] = post(new Browser(), 'api/register.php', array_merge(['username' => 'valid_name'] + REGISTRATION, $change));
        ok($status === 422 && ($json['error'] ?? '') === $message, json_encode($change) . ": got $status " . json_encode($json));
    }
});

check('username is case-insensitive at register and sign-in', function (mysqli $db) {
    [$status, $json] = post(new Browser(), 'api/register.php', ['username' => 'Member'] + REGISTRATION);
    ok($status === 409 && $json['error'] === 'That username is already taken.', "got $status " . json_encode($json));
    login_as('MEMBER', 'member123');
});

check('register ignores role, status and association fields', function (mysqli $db) {
    [$status] = post(new Browser(), 'api/register.php', ['username' => 'sneaky', 'role' => 'staff', 'status' => 'active', 'associationId' => 1] + REGISTRATION);
    ok($status === 200, "got $status");
    same(['participant', 'registering', null], $db->query(
        "SELECT u.role, u.status, b.association_id FROM users u JOIN beneficiaries b ON b.id = u.beneficiary_id WHERE u.username = 'sneaky'")->fetch_row(), 'created account');
});

check('pending account cannot sign in', function (mysqli $db) {
    $browser = new Browser();
    [$status, $json] = $browser->request('POST', 'api/login.php', ['username' => 'applicant', 'password' => 'applicant123']);
    ok($status === 403 && ($json['status'] ?? '') === 'pending' && ($json['error'] ?? '') === PENDING_SENTENCE, "got $status " . $browser->raw);
    [$status] = $browser->request('GET', 'api/session.php');
    ok($status === 401, "session after a pending sign-in: $status");
});

check('rejected account signs in with the reason', function (mysqli $db) {
    $db->query("UPDATE users SET status = 'rejected', review_note = 'Birthday is missing.' WHERE id = 4");
    try {
        [$status, $json] = (new Browser())->request('POST', 'api/login.php', ['username' => 'applicant', 'password' => 'applicant123']);
        ok($status === 200, "got $status");
        same(['rejected', 'Birthday is missing.'], [$json['me']['status'], $json['me']['reviewNote']], 'me');
    } finally {
        $db->query("UPDATE users SET status = 'pending', review_note = NULL WHERE id = 4");
    }
});

check('applicants cannot use active-only endpoints', function (mysqli $db) {
    $browser = register_as('lea2');
    [$status] = post($browser, 'api/beneficiaries.php', VALID_CREATES['api/beneficiaries.php']);
    ok($status === 403, "beneficiaries.php: $status");
    [$status] = post($browser, 'api/notifications.php', ['action' => 'read_all']);
    ok($status === 403, "notifications.php: $status");
});

check('reference lists the barangays without a session', function (mysqli $db) {
    [$status, $json] = (new Browser())->request('GET', 'api/reference.php');
    ok($status === 200 && count($json['barangays'] ?? []) === 16, "got $status");
});


/* ---------------- Part A2, Task 3: the applicant's form ---------------- */

function complete_profile(): array {
    return ['firstName' => 'Lea', 'lastName' => 'Cruz', 'birthday' => '1992-05-01', 'sex' => 'Female', 'barangay' => 'Tilik',
            'contactNo' => '09181234567', 'participantType' => 'Non-4Ps',
            'consentAssess' => true, 'consentPolicy' => true, 'consentRetain' => true, 'consentShare' => true];
}

/* Register, save a complete form and submit it. Returns [userId, beneficiaryId]. */
function register_and_submit(string $username): array {
    $browser = register_as($username);
    [$status] = post($browser, 'api/profile.php', ['action' => 'save', 'data' => complete_profile()]);
    ok($status === 200, "save for $username: $status {$browser->raw}");
    [$status] = post($browser, 'api/profile.php', ['action' => 'submit']);
    ok($status === 200, "submit for $username: $status {$browser->raw}");
    $row = db_connect(API_DB)->execute_query('SELECT id, beneficiary_id FROM users WHERE username = ?', [$username])->fetch_row();
    return [(int) $row[0], (int) $row[1]];
}

function latest_profile(mysqli $db, string $username): array {
    $data = $db->execute_query('SELECT p.data FROM profile_versions p JOIN users u ON u.beneficiary_id = p.beneficiary_id
                                WHERE u.username = ? ORDER BY p.version_no DESC LIMIT 1', [$username])->fetch_row();
    return $data ? json_decode($data[0], true) : [];
}

check('applicant snapshot is limited', function (mysqli $db) {
    $s = snapshot(register_as('lea3'));
    same(['ok', 'me', 'reference', 'profile'], array_keys($s), 'top-level keys');
    same(['barangays'], array_keys($s['reference']), 'reference keys');
});

check('save drops personnel fields', function (mysqli $db) {
    $browser = register_as('lea4a');
    [$status] = post($browser, 'api/profile.php', ['action' => 'save', 'data' => ['firstName' => 'Lea', 'overallAssessment' => 'Qualified', 'track' => 'Association', 'referenceId2' => 'x']]);
    ok($status === 200, "save: $status");
    same(['firstName' => 'Lea'], latest_profile($db, 'lea4a'), 'stored answers');
});

check('saved draft comes back after signing in again', function (mysqli $db) {
    $browser = register_as('lea4b');
    post($browser, 'api/profile.php', ['action' => 'save', 'data' => ['firstName' => 'Lea', 'lastName' => 'Cruz']]);
    $again = login_as('lea4b', 'applicant-pass1');
    $s = snapshot($again);
    same(['Lea', 'registering'], [$s['profile']['firstName'] ?? null, $s['me']['status']], 'profile and status after signing in again');
});

check('save copies answers to the registry row', function (mysqli $db) {
    $browser = register_as('lea4c');
    [$status] = post($browser, 'api/profile.php', ['action' => 'save', 'data' => complete_profile()]);
    ok($status === 200, "save: $status");
    same(['1992-05-01', 'female', 'non_4ps', 'Tilik', '09181234567'], $db->query(
        "SELECT b.birthday, b.sex, b.participant_type, g.name, b.contact_no FROM beneficiaries b JOIN barangays g ON g.id = b.barangay_id
         JOIN users u ON u.beneficiary_id = b.id WHERE u.username = 'lea4c'")->fetch_row(), 'registry row');
});

check('save rejects oversized or nested answers', function (mysqli $db) {
    $browser = register_as('lea4d');
    [$status] = post($browser, 'api/profile.php', ['action' => 'save', 'data' => ['remarksText' => str_repeat('a', 501)]]);
    ok($status === 422, "501 characters: $status");
    [$status] = post($browser, 'api/profile.php', ['action' => 'save', 'data' => ['household' => ['a' => 1]]]);
    ok($status === 422, "nested answer: $status");
});

check('submit lists what is missing', function (mysqli $db) {
    $browser = register_as('lea4e');
    post($browser, 'api/profile.php', ['action' => 'save', 'data' => ['firstName' => 'Lea']]);
    [$status, $json] = post($browser, 'api/profile.php', ['action' => 'submit']);
    ok($status === 422 && ($json['error'] ?? '') === 'Complete these items before you submit.', "got $status " . json_encode($json));
    ok(in_array('birthday', $json['missing'], true) && in_array('consentShare', $json['missing'], true) && !in_array('firstName', $json['missing'], true),
        'missing list: ' . json_encode($json['missing']));
});

check('submit puts the account on hold', function (mysqli $db) {
    $browser = register_as('lea4f');
    post($browser, 'api/profile.php', ['action' => 'save', 'data' => complete_profile()]);
    [$status] = post($browser, 'api/profile.php', ['action' => 'submit']);
    ok($status === 200, "submit: $status {$browser->raw}");
    [$status] = $browser->request('GET', 'api/session.php');
    ok($status === 401, "session after submit: $status");
    [$status, $json] = (new Browser())->request('POST', 'api/login.php', ['username' => 'lea4f', 'password' => 'applicant-pass1']);
    ok($status === 403 && ($json['status'] ?? '') === 'pending', "sign-in after submit: $status");
    same(['pending', '1', 'submitted'], $db->query("SELECT u.status, u.submitted_at IS NOT NULL, b.profile_status FROM users u JOIN beneficiaries b ON b.id = u.beneficiary_id WHERE u.username = 'lea4f'")->fetch_row(), 'state');
    ok((int) scalar($db, "SELECT COUNT(*) FROM audit_log a JOIN users u ON u.id = a.entity_id WHERE a.action = 'registration.submit' AND u.username = 'lea4f'") === 1, 'audit row missing');
});


/* ---------------- Part A2, Task 4: staff review ---------------- */

function approve_body(int $userId, array $change = []): array {
    return array_replace_recursive(['action' => 'approve', 'userId' => $userId, 'associationId' => 2,
        'assessment' => ['overallAssessment' => 'qualified', 'track' => 'association', 'data' => ['remarks' => 'Eligible']]], $change);
}

check('staff snapshot lists registrations with duplicates', function (mysqli $db) {
    $admin = login_as('admin', 'admin123');
    $find = fn() => array_values(array_filter(snapshot($admin)['registrations'], fn($r) => $r['userId'] === 4))[0] ?? null;
    $nora = $find();
    ok($nora !== null && $nora['status'] === 'pending' && $nora['duplicates'] === [], 'user 4 should be listed with no duplicates: ' . json_encode($nora));
    $db->query("INSERT INTO beneficiaries (first_name, last_name, birthday, barangay_id) VALUES ('Nora', 'Santiago', '1990-04-12', 5)");
    $twin = $db->insert_id;
    try {
        same([$twin], array_column($find()['duplicates'], 'beneficiaryId'), 'duplicates');
    } finally {
        $db->query("DELETE FROM beneficiaries WHERE id = $twin");
    }
});

check('participants cannot review registrations', function (mysqli $db) {
    [$status] = post(login_as('leader', 'leader123'), 'api/registrations.php', approve_body(4));
    ok($status === 403, "got $status");
});

check('approve needs Qualified and a track', function (mysqli $db) {
    [$userId] = register_and_submit('lea5a');
    $admin = login_as('admin', 'admin123');
    [$status, $json] = post($admin, 'api/registrations.php', approve_body($userId, ['assessment' => ['overallAssessment' => 'not_qualified']]));
    ok($status === 422 && $json['error'] === 'Only a Qualified applicant can be approved. Reject the registration instead.', "not qualified: $status " . json_encode($json));
    [$status] = post($admin, 'api/registrations.php', approve_body($userId, ['associationId' => null]));
    ok($status === 422, "association track without an association: $status");
    $noTrack = approve_body($userId);
    unset($noTrack['assessment']['track']);
    [$status] = post($admin, 'api/registrations.php', $noTrack);
    ok($status === 422, "no track: $status");
});

check('approve activates the account', function (mysqli $db) {
    $userId = (int) scalar($db, "SELECT id FROM users WHERE username = 'lea5a'");
    $beneficiary = (int) scalar($db, "SELECT beneficiary_id FROM users WHERE username = 'lea5a'");
    [$status, $json] = post(login_as('admin', 'admin123'), 'api/registrations.php', approve_body($userId));
    ok($status === 200, "approve: $status " . json_encode($json));
    same(['active', '2', 'active', 'verified'], $db->query("SELECT u.status, b.association_id, b.enrollment_status, b.profile_status
        FROM users u JOIN beneficiaries b ON b.id = u.beneficiary_id WHERE u.id = $userId")->fetch_row(), 'state after approval');
    ok((int) scalar($db, "SELECT COUNT(*) FROM eligibility_assessments WHERE beneficiary_id = $beneficiary AND overall_assessment = 'qualified'") === 1, 'assessment row missing');
    ok((int) scalar($db, "SELECT COUNT(*) FROM notifications WHERE beneficiary_id = $beneficiary AND title = 'Registration approved'") === 1, 'notification missing');
    ok((int) scalar($db, "SELECT COUNT(*) FROM audit_log WHERE action = 'registration.approve' AND entity_id = $userId") === 1, 'audit row missing');
    $lea = login_as('lea5a', 'applicant-pass1');
    $s = snapshot($lea);
    same(['active', 2, [$beneficiary]], [$s['me']['status'], $s['me']['associationId'], ids_of($s['beneficiaries'])], 'signed in after approval');
});

check('approving twice gives 409 and one notification', function (mysqli $db) {
    $userId = (int) scalar($db, "SELECT id FROM users WHERE username = 'lea5a'");
    $beneficiary = (int) scalar($db, "SELECT beneficiary_id FROM users WHERE username = 'lea5a'");
    [$status, $json] = post(login_as('admin', 'admin123'), 'api/registrations.php', approve_body($userId));
    ok($status === 409 && $json['error'] === 'This registration is not waiting for review.', "second approval: $status " . json_encode($json));
    ok((int) scalar($db, "SELECT COUNT(*) FROM notifications WHERE beneficiary_id = $beneficiary") === 1, 'exactly one notification');
});

check('reject needs a reason and returns the form', function (mysqli $db) {
    [$userId, $beneficiary] = register_and_submit('lea5b');
    $admin = login_as('admin', 'admin123');
    [$status] = post($admin, 'api/registrations.php', ['action' => 'reject', 'userId' => $userId, 'reason' => '']);
    ok($status === 422, "no reason: $status");
    [$status] = post($admin, 'api/registrations.php', ['action' => 'reject', 'userId' => $userId, 'reason' => 'Birthday does not match the ID.']);
    ok($status === 200, "reject: $status");
    [$status, $json] = (new Browser())->request('POST', 'api/login.php', ['username' => 'lea5b', 'password' => 'applicant-pass1']);
    same([200, 'rejected', 'Birthday does not match the ID.'], [$status, $json['me']['status'] ?? null, $json['me']['reviewNote'] ?? null], 'sign-in after rejection');
    ok(scalar($db, "SELECT profile_status FROM beneficiaries WHERE id = $beneficiary") === 'draft', 'profile should be back to draft');
});

check('a rejected applicant can resubmit', function (mysqli $db) {
    $lea = login_as('lea5b', 'applicant-pass1');
    [$status] = post($lea, 'api/profile.php', ['action' => 'save', 'data' => complete_profile()]);
    ok($status === 200, "save: $status");
    [$status] = post($lea, 'api/profile.php', ['action' => 'submit']);
    ok($status === 200, "submit: $status");
    same(['pending', null], $db->query("SELECT status, review_note FROM users WHERE username = 'lea5b'")->fetch_row(), 'after resubmitting');
});


/* ---------------- Runner ---------------- */

$db = null;
$server = null;
$temp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'slp_api_check';
run_checks($argv[1] ?? '', function () use (&$db, &$server, $temp) {
    if ($db === null) {
        @mkdir($temp, 0775, true);
        $db = install(API_DB, demo: true, fresh: true, storageDir: $temp . DIRECTORY_SEPARATOR . 'storage');
        $server = start_server($temp . DIRECTORY_SEPARATOR . 'server.log');
    }
    return $db;
}, function () use (&$server, $temp) {
    if ($server) proc_terminate($server);
    db_connect()->query('DROP DATABASE IF EXISTS ' . API_DB);
    remove_tree($temp);
});
