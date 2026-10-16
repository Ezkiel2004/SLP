<?php
/* Downloads: a searchable table filtered by category and year (10 per page). */
require __DIR__ . '/includes/bootstrap.php';

$categories = get_categories('download');
$years = get_download_years();
$filters = [
    'q' => param('q'),
    'category' => isset($categories[param('category')]) ? param('category') : '',
    'year' => in_array(int_param('year'), $years, true) ? (string) int_param('year') : '',
];
$perPage = 10;
$current = int_param('page', 1);
$result = get_downloads($filters, $current, $perPage);
$filtered = array_filter($filters) !== [];

$page = ['title' => t('downloads.title'), 'description' => t('downloads.lead'), 'nav' => 'downloads'];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('downloads.title'), t('downloads.lead'), [t('downloads.title') => '']) ?>

    <div class="container page-body">
        <form class="filters" action="<?= e(url('downloads.php')) ?>" method="get" role="search" aria-label="<?= e(t('downloads.filter')) ?>">
            <div class="field">
                <label class="field__label" for="f-q"><?= e(t('label.keyword')) ?></label>
                <input class="input" id="f-q" name="q" type="search" value="<?= e($filters['q']) ?>">
            </div>
            <div class="field">
                <label class="field__label" for="f-category"><?= e(t('label.category')) ?></label>
                <div class="select">
                    <select class="input" id="f-category" name="category"><?= options(['' => t('label.all_categories')] + $categories, $filters['category']) ?></select>
                    <?= icon('chevron-down') ?>
                </div>
            </div>
            <div class="field">
                <label class="field__label" for="f-year"><?= e(t('label.year')) ?></label>
                <div class="select">
                    <select class="input" id="f-year" name="year"><?= options(['' => t('label.all_years')] + array_combine($years, $years), $filters['year']) ?></select>
                    <?= icon('chevron-down') ?>
                </div>
            </div>
            <div class="filters__actions">
                <button class="btn btn--primary" type="submit"><?= icon('search') ?><?= e(t('action.find_files')) ?></button>
                <?php if ($filtered): ?><a href="<?= e(url('downloads.php')) ?>"><?= e(t('action.clear')) ?></a><?php endif; ?>
            </div>
        </form>

        <p class="results-count"><?= e(t('results.count', ['count' => $result['total']])) ?></p>

        <?php if ($result['items']): ?>
        <div class="table-wrap" role="region" aria-labelledby="downloads-caption" tabindex="0" data-dynamic="downloads">
            <table class="table">
                <caption id="downloads-caption"><?= e(t('downloads.caption')) ?></caption>
                <thead>
                    <tr>
                        <th scope="col"><?= e(t('label.title')) ?></th>
                        <th scope="col"><?= e(t('label.category')) ?></th>
                        <th scope="col" class="num"><?= e(t('label.year')) ?></th>
                        <th scope="col" class="num"><?= e(t('label.size')) ?></th>
                        <th scope="col"><?= e(t('label.file')) ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($result['items'] as $d): ?>
                    <tr>
                        <td><?= e($d['title']) ?></td>
                        <td><?= e($d['category_label']) ?></td>
                        <td class="num"><?= e($d['year']) ?></td>
                        <td class="num">PDF, <?= e(format_bytes($d['size'])) ?></td>
                        <td><a href="<?= e(url($d['file'])) ?>"><?= icon('download') ?><?= e(t('action.download')) ?><span class="visually-hidden"> <?= e($d['title']) ?></span></a></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?= pagination($result['total'], $current, $perPage, 'downloads.php', $filters) ?>
        <?php else: ?>
        <div class="empty">
            <p class="empty__title"><?= e(t('results.none')) ?></p>
            <p><?= e(t('results.none_hint')) ?></p>
        </div>
        <?php endif; ?>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
