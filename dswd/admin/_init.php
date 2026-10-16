<?php
/* Setup for every admin page: English interface, the shared bootstrap, and
   the CSRF, sign-in, upload, rich text and layout helpers. */
declare(strict_types=1);

define('LANG', 'en');
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/csrf.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/upload.php';
require __DIR__ . '/../includes/richtext.php';
require __DIR__ . '/../includes/admin-layout.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
