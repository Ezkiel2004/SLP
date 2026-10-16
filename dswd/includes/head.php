<?php /* Document start and <head>. Needs $page['title']; $page['description'] is optional. */ ?>
<!doctype html>
<html lang="<?= LANG === 'fil' ? 'fil' : 'en' ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($page['title']) ?> | <?= SITE_SHORT ?></title>
    <meta name="description" content="<?= e($page['description'] ?? '') ?>">
    <link rel="icon" href="<?= e(asset('img/logo.svg')) ?>" type="image/svg+xml">
    <link rel="preload" href="<?= e(url('fonts/inter-latin-wght-normal.woff2')) ?>" as="font" type="font/woff2" crossorigin>
<?php foreach (bundle('css/site.min.css') as $href): ?>
    <link rel="stylesheet" href="<?= e($href) ?>">
<?php endforeach; foreach (bundle('js/ui.min.js') as $src): ?>
    <script src="<?= e($src) ?>" defer></script>
<?php endforeach; ?>
</head>
