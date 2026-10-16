<?php
/* Admin: site text that is not content (contact details, mandate, privacy
   contacts). Super administrators only. */
require __DIR__ . '/_init.php';

$user = require_login();
if (!can('settings', $user)) {
    admin_error(403, 'Only super administrators can change site settings.');
}
$settings = db_all('SELECT setting_key, label, value FROM site_settings ORDER BY setting_key');
$errors = [];

if (is_post()) {
    require_csrf();
    $changed = [];
    foreach ($settings as $s) {
        $key = $s['setting_key'];
        $value = post('s_' . $key);
        if (mb_strlen($value) > 2000) {
            $errors[$key] = $s['label'] . ' must be 2,000 characters or fewer';
        } elseif (str_ends_with($key, '_url') && $value !== '' && !preg_match('~^https://~', $value)) {
            $errors[$key] = $s['label'] . ' must start with https://';
        } elseif ($value !== $s['value']) {
            $changed[$key] = $value;
        }
    }
    if (!$errors) {
        foreach ($changed as $key => $value) {
            db_exec('UPDATE site_settings SET value = ? WHERE setting_key = ?', [$value, $key]);
        }
        if ($changed) {
            audit('update', 'site_settings', null, implode(', ', array_keys($changed)));
        }
        flash('success', $changed ? 'Settings saved.' : 'Nothing changed.');
        redirect('admin/settings.php');
    }
}

admin_start('Site settings', $user);
?>
<h1>Site settings</h1>
<p>Text used across the website. Bracketed text such as [Hotline number] is a placeholder: replace it with the official information.</p>
<?= admin_error_summary($errors, 'f-s_') ?>
<form class="form-stack" action="<?= e(url('admin/settings.php')) ?>" method="post">
    <?= csrf_field() ?>
    <?php foreach ($settings as $s):
        $id = 'f-s_' . $s['setting_key'];
        $value = is_post() ? post('s_' . $s['setting_key']) : $s['value'];
        $long = in_array($s['setting_key'], ['mandate', 'vision', 'mission', 'office_address'], true);
        $control = $long
            ? '<textarea class="input" id="' . e($id) . '" name="s_' . e($s['setting_key']) . '" rows="3" autocomplete="off"' . admin_aria($id, false, isset($errors[$s['setting_key']])) . '>' . e($value) . '</textarea>'
            : '<input class="input" id="' . e($id) . '" name="s_' . e($s['setting_key']) . '" type="text" autocomplete="off" value="' . e($value) . '"' . admin_aria($id, false, isset($errors[$s['setting_key']])) . '>';
    ?>
    <?= admin_field($id, $s['label'], $control, '', $errors[$s['setting_key']] ?? null) ?>
    <?php endforeach; ?>
    <p><button class="btn btn--primary" type="submit"><?= icon('check') ?>Save settings</button></p>
</form>
<?php admin_end();
