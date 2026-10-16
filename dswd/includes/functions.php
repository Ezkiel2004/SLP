<?php
/* Shared helpers for the public site, the API and the admin dashboard:
   output escaping, URLs, icons, request values, dates, sessions, flash
   messages, settings, audit log and rate limits. */
declare(strict_types=1);

const SITE_NAME = 'Department of Social Welfare and Development';
const SITE_SHORT = 'DSWD';

// URL path of the site folder (e.g. /SLP/dswd), so links work from any subfolder.
define('BASE_URL', rtrim(str_replace('\\', '/', substr(
    (string) realpath(__DIR__ . '/..'),
    strlen((string) realpath($_SERVER['DOCUMENT_ROOT'] ?? ''))
)), '/'));


/* ---------- output ---------- */

/** Escape text for HTML. Use on every value that is not static markup. */
function e(string|int|float|null $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Site URL for a path, with empty query values dropped. */
function url(string $path = '', array $query = []): string
{
    $query = array_filter($query, fn ($v) => $v !== null && $v !== '');
    return BASE_URL . '/' . ltrim($path, '/') . ($query ? '?' . http_build_query($query) : '');
}

/** CSS and JS bundles made by tools/build-assets.php: [minified file => source files]. */
const BUNDLES = [
    'css/site.min.css' => ['css/tokens.css', 'css/base.css', 'css/components.css'],
    'js/ui.min.js' => ['js/ui.js'],
    'js/admin.min.js' => ['js/admin.js'],
];

/** URL of a static file with ?v=<last change>. Browsers keep such URLs for a
    year (.htaccess) and still fetch a new copy after every change. */
function asset(string $path): string
{
    return url($path, ['v' => (string) @filemtime(dirname(__DIR__) . '/' . $path)]);
}

/** URLs for one bundle: the minified file while it is newer than all its
    sources, otherwise the sources, so an edit shows up before the next build. */
function bundle(string $min): array
{
    $root = dirname(__DIR__) . '/';
    $sources = BUNDLES[$min];
    $fresh = is_file($root . $min) && filemtime($root . $min) >= max(array_map(fn ($s) => (int) filemtime($root . $s), $sources));
    return array_map('asset', $fresh ? [$min] : $sources);
}

/** Lucide icon from the sprite. Always decorative: put visible text next to it. */
function icon(string $name, string $class = ''): string
{
    static $sprite = null;
    $sprite ??= e(asset('img/icons.svg'));
    return '<svg class="icon' . ($class !== '' ? ' ' . e($class) : '') . '" aria-hidden="true" focusable="false">'
        . '<use href="' . $sprite . '#' . e($name) . '"></use></svg>';
}

/** <select> options with the current value selected. $options: [value => label]. */
function options(array $options, string $selected): string
{
    $html = '';
    foreach ($options as $value => $label) {
        $html .= '<option value="' . e((string) $value) . '"' . ((string) $value === $selected ? ' selected' : '') . '>' . e($label) . '</option>';
    }
    return $html;
}

/** "245 KB" / "1.2 MB". */
function format_bytes(int $bytes): string
{
    return $bytes >= 1048576 ? round($bytes / 1048576, 1) . ' MB' : max(1, (int) round($bytes / 1024)) . ' KB';
}

/** "12 October 2026" in the current language. */
function format_date(?string $date): string
{
    $time = $date ? strtotime($date) : false;
    return $time === false ? '' : date('j', $time) . ' ' . t('month.' . date('n', $time)) . ' ' . date('Y', $time);
}

/** Lowercase, hyphenated URL name: "Social Pension 2026!" → "social-pension-2026". */
function slugify(string $text): string
{
    $text = strtolower(trim((string) preg_replace('/[^A-Za-z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text), '-'));
    return $text !== '' ? substr($text, 0, 150) : 'item-' . bin2hex(random_bytes(3));
}


/* ---------- request values ---------- */

/** Trimmed GET text parameter, capped at 100 characters. */
function param(string $key): string
{
    $value = $_GET[$key] ?? '';
    return is_string($value) ? mb_substr(trim($value), 0, 100) : '';
}

/** Positive integer GET parameter (page numbers, ids, years). */
function int_param(string $key, int $default = 0): int
{
    $value = filter_var($_GET[$key] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $value === false || $value === null ? $default : $value;
}

/** Trimmed POST text value ('' when missing or not a string). */
function post(string $key): string
{
    $value = $_POST[$key] ?? '';
    return is_string($value) ? trim($value) : '';
}

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

/** Redirect within the site and stop. */
function redirect(string $path, array $query = []): never
{
    header('Location: ' . url($path, $query), true, 303);
    exit;
}


/* ---------- sessions and flash messages ---------- */

/** Start the session with safe cookie settings (only pages that need it call this). */
function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('dswd_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => BASE_URL . '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

/** Store a one-time message for the next page (type: success, warning, error). */
function flash(string $type, string $message): void
{
    start_session();
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

/** Read and clear the one-time messages. */
function take_flash(): array
{
    start_session();
    $messages = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $messages;
}

/** Alert component for one message (title text is escaped; $body is trusted HTML). */
function alert(string $type, string $title, string $body = '', bool $live = false): string
{
    $icons = ['success' => 'circle-check', 'warning' => 'triangle-alert', 'error' => 'circle-alert'];
    return '<div class="alert alert--' . e($type) . '"' . ($live ? ' role="alert"' : '') . '>'
        . icon($icons[$type] ?? 'circle-alert', 'icon--24 alert__icon')
        . '<div class="alert__content"><p class="alert__title"><span class="visually-hidden">' . e(t('alert.' . $type)) . ' </span>' . e($title) . '</p>'
        . $body . '</div></div>';
}


/* ---------- settings, audit, rate limits ---------- */

/** Editable site text (contact details, mandate…) from site_settings, cached per request. */
function setting(string $key): string
{
    static $settings = null;
    $settings ??= array_column(db_all('SELECT setting_key, value FROM site_settings'), 'value', 'setting_key');
    return (string) ($settings[$key] ?? '');
}

/** Record an admin action. Never store personal data in the summary. */
function audit(string $action, string $table = '', ?int $recordId = null, string $summary = '', ?int $userId = null): void
{
    db_exec(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, summary) VALUES (?, ?, ?, ?, ?)',
        [$userId ?? ($_SESSION['uid'] ?? null), $action, $table, $recordId, mb_substr($summary, 0, 255)]
    );
}

/** HMAC of the client IP, so rate limits never store raw addresses. */
function client_key(): string
{
    return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'cli', CONFIG['app_secret'] ?: 'dswd');
}

/** True when $bucket already has $max hits inside the current window. */
function rate_limited(string $bucket, int $max, int $windowSeconds): bool
{
    $hits = db_value(
        'SELECT hits FROM rate_limits WHERE bucket = ? AND window_start > NOW() - INTERVAL ? SECOND',
        [$bucket, $windowSeconds]
    );
    return (int) $hits >= $max;
}

/** Count one hit; a stale window starts again at 1. */
function rate_hit(string $bucket, int $windowSeconds): void
{
    db_exec(
        'INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, NOW())
         ON DUPLICATE KEY UPDATE
            hits = IF(window_start <= NOW() - INTERVAL ? SECOND, 1, hits + 1),
            window_start = IF(window_start <= NOW() - INTERVAL ? SECOND, NOW(), window_start)',
        [$bucket, $windowSeconds, $windowSeconds]
    );
}

function rate_clear(string $bucket): void
{
    db_exec('DELETE FROM rate_limits WHERE bucket = ?', [$bucket]);
}
