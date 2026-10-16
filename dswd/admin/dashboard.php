<?php
/* Dashboard: how much content is live or waiting, new feedback, recent changes. */
require __DIR__ . '/_init.php';
require __DIR__ . '/../includes/feedback.php';

$user = require_login();
purge_old_feedback();
$types = [
    'programs' => ['Programs and services', 'programs.php'],
    'news_articles' => ['News', 'news.php'],
    'announcements' => ['Announcements', 'announcements.php'],
    'downloads' => ['Downloads', 'downloads.php'],
    'offices' => ['Offices', 'offices.php'],
    'faqs' => ['FAQs', 'faqs.php'],
    'officials' => ['Officials', 'officials.php'],
];
$counts = [];
foreach ($types as $table => [$label, $page]) { // table names come from the list above, never from the request
    $counts[$table] = db_one("SELECT SUM(status = 'published') AS published, SUM(status = 'draft') AS drafts FROM $table WHERE deleted_at IS NULL");
}
$newFeedback = can('feedback', $user) ? (int) db_value("SELECT COUNT(*) FROM feedback WHERE status = 'new'") : null;
$recent = can('audit', $user)
    ? db_all('SELECT a.created_at, a.action, a.table_name, a.summary, u.name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 8')
    : [];

admin_start('Dashboard', $user);
?>
<div class="page-head">
    <h1>Dashboard</h1>
    <?php if (can('create', $user)): ?><a class="btn btn--primary" href="<?= e(url('admin/news.php', ['action' => 'new'])) ?>"><?= icon('file-text') ?>Write a news article</a><?php endif; ?>
</div>
<p>Signed in as <?= e($user['name']) ?> (<?= e($user['role_label']) ?>).</p>

<?php if ($newFeedback !== null): ?>
<p class="note"><?= icon('mail') ?> <a href="<?= e(url('admin/feedback.php', ['status' => 'new'])) ?>"><?= $newFeedback ?> new feedback <?= $newFeedback === 1 ? 'message' : 'messages' ?></a> waiting for a reply.</p>
<?php endif; ?>

<div class="table-wrap" role="region" aria-labelledby="overview-caption" tabindex="0">
    <table class="table">
        <caption id="overview-caption">Content overview</caption>
        <thead><tr><th scope="col">Content</th><th scope="col" class="num">Published</th><th scope="col" class="num">Drafts</th></tr></thead>
        <tbody>
            <?php foreach ($types as $table => [$label, $page]): ?>
            <tr>
                <td><a href="<?= e(url('admin/' . $page)) ?>"><?= e($label) ?></a></td>
                <td class="num"><?= (int) $counts[$table]['published'] ?></td>
                <td class="num"><?= (int) $counts[$table]['drafts'] ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

<?php if ($recent): ?>
<h2>Recent changes</h2>
<ul class="media-list">
    <?php foreach ($recent as $entry): ?>
    <li class="media"><div>
        <p class="meta"><time datetime="<?= e($entry['created_at']) ?>"><?= e($entry['created_at']) ?></time><span><?= e($entry['name'] ?? 'Unknown user') ?></span></p>
        <p><?= e(ucfirst(str_replace('_', ' ', $entry['action']))) ?> <?= e(str_replace('_', ' ', $entry['table_name'])) ?><?= $entry['summary'] !== '' ? ': ' . e($entry['summary']) : '' ?></p>
    </div></li>
    <?php endforeach; ?>
</ul>
<p><a href="<?= e(url('admin/audit.php')) ?>">See the full audit log</a></p>
<?php endif; ?>
<?php admin_end();
