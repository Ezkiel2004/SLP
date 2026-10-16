<?php
/* Site configuration. These defaults suit a local XAMPP install.
   Put real secrets in config/config.local.php (same keys, returned as an array);
   it overrides these values and must never be shared or committed.
   The whole config/ folder is blocked from the web by config/.htaccess. */
declare(strict_types=1);

$config = [
    // Database (a dedicated account with only SELECT, INSERT, UPDATE, DELETE on dswd_website)
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'dswd_website',
    'db_user' => 'dswd_app',
    'db_pass' => '',

    // 'production' hides error details from visitors and logs them instead.
    'app_env' => 'development',
    // Long random value; used to hash IP addresses for rate limits.
    'app_secret' => '',

    // Sessions and sign-in
    'session_idle_minutes' => 30,
    'login_max_attempts' => 5,
    'login_window_minutes' => 15,
    'password_min_length' => 12,

    // Feedback form
    'feedback_max_per_hour' => 5,
    // Days a resolved or closed message is kept before it is deleted automatically.
    // Shown in the privacy notices. Confirm the period with the Data Protection Officer.
    'feedback_retention_days' => 365,

    // Uploads (bytes)
    'upload_max_image' => 2 * 1024 * 1024,
    'upload_max_file' => 10 * 1024 * 1024,
];

if (is_file(__DIR__ . '/config.local.php')) {
    $config = array_replace($config, require __DIR__ . '/config.local.php');
}

define('CONFIG', $config);
