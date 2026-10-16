<?php
/* Sign out (POST only, with the CSRF token, so a link elsewhere cannot sign staff out). */
require __DIR__ . '/_init.php';

if (!is_post()) {
    redirect('admin/dashboard.php');
}
require_csrf();
$user = current_user();
if ($user) {
    audit('logout', 'users', (int) $user['id']);
}
end_session();
flash('success', 'You signed out.');
redirect('admin/login.php');
