<?php
/* Skip link and sticky site header.
   $page['nav'] names the current section; set $page['nav_child'] = true on a page
   inside a section (program.php, article.php) so the link reads as "current section"
   instead of "current page". */
$navItems = [
    'programs' => 'programs.php',
    'news' => 'news.php',
    'downloads' => 'downloads.php',
    'transparency' => 'transparency.php',
    'offices' => 'offices.php',
    'about' => 'about.php',
    'contact' => 'contact.php',
];
$navCurrent = empty($page['nav_child']) ? 'page' : 'true';
?>
<body>
<a class="skip-link" href="#main"><?= e(t('skip')) ?></a>

<header class="site-header">
    <div class="container site-header__inner">
        <a class="brand brand--short-on-phones" href="<?= e(url('index.php')) ?>" aria-label="<?= e(SITE_SHORT . ', ' . t('site.name')) ?>">
            <img class="brand__logo" src="<?= e(asset('img/logo.svg')) ?>" alt="" width="40" height="40">
            <span class="brand__short"><?= SITE_SHORT ?></span>
            <span class="brand__name"><?= e(t('site.name')) ?></span>
        </a>
        <a class="btn btn--ghost site-header__search" href="<?= e(url('search.php')) ?>"><?= icon('search') ?><?= e(t('header.search')) ?></a>
        <button class="btn btn--ghost menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><?= icon('menu') ?><?= e(t('header.menu')) ?></button>
        <nav class="site-nav" id="site-nav" aria-label="<?= e(t('nav.label')) ?>">
            <ul class="site-nav__list">
                <?php foreach ($navItems as $key => $href): ?>
                <li><a class="site-nav__link" href="<?= e(url($href)) ?>"<?= ($page['nav'] ?? '') === $key ? ' aria-current="' . $navCurrent . '"' : '' ?>><?= e(t('nav.' . $key)) ?></a></li>
                <?php endforeach; ?>
            </ul>
            <p class="lang-toggle">
                <span class="lang-toggle__label"><?= icon('globe') ?><?= e(t('lang.label')) ?>:</span>
                <a class="lang-toggle__link" href="<?= e(lang_url('en')) ?>" lang="en" hreflang="en"<?= LANG === 'en' ? ' aria-current="true"' : '' ?>>English</a>
                <a class="lang-toggle__link" href="<?= e(lang_url('fil')) ?>" lang="fil" hreflang="fil"<?= LANG === 'fil' ? ' aria-current="true"' : '' ?>>Filipino</a>
            </p>
        </nav>
    </div>
</header>
