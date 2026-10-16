<?php
/*
   SLP database installer.
   Usage: php database/install.php [--db=slp_monitoring] [--demo] [--fresh]

   Creates the database, runs schema.sql and seed-reference.sql and,
   with --demo, the fictional demo data. Refuses a database that already
   exists unless --fresh is given (which drops it first). Only database
   names starting with slp_ are accepted, so another project's database
   can never be dropped.

   Spec: docs/superpowers/specs/2026-10-13-slp-database-schema-design.md
*/

require_once __DIR__ . '/db.php';

/* Split SQL text on ";" outside quoted strings and "--" comments. */
function split_sql(string $sql): array {
    $statements = [];
    $current = '';
    $length = strlen($sql);
    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];
        if ($char === '-' && ($sql[$i + 1] ?? '') === '-' && ctype_space($sql[$i + 2] ?? ' ')) {
            $end = strpos($sql, "\n", $i);
            $i = $end === false ? $length : $end;
            $current .= "\n";
        } elseif ($char === "'" || $char === '"' || $char === '`') {
            $j = $i + 1;
            while ($j < $length && $sql[$j] !== $char) {
                $j += $sql[$j] === '\\' ? 2 : 1;
            }
            $current .= substr($sql, $i, $j - $i + 1);
            $i = $j;
        } elseif ($char === ';') {
            if (trim($current) !== '') $statements[] = trim($current);
            $current = '';
        } else {
            $current .= $char;
        }
    }
    if (trim($current) !== '') $statements[] = trim($current);
    return $statements;
}

/* Run a SQL file one statement at a time. Any error or warning stops it. */
function run_sql_file(mysqli $db, string $path): void {
    $name = basename($path);
    if (!is_file($path)) throw new RuntimeException("$name: file not found");

    foreach (split_sql(file_get_contents($path)) as $index => $statement) {
        $number = $index + 1;
        try {
            $result = $db->query($statement);
            if ($result instanceof mysqli_result) $result->free();
        } catch (mysqli_sql_exception $e) {
            throw new RuntimeException("$name: statement $number: {$e->getMessage()}", 0, $e);
        }
        if ($db->warning_count > 0) {
            $warnings = array_map(fn($w) => "$w[0] $w[1]: $w[2]", $db->query('SHOW WARNINGS')->fetch_all());
            throw new RuntimeException("$name: statement $number: " . implode('; ', $warnings));
        }
    }
}

function install(string $dbName, bool $demo = false, bool $fresh = false, ?string $storageDir = null): mysqli {
    if (!preg_match('/^slp_[a-z0-9_]+$/', $dbName)) {
        throw new InvalidArgumentException("Database name '$dbName' must start with slp_ and use only a-z, 0-9 and _.");
    }

    $db = db_connect();
    $exists = $db->execute_query('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [$dbName])->num_rows > 0;
    if ($exists && !$fresh) {
        throw new RuntimeException("Database '$dbName' already exists. Re-run with --fresh to drop and recreate it.");
    }
    if ($exists) $db->query("DROP DATABASE `$dbName`");

    $db->query("CREATE DATABASE `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    try {
        $db->select_db($dbName);
        run_sql_file($db, __DIR__ . '/schema.sql');
        run_sql_file($db, __DIR__ . '/seed-reference.sql');
        if ($demo) install_demo($db, $storageDir ?? dirname(__DIR__) . '/storage');
    } catch (Throwable $e) {
        // Never leave a half-built database that a re-run would report as "already exists".
        $db->query("DROP DATABASE IF EXISTS `$dbName`");
        throw new RuntimeException($e->getMessage() . ' (partial database removed)', 0, $e);
    }

    return $db;
}

/* Fictional demo data, plus one copy of the placeholder PDF per document version. */
function install_demo(mysqli $db, string $storageDir): void {
    $placeholder = __DIR__ . '/demo/placeholder.pdf';
    if (!is_file($placeholder)) throw new RuntimeException("Missing $placeholder");

    foreach (['admin' => 'admin123', 'leader' => 'leader123', 'member' => 'member123', 'applicant' => 'applicant123'] as $user => $password) {
        $db->execute_query("SET @pw_$user = ?", [password_hash($password, PASSWORD_DEFAULT)]);
    }
    $db->execute_query('SET @doc_sha = ?, @doc_size = ?', [hash_file('sha256', $placeholder), filesize($placeholder)]);
    run_sql_file($db, __DIR__ . '/seed-demo.sql');

    foreach ($db->query('SELECT file_path FROM document_versions')->fetch_all() as [$path]) {
        $target = $storageDir . '/' . $path;
        if (!is_dir(dirname($target)) && !@mkdir(dirname($target), 0775, true)) {
            throw new RuntimeException('Cannot create ' . dirname($target));
        }
        if (!copy($placeholder, $target)) throw new RuntimeException("Cannot write $target");
    }
}

if (PHP_SAPI === 'cli' && get_included_files()[0] === __FILE__) {
    // Strict parsing: a mistyped option must never fall back to slp_monitoring (with --fresh it would drop it).
    $dbName = 'slp_monitoring';
    $demo = false;
    $fresh = false;
    foreach (array_slice($argv, 1) as $argument) {
        if ($argument === '--demo') {
            $demo = true;
        } elseif ($argument === '--fresh') {
            $fresh = true;
        } elseif (str_starts_with($argument, '--db=') && strlen($argument) > 5) {
            $dbName = substr($argument, 5);
        } else {
            fwrite(STDERR, "Unknown argument '$argument'. Usage: php database/install.php [--db=slp_monitoring] [--demo] [--fresh]\n");
            exit(1);
        }
    }
    try {
        $db = install($dbName, $demo, $fresh);
        [$tables, $views, $triggers] = $db->query(
            "SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'),
                    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'VIEW'),
                    (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE())"
        )->fetch_row();
        echo "Installed $dbName: $tables tables, $views view, $triggers triggers" . ($demo ? ', demo data' : '') . "\n";
    } catch (Throwable $e) {
        fwrite(STDERR, $e->getMessage() . "\n");
        exit(1);
    }
}
