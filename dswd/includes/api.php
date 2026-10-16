<?php
/* JSON API helpers. The read endpoints are public and return published content
   only, through an explicit list of fields. The feedback endpoint needs the
   session's CSRF token (GET api/feedback.php hands one out to this site's pages). */
declare(strict_types=1);

define('LANG', in_array($_GET['lang'] ?? '', ['en', 'fil'], true) ? $_GET['lang'] : 'en');
require __DIR__ . '/bootstrap.php';

set_exception_handler(function (Throwable $ex): void {
    error_log((string) $ex);
    json_out(['error' => 'Something went wrong. Try again later.'], 500);
});

/** Send JSON and stop. $maxAge > 0 lets browsers and proxies cache public reads. */
function json_out(mixed $data, int $status = 200, int $maxAge = 0): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: ' . ($maxAge > 0 ? 'public, max-age=' . $maxAge : 'no-store'));
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_method(string $method): void
{
    $actual = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($actual !== $method && !($method === 'GET' && $actual === 'HEAD')) { // HEAD is GET without the body
        header('Allow: ' . ($method === 'GET' ? 'GET, HEAD' : $method));
        json_out(['error' => 'Method not allowed'], 405);
    }
}

/** Absolute URL for a site path, for API consumers. */
function absolute_url(string $path, array $query = []): string
{
    $scheme = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
    return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . url($path, $query);
}

function api_download(array $d): array
{
    return ['title' => $d['title'], 'category' => $d['category'], 'year' => $d['year'], 'size_bytes' => $d['size'], 'url' => absolute_url($d['file'])];
}

function api_program(array $p, bool $full): array
{
    $out = [
        'slug' => $p['slug'], 'title' => $p['title'], 'title_en' => $p['title_en'], 'title_fil' => $p['title_fil'],
        'kind' => $p['kind'], 'category' => $p['category'], 'summary' => $p['summary'],
        'url' => absolute_url('program.php', ['slug' => $p['slug']]),
    ];
    if ($full) {
        $out += [
            'description_html' => $p['description'], 'eligibility' => $p['eligibility'],
            'requirements' => $p['requirements'], 'steps' => $p['steps'],
            'forms' => array_map('api_download', $p['form_files']),
        ];
    }
    return $out;
}
