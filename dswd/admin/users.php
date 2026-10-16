<?php
/* Admin: staff accounts (super administrators only). New accounts and password
   resets get a one-time temporary password that must be changed at sign-in. */
require __DIR__ . '/_init.php';

$user = require_login();
if (!can('users', $user)) {
    admin_error(403, 'Only super administrators can manage accounts.');
}
$roles = array_column(db_all('SELECT id, label FROM roles ORDER BY id'), 'label', 'id');
$id = int_param('id');
$action = param('action');
$errors = [];
$values = ['name' => '', 'email' => '', 'role_id' => '3', 'is_active' => '1'];

if (is_post()) {
    require_csrf();
    $target = $id ? db_one('SELECT * FROM users WHERE id = ?', [$id]) : null;
    if ($id && $target === null) {
        admin_error(404, 'This account does not exist.');
    }
    $do = post('do');
    if ($do === 'save') {
        $values = ['name' => post('name'), 'email' => strtolower(post('email')), 'role_id' => post('role_id'), 'is_active' => post('is_active') === '1' ? '1' : '0'];
        if (mb_strlen($values['name']) < 2 || mb_strlen($values['name']) > 120) {
            $errors['name'] = 'Enter the full name';
        }
        if (!filter_var($values['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Enter an email address in the correct format';
        } elseif ((int) db_value('SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?', [$values['email'], $id]) > 0) {
            $errors['email'] = 'Another account already uses this email address';
        }
        if (!isset($roles[(int) $values['role_id']])) {
            $errors['role_id'] = 'Choose a role';
        }
        if ($target && (int) $target['id'] === (int) $user['id'] && ($values['is_active'] !== '1' || (int) $values['role_id'] !== (int) $target['role_id'])) {
            $errors['role_id'] = 'You cannot change your own role or turn off your own account';
        }
        if (!$errors) {
            if ($target) {
                db_exec('UPDATE users SET name = ?, email = ?, role_id = ?, is_active = ? WHERE id = ?',
                    [$values['name'], $values['email'], (int) $values['role_id'], (int) $values['is_active'], $id]);
                audit('update', 'users', $id, 'role ' . $roles[(int) $values['role_id']] . ($values['is_active'] === '1' ? '' : ', turned off'));
                flash('success', 'Account saved.');
            } else {
                $temporary = temporary_password();
                db_exec('INSERT INTO users (name, email, password_hash, role_id, is_active, must_change_password) VALUES (?, ?, ?, ?, ?, 1)',
                    [$values['name'], $values['email'], password_hash($temporary, PASSWORD_ARGON2ID), (int) $values['role_id'], (int) $values['is_active']]);
                $id = (int) db()->lastInsertId();
                audit('create', 'users', $id, 'role ' . $roles[(int) $values['role_id']]);
                flash('success', 'Account created. Give this temporary password to ' . $values['name'] . ' in person or by phone: ' . $temporary . ' — it works once and must be changed at the first sign-in.');
            }
            redirect('admin/users.php', ['action' => 'edit', 'id' => $id]);
        }
        $action = $target ? 'edit' : 'new';
    } elseif ($do === 'reset' && $target) {
        $temporary = temporary_password();
        db_exec('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [password_hash($temporary, PASSWORD_ARGON2ID), $id]);
        audit('password_reset', 'users', $id);
        flash('success', 'Password reset. Give this temporary password to ' . $target['name'] . ' in person or by phone: ' . $temporary . ' — it must be changed at the next sign-in.');
        redirect('admin/users.php', ['action' => 'edit', 'id' => $id]);
    } else {
        admin_error(404, 'Unknown action.');
    }
}

if ($action === 'new' || $action === 'edit') {
    $target = $action === 'edit' ? db_one('SELECT * FROM users WHERE id = ?', [$id]) : null;
    if ($action === 'edit' && $target === null) {
        admin_error(404, 'This account does not exist.');
    }
    if ($target && !is_post()) {
        $values = ['name' => $target['name'], 'email' => $target['email'], 'role_id' => (string) $target['role_id'], 'is_active' => (string) $target['is_active']];
    }
    admin_start($target ? 'Edit account' : 'Add account', $user);
    ?>
    <p><a href="<?= e(url('admin/users.php')) ?>"><?= icon('chevron-left') ?>Back to users</a></p>
    <h1><?= $target ? 'Edit account' : 'Add account' ?></h1>
    <?= admin_error_summary($errors) ?>
    <form class="form-stack" action="<?= e(url('admin/users.php', ['id' => $target['id'] ?? null])) ?>" method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save">
        <?= admin_field('f-name', 'Full name', '<input class="input" id="f-name" name="name" type="text" autocomplete="off" maxlength="120" required value="' . e($values['name']) . '"' . admin_aria('f-name', false, isset($errors['name'])) . '>', '', $errors['name'] ?? null, true) ?>
        <?= admin_field('f-email', 'Email address', '<input class="input" id="f-email" name="email" type="email" autocomplete="off" maxlength="190" required value="' . e($values['email']) . '"' . admin_aria('f-email', false, isset($errors['email'])) . '>', '', $errors['email'] ?? null, true) ?>
        <?= admin_field('f-role_id', 'Role', '<div class="select"><select class="input" id="f-role_id" name="role_id"' . admin_aria('f-role_id', true, isset($errors['role_id'])) . '>' . options($roles, $values['role_id']) . '</select>' . icon('chevron-down') . '</div>',
            'Viewer: can only look. Editor: writes drafts. Publisher: publishes and handles feedback. Super administrator: everything, including accounts.', $errors['role_id'] ?? null, true) ?>
        <div class="choices"><label class="choice"><input type="checkbox" name="is_active" value="1"<?= $values['is_active'] === '1' ? ' checked' : '' ?>>Account can sign in</label></div>
        <p><button class="btn btn--primary" type="submit"><?= icon('check') ?>Save</button></p>
    </form>
    <?php if ($target): ?>
    <h2>Password</h2>
    <p>Last sign-in: <?= e($target['last_login'] ?? 'never') ?>. Reset the password if the person forgot it; they choose a new one at their next sign-in.</p>
    <form action="<?= e(url('admin/users.php', ['id' => $target['id']])) ?>" method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="reset">
        <button class="btn btn--secondary" type="submit">Reset password</button>
    </form>
    <?php endif;
    admin_end();
    exit;
}

$rows = db_all('SELECT u.id, u.name, u.email, u.is_active, u.last_login, r.label AS role FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.name');
admin_start('Users', $user);
?>
<div class="page-head">
    <h1>Users</h1>
    <a class="btn btn--primary" href="<?= e(url('admin/users.php', ['action' => 'new'])) ?>"><?= icon('user') ?>Add account</a>
</div>
<div class="table-wrap" role="region" aria-labelledby="users-caption" tabindex="0">
    <table class="table">
        <caption id="users-caption">Staff accounts</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Can sign in</th><th scope="col">Last sign-in</th></tr></thead>
        <tbody>
            <?php foreach ($rows as $row): ?>
            <tr>
                <td><a href="<?= e(url('admin/users.php', ['action' => 'edit', 'id' => $row['id']])) ?>"><?= e($row['name']) ?></a></td>
                <td><?= e($row['email']) ?></td>
                <td><?= e($row['role']) ?></td>
                <td><?= $row['is_active'] ? 'Yes' : 'No' ?></td>
                <td><?= e($row['last_login'] ?? 'Never') ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php admin_end();
