<?php
/* Page frame for the staff dashboard: head, header with the signed-in user,
   a sidebar nav filtered by role, flash messages, and error pages.
   Built from the same components as the public site. */
declare(strict_types=1);

/** Admin sections: [file => [label, ability]]. */
const ADMIN_NAV = [
    'dashboard.php' => ['Dashboard', 'view'],
    'programs.php' => ['Programs and services', 'view'],
    'news.php' => ['News', 'view'],
    'announcements.php' => ['Announcements', 'view'],
    'downloads.php' => ['Downloads', 'view'],
    'offices.php' => ['Offices', 'view'],
    'faqs.php' => ['FAQs', 'view'],
    'officials.php' => ['Officials', 'view'],
    'categories.php' => ['Categories', 'categories'],
    'feedback.php' => ['Feedback', 'feedback'],
    'users.php' => ['Users', 'users'],
    'audit.php' => ['Audit log', 'audit'],
    'settings.php' => ['Site settings', 'settings'],
];

/** Open the page: everything up to the start of the main content. */
function admin_start(string $title, ?array $user): void
{
    $flash = take_flash();
    $current = basename($_SERVER['SCRIPT_NAME'] ?? '');
    ?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?= e($title) ?> | DSWD admin</title>
    <link rel="icon" href="<?= e(asset('img/logo.svg')) ?>" type="image/svg+xml">
    <link rel="preload" href="<?= e(url('fonts/inter-latin-wght-normal.woff2')) ?>" as="font" type="font/woff2" crossorigin>
<?php foreach (bundle('css/site.min.css') as $href): ?>
    <link rel="stylesheet" href="<?= e($href) ?>">
<?php endforeach; foreach ([...bundle('js/ui.min.js'), ...bundle('js/admin.min.js')] as $src): ?>
    <script src="<?= e($src) ?>" defer></script>
<?php endforeach; ?>
</head>
<body class="admin">
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
    <div class="container site-header__inner">
        <a class="brand" href="<?= e(url($user ? 'admin/dashboard.php' : 'admin/login.php')) ?>">
            <img class="brand__logo" src="<?= e(asset('img/logo.svg')) ?>" alt="" width="40" height="40">
            <span class="brand__name">DSWD website admin</span>
        </a>
        <?php if ($user): ?>
        <div class="admin-bar">
            <span><?= e($user['name']) ?> · <?= e($user['role_label']) ?></span>
            <form action="<?= e(url('admin/logout.php')) ?>" method="post">
                <?= csrf_field() ?>
                <button class="btn btn--ghost" type="submit">Sign out</button>
            </form>
        </div>
        <?php endif; ?>
    </div>
</header>
<?php if ($user): ?>
<div class="container admin-layout">
    <nav class="admin-nav" aria-label="Admin">
        <ul>
            <?php foreach (ADMIN_NAV as $file => [$label, $ability]): if (!can($ability, $user)) continue; ?>
            <li><a class="site-nav__link" href="<?= e(url('admin/' . $file)) ?>"<?= $file === $current ? ' aria-current="page"' : '' ?>><?= e($label) ?></a></li>
            <?php endforeach; ?>
            <li><a class="site-nav__link" href="<?= e(url('admin/change-password.php')) ?>"<?= $current === 'change-password.php' ? ' aria-current="page"' : '' ?>>Change password</a></li>
            <li><a class="site-nav__link" href="<?= e(url('index.php')) ?>">View the website</a></li>
        </ul>
    </nav>
    <main id="main" tabindex="-1" class="admin-main">
<?php else: ?>
<div class="container admin-layout admin-layout--single">
    <main id="main" tabindex="-1" class="admin-main admin-main--narrow">
<?php endif; ?>
    <?php foreach ($flash as $message): ?>
        <?= alert($message['type'], $message['message'], '', $message['type'] === 'error') ?>
    <?php endforeach;
}

/** Close the page. */
function admin_end(): void
{
    ?>
    </main>
</div>
</body>
</html>
<?php
}

/** Stop with an error page (403 no access, 404 not found). */
function admin_error(int $status, string $message): never
{
    http_response_code($status);
    $user = current_user();
    admin_start($status === 403 ? 'No access' : 'Not found', $user);
    echo '<h1>' . ($status === 403 ? 'You do not have access to this' : 'We could not find that') . '</h1>';
    echo '<p>' . e($message) . '</p>';
    echo '<p><a class="btn btn--primary" href="' . e(url($user ? 'admin/dashboard.php' : 'admin/login.php')) . '">Go to the dashboard</a></p>';
    admin_end();
    exit;
}

/** Field markup shared by admin forms: label, hint, inline error, then the control (trusted HTML). */
function admin_field(string $id, string $label, string $control, string $hint = '', ?string $error = null, bool $required = false): string
{
    return '<div class="field"><label class="field__label" for="' . e($id) . '" id="' . e($id) . '-label">' . e($label)
        . ($required ? ' <span class="field__required">(required)</span>' : '') . '</label>'
        . ($hint !== '' ? '<p class="field__hint" id="' . e($id) . '-hint">' . e($hint) . '</p>' : '')
        . ($error !== null ? '<p class="field__error" id="' . e($id) . '-error">' . icon('circle-alert') . 'Error: ' . e($error) . '</p>' : '')
        . $control . '</div>';
}

/** aria-invalid and aria-describedby for a control. */
function admin_aria(string $id, bool $hasHint, bool $hasError): string
{
    $ids = trim(($hasHint ? $id . '-hint' : '') . ($hasError ? ' ' . $id . '-error' : ''));
    return ($hasError ? ' aria-invalid="true"' : '') . ($ids !== '' ? ' aria-describedby="' . e($ids) . '"' : '');
}

/** Error summary linking to each field (field name => message). */
function admin_error_summary(array $errors, string $prefix = 'f-'): string
{
    if (!$errors) {
        return '';
    }
    $items = '';
    foreach ($errors as $field => $message) {
        $items .= '<li><a href="#' . e($prefix . $field) . '">' . e($message) . '</a></li>';
    }
    return alert('error', 'There is a problem', '<ul>' . $items . '</ul>', true);
}
