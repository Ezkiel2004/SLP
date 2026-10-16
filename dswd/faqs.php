<?php
/* FAQs: one section per topic, each a native <details> accordion. */
require __DIR__ . '/includes/bootstrap.php';

$groups = get_faqs();
$page = ['title' => t('faqs.title'), 'description' => t('faqs.lead'), 'nav' => ''];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('faqs.title'), t('faqs.lead'), [t('faqs.title') => ''],
        '<a class="btn btn--primary" href="' . e(url('contact.php', ['type' => 'question'])) . '">' . icon('arrow-right') . e(t('action.ask')) . '</a>') ?>

    <div class="container page-body">
        <div class="grid">
            <div class="span-lg-8" data-dynamic="faqs">
                <?php $n = 0; foreach ($groups as $topic => $faqs): $n++; ?>
                <section class="page-section" aria-labelledby="topic-<?= $n ?>">
                    <h2 id="topic-<?= $n ?>"><?= e($topic) ?></h2>
                    <div class="accordion">
                        <?php foreach ($faqs as $faq): ?>
                        <details class="accordion__item">
                            <summary class="accordion__summary"><?= e($faq['question']) ?><?= icon('chevron-down', 'accordion__icon') ?></summary>
                            <div class="accordion__body"><p><?= e($faq['answer']) ?></p></div>
                        </details>
                        <?php endforeach; ?>
                    </div>
                </section>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
