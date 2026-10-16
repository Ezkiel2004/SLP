<?php
/* About us: mandate, vision and mission, officials and the organizational chart.
   Official texts and names are placeholders until the agency supplies them. */
require __DIR__ . '/includes/bootstrap.php';

$sections = [
    'mandate' => t('about.mandate'),
    'vision-mission' => t('about.vision_mission'),
    'officials' => t('about.officials'),
    'org-chart' => t('about.org_chart'),
];
$page = ['title' => t('about.title'), 'description' => t('about.lead'), 'nav' => 'about'];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('about.title'), t('about.lead'), [t('about.title') => ''],
        '<a class="btn btn--primary" href="' . e(url('offices.php')) . '">' . icon('building-2') . e(t('action.find_office')) . '</a>') ?>

    <div class="container page-body">
        <div class="grid">
            <div class="span-lg-8">
                <p class="note"><?= e(t('placeholder.notice')) ?></p>
                <nav class="toc" aria-labelledby="toc-title">
                    <p class="toc__title" id="toc-title"><?= e(t('on_this_page')) ?></p>
                    <ul>
                        <?php foreach ($sections as $id => $label): ?><li><a href="#<?= e($id) ?>"><?= e($label) ?></a></li><?php endforeach; ?>
                    </ul>
                </nav>

                <section class="page-section" id="mandate" aria-labelledby="mandate-title" data-dynamic="mandate">
                    <h2 id="mandate-title"><?= e($sections['mandate']) ?></h2>
                    <p>The Department of Social Welfare and Development leads the government's work on social welfare and development for poor, vulnerable and disadvantaged Filipinos.</p>
                    <p><?= e(setting('mandate')) ?></p>
                </section>

                <section class="page-section" id="vision-mission" aria-labelledby="vision-mission-title" data-dynamic="vision-mission">
                    <h2 id="vision-mission-title"><?= e($sections['vision-mission']) ?></h2>
                    <div class="grid">
                        <div class="card span-md-6">
                            <h3 class="card__title"><?= e(t('about.vision')) ?></h3>
                            <p><?= e(setting('vision')) ?></p>
                        </div>
                        <div class="card span-md-6">
                            <h3 class="card__title"><?= e(t('about.mission')) ?></h3>
                            <p><?= e(setting('mission')) ?></p>
                        </div>
                    </div>
                </section>

                <section class="page-section" id="officials" aria-labelledby="officials-title" data-dynamic="officials">
                    <h2 id="officials-title"><?= e($sections['officials']) ?></h2>
                    <ul class="grid" role="list">
                        <?php foreach (get_officials() as $official): ?>
                        <li class="span-md-6">
                            <div class="person">
                                <span class="person__photo"><?= icon('user', 'icon--24') ?></span>
                                <div>
                                    <p class="person__name"><?= e($official['name']) ?></p>
                                    <p class="person__position"><?= e($official['position']) ?></p>
                                </div>
                            </div>
                        </li>
                        <?php endforeach; ?>
                    </ul>
                </section>

                <section class="page-section" id="org-chart" aria-labelledby="org-chart-title" data-dynamic="org-chart">
                    <h2 id="org-chart-title"><?= e($sections['org-chart']) ?></h2>
                    <p>[Sample structure. Replace with the approved organizational chart.]</p>
                    <ul class="org-tree">
                        <li><span class="org-tree__unit">Office of the Secretary</span>
                            <ul>
                                <li><span class="org-tree__unit">Operations Group</span>
                                    <ul><li><span class="org-tree__unit">Field offices (16 regions)</span></li></ul>
                                </li>
                                <li><span class="org-tree__unit">Policy and Plans Group</span></li>
                                <li><span class="org-tree__unit">General Administration and Support Services Group</span></li>
                                <li><span class="org-tree__unit">Disaster Response Management Group</span></li>
                            </ul>
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
