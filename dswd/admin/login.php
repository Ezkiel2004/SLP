<?php
/* Staff sign-in. Rate limited per email and device; the same message for a
   wrong email or a wrong password, so accounts cannot be discovered. */
require __DIR__ . '/_init.php';

if (current_user()) {
    redirect('admin/dashboard.php');
}
$error = null;
$email = '';
csrf_token();
if (is_post()) {
    require_csrf();
    $email = post('email');
    $result = attempt_login($email, is_string($_POST['password'] ?? null) ? $_POST['password'] : '');
    if (is_int($result)) {
        redirect('admin/dashboard.php'); // require_login() sends a pending password change first
    }
    $error = $result;
}

admin_start('Sign in', null);
?>
<h1>Sign in</h1>
<p>For DSWD website staff. Use the email address and password your administrator gave you.</p>
<?php if ($error): ?><?= alert('error', $error, '', true) ?><?php endif; ?>
<form class="form-stack" action="<?= e(url('admin/login.php')) ?>" method="post">
    <?= csrf_field() ?>
    <?= admin_field('f-email', 'Email address', '<input class="input" id="f-email" name="email" type="email" autocomplete="username" required value="' . e($email) . '">') ?>
    <?= admin_field('f-password', 'Password', '<input class="input" id="f-password" name="password" type="password" autocomplete="current-password" required>') ?>
    <p><button class="btn btn--primary" type="submit">Sign in</button></p>
</form>
<?php admin_end();
