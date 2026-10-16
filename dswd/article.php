<?php
/* One news article: title band with date and category, cover image, body,
   the way back to all news, and related articles. */
require __DIR__ . '/includes/bootstrap.php';

$article = get_article(param('slug'));
if ($article === null) {
    http_response_code(404);
}

$page = [
    'title' => $article['title'] ?? t('article.not_found'),
    'description' => $article['excerpt'] ?? '',
    'nav' => 'news',
    'nav_child' => true,
];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
<?php if ($article === null): ?>
    <?= title_band(t('article.not_found'), t('results.none_hint'), [t('news.title') => url('news.php'), t('article.not_found') => ''],
        '<a class="btn btn--primary" href="' . e(url('news.php')) . '">' . e(t('action.see_all_news')) . '</a>') ?>
<?php else:
    $related = array_slice(array_values(array_filter(
        get_news(['category' => $article['category']], 1, PHP_INT_MAX)['items'],
        fn ($n) => $n['slug'] !== $article['slug']
    )), 0, 3);
?>
    <div class="title-band">
        <div class="container">
            <?= breadcrumbs([t('nav.home') => url('index.php'), t('news.title') => url('news.php'), $article['title'] => '']) ?>
            <h1 class="title-band__title"><?= e($article['title']) ?></h1>
            <p class="title-band__meta"><time datetime="<?= e($article['date']) ?>"><?= e(format_date($article['date'])) ?></time> · <?= e($article['category_label']) ?></p>
        </div>
    </div>

    <div class="container page-body">
        <div class="grid">
            <article class="span-lg-8 prose" data-dynamic="article" data-slug="<?= e($article['slug']) ?>">
                <p class="note"><?= e(t('placeholder.notice')) ?></p>
                <img src="<?= e(url($article['image'])) ?>" alt="<?= e($article['image_alt']) ?>" width="320" height="180" fetchpriority="high">
                <p><strong><?= e($article['excerpt']) ?></strong></p>
                <?= $article['body'] /* sanitized rich text, see includes/richtext.php */ ?>
                <a class="btn btn--primary" href="<?= e(url('news.php')) ?>"><?= icon('arrow-right') ?><?= e(t('action.see_all_news')) ?></a>
            </article>

            <?php if ($related): ?>
            <aside class="span-lg-4" aria-labelledby="related-title">
                <h2 id="related-title"><?= e(t('article.related')) ?></h2>
                <ul class="media-list">
                    <?php foreach ($related as $item): ?>
                    <li class="media">
                        <div>
                            <p class="meta"><time datetime="<?= e($item['date']) ?>"><?= e(format_date($item['date'])) ?></time></p>
                            <h3 class="media__title"><a href="<?= e(url('article.php', ['slug' => $item['slug']])) ?>"><?= e($item['title']) ?></a></h3>
                        </div>
                    </li>
                    <?php endforeach; ?>
                </ul>
            </aside>
            <?php endif; ?>
        </div>
    </div>
<?php endif; ?>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
