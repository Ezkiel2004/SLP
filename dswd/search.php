<?php
/* Site search: one field, results grouped by type with counts. */
require __DIR__ . '/includes/bootstrap.php';

$q = param('q');
$results = search_site($q);
$labels = [
    'programs' => t('label.programs_and_services'),
    'news' => t('nav.news'),
    'downloads' => t('nav.downloads'),
    'faqs' => t('nav.faqs'),
];

$page = ['title' => $q === '' ? t('search.title') : t('search.results_for', ['q' => $q]), 'description' => t('search.lead'), 'nav' => ''];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <div class="title-band">
        <div class="container">
            <?= breadcrumbs([t('nav.home') => url('index.php'), t('search.title') => '']) ?>
            <h1 class="title-band__title"><?= e(t('search.title')) ?></h1>
            <form class="search-form" action="<?= e(url('search.php')) ?>" method="get" role="search">
                <label class="search-form__label" for="site-search"><?= e(t('search.label')) ?></label>
                <div class="search-form__row">
                    <input class="input" id="site-search" name="q" type="search" value="<?= e($q) ?>" placeholder="<?= e(t('search.example')) ?>">
                    <button class="btn btn--primary" type="submit"><?= icon('search') ?><?= e(t('action.search')) ?></button>
                </div>
            </form>
        </div>
    </div>

    <div class="container page-body" data-dynamic="search-results">
        <?php if ($q === ''): ?>
        <p><?= e(t('search.lead')) ?></p>
        <?php elseif (!$results): ?>
        <div class="empty">
            <p class="empty__title"><?= e(t('search.results_for', ['q' => $q])) ?>: <?= e(t('results.none')) ?></p>
            <p><?= e(t('results.none_hint')) ?></p>
        </div>
        <?php else: ?>
        <h2><?= e(t('search.results_for', ['q' => $q])) ?></h2>
        <?php foreach ($results as $group => $items): ?>
        <section class="page-section" aria-labelledby="group-<?= e($group) ?>">
            <h3 id="group-<?= e($group) ?>"><?= e($labels[$group]) ?> (<?= count($items) ?>)</h3>
            <ul class="media-list">
                <?php foreach ($items as $item): ?>
                <li class="media">
                    <div>
                        <?php if ($group === 'programs'): ?>
                        <h4 class="media__title"><a href="<?= e(url('program.php', ['slug' => $item['slug']])) ?>"><?= e($item['title']) ?></a></h4>
                        <p><?= e($item['summary']) ?></p>
                        <?php elseif ($group === 'news'): ?>
                        <p class="meta"><time datetime="<?= e($item['date']) ?>"><?= e(format_date($item['date'])) ?></time></p>
                        <h4 class="media__title"><a href="<?= e(url('article.php', ['slug' => $item['slug']])) ?>"><?= e($item['title']) ?></a></h4>
                        <p><?= e($item['excerpt']) ?></p>
                        <?php elseif ($group === 'downloads'): ?>
                        <h4 class="media__title"><a href="<?= e(url($item['file'])) ?>"><?= e($item['title']) ?></a></h4>
                        <p class="meta"><span><?= e($item['category_label']) ?></span><span>PDF, <?= e(format_bytes($item['size'])) ?></span></p>
                        <?php else: ?>
                        <h4 class="media__title"><a href="<?= e(url('faqs.php')) ?>"><?= e($item['question']) ?></a></h4>
                        <p><?= e($item['answer']) ?></p>
                        <?php endif; ?>
                    </div>
                </li>
                <?php endforeach; ?>
            </ul>
        </section>
        <?php endforeach; ?>
        <?php endif; ?>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
