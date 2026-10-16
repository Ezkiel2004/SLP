<?php
/* Transparency: the Transparency Seal checklist, annual reports, budget and
   finance, issuances, and how to make a Freedom of Information request. */
require __DIR__ . '/includes/bootstrap.php';

$byCategory = fn (string $category) => get_downloads(['category' => $category])['items'];
$reports = $byCategory('reports');
$budget = array_merge($byCategory('budget'), $byCategory('procurement'));
$issuances = $byCategory('issuances');
$foiForm = get_downloads(['q' => 'Freedom of Information'])['items'][0] ?? null;
$latestReport = $reports[0] ?? null;

$sections = [
    'transparency-seal' => t('transparency.seal'),
    'annual-reports' => t('transparency.reports'),
    'budget' => t('transparency.budget'),
    'issuances' => t('transparency.issuances'),
    'foi' => t('transparency.foi'),
];
$seal = [
    ['Mandate, functions and officials', url('about.php') . '#mandate'],
    ['Annual reports', '#annual-reports'],
    ['Approved budget and targets', '#budget'],
    ['Major programs and projects', url('programs.php')],
    ['Annual procurement plan', '#budget'],
    ['Freedom of Information manual and request form', '#foi'],
];

/** File list for one group of downloads. */
function file_list(array $files): string
{
    $html = '<ul class="file-list">';
    foreach ($files as $f) {
        $html .= '<li><a href="' . e(url($f['file'])) . '">' . icon('download') . e($f['title']) . '</a> '
            . '<span class="file-list__meta">PDF, ' . e(format_bytes($f['size'])) . '</span></li>';
    }
    return $html . '</ul>';
}

$action = $latestReport
    ? '<a class="btn btn--primary" href="' . e(url($latestReport['file'])) . '">' . icon('download') . e(t('action.latest_report')) . '</a>'
    : '';
$page = ['title' => t('transparency.title'), 'description' => t('transparency.lead'), 'nav' => 'transparency'];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('transparency.title'), t('transparency.lead'), [t('transparency.title') => ''], $action) ?>

    <div class="container page-body">
        <div class="grid">
            <div class="span-lg-8" data-dynamic="transparency">
                <p class="note"><?= e(t('placeholder.notice')) ?></p>
                <nav class="toc" aria-labelledby="toc-title">
                    <p class="toc__title" id="toc-title"><?= e(t('on_this_page')) ?></p>
                    <ul>
                        <?php foreach ($sections as $id => $label): ?><li><a href="#<?= e($id) ?>"><?= e($label) ?></a></li><?php endforeach; ?>
                    </ul>
                </nav>

                <section class="page-section" id="transparency-seal" aria-labelledby="seal-title">
                    <h2 id="seal-title"><?= e($sections['transparency-seal']) ?></h2>
                    <p>The Transparency Seal shows that the department publishes the documents that government agencies are required to post on their websites.</p>
                    <ul class="checklist">
                        <?php foreach ($seal as [$label, $href]): ?><li><?= icon('check') ?><a href="<?= e($href) ?>"><?= e($label) ?></a></li><?php endforeach; ?>
                    </ul>
                </section>

                <section class="page-section" id="annual-reports" aria-labelledby="reports-title">
                    <h2 id="reports-title"><?= e($sections['annual-reports']) ?></h2>
                    <?= file_list($reports) ?>
                </section>

                <section class="page-section" id="budget" aria-labelledby="budget-title">
                    <h2 id="budget-title"><?= e($sections['budget']) ?></h2>
                    <?= file_list($budget) ?>
                </section>

                <section class="page-section" id="issuances" aria-labelledby="issuances-title">
                    <h2 id="issuances-title"><?= e($sections['issuances']) ?></h2>
                    <?= file_list($issuances) ?>
                </section>

                <section class="page-section" id="foi" aria-labelledby="foi-title">
                    <h2 id="foi-title"><?= e($sections['foi']) ?></h2>
                    <p>You can ask for information and records that the department holds. Make your request online through the national eFOI portal, or download the request form and submit it at any DSWD office.</p>
                    <ul class="file-list">
                        <li><a href="https://www.foi.gov.ph/"><?= icon('external-link') ?>eFOI portal (foi.gov.ph)</a></li>
                        <?php if ($foiForm): ?>
                        <li><a href="<?= e(url($foiForm['file'])) ?>"><?= icon('download') ?><?= e($foiForm['title']) ?></a> <span class="file-list__meta">PDF, <?= e(format_bytes($foiForm['size'])) ?></span></li>
                        <?php endif; ?>
                    </ul>
                </section>
            </div>
        </div>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
