<?php
/* Site footer and document end. Contact details and social links come from
   site settings (Admin > Settings); empty social links show a placeholder. */
$social = ['Facebook' => setting('facebook_url'), 'YouTube' => setting('youtube_url')];
?>
<footer class="site-footer">
    <div class="container">
        <div class="grid">
            <div class="span-md-6 span-lg-3">
                <p class="site-footer__name"><img src="<?= e(asset('img/logo.svg')) ?>" alt="" width="40" height="40" loading="lazy" decoding="async"><?= e(t('site.name')) ?></p>
                <h2 class="site-footer__heading" id="footer-contact"><?= e(t('footer.contact')) ?></h2>
                <ul class="site-footer__contact" aria-labelledby="footer-contact">
                    <li><?= icon('map-pin') ?><span><?= e(setting('office_address')) ?></span></li>
                    <li><?= icon('phone') ?><span><?= e(t('footer.hotline')) ?>: <?= e(setting('hotline')) ?></span></li>
                    <li><?= icon('mail') ?><span><?= e(setting('contact_email')) ?></span></li>
                    <li><?= icon('clock') ?><span><?= e(setting('office_hours')) ?></span></li>
                </ul>
            </div>
            <nav class="span-md-6 span-lg-3" aria-labelledby="footer-programs">
                <h2 class="site-footer__heading" id="footer-programs"><?= e(t('nav.programs')) ?></h2>
                <ul>
                    <?php foreach (get_programs(['featured' => true]) as $p): ?>
                    <li><a href="<?= e(url('program.php', ['slug' => $p['slug']])) ?>"><?= e($p['title']) ?></a></li>
                    <?php endforeach; ?>
                    <li><a href="<?= e(url('programs.php')) ?>"><?= e(t('action.see_all_programs')) ?></a></li>
                </ul>
            </nav>
            <nav class="span-md-6 span-lg-3" aria-labelledby="footer-about">
                <h2 class="site-footer__heading" id="footer-about"><?= e(t('footer.about')) ?></h2>
                <ul>
                    <li><a href="<?= e(url('about.php')) ?>"><?= e(t('nav.about')) ?></a></li>
                    <li><a href="<?= e(url('offices.php')) ?>"><?= e(t('nav.offices')) ?></a></li>
                    <li><a href="<?= e(url('news.php')) ?>"><?= e(t('nav.news')) ?></a></li>
                    <li><a href="<?= e(url('faqs.php')) ?>"><?= e(t('nav.faqs')) ?></a></li>
                    <li><a href="<?= e(url('contact.php')) ?>"><?= e(t('nav.contact')) ?></a></li>
                </ul>
            </nav>
            <nav class="span-md-6 span-lg-3" aria-labelledby="footer-follow">
                <h2 class="site-footer__heading" id="footer-follow"><?= e(t('footer.follow')) ?></h2>
                <ul>
                    <?php foreach ($social as $name => $link): ?>
                    <li><?php if (preg_match('~^https://~', $link)): ?><a href="<?= e($link) ?>"><?= e($name) ?><?= icon('external-link') ?></a><?php else: ?><?= e(t('footer.social_placeholder', ['name' => $name])) ?><?php endif; ?></li>
                    <?php endforeach; ?>
                </ul>
            </nav>
        </div>
        <div class="site-footer__bottom">
            <p><?= e(t('footer.copyright', ['year' => date('Y')])) ?></p>
            <nav aria-label="<?= e(t('footer.policies')) ?>">
                <ul>
                    <li><a href="<?= e(url('privacy.php')) ?>"><?= e(t('footer.privacy')) ?></a></li>
                    <li><a href="<?= e(url('terms.php')) ?>"><?= e(t('footer.terms')) ?></a></li>
                    <li><a href="<?= e(url('transparency.php')) ?>#foi"><?= e(t('footer.foi')) ?></a></li>
                    <li><a href="<?= e(url('transparency.php')) ?>#transparency-seal"><?= e(t('footer.seal')) ?></a></li>
                    <li><a href="<?= e(url('sitemap.php')) ?>"><?= e(t('footer.sitemap')) ?></a></li>
                </ul>
            </nav>
        </div>
    </div>
</footer>
</body>
</html>
