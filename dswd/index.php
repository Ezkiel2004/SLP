<?php
/* Home: one message, the site search, quick access, news, announcements,
   featured programs and the regional offices link. */
require __DIR__ . '/includes/bootstrap.php';

$page = ['title' => t('nav.home'), 'description' => t('home.lead'), 'nav' => ''];
$quick = [
    ['icon' => 'hand-heart', 'title' => t('home.quick.programs'), 'text' => t('home.quick.programs_text'), 'href' => url('programs.php', ['kind' => 'program'])],
    ['icon' => 'heart-handshake', 'title' => t('home.quick.services'), 'text' => t('home.quick.services_text'), 'href' => url('programs.php', ['kind' => 'service'])],
    ['icon' => 'file-text', 'title' => t('home.quick.forms'), 'text' => t('home.quick.forms_text'), 'href' => url('downloads.php', ['category' => 'forms'])],
    ['icon' => 'megaphone', 'title' => t('home.quick.report'), 'text' => t('home.quick.report_text'), 'href' => url('contact.php', ['type' => 'complaint'])],
];
$news = get_news([], 1, 3)['items'];
$announcements = get_announcements();
$featured = get_programs(['featured' => true]);

require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <div class="title-band title-band--hero">
        <div class="container">
            <h1 class="title-band__title"><?= e(t('home.title')) ?></h1>
            <p class="title-band__lead"><?= e(t('home.lead')) ?></p>
            <form class="search-form" action="<?= e(url('search.php')) ?>" method="get" role="search">
                <label class="search-form__label" for="home-search"><?= e(t('home.search_label')) ?></label>
                <div class="search-form__row">
                    <input class="input" id="home-search" name="q" type="search" placeholder="<?= e(t('search.example')) ?>">
                    <button class="btn btn--primary" type="submit"><?= icon('search') ?><?= e(t('action.search')) ?></button>
                </div>
            </form>
        </div>
    </div>

    <div class="container page-body">
        <section class="page-section" aria-labelledby="quick-title">
            <h2 id="quick-title"><?= e(t('home.quick')) ?></h2>
            <ul class="grid" role="list">
                <?php foreach ($quick as $item): ?>
                <li class="span-md-6 span-lg-3">
                    <article class="card card--link">
                        <?= icon($item['icon'], 'icon--24 card__icon') ?>
                        <h3 class="card__title"><a href="<?= e($item['href']) ?>"><?= e($item['title']) ?></a></h3>
                        <p><?= e($item['text']) ?></p>
                    </article>
                </li>
                <?php endforeach; ?>
            </ul>
        </section>

        <div class="grid page-section">
            <section class="span-lg-8" aria-labelledby="news-title" data-dynamic="news-latest">
                <div class="section-head">
                    <h2 id="news-title"><?= e(t('home.news')) ?></h2>
                    <a href="<?= e(url('news.php')) ?>"><?= e(t('action.see_all_news')) ?></a>
                </div>
                <ul class="media-list">
                    <?php foreach ($news as $item): ?>
                    <li class="media">
                        <img class="media__image" src="<?= e(url($item['image'])) ?>" alt="" width="320" height="180" loading="lazy" decoding="async">
                        <div>
                            <p class="meta"><time datetime="<?= e($item['date']) ?>"><?= e(format_date($item['date'])) ?></time><span><?= e($item['category_label']) ?></span></p>
                            <h3 class="media__title"><a href="<?= e(url('article.php', ['slug' => $item['slug']])) ?>"><?= e($item['title']) ?></a></h3>
                            <p><?= e($item['excerpt']) ?></p>
                        </div>
                    </li>
                    <?php endforeach; ?>
                </ul>
            </section>

            <section class="span-lg-4" aria-labelledby="announcements-title" data-dynamic="announcements">
                <h2 id="announcements-title"><?= e(t('home.announcements')) ?></h2>
                <ul class="media-list">
                    <?php foreach ($announcements as $item): ?>
                    <li class="media">
                        <div>
                            <p class="meta"><?= icon('calendar') ?><time datetime="<?= e($item['starts_at']) ?>"><?= e(format_date($item['starts_at'])) ?></time></p>
                            <h3 class="media__title"><?= e($item['title']) ?></h3>
                            <p><?= e($item['body']) ?></p>
                        </div>
                    </li>
                    <?php endforeach; ?>
                </ul>
            </section>
        </div>

        <section class="page-section" aria-labelledby="featured-title" data-dynamic="programs-featured">
            <div class="section-head">
                <h2 id="featured-title"><?= e(t('home.featured')) ?></h2>
                <a href="<?= e(url('programs.php')) ?>"><?= e(t('action.see_all_programs')) ?></a>
            </div>
            <ul class="grid" role="list">
                <?php foreach ($featured as $p): ?>
                <li class="span-md-6 span-lg-4">
                    <article class="card card--link">
                        <p class="card__meta"><?= e($p['category_label']) ?></p>
                        <h3 class="card__title"><a href="<?= e(url('program.php', ['slug' => $p['slug']])) ?>"><?= e($p['title']) ?></a></h3>
                        <p><?= e($p['summary']) ?></p>
                    </article>
                </li>
                <?php endforeach; ?>
            </ul>
        </section>
    </div>

    <section class="band" aria-labelledby="offices-title">
        <div class="container band__inner">
            <div>
                <h2 id="offices-title"><?= e(t('home.offices')) ?></h2>
                <p><?= e(t('home.offices_text')) ?></p>
            </div>
            <a class="btn btn--secondary" href="<?= e(url('offices.php')) ?>"><?= icon('building-2') ?><?= e(t('action.find_office')) ?></a>
        </div>
    </section>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
