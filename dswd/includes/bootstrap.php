<?php
/* Shared setup for every PHP request (public pages, API, admin): configuration,
   database, helpers, language, error handling and security headers.
   A public page then sets $page = ['title' => …, 'description' => …, 'nav' => …]
   and includes head.php, header.php, its content and footer.php.
   The admin and the API define LANG as 'en' before including this file. */
declare(strict_types=1);

require __DIR__ . '/../config/config.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/functions.php';
require __DIR__ . '/lang.php';
require __DIR__ . '/repository.php';


/* ---------- errors: details in development, a plain message in production ---------- */

ini_set('display_errors', CONFIG['app_env'] === 'production' ? '0' : '1');
ini_set('log_errors', '1');
set_exception_handler(function (Throwable $ex): void {
    error_log((string) $ex);
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: text/html; charset=utf-8');
    }
    echo CONFIG['app_env'] === 'production'
        ? '<!doctype html><html lang="en"><title>Something went wrong</title><p>Sorry, something went wrong. Please try again later.</p>'
        : '<pre>' . e((string) $ex) . '</pre>';
});


/* ---------- compression and security headers for every PHP response ---------- */

// Gzip pages and JSON even where Apache's mod_deflate is off (it skips output that is already compressed).
ini_set('zlib.output_compression', '1');
header_remove('X-Powered-By');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    header('Strict-Transport-Security: max-age=31536000');
}
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');


/* ---------- language: ?lang=en|fil, remembered in a cookie for a year ---------- */

if (!defined('LANG')) {
    $requestedLang = $_GET['lang'] ?? null;
    if (is_string($requestedLang) && isset(STRINGS[$requestedLang])) {
        setcookie('lang', $requestedLang, [
            'expires' => time() + 31536000,
            'path' => BASE_URL . '/',
            'samesite' => 'Lax',
            'httponly' => true,
        ]);
        define('LANG', $requestedLang);
    } else {
        $cookieLang = $_COOKIE['lang'] ?? 'en';
        define('LANG', is_string($cookieLang) && isset(STRINGS[$cookieLang]) ? $cookieLang : 'en');
    }
}

/** Interface text in the current language; falls back to English, then to the key. */
function t(string $key, array $vars = []): string
{
    $text = STRINGS[LANG][$key] ?? STRINGS['en'][$key] ?? $key;
    foreach ($vars as $name => $value) {
        $text = str_replace('{' . $name . '}', (string) $value, $text);
    }
    return $text;
}

/** The current URL with ?lang= swapped, for the language toggle. */
function lang_url(string $lang): string
{
    $query = $_GET;
    $query['lang'] = $lang;
    return strtok($_SERVER['REQUEST_URI'] ?? '', '?') . '?' . http_build_query($query);
}


/* ---------- page parts ---------- */

/** Breadcrumb trail. $items: [label => href, …]; the last label is the current page. */
function breadcrumbs(array $items): string
{
    $html = '<nav class="breadcrumb" aria-label="' . e(t('breadcrumb.label')) . '"><ol class="breadcrumb__list">';
    $labels = array_keys($items);
    foreach ($labels as $i => $label) {
        $html .= '<li class="breadcrumb__item">' . ($i > 0 ? icon('chevron-right') : '');
        $html .= $i === count($labels) - 1
            ? '<span aria-current="page">' . e((string) $label) . '</span>'
            : '<a href="' . e($items[$label]) . '">' . e((string) $label) . '</a>';
        $html .= '</li>';
    }
    return $html . '</ol></nav>';
}

/** Title band: breadcrumbs, the page's one H1, a lead sentence and an optional action (trusted HTML). */
function title_band(string $title, string $lead = '', array $crumbs = [], string $action = '', string $extraClass = ''): string
{
    $html = '<div class="title-band' . ($extraClass !== '' ? ' ' . e($extraClass) : '') . '"><div class="container">';
    if ($crumbs) {
        $html .= breadcrumbs([t('nav.home') => url('index.php')] + $crumbs);
    }
    $html .= '<h1 class="title-band__title">' . e($title) . '</h1>';
    if ($lead !== '') {
        $html .= '<p class="title-band__lead">' . e($lead) . '</p>';
    }
    return $html . $action . '</div></div>';
}

/** Pagination nav for a list split into pages of $perPage. Keeps the current filters. */
function pagination(int $total, int $current, int $perPage, string $path, array $query): string
{
    $pages = (int) ceil($total / $perPage);
    if ($pages <= 1) {
        return '';
    }
    $link = fn (int $n) => e(url($path, ['page' => $n > 1 ? $n : null] + $query));
    $html = '<nav class="pagination" aria-label="' . e(t('pagination.label')) . '"><ul class="pagination__list">';
    $number = fn (int $n) => '<li class="pagination__page"><a class="pagination__link" href="' . $link($n) . '"'
        . ($n === $current ? ' aria-current="page"' : '') . ' aria-label="' . e(t('pagination.page', ['n' => $n])) . '">' . $n . '</a></li>';
    $html .= $current > 1
        ? '<li><a class="pagination__link" href="' . $link($current - 1) . '">' . icon('chevron-left') . e(t('pagination.previous')) . '</a></li>'
        : '<li><span class="pagination__link" role="link" aria-disabled="true">' . icon('chevron-left') . e(t('pagination.previous')) . '</span></li>';
    // Phones show this instead of the numbers (components.css, section 9).
    $html .= '<li class="pagination__status">' . e(t('pagination.status', ['n' => min($current, $pages), 'total' => $pages])) . '</li>';
    // The first and last page and the pages next to the current one; an ellipsis stands for a longer gap.
    $shown = array_unique(array_filter([1, $current - 1, $current, $current + 1, $pages], fn ($n) => $n >= 1 && $n <= $pages));
    sort($shown);
    $before = 0;
    foreach ($shown as $n) {
        if ($n - $before === 2) {
            $html .= $number($n - 1);
        } elseif ($n - $before > 2) {
            $html .= '<li class="pagination__page"><span class="pagination__ellipsis" aria-hidden="true">…</span></li>';
        }
        $html .= $number($n);
        $before = $n;
    }
    $html .= $current < $pages
        ? '<li><a class="pagination__link" href="' . $link($current + 1) . '">' . e(t('pagination.next')) . icon('chevron-right') . '</a></li>'
        : '<li><span class="pagination__link" role="link" aria-disabled="true">' . e(t('pagination.next')) . icon('chevron-right') . '</span></li>';
    return $html . '</ul></nav>';
}
