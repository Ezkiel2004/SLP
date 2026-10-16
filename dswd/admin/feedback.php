<?php
/* Admin: feedback, complaints and questions from the public.
   Personal data (Data Privacy Act): publishers and super administrators only.
   Super administrators can permanently delete a message, for example when the
   sender asks for their data to be erased. */
require __DIR__ . '/_init.php';

$user = require_login();
if (!can('feedback', $user)) {
    admin_error(403, 'Feedback contains personal information, so only publishers and super administrators can see it.');
}
const FEEDBACK_STATUSES = ['new' => 'New', 'in_progress' => 'In progress', 'resolved' => 'Resolved', 'closed' => 'Closed'];
const FEEDBACK_TYPE_LABELS = ['feedback' => 'Feedback', 'complaint' => 'Complaint', 'question' => 'Question'];
$id = int_param('id');

if (is_post()) {
    require_csrf();
    $row = db_one('SELECT id, reference_no FROM feedback WHERE id = ?', [$id]);
    if ($row === null) {
        admin_error(404, 'This message does not exist.');
    }
    if (post('do') === 'status' && isset(FEEDBACK_STATUSES[post('status')])) {
        db_exec('UPDATE feedback SET status = ? WHERE id = ?', [post('status'), $id]);
        audit('update', 'feedback', $id, $row['reference_no'] . ' → ' . post('status'));
        flash('success', 'Status updated.');
        redirect('admin/feedback.php', ['id' => $id]);
    }
    if (post('do') === 'delete' && $user['role'] === 'super_admin') {
        db_exec('DELETE FROM feedback WHERE id = ?', [$id]);
        audit('delete', 'feedback', $id, $row['reference_no']);
        flash('success', 'Message ' . $row['reference_no'] . ' permanently deleted.');
        redirect('admin/feedback.php');
    }
    admin_error(404, 'Unknown action.');
}

if ($id) {
    $row = db_one('SELECT * FROM feedback WHERE id = ?', [$id]);
    if ($row === null) {
        admin_error(404, 'This message does not exist.');
    }
    audit('view', 'feedback', $id, $row['reference_no']); // who looked at personal data, and when
    admin_start('Feedback ' . $row['reference_no'], $user);
    ?>
    <p><a href="<?= e(url('admin/feedback.php')) ?>"><?= icon('chevron-left') ?>Back to feedback</a></p>
    <h1><?= e($row['reference_no']) ?></h1>
    <dl class="details-list">
        <dt>Type</dt><dd><?= e(FEEDBACK_TYPE_LABELS[$row['type']]) ?></dd>
        <dt>Received</dt><dd><?= e($row['created_at']) ?></dd>
        <dt>Name</dt><dd><?= e($row['name']) ?></dd>
        <dt>Email</dt><dd><a href="mailto:<?= e($row['email']) ?>"><?= e($row['email']) ?></a></dd>
        <dt>Mobile</dt><dd><?= e($row['mobile'] ?? 'Not given') ?></dd>
        <dt>Subject</dt><dd><?= e($row['subject']) ?></dd>
        <dt>Consent given</dt><dd><?= e($row['consent_at']) ?></dd>
    </dl>
    <h2>Message</h2>
    <p class="prose"><?= nl2br(e($row['message'])) ?></p>

    <h2>Status</h2>
    <form class="form-stack" action="<?= e(url('admin/feedback.php', ['id' => $id])) ?>" method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="status">
        <?= admin_field('f-status', 'Status', '<div class="select"><select class="input" id="f-status" name="status">' . options(FEEDBACK_STATUSES, $row['status']) . '</select>' . icon('chevron-down') . '</div>') ?>
        <p><button class="btn btn--primary" type="submit">Update status</button></p>
    </form>
    <?php if ($user['role'] === 'super_admin'): ?>
    <h2>Erase this message</h2>
    <p>Use this when the sender asks for their information to be deleted. It cannot be undone.</p>
    <form action="<?= e(url('admin/feedback.php', ['id' => $id])) ?>" method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="delete">
        <button class="btn btn--secondary" type="submit">Delete permanently</button>
    </form>
    <?php endif;
    admin_end();
    exit;
}

$status = isset(FEEDBACK_STATUSES[param('status')]) ? param('status') : '';
$type = isset(FEEDBACK_TYPE_LABELS[param('type')]) ? param('type') : '';
$q = param('q');
$perPage = 25;
$current = int_param('page', 1);
$where = 'WHERE (? = \'\' OR status = ?) AND (? = \'\' OR type = ?) AND (? = \'\' OR reference_no LIKE ? OR subject LIKE ?)';
$params = [$status, $status, $type, $type, $q, like($q), like($q)];
$total = (int) db_value("SELECT COUNT(*) FROM feedback $where", $params);
$rows = db_all("SELECT id, reference_no, type, subject, status, created_at FROM feedback $where ORDER BY created_at DESC" . page_limit($current, $perPage), $params);

admin_start('Feedback', $user);
?>
<h1>Feedback</h1>
<p>Messages sent through the Contact us page. They contain personal information: open only what you need to handle.</p>
<form class="filters" action="<?= e(url('admin/feedback.php')) ?>" method="get" role="search" aria-label="Find feedback">
    <?= admin_field('f-q', 'Reference number or subject', '<input class="input" id="f-q" name="q" type="search" value="' . e($q) . '">') ?>
    <?= admin_field('f-status', 'Status', '<div class="select"><select class="input" id="f-status" name="status">' . options(['' => 'All'] + FEEDBACK_STATUSES, $status) . '</select>' . icon('chevron-down') . '</div>') ?>
    <?= admin_field('f-type', 'Type', '<div class="select"><select class="input" id="f-type" name="type">' . options(['' => 'All'] + FEEDBACK_TYPE_LABELS, $type) . '</select>' . icon('chevron-down') . '</div>') ?>
    <div class="filters__actions"><button class="btn btn--primary" type="submit"><?= icon('search') ?>Show results</button></div>
</form>
<p class="results-count">Results: <?= $total ?></p>
<?php if ($rows): ?>
<div class="table-wrap" role="region" aria-labelledby="feedback-caption" tabindex="0">
    <table class="table">
        <caption id="feedback-caption">Feedback messages</caption>
        <thead><tr><th scope="col">Reference</th><th scope="col">Type</th><th scope="col">Subject</th><th scope="col">Status</th><th scope="col">Received</th></tr></thead>
        <tbody>
            <?php foreach ($rows as $row): ?>
            <tr>
                <td><a href="<?= e(url('admin/feedback.php', ['id' => $row['id']])) ?>"><?= e($row['reference_no']) ?></a></td>
                <td><?= e(FEEDBACK_TYPE_LABELS[$row['type']]) ?></td>
                <td><?= e($row['subject']) ?></td>
                <td><?= e(FEEDBACK_STATUSES[$row['status']]) ?></td>
                <td><?= e($row['created_at']) ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?= pagination($total, $current, $perPage, 'admin/feedback.php', ['q' => $q, 'status' => $status, 'type' => $type]) ?>
<?php else: ?>
<div class="empty"><p class="empty__title">No messages</p><p>Change the filters to see more.</p></div>
<?php endif; ?>
<?php admin_end();
