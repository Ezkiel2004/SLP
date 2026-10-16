<?php
/* Contact us: feedback, complaint or question form with the privacy notice
   required by the Data Privacy Act of 2012 (RA 10173). On success it shows a
   reference number (post, redirect, then show, so a reload never resends). */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/csrf.php';
require __DIR__ . '/includes/feedback.php';

$types = ['feedback' => t('contact.type.feedback'), 'complaint' => t('contact.type.complaint'), 'question' => t('contact.type.question')];
$values = [
    'type' => isset($types[param('type')]) ? param('type') : 'feedback',
    'name' => '', 'email' => '', 'mobile' => '', 'subject' => '', 'message' => '',
];
$errors = [];
$limited = false;
$consented = false;

csrf_token(); // starts the session before any output
if (is_post()) {
    require_csrf();
    $result = submit_feedback($_POST);
    if (isset($result['reference'])) {
        flash('success', $result['reference']);
        redirect('contact.php', ['sent' => 1]);
    }
    $errors = $result['errors'] ?? [];
    $limited = !empty($result['limited']);
    $values = $result['values'] + $values;
    $consented = post('consent') === '1';
}
$reference = null;
if (param('sent') === '1') {
    foreach (take_flash() as $message) {
        $reference = $message['type'] === 'success' ? $message['message'] : $reference;
    }
}

/** Inline error for one field, linked from the control with aria-describedby. */
function field_error(array $errors, string $field): string
{
    return isset($errors[$field])
        ? '<p class="field__error" id="c-' . e($field) . '-error">' . icon('circle-alert') . e(t('label.error')) . ' ' . e($errors[$field]) . '</p>'
        : '';
}

/** aria-invalid and aria-describedby for a control (with its hint, when it has one). */
function field_attrs(array $errors, string $field, string $hint = ''): string
{
    $ids = trim($hint . (isset($errors[$field]) ? ' c-' . $field . '-error' : ''));
    return (isset($errors[$field]) ? ' aria-invalid="true"' : '') . ($ids !== '' ? ' aria-describedby="' . e($ids) . '"' : '');
}

