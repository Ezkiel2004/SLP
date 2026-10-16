<?php
/*
   SLP database checks.
   Usage: php database/tests/schema-check.php [name-filter]

   Installs into scratch databases (slp_schema_check, and
   slp_schema_check_demo for demo checks), runs every check, prints
   PASS/FAIL per check, then drops the scratch databases.
   The filter "demo" selects every demo check; any other filter
   matches part of a check name.
   Spec: docs/superpowers/specs/2026-10-13-slp-database-schema-design.md §13
*/

require __DIR__ . '/../install.php';
require __DIR__ . '/_check-lib.php';

const SCRATCH = 'slp_schema_check';
const SCRATCH_DEMO = 'slp_schema_check_demo';

const BARANGAYS = [
    'Araw at Bituin', 'Bagong Sikat', 'Banaag at Pag-asa', 'Binakas', 'Cabra', 'Likas ng Silangan',
    'Maginhawa', 'Maligaya', 'Maliig', 'Ninikat ng Pag-asa', 'Paraiso', 'Surville', 'Tagbac', 'Tangal',
    'Tilik', 'Vigo',
];
const POBLACION = [
    'Araw at Bituin', 'Bagong Sikat', 'Banaag at Pag-asa', 'Likas ng Silangan', 'Maginhawa',
    'Ninikat ng Pag-asa', 'Paraiso', 'Surville',
];
const LIVELIHOODS = ['Sari-sari Store', 'Poultry Raising', 'Piggery', 'Food Vending', 'Fishing', 'Livestock Raising', 'Farming'];

/* ---------------- Task 1: installer, schema, reference data ---------------- */

check('schema imports with no warnings', function (mysqli $db) {
    ok(scalar($db, 'SELECT DATABASE()') === SCRATCH, 'install() did not return a connection on ' . SCRATCH);
});

