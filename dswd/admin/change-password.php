<?php
/* Change your own password. New and reset accounts are sent here first and
   cannot use the dashboard until they choose their own password. */
require __DIR__ . '/_init.php';

$user = require_login();
$errors = [];
if (is_post()) {
    require_csrf();
    $current = is_string($_POST['current'] ?? null) ? $_POST['current'] : '';
    $new = is_string($_POST['new'] ?? null) ? $_POST['new'] : '';
    $confirm = is_string($_POST['confirm'] ?? null) ? $_POST['confirm'] : '';
    $hash = (string) db_value('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
    if (!password_verify($current, $hash)) {
        $errors['current'] = 'Your current password is not correct.';
    } elseif (password_verify($new, $hash)) {
        $errors['new'] = 'Choose a password you have not used here.';
    } elseif ($problem = password_problem($new, $confirm, $user['email'])) {
        $errors['new'] = $problem;
    }
    if (!$errors) {
        db_exec('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [password_hash($new, PASSWORD_ARGON2ID), $user['id']]);
        session_regenerate_id(true);
        audit('password_change', 'users', (int) $user['id']);
        flash('success', 'Your password is changed.');
        redirect('admin/dashboard.php');
    }
}

admin_start('Change password', $user);
?>
<h1>Change password</h1>
<?php if ($user['must_change_password']): ?>
<?= alert('warning', 'Choose your own password to continue', '<p>Your account has a temporary password. Choose a new one before you use the dashboard.</p>') ?>
<?php endif; ?>
<?= admin_error_summary($errors) ?>
<form class="form-stack" action="<?= e(url('admin/change-password.php')) ?>" method="post">
    <?= csrf_field() ?>
    <?= admin_field('f-current', 'Current password', '<input class="input" id="f-current" name="current" type="password" autocomplete="current-password" required' . admin_aria('f-current', false, isset($errors['current'])) . '>', '', $errors['current'] ?? null, true) ?>
    <?= admin_field('f-new', 'New password', '<input class="input" id="f-new" name="new" type="password" autocomplete="new-password" minlength="' . CONFIG['password_min_length'] . '" required' . admin_aria('f-new', true, isset($errors['new'])) . '>', 'At least ' . CONFIG['password_min_length'] . ' characters. A short sentence is easy to remember and hard to guess.', $errors['new'] ?? null, true) ?>
    <?= admin_field('f-confirm', 'Type the new password again', '<input class="input" id="f-confirm" name="confirm" type="password" autocomplete="new-password" required>', '', null, true) ?>
    <p><button class="btn btn--primary" type="submit">Change password</button></p>
</form>
<?php admin_end();
