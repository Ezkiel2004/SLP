<?php
/* Admin: audit log of sign-ins and content changes (super administrators only). */
require __DIR__ . '/_init.php';

$user = require_login();
if (!can('audit', $user)) {
    admin_error(403, 'Only super administrators can read the audit log.');
}
$actions = array_column(db_all('SELECT DISTINCT action FROM audit_logs ORDER BY action'), 'action', 'action');
$tables = array_column(db_all("SELECT DISTINCT table_name FROM audit_logs WHERE table_name <> '' ORDER BY table_name"), 'table_name', 'table_name');
$action = isset($actions[param('action')]) ? param('action') : '';
$table = isset($tables[param('table')]) ? param('table') : '';
$perPage = 50;
$current = int_param('page', 1);
$where = 'WHERE (? = \'\' OR a.action = ?) AND (? = \'\' OR a.table_name = ?)';
$params = [$action, $action, $table, $table];
$total = (int) db_value("SELECT COUNT(*) FROM audit_logs a $where", $params);
$rows = db_all(
    "SELECT a.created_at, a.action, a.table_name, a.record_id, a.summary, u.name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id $where ORDER BY a.id DESC" . page_limit($current, $perPage),
    $params
);

admin_start('Audit log', $user);
?>
<h1>Audit log</h1>
<p>Every sign-in, failed sign-in and change to content or accounts, newest first.</p>
<form class="filters" action="<?= e(url('admin/audit.php')) ?>" method="get" aria-label="Filter the audit log">
    <?= admin_field('f-action', 'Action', '<div class="select"><select class="input" id="f-action" name="action">' . options(['' => 'All'] + $actions, $action) . '</select>' . icon('chevron-down') . '</div>') ?>
    <?= admin_field('f-table', 'Content', '<div class="select"><select class="input" id="f-table" name="table">' . options(['' => 'All'] + $tables, $table) . '</select>' . icon('chevron-down') . '</div>') ?>
    <div class="filters__actions"><button class="btn btn--primary" type="submit">Show results</button></div>
</form>
<p class="results-count">Results: <?= $total ?></p>
<div class="table-wrap" role="region" aria-labelledby="audit-caption" tabindex="0">
    <table class="table">
        <caption id="audit-caption">Audit log entries</caption>
        <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Content</th><th scope="col" class="num">Record</th><th scope="col">Details</th></tr></thead>
        <tbody>
            <?php foreach ($rows as $row): ?>
            <tr>
                <td><?= e($row['created_at']) ?></td>
                <td><?= e($row['name'] ?? '—') ?></td>
                <td><?= e($row['action']) ?></td>
                <td><?= e($row['table_name']) ?></td>
                <td class="num"><?= e($row['record_id'] ?? '') ?></td>
                <td><?= e($row['summary']) ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?= pagination($total, $current, $perPage, 'admin/audit.php', ['action' => $action, 'table' => $table]) ?>
<?php admin_end();
