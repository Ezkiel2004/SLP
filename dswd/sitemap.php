<?php
/* Sitemap: every page, in the same order as the navigation. */
require __DIR__ . '/includes/bootstrap.php';

$page = ['title' => t('sitemap.title'), 'description' => t('sitemap.lead'), 'nav' => ''];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('sitemap.title'), t('sitemap.lead'), [t('sitemap.title') => ''],
        '<a class="btn btn--primary" href="' . e(url('search.php')) . '">' . icon('search') . e(t('action.search_site')) . '</a>') ?>

    <div class="container page-body">
        <ul data-dynamic="sitemap">
            <li><a href="<?= e(url('index.php')) ?>"><?= e(t('nav.home')) ?></a>
                <ul>
                    <li><a href="<?= e(url('programs.php')) ?>"><?= e(t('nav.programs')) ?></a>
                        <ul>
                            <?php foreach (get_programs() as $p): ?>
                            <li><a href="<?= e(url('program.php', ['slug' => $p['slug']])) ?>"><?= e($p['title']) ?></a></li>
                            <?php endforeach; ?>
                        </ul>
                    </li>
                    <li><a href="<?= e(url('news.php')) ?>"><?= e(t('nav.news')) ?></a></li>
                    <li><a href="<?= e(url('downloads.php')) ?>"><?= e(t('nav.downloads')) ?></a></li>
                    <li><a href="<?= e(url('transparency.php')) ?>"><?= e(t('nav.transparency')) ?></a></li>
                    <li><a href="<?= e(url('offices.php')) ?>"><?= e(t('nav.offices')) ?></a></li>
                    <li><a href="<?= e(url('about.php')) ?>"><?= e(t('nav.about')) ?></a></li>
                    <li><a href="<?= e(url('contact.php')) ?>"><?= e(t('nav.contact')) ?></a></li>
                    <li><a href="<?= e(url('faqs.php')) ?>"><?= e(t('nav.faqs')) ?></a></li>
                    <li><a href="<?= e(url('search.php')) ?>"><?= e(t('search.title')) ?></a></li>
                    <li><a href="<?= e(url('privacy.php')) ?>"><?= e(t('footer.privacy')) ?></a></li>
                    <li><a href="<?= e(url('terms.php')) ?>"><?= e(t('footer.terms')) ?></a></li>
                </ul>
            </li>
        </ul>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
