<?php
/* Combine and minify the CSS and JS for production (BUNDLES in includes/functions.php).
   Run it after every CSS or JS change, and on the server after copying files:
       C:\xampp\php\php.exe tools\build-assets.php
   Pages use a bundle only while it is newer than all its sources, so a stale
   bundle is never served. Always edit the commented source files, never the .min files. */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../includes/functions.php';

/** Comments and extra white space out. "+" and "~" keep their spaces (calc(), selectors). */
function minify_css(string $css): string
{
    $css = preg_replace('~/\*.*?\*/~s', '', $css);
    $css = preg_replace('~\s+~', ' ', $css);
    $css = preg_replace('~\s*([{};,>])\s*~', '$1', $css);
    return trim(str_replace([': ', ';}'], [':', '}'], $css)) . "\n";
}

/** Block comments, comment lines, indentation and blank lines out; line breaks
    stay, so no statement can run into the next. These files have no "/*" or
    line-leading "//" inside strings. */
function minify_js(string $js): string
{
    $lines = array_map('trim', explode("\n", preg_replace('~/\*.*?\*/~s', '', $js)));
    return implode("\n", array_filter($lines, fn ($l) => $l !== '' && !str_starts_with($l, '//'))) . "\n";
}

$root = dirname(__DIR__) . '/';
foreach (BUNDLES as $min => $sources) {
    $code = implode("\n", array_map(fn ($s) => (string) file_get_contents($root . $s), $sources));
    $out = str_ends_with($min, '.css') ? minify_css($code) : minify_js($code);
    file_put_contents($root . $min, $out);
    file_put_contents($root . $min . '.gz', gzencode($out, 9)); // served by .htaccess to browsers that accept gzip
    printf("%-18s %6d bytes (sources %6d; gzip %5d)\n", $min, strlen($out), strlen($code), strlen(gzencode($out, 9)));
}
