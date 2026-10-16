<?php
/* Office directory: filter by region; each office shows address, phone,
   email and hours. Contact details are placeholders until supplied. */
require __DIR__ . '/includes/bootstrap.php';

$regions = get_regions();
$region = isset($regions[param('region')]) ? param('region') : '';
$offices = get_offices($region);

$page = ['title' => t('offices.title'), 'description' => t('offices.lead'), 'nav' => 'offices'];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('offices.title'), t('offices.lead'), [t('offices.title') => '']) ?>

    <div class="container page-body">
        <form class="filters" action="<?= e(url('offices.php')) ?>" method="get" aria-label="<?= e(t('offices.filter')) ?>">
            <div class="field">
                <label class="field__label" for="f-region"><?= e(t('label.region')) ?></label>
                <div class="select">
                    <select class="input" id="f-region" name="region"><?= options(['' => t('label.all_regions')] + $regions, $region) ?></select>
                    <?= icon('chevron-down') ?>
                </div>
            </div>
            <div class="filters__actions">
                <button class="btn btn--primary" type="submit"><?= e(t('action.show_offices')) ?></button>
                <?php if ($region !== ''): ?><a href="<?= e(url('offices.php')) ?>"><?= e(t('action.clear')) ?></a><?php endif; ?>
            </div>
        </form>

        <p class="results-count"><?= e(t('results.count', ['count' => count($offices)])) ?></p>

        <ul class="grid" role="list" data-dynamic="offices">
            <?php foreach ($offices as $office): ?>
            <li class="span-md-6 span-lg-4">
                <article class="card">
                    <p class="card__meta"><?= e($office['region_label']) ?></p>
                    <h2 class="card__title"><?= e($office['name']) ?></h2>
                    <ul class="details">
                        <li><?= icon('map-pin') ?><span><span class="visually-hidden"><?= e(t('label.address')) ?>: </span><span data-placeholder="address"><?= e($office['address']) ?></span></span></li>
                        <li><?= icon('phone') ?><span><span class="visually-hidden"><?= e(t('label.phone')) ?>: </span><span data-placeholder="phone"><?= e($office['phone']) ?></span></span></li>
                        <li><?= icon('mail') ?><span><span class="visually-hidden"><?= e(t('label.email')) ?>: </span><span data-placeholder="email"><?= e($office['email']) ?></span></span></li>
                        <li><?= icon('clock') ?><span><span class="visually-hidden"><?= e(t('label.hours')) ?>: </span><?= e($office['hours']) ?></span></li>
                    </ul>
                </article>
            </li>
            <?php endforeach; ?>
        </ul>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
