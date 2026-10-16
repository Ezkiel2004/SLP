<?php
/* Programs and services: a filterable card grid (keyword, type, category).
   The filters are a plain GET form, so they work without JavaScript. */
require __DIR__ . '/includes/bootstrap.php';

$categories = get_categories('program');
$kinds = ['program' => t('label.program'), 'service' => t('label.service')];
$filters = [
    'q' => param('q'),
    'kind' => isset($kinds[param('kind')]) ? param('kind') : '',
    'category' => isset($categories[param('category')]) ? param('category') : '',
];
$programs = get_programs($filters);
$filtered = array_filter($filters) !== [];

$page = ['title' => t('programs.title'), 'description' => t('programs.lead'), 'nav' => 'programs'];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('programs.title'), t('programs.lead'), [t('programs.title') => '']) ?>

    <div class="container page-body">
        <form class="filters" action="<?= e(url('programs.php')) ?>" method="get" aria-label="<?= e(t('programs.filter')) ?>">
            <div class="field">
                <label class="field__label" for="f-q"><?= e(t('label.keyword')) ?></label>
                <input class="input" id="f-q" name="q" type="search" value="<?= e($filters['q']) ?>">
            </div>
            <div class="field">
                <label class="field__label" for="f-kind"><?= e(t('label.type')) ?></label>
                <div class="select">
                    <select class="input" id="f-kind" name="kind"><?= options(['' => t('label.all')] + $kinds, $filters['kind']) ?></select>
                    <?= icon('chevron-down') ?>
                </div>
            </div>
            <div class="field">
                <label class="field__label" for="f-category"><?= e(t('label.category')) ?></label>
                <div class="select">
                    <select class="input" id="f-category" name="category"><?= options(['' => t('label.all_categories')] + $categories, $filters['category']) ?></select>
                    <?= icon('chevron-down') ?>
                </div>
            </div>
            <div class="filters__actions">
                <button class="btn btn--primary" type="submit"><?= e(t('action.show_results')) ?></button>
                <?php if ($filtered): ?><a href="<?= e(url('programs.php')) ?>"><?= e(t('action.clear')) ?></a><?php endif; ?>
            </div>
        </form>

        <p class="results-count"><?= e(t('results.count', ['count' => count($programs)])) ?></p>

        <?php if ($programs): ?>
        <ul class="grid" role="list" data-dynamic="programs">
            <?php foreach ($programs as $p): ?>
            <li class="span-md-6 span-lg-4">
                <article class="card card--link">
                    <p class="card__meta"><?= e($kinds[$p['kind']]) ?> · <?= e($p['category_label']) ?></p>
                    <h2 class="card__title"><a href="<?= e(url('program.php', ['slug' => $p['slug']])) ?>"><?= e($p['title']) ?></a></h2>
                    <p><?= e($p['summary']) ?></p>
                </article>
            </li>
            <?php endforeach; ?>
        </ul>
        <?php else: ?>
        <div class="empty">
            <p class="empty__title"><?= e(t('results.none')) ?></p>
            <p><?= e(t('results.none_hint')) ?></p>
        </div>
        <?php endif; ?>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
