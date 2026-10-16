<?php
/* Terms of use. Placeholder text for the legal office to complete. */
require __DIR__ . '/includes/bootstrap.php';

$page = ['title' => t('terms.title'), 'description' => t('terms.lead'), 'nav' => ''];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('terms.title'), t('terms.lead'), [t('terms.title') => '']) ?>

    <div class="container page-body">
        <div class="grid">
            <div class="span-lg-8 prose" data-dynamic="terms">
                <p class="note"><?= e(t('placeholder.notice')) ?></p>
                <h2>Using this website</h2>
                <p>[Placeholder] You may read, download and share the information on this website for personal and non-commercial use.</p>
                <h2>Accuracy of information</h2>
                <p>[Placeholder] We keep the information up to date. If you see an error, tell us through the Contact us page.</p>
                <h2>Links to other websites</h2>
                <p>[Placeholder] We are not responsible for the content of other websites we link to.</p>
                <h2>Changes to these terms</h2>
                <p>[Placeholder] We post any change on this page with the date it takes effect.</p>
                <a class="btn btn--primary" href="<?= e(url('contact.php', ['type' => 'question'])) ?>"><?= icon('arrow-right') ?><?= e(t('action.contact')) ?></a>
            </div>
        </div>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