$page = [
    'title' => $reference ? t('contact.sent_title') : ($errors ? t('contact.errors_title') . ': ' . t('contact.title') : t('contact.title')),
    'description' => t('contact.lead'),
    'nav' => 'contact',
];
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<main id="main" tabindex="-1">
    <?= title_band(t('contact.title'), t('contact.lead'), [t('contact.title') => '']) ?>

    <div class="container page-body">
        <div class="grid">
            <div class="span-lg-8">
                <?php if ($reference): ?>
                <?= alert('success', t('contact.sent_title'), '<p>' . e(t('contact.sent_body', ['ref' => $reference])) . '</p>', true) ?>
                <?php endif; ?>

                <?php if ($errors): ?>
                <div class="alert alert--error" role="alert">
                    <?= icon('circle-alert', 'icon--24 alert__icon') ?>
                    <div class="alert__content">
                        <p class="alert__title"><?= e(t('contact.errors_title')) ?></p>
                        <ul>
                            <?php foreach ($errors as $field => $message): ?>
                            <li><a href="#c-<?= e($field) ?>"><?= e($message) ?></a></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                </div>
                <?php elseif ($limited): ?>
                <?= alert('warning', t('contact.errors_title'), '<p>' . e(t('contact.limited')) . '</p>', true) ?>
                <?php endif; ?>

                <h2><?= e(t('contact.form')) ?></h2>
                <form class="form-stack" action="<?= e(url('contact.php')) ?>" method="post">
                    <?= csrf_field() ?>
                    <fieldset class="fieldset"<?= isset($errors['type']) ? ' aria-describedby="c-type-error"' : '' ?>>
                        <legend class="fieldset__legend"><?= e(t('contact.type')) ?> <span class="field__required"><?= e(t('label.required')) ?></span></legend>
                        <?= field_error($errors, 'type') ?>
                        <div class="choices">
                            <?php foreach ($types as $value => $label): ?>
                            <label class="choice"><input type="radio" name="type" value="<?= e($value) ?>"<?= $value === $values['type'] ? ' checked' : '' ?><?= $value === array_key_first($types) ? ' id="c-type"' : '' ?> required><?= e($label) ?></label>
                            <?php endforeach; ?>
                        </div>
                    </fieldset>

                    <div class="field">
                        <label class="field__label" for="c-name"><?= e(t('contact.name')) ?> <span class="field__required"><?= e(t('label.required')) ?></span></label>
                        <?= field_error($errors, 'name') ?>
                        <input class="input" id="c-name" name="name" type="text" autocomplete="name" maxlength="120" required value="<?= e($values['name']) ?>"<?= field_attrs($errors, 'name') ?>>
                    </div>
                    <div class="field">
                        <label class="field__label" for="c-email"><?= e(t('contact.email')) ?> <span class="field__required"><?= e(t('label.required')) ?></span></label>
                        <p class="field__hint" id="c-email-hint"><?= e(t('contact.email_hint')) ?></p>
                        <?= field_error($errors, 'email') ?>
                        <input class="input" id="c-email" name="email" type="email" autocomplete="email" maxlength="190" required value="<?= e($values['email']) ?>"<?= field_attrs($errors, 'email', 'c-email-hint') ?>>
                    </div>
                    <div class="field">
                        <label class="field__label" for="c-mobile"><?= e(t('contact.mobile')) ?></label>
                        <p class="field__hint" id="c-mobile-hint"><?= e(t('contact.mobile_hint')) ?></p>
                        <?= field_error($errors, 'mobile') ?>
                        <input class="input" id="c-mobile" name="mobile" type="tel" autocomplete="tel" maxlength="20" value="<?= e($values['mobile']) ?>"<?= field_attrs($errors, 'mobile', 'c-mobile-hint') ?>>
                    </div>
                    <div class="field">
                        <label class="field__label" for="c-subject"><?= e(t('contact.subject')) ?> <span class="field__required"><?= e(t('label.required')) ?></span></label>
                        <?= field_error($errors, 'subject') ?>
                        <input class="input" id="c-subject" name="subject" type="text" maxlength="150" required value="<?= e($values['subject']) ?>"<?= field_attrs($errors, 'subject') ?>>
                    </div>
                    <div class="field">
                        <label class="field__label" for="c-message"><?= e(t('contact.message')) ?> <span class="field__required"><?= e(t('label.required')) ?></span></label>
                        <p class="field__hint" id="c-message-hint"><?= e(t('contact.message_hint')) ?></p>
                        <?= field_error($errors, 'message') ?>
                        <textarea class="input" id="c-message" name="message" rows="6" maxlength="5000" required<?= field_attrs($errors, 'message', 'c-message-hint') ?>><?= e($values['message']) ?></textarea>
                    </div>

                    <section class="note" aria-labelledby="privacy-title" id="privacy-notice">
                        <h3 id="privacy-title" class="h4"><?= e(t('contact.privacy')) ?></h3>
                        <p>The Department of Social Welfare and Development collects your name, email address, optional mobile number and message only to answer this request. Only authorized staff can see it. We keep it for <?= (int) CONFIG['feedback_retention_days'] ?> days after your request is resolved, and then delete it.</p>
                        <p>Under the Data Privacy Act of 2012 you can ask to see, correct or delete your information, object to its use, and complain to the National Privacy Commission. Contact our Data Protection Officer at <?= e(setting('dpo_email')) ?>. Read the full <a href="<?= e(url('privacy.php')) ?>"><?= e(t('footer.privacy')) ?></a>.</p>
                    </section>

                    <fieldset class="fieldset">
                        <legend class="visually-hidden"><?= e(t('contact.privacy')) ?></legend>
                        <?= field_error($errors, 'consent') ?>
                        <div class="choices">
                            <label class="choice"><input type="checkbox" id="c-consent" name="consent" value="1" required<?= $consented ? ' checked' : '' ?><?= field_attrs($errors, 'consent') ?>><?= e(t('contact.consent')) ?> <?= e(t('label.required')) ?></label>
                        </div>
                    </fieldset>

                    <p><button class="btn btn--primary" type="submit"><?= icon('arrow-right') ?><?= e(t('action.send')) ?></button></p>
                </form>
            </div>

            <aside class="span-lg-4" aria-labelledby="other-title">
                <div class="card">
                    <h2 class="card__title" id="other-title"><?= e(t('contact.other_ways')) ?></h2>
                    <ul class="details">
                        <li><?= icon('phone') ?><span><?= e(t('footer.hotline')) ?>: <?= e(setting('hotline')) ?></span></li>
                        <li><?= icon('mail') ?><span><?= e(setting('contact_email')) ?></span></li>
                        <li><?= icon('clock') ?><span><?= e(setting('office_hours')) ?></span></li>
                    </ul>
                    <p><a href="<?= e(url('offices.php')) ?>"><?= e(t('action.find_office')) ?></a></p>
                    <p><a href="<?= e(url('faqs.php')) ?>"><?= e(t('nav.faqs')) ?></a></p>
                </div>
            </aside>
        </div>
    </div>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
