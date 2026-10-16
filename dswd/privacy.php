<?php
/* Privacy policy (RA 10173). Text in brackets is placeholder content for the
   Data Protection Officer to complete. */
require __DIR__ . '/includes/bootstrap.php';

$page = ['title' => t('privacy.title'), 'description' => t('privacy.lead'), 'nav' => ''];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('privacy.title'), t('privacy.lead'), [t('privacy.title') => '']) ?>

    <div class="container page-body">
        <div class="grid">
            <div class="span-lg-8 prose" data-dynamic="privacy-policy">
                <p class="note"><?= e(t('placeholder.notice')) ?></p>
                <h2>What we collect</h2>
                <p>When you send a message through this website, we collect your name, email address, optional mobile number and your message. We do not ask for beneficiary or case records on this website.</p>
                <h2>Why we collect it</h2>
                <p>We use your information only to answer your feedback, complaint or question and to keep a record of how we handled it.</p>
                <h2>Who can see it</h2>
                <p>Only authorized DSWD staff who handle your request. We do not sell or share your information, except when the law requires it.</p>
                <h2>How long we keep it</h2>
                <p>We keep it for <?= (int) CONFIG['feedback_retention_days'] ?> days after your request is resolved or closed, and then delete it securely.</p>
                <h2>Your rights</h2>
                <p>Under the Data Privacy Act of 2012, you can ask to see, correct or delete your information, object to how it is used, and file a complaint with the National Privacy Commission.</p>
                <h2>Contact our Data Protection Officer</h2>
                <p><?= e(setting('dpo_name')) ?>, <?= e(setting('dpo_email')) ?>.</p>
                <a class="btn btn--primary" href="<?= e(url('contact.php', ['type' => 'question'])) ?>"><?= icon('arrow-right') ?><?= e(t('action.contact')) ?></a>
            </div>
        </div>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