check('object counts', function (mysqli $db) {
    $tables = (int) scalar($db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
    ok($tables === 18, "expected 18 tables, got $tables");
    same(['user_roles'], column($db, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'VIEW'"), 'views');
    $triggers = (int) scalar($db, 'SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()');
    ok($triggers === 10, "expected 10 triggers, got $triggers");
});

check('16 barangays, 8 poblacion', function (mysqli $db) {
    same(BARANGAYS, column($db, 'SELECT name FROM barangays ORDER BY id'), 'barangays');
    ok((int) scalar($db, 'SELECT SUM(is_poblacion) FROM barangays') === 8, 'expected 8 poblacion barangays');
});

check('poblacion flags', function (mysqli $db) {
    same(POBLACION, column($db, 'SELECT name FROM barangays WHERE is_poblacion = 1 ORDER BY id'), 'poblacion barangays');
});

check('7 livelihood types', function (mysqli $db) {
    same(LIVELIHOODS, column($db, 'SELECT name FROM livelihood_types ORDER BY id'), 'livelihood types');
});

check('installer refuses existing database', function (mysqli $db) {
    try {
        install(SCRATCH);
    } catch (RuntimeException $e) {
        ok(str_contains($e->getMessage(), 'already exists'), 'wrong message: ' . $e->getMessage());
        ok((int) scalar($db, 'SELECT COUNT(*) FROM barangays') === 16, 'the existing database was changed');
        return;
    }
    throw new RuntimeException('install() did not refuse an existing database');
});

check('installer refuses non-slp names', function (mysqli $db) {
    $name = 'not_slp_schema_check';
    try {
        install($name, fresh: true);
    } catch (InvalidArgumentException $e) {
        $created = $db->execute_query('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [$name])->num_rows;
        ok($created === 0, "install() created $name before refusing it");
        return;
    }
    throw new RuntimeException("install() accepted the name $name");
});

check('run_sql_file stops at a bad statement', function (mysqli $db) {
    $file = tempnam(sys_get_temp_dir(), 'slp');
    file_put_contents($file, "SELECT 1;\nSELEC 2;\nSELECT 3;\n");
    try {
        run_sql_file($db, $file);
    } catch (RuntimeException $e) {
        ok(str_contains($e->getMessage(), 'statement 2'), 'message does not name statement 2: ' . $e->getMessage());
        return;
    } finally {
        unlink($file);
    }
    throw new RuntimeException('run_sql_file() did not stop at the bad statement');
});

check('run_sql_file ignores semicolons in comments and strings', function (mysqli $db) {
    $file = tempnam(sys_get_temp_dir(), 'slp');
    file_put_contents($file, "-- a comment; with a semicolon\nSET @slp_check = 'x;y';\nSET @slp_check2 = 'it''s; fine';\n");
    try {
        run_sql_file($db, $file);
    } finally {
        unlink($file);
    }
    same(['x;y', "it's; fine"], $db->query('SELECT @slp_check, @slp_check2')->fetch_row(), 'session variables');
});

check('run_sql_file stops on a warning', function (mysqli $db) {
    $file = tempnam(sys_get_temp_dir(), 'slp');
    file_put_contents($file, "SELECT 1;\nSELECT CAST('abc' AS INTEGER);\n");   // warning 1292, even in strict mode
    try {
        run_sql_file($db, $file);
    } catch (RuntimeException $e) {
        ok(str_contains($e->getMessage(), 'statement 2') && str_contains($e->getMessage(), '1292'), 'wrong message: ' . $e->getMessage());
        return;
    } finally {
        unlink($file);
    }
    throw new RuntimeException('run_sql_file() ignored a warning');
});

check('connection uses +08:00', function (mysqli $db) {
    $zone = scalar($db, 'SELECT @@session.time_zone');
    ok($zone === '+08:00', "time_zone is $zone");
});

check('strict mode rejects bad enum and long text', function (mysqli $db) {
    expect_error($db, 1265, "INSERT INTO livelihood_types (name, status) VALUES ('X', 'maybe')");
    expect_error($db, 1406, "INSERT INTO livelihood_types (name) VALUES (REPEAT('a', 101))");
});

check('utf8mb4 round-trips ñ', function (mysqli $db) {
    $db->query("INSERT INTO livelihood_types (name) VALUES ('Piña Processing')");
    $id = $db->insert_id;
    try {
        ok(scalar($db, "SELECT name FROM livelihood_types WHERE id = $id") === 'Piña Processing', 'name did not round-trip');
        // Server side too: a wrong connection charset reads back fine in PHP but stores mojibake.
        ok((int) scalar($db, "SELECT CHAR_LENGTH(name) FROM livelihood_types WHERE id = $id") === 15, 'the server did not store 15 characters');
    } finally {
        $db->query("DELETE FROM livelihood_types WHERE id = $id");
    }
});


/* ---------------- Task 2: demo data and stored files ---------------- */

check('demo counts', function (mysqli $db) {
    $expected = [
        'associations' => 5, 'beneficiaries' => 13, 'users' => 4, 'projects' => 6, 'documents' => 4,
        'document_versions' => 4, 'tool_submissions' => 1, 'tool_submission_versions' => 1, 'profile_versions' => 3,
        'monitoring_visits' => 2, 'assistance' => 2, 'reports' => 3, 'notifications' => 3, 'audit_log' => 9,
    ];
    $actual = [];
    foreach (array_keys($expected) as $table) $actual[$table] = (int) scalar($db, "SELECT COUNT(*) FROM $table");
    same($expected, $actual, 'row counts');
    ok((int) scalar($db, 'SELECT COUNT(DISTINCT barangay_id) FROM associations') === 5, 'associations are not in 5 different barangays');
}, demo: true);

check('every association has a leader and 2+ members', function (mysqli $db) {
    $pairs = fn(string $sql) => array_map('intval', array_column($db->query($sql)->fetch_all(), 1, 0));
    same([1 => 1, 2 => 6, 3 => 8, 4 => 10, 5 => 4], $pairs('SELECT id, leader_id FROM associations ORDER BY id'), 'leaders');
    same([1 => 3, 2 => 2, 3 => 2, 4 => 2, 5 => 2], $pairs('SELECT association_id, COUNT(*) FROM beneficiaries WHERE association_id IS NOT NULL GROUP BY association_id ORDER BY association_id'), 'members per association');
}, demo: true);

check('same livelihood, different barangays', function (mysqli $db) {
    same([['Poultry Raising', 'Tilik'], ['Poultry Raising', 'Maliig']], $db->query(
        'SELECT t.name, b.name FROM associations a
         JOIN livelihood_types t ON t.id = a.livelihood_type_id
         JOIN barangays b ON b.id = a.barangay_id
         WHERE a.id IN (2, 3) ORDER BY a.id'
    )->fetch_all(), 'associations 2 and 3');
}, demo: true);

check('demo passwords', function (mysqli $db) {
    $hashes = array_column($db->query('SELECT username, password_hash FROM users')->fetch_all(), 1, 0);
    foreach (['admin' => 'admin123', 'leader' => 'leader123', 'member' => 'member123'] as $user => $password) {
        ok(password_verify($password, $hashes[$user] ?? ''), "$user does not accept $password");
        ok(!password_verify('password', $hashes[$user] ?? ''), "$user accepts the word password");
    }
}, demo: true);

check('user_roles for demo accounts', function (mysqli $db) {
    same([['1', 'staff', null], ['2', 'leader', '1'], ['3', 'member', '1'], ['4', 'member', null]],
        $db->query('SELECT user_id, role, association_id FROM user_roles ORDER BY user_id')->fetch_all(), 'user_roles');
}, demo: true);

check('stored files match their hashes', function (mysqli $db) {
    global $storage;
    $rows = $db->query('SELECT file_path, sha256, size_bytes FROM document_versions')->fetch_all(MYSQLI_ASSOC);
    ok(count($rows) > 0, 'no document versions');
    foreach ($rows as $row) {
        $file = $storage . '/' . $row['file_path'];
        ok(is_file($file), "missing $file");
        ok(hash_file('sha256', $file) === $row['sha256'], "hash mismatch for {$row['file_path']}");
        ok(filesize($file) === (int) $row['size_bytes'], "size mismatch for {$row['file_path']}");
        ok(file_get_contents($file, false, null, 0, 5) === '%PDF-', "{$row['file_path']} is not a PDF");
    }
}, demo: true);

check('storage is not web-readable', function (mysqli $db) {
    $file = __DIR__ . '/../../storage/.htaccess';
    ok(is_file($file) && in_array('Require all denied', array_map('trim', file($file)), true), 'storage/.htaccess must contain "Require all denied"');
}, demo: true);

check('connection and view use utf8mb4_unicode_ci', function (mysqli $db) {
    ok(scalar($db, 'SELECT @@collation_connection') === 'utf8mb4_unicode_ci', 'collation_connection is ' . scalar($db, 'SELECT @@collation_connection'));
    $view = scalar($db, "SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_roles' AND COLUMN_NAME = 'role'");
    ok($view === 'utf8mb4_unicode_ci', "user_roles.role collation is $view");
});

check('failed install removes the partial database', function (mysqli $db) {
    $name = 'slp_schema_check_fail';
    $blocker = tempnam(sys_get_temp_dir(), 'slp');          // a file, so no folder can be made under it
    try {
        install($name, demo: true, fresh: true, storageDir: $blocker . '/storage');
    } catch (RuntimeException $e) {
        ok(str_contains($e->getMessage(), 'partial database removed'), 'wrong message: ' . $e->getMessage());
        $left = $db->execute_query('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [$name])->num_rows;
        ok($left === 0, "$name was left behind");
        return;
    } finally {
        unlink($blocker);
    }
    throw new RuntimeException('install() succeeded with unwritable storage');
}, demo: true);

check('CLI rejects unknown arguments', function (mysqli $db) {
    // Without --fresh, so a broken parser can at worst be refused by "already exists", never drop anything.
    foreach (['--database=slp_schema_check_cli', 'slp_schema_check_cli', '-db=slp_schema_check_cli'] as $argument) {
        exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/../install.php') . ' ' . escapeshellarg($argument) . ' 2>&1', $output, $code);
        ok($code === 1, "$argument: exit code $code");
        ok(str_contains(implode("\n", $output), 'Unknown argument'), "$argument: wrong message: " . implode(' ', $output));
        $output = [];
    }
});

// The SQL files and this script (which creates and drops databases as root) must never run over HTTP.
check('database folder is not web-readable', function (mysqli $db) {
    $file = __DIR__ . '/../.htaccess';
    ok(is_file($file) && in_array('Require all denied', array_map('trim', file($file)), true), 'database/.htaccess must contain "Require all denied"');
});


/* ---------------- Task 3: spec rules (§7 and §13) ---------------- */

/* Run $fn in a transaction that is always rolled back, so checks do not depend on their order. */
function rolled_back(mysqli $db, callable $fn): void {
    $db->begin_transaction();
    try {
        $fn();
    } finally {
        $db->rollback();
    }
}

/* Ids returned by a parameterised query (the spec §7 read rules). */
function ids(mysqli $db, string $sql, array $params): array {
    return array_map('intval', array_column($db->execute_query($sql, $params)->fetch_all(), 0));
}

const REJECTIONS = [
    'rejects staff with a beneficiary' => [
        [4025, "INSERT INTO users (username, password_hash, role, beneficiary_id, full_name) VALUES ('x1', 'x', 'staff', 5, 'X')"],
    ],
    'rejects participant without beneficiary' => [
        [4025, "INSERT INTO users (username, password_hash, role, beneficiary_id, full_name) VALUES ('x2', 'x', 'participant', NULL, NULL)"],
    ],
    'rejects document with two owners or none' => [
        [4025, "INSERT INTO documents (association_id, beneficiary_id, title, category, created_by) VALUES (1, 1, 'X', 'other', 1)"],
        [4025, "INSERT INTO documents (association_id, beneficiary_id, title, category, created_by) VALUES (NULL, NULL, 'X', 'other', 1)"],
    ],
    'rejects project with two owners or none' => [
        [4025, "INSERT INTO projects (association_id, beneficiary_id, livelihood_type_id, name) VALUES (1, 1, 1, 'X')"],
        [4025, "INSERT INTO projects (association_id, beneficiary_id, livelihood_type_id, name) VALUES (NULL, NULL, 1, 'X')"],
    ],
    'rejects returned document without note' => [
        [4025, "UPDATE documents SET status = 'returned', review_note = NULL WHERE id = 1"],
    ],
    'rejects invalid JSON' => [
        [4025, "INSERT INTO profile_versions (beneficiary_id, version_no, data, created_by) VALUES (3, 1, '{not json', 1)"],
    ],
    'rejects malformed sha256' => [
        [4025, "INSERT INTO document_versions (document_id, version_no, file_path, original_name, mime_type, size_bytes, sha256, created_by)
                VALUES (1, 2, 'x', 'x.pdf', 'application/pdf', 1, 'ABC', 1)"],
    ],
    'rejects tool submitted without time' => [
        [4025, 'UPDATE tool_submissions SET submitted_at = NULL WHERE id = 1'],
    ],
    'rejects sharing a draft report' => [
        [4025, "UPDATE reports SET shared_with_participants = 1 WHERE status = 'for_review'"],
    ],
    'rejects negative assistance' => [
        [4025, 'UPDATE assistance SET amount = -1 WHERE id = 1'],
    ],
    'rejects association without livelihood type' => [
        [1048, "INSERT INTO associations (name, livelihood_type_id, barangay_id) VALUES ('X SLPA', NULL, 1)"],
    ],
    'rejects duplicate livelihood type' => [
        [1062, "INSERT INTO livelihood_types (name) VALUES ('piggery')"],
    ],
    'rejects second Poultry association in Tilik' => [
        [1062, "INSERT INTO associations (name, livelihood_type_id, barangay_id) VALUES ('Tilik Poultry Two SLPA',
                (SELECT id FROM livelihood_types WHERE name = 'Poultry Raising'), (SELECT id FROM barangays WHERE name = 'Tilik'))"],
    ],
    'rejects unknown barangay' => [
        [1452, "INSERT INTO beneficiaries (first_name, last_name, barangay_id) VALUES ('X', 'Y', 99)"],
    ],
    // Carmen (7) is a non-leader member of association 2, so the unique-leader key cannot fire first.
    'rejects leader from another association' => [
        [1452, 'UPDATE associations SET leader_id = 7 WHERE id = 1'],
    ],
    // Spec §8: two saves racing for the same version number.
    'rejects duplicate version number' => [
        [1062, "INSERT INTO document_versions (document_id, version_no, file_path, original_name, mime_type, size_bytes, sha256, created_by)
                VALUES (1, 1, 'dup', 'x.pdf', 'application/pdf', 1, REPEAT('0', 64), 1)"],
    ],
];

foreach (REJECTIONS as $name => $cases) {
    check($name, function (mysqli $db) use ($cases) {
        rolled_back($db, function () use ($db, $cases) {
            foreach ($cases as [$code, $sql]) expect_error($db, $code, $sql);
        });
    }, demo: true);
}

check('history tables are append-only', function (mysqli $db) {
    rolled_back($db, function () use ($db) {
        $db->query("INSERT INTO eligibility_assessments (beneficiary_id, version_no, data, created_by) VALUES (1, 1, '{}', 1)");
        foreach (['profile_versions', 'eligibility_assessments', 'document_versions', 'tool_submission_versions', 'audit_log'] as $table) {
            $id = (int) scalar($db, "SELECT MIN(id) FROM $table");
            ok($id > 0, "$table has no row to test");
            foreach (["UPDATE $table SET created_at = created_at WHERE id = $id", "DELETE FROM $table WHERE id = $id"] as $sql) {
                $message = expect_error($db, 1644, $sql);
                ok(str_contains($message, 'append-only'), "$table: unexpected message: $message");
            }
        }
    });
}, demo: true);

check('changing the leader changes roles only', function (mysqli $db) {
    rolled_back($db, function () use ($db) {
        $db->query('UPDATE associations SET leader_id = 2 WHERE id = 1');
        same([['2', 'member', '1'], ['3', 'leader', '1']],
            $db->query('SELECT user_id, role, association_id FROM user_roles WHERE user_id IN (2, 3) ORDER BY user_id')->fetch_all(), 'roles after the change');
    });
}, demo: true);

check("Juan sees only his association's documents", function (mysqli $db) {
    same([1, 2], ids($db, 'SELECT id FROM documents WHERE association_id = ? OR beneficiary_id = ? ORDER BY id', [1, 2]), 'documents for Juan');
}, demo: true);

check('Juan sees submitted tools of his association', function (mysqli $db) {
    same([1], ids($db, "SELECT id FROM tool_submissions WHERE association_id = ? AND (status = 'submitted' OR created_by = ?) ORDER BY id", [1, 3]), 'tools for Juan');
}, demo: true);

check('notifications reach the right people', function (mysqli $db) {
    $sql = 'SELECT id FROM notifications WHERE beneficiary_id IS NULL OR beneficiary_id = ? ORDER BY id';
    same([3], ids($db, $sql, [2]), 'notifications for Juan');
    same([1, 3], ids($db, $sql, [1]), 'notifications for Maria');
}, demo: true);

check('activity feed is per association', function (mysqli $db) {
    $sql = "SELECT id FROM audit_log WHERE association_id = ? AND action IN
            ('document.submit', 'document.resubmit', 'document.review', 'document.staff_version', 'tool.submit', 'tool.staff_version')";
    ok(count(ids($db, $sql, [1])) === 5, 'association 1 feed should have 5 rows');
    ok(count(ids($db, $sql, [2])) === 1, 'association 2 feed should have 1 row');
}, demo: true);


/* ---------------- Part A2: self-registration (account status) ---------------- */

check('rejected account needs a note', function (mysqli $db) {
    rolled_back($db, fn() => expect_error($db, 4025, "UPDATE users SET status = 'rejected', review_note = NULL WHERE id = 4"));
}, demo: true);

check('staff account cannot be an applicant', function (mysqli $db) {
    rolled_back($db, fn() => expect_error($db, 4025, "UPDATE users SET status = 'registering' WHERE id = 1"));
}, demo: true);

check('demo applicant is pending', function (mysqli $db) {
    same(['pending', '1'], $db->query('SELECT status, submitted_at IS NOT NULL FROM users WHERE id = 4')->fetch_row(), 'user 4');
    same(['applicant', 'submitted', null, '1990-04-12'],
        $db->query('SELECT enrollment_status, profile_status, association_id, birthday FROM beneficiaries WHERE id = 13')->fetch_row(), 'beneficiary 13');
}, demo: true);


/* ---------------- Runner ---------------- */

$storage = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'slp_schema_check_storage';
$connections = [];
run_checks($argv[1] ?? '', function (bool $demo) use (&$connections, $storage) {
    return $connections[(int) $demo] ??= install($demo ? SCRATCH_DEMO : SCRATCH, demo: $demo, fresh: true, storageDir: $storage);
}, function () use ($storage) {
    $admin = db_connect();
    $admin->query('DROP DATABASE IF EXISTS ' . SCRATCH);
    $admin->query('DROP DATABASE IF EXISTS ' . SCRATCH_DEMO);
    $admin->query('DROP DATABASE IF EXISTS slp_schema_check_fail');
    remove_tree($storage);
});
