<?php
/* News list with search, category filter and pagination (6 per page). */
require __DIR__ . '/includes/bootstrap.php';

$categories = get_categories('news');
$filters = [
    'q' => param('q'),
    'category' => isset($categories[param('category')]) ? param('category') : '',
];
$perPage = 6;
$current = int_param('page', 1);
$result = get_news($filters, $current, $perPage);
$filtered = array_filter($filters) !== [];

$page = ['title' => t('news.title'), 'description' => t('news.lead'), 'nav' => 'news'];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('news.title'), t('news.lead'), [t('news.title') => '']) ?>

    <div class="container page-body">
        <form class="filters" action="<?= e(url('news.php')) ?>" method="get" role="search" aria-label="<?= e(t('news.filter')) ?>">
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
            <div class="filters__actions">
                <button class="btn btn--primary" type="submit"><?= icon('search') ?><?= e(t('action.search_news')) ?></button>
                <?php if ($filtered): ?><a href="<?= e(url('news.php')) ?>"><?= e(t('action.clear')) ?></a><?php endif; ?>
            </div>
        </form>

        <p class="results-count"><?= e(t('results.count', ['count' => $result['total']])) ?></p>

        <?php if ($result['items']): ?>
        <ul class="media-list page-section" data-dynamic="news">
            <?php foreach ($result['items'] as $item): ?>
            <li class="media">
                <img class="media__image" src="<?= e(url($item['image'])) ?>" alt="" width="320" height="180" loading="lazy" decoding="async">
                <div>
                    <p class="meta"><time datetime="<?= e($item['date']) ?>"><?= e(format_date($item['date'])) ?></time><span><?= e($item['category_label']) ?></span></p>
                    <h2 class="media__title"><a href="<?= e(url('article.php', ['slug' => $item['slug']])) ?>"><?= e($item['title']) ?></a></h2>
                    <p><?= e($item['excerpt']) ?></p>
                </div>
            </li>
            <?php endforeach; ?>
        </ul>
        <?= pagination($result['total'], $current, $perPage, 'news.php', $filters) ?>
        <?php else: ?>
        <div class="empty">
            <p class="empty__title"><?= e(t('results.none')) ?></p>
            <p><?= e(t('results.none_hint')) ?></p>
        </div>
        <?php endif; ?>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
