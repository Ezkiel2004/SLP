<?php
/* One program or service: what it is, who can apply, what to bring, how to
   apply step by step, and the forms to download. */
require __DIR__ . '/includes/bootstrap.php';

$program = get_program(param('slug'));
if ($program === null) {
    http_response_code(404);
}

$page = [
    'title' => $program['title'] ?? t('program.not_found'),
    'description' => $program['summary'] ?? '',
    'nav' => 'programs',
    'nav_child' => true,
];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
<?php if ($program === null): ?>
    <?= title_band(t('program.not_found'), t('results.none_hint'), [t('programs.title') => url('programs.php'), t('program.not_found') => ''],
        '<a class="btn btn--primary" href="' . e(url('programs.php')) . '">' . e(t('action.see_all_programs')) . '</a>') ?>
<?php else:
    $form = $program['form_files'][0] ?? null;
    $action = $form
        ? '<a class="btn btn--primary" href="' . e(url($form['file'])) . '">' . icon('download') . e(t('action.download_form')) . '</a>'
        : '<a class="btn btn--primary" href="' . e(url('offices.php')) . '">' . icon('building-2') . e(t('action.find_office')) . '</a>';
    $sections = [
        'about' => t('program.about'),
        'eligibility' => t('program.eligibility'),
        'requirements' => t('program.requirements'),
        'steps' => t('program.steps'),
        'forms' => t('program.forms'),
        'where' => t('program.where'),
    ];
?>
    <?= title_band($program['title'], $program['summary'], [t('programs.title') => url('programs.php'), $program['title'] => ''], $action) ?>

    <div class="container page-body">
        <div class="grid" data-dynamic="program" data-slug="<?= e($program['slug']) ?>">
            <div class="span-lg-8">
                <p class="note"><?= e(t('placeholder.notice')) ?></p>
                <nav class="toc" aria-labelledby="toc-title">
                    <p class="toc__title" id="toc-title"><?= e(t('on_this_page')) ?></p>
                    <ul>
                        <?php foreach ($sections as $id => $label): ?>
                        <li><a href="#<?= e($id) ?>"><?= e($label) ?></a></li>
                        <?php endforeach; ?>
                    </ul>
                </nav>

                <section class="page-section" id="about" aria-labelledby="about-title">
                    <h2 id="about-title"><?= e($sections['about']) ?></h2>
                    <?= $program['description'] /* sanitized rich text, see includes/richtext.php */ ?>
                </section>

                <section class="page-section" id="eligibility" aria-labelledby="eligibility-title">
                    <h2 id="eligibility-title"><?= e($sections['eligibility']) ?></h2>
                    <ul>
                        <?php foreach ($program['eligibility'] as $item): ?><li><?= e($item) ?></li><?php endforeach; ?>
                    </ul>
                </section>

                <section class="page-section" id="requirements" aria-labelledby="requirements-title">
                    <h2 id="requirements-title"><?= e($sections['requirements']) ?></h2>
                    <ul class="checklist">
                        <?php foreach ($program['requirements'] as $item): ?><li><?= icon('check') ?><span><?= e($item) ?></span></li><?php endforeach; ?>
                    </ul>
                </section>

                <section class="page-section" id="steps" aria-labelledby="steps-title">
                    <h2 id="steps-title"><?= e($sections['steps']) ?></h2>
                    <ol class="steps" role="list">
                        <?php foreach ($program['steps'] as $item): ?><li><span><?= e($item) ?></span></li><?php endforeach; ?>
                    </ol>
                </section>

                <section class="page-section" id="forms" aria-labelledby="forms-title">
                    <h2 id="forms-title"><?= e($sections['forms']) ?></h2>
                    <?php if ($program['form_files']): ?>
                    <ul class="file-list">
                        <?php foreach ($program['form_files'] as $file): ?>
                        <li><a href="<?= e(url($file['file'])) ?>"><?= icon('download') ?><?= e($file['title']) ?></a> <span class="file-list__meta">PDF, <?= e(format_bytes($file['size'])) ?></span></li>
                        <?php endforeach; ?>
                    </ul>
                    <?php else: ?>
                    <p><?= e(t('program.no_forms')) ?></p>
                    <?php endif; ?>
                </section>

                <section class="page-section" id="where" aria-labelledby="where-title">
                    <h2 id="where-title"><?= e($sections['where']) ?></h2>
                    <p><?= e(t('program.where_text')) ?></p>
                    <p><a href="<?= e(url('offices.php')) ?>"><?= e(t('action.find_office')) ?></a></p>
                </section>
            </div>

            <aside class="span-lg-4" aria-labelledby="help-title">
                <div class="card">
                    <h2 class="card__title" id="help-title"><?= e(t('program.help')) ?></h2>
                    <p><?= e(t('program.help_text')) ?></p>
                    <ul class="details">
                        <li><?= icon('phone') ?><span><?= e(t('footer.hotline')) ?>: <?= e(setting('hotline')) ?></span></li>
                        <li><?= icon('clock') ?><span><?= e(setting('office_hours')) ?></span></li>
                    </ul>
                    <p><a href="<?= e(url('contact.php', ['type' => 'question'])) ?>"><?= e(t('action.ask')) ?></a></p>
                </div>
            </aside>
        </div>
    </div>
<?php endif; ?>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
