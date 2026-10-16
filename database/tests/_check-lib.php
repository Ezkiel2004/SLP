<?php
/*
   Shared helpers for the PHP check scripts (database/tests/schema-check.php,
   api/tests/api-check.php): a check registry, assertions and the runner.
*/

$checks = [];

function check(string $name, callable $fn, bool $demo = false): void {
    global $checks;
    $checks[] = [$name, $fn, $demo];
}

/* Passes only if $sql fails with MariaDB error $code. Returns the error message. */
function expect_error(mysqli $db, int $code, string $sql): string {
    try {
        $db->query($sql);
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() === $code) return $e->getMessage();
        throw new RuntimeException("expected error $code, got {$e->getCode()}: {$e->getMessage()}");
    }
    throw new RuntimeException("expected error $code, but the statement succeeded: $sql");
}

function ok(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

function scalar(mysqli $db, string $sql) {
    return $db->query($sql)->fetch_row()[0];
}

function column(mysqli $db, string $sql): array {
    return array_column($db->query($sql)->fetch_all(), 0);
}

function same(array $expected, array $actual, string $what): void {
    ok($expected === $actual, "$what: expected " . json_encode($expected) . ', got ' . json_encode($actual));
}

function remove_tree(string $dir): void {
    if (!is_dir($dir)) return;
    $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($items as $item) {
        $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    }
    rmdir($dir);
}

/*
   Run the registered checks. Filter: "" = all, "demo" = checks registered
   with $demo = true, anything else = part of a check name.
   $argFor($demo) gives each check its argument; $cleanup() always runs.
   Exits 1 if anything failed or nothing matched the filter.
*/
function run_checks(string $filter, callable $argFor, callable $cleanup): never {
    global $checks;
    $passed = 0;
    $failed = 0;
    try {
        foreach ($checks as [$name, $fn, $demo]) {
            $selected = $filter === '' || ($filter === 'demo' ? $demo : str_contains($name, $filter));
            if (!$selected) continue;
            try {
                $fn($argFor($demo));
                echo "PASS $name\n";
                $passed++;
            } catch (Throwable $e) {
                echo "FAIL $name: {$e->getMessage()}\n";
                $failed++;
            }
        }
    } finally {
        $cleanup();
    }
    echo "$passed passed, $failed failed\n";
    if ($passed + $failed === 0) echo "No check matched the filter \"$filter\".\n";
    exit(($failed || $passed + $failed === 0) ? 1 : 0);
}
