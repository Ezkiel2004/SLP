<?php
/* Feedback, complaints and questions from the Contact us form and the API.
   Collects only what is needed to reply (Data Privacy Act of 2012), limits
   how often one visitor can send, and returns a reference number. */
declare(strict_types=1);

const FEEDBACK_TYPES = ['feedback', 'complaint', 'question'];

/**
 * Validate and save one message.
 * Returns ['reference' => 'FB-…'] on success, ['errors' => [field => message], 'values' => …]
 * when the form needs fixing, or ['limited' => true, 'values' => …] when sent too often.
 */
function submit_feedback(array $input): array
{
    $text = fn (string $key) => is_string($input[$key] ?? null) ? trim($input[$key]) : '';
    $values = [
        'type' => $text('type'),
        'name' => $text('name'),
        'email' => $text('email'),
        'mobile' => $text('mobile'),
        'subject' => $text('subject'),
        'message' => $text('message'),
    ];
    $errors = [];
    if (!in_array($values['type'], FEEDBACK_TYPES, true)) {
        $errors['type'] = t('contact.error.type');
    }
    if (mb_strlen($values['name']) < 2 || mb_strlen($values['name']) > 120) {
        $errors['name'] = t('contact.error.name');
    }
    if (!filter_var($values['email'], FILTER_VALIDATE_EMAIL) || mb_strlen($values['email']) > 190) {
        $errors['email'] = t('contact.error.email');
    }
    if ($values['mobile'] !== '' && !preg_match('/^\+?[0-9 ()-]{7,20}$/', $values['mobile'])) {
        $errors['mobile'] = t('contact.error.mobile');
    }
    if (mb_strlen($values['subject']) < 3 || mb_strlen($values['subject']) > 150) {
        $errors['subject'] = t('contact.error.subject');
    }
    if (mb_strlen($values['message']) < 10 || mb_strlen($values['message']) > 5000) {
        $errors['message'] = t('contact.error.message');
    }
    if (($input['consent'] ?? '') !== '1') {
        $errors['consent'] = t('contact.error.consent');
    }
    if ($errors) {
        return ['errors' => $errors, 'values' => $values];
    }

    $bucket = 'feedback:' . client_key();
    if (rate_limited($bucket, CONFIG['feedback_max_per_hour'], 3600)) {
        return ['limited' => true, 'values' => $values];
    }
    rate_hit($bucket, 3600);

    for ($try = 0; ; $try++) {
        $reference = 'FB-' . date('Ymd') . '-' . reference_code(6);
        try {
            db_exec(
                'INSERT INTO feedback (reference_no, type, name, email, mobile, subject, message, consent_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                [$reference, $values['type'], $values['name'], strtolower($values['email']),
                 $values['mobile'] !== '' ? $values['mobile'] : null, $values['subject'], $values['message']]
            );
            return ['reference' => $reference];
        } catch (PDOException $ex) {
            if ($ex->getCode() !== '23000' || $try >= 3) {
                throw $ex; // not a duplicate reference, or very unlucky
            }
        }
    }
}

/** Random code without look-alike characters (no 0/O, 1/I/L), easy to read out on the phone. */
function reference_code(int $length): string
{
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < $length; $i++) {
        $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $code;
}

/** Data Privacy Act: delete resolved or closed messages once the retention period
    (config feedback_retention_days) has passed. Runs when staff open the dashboard. */
function purge_old_feedback(): void
{
    $days = (int) CONFIG['feedback_retention_days'];
    $count = db_exec("DELETE FROM feedback WHERE status IN ('resolved', 'closed') AND updated_at < NOW() - INTERVAL ? DAY", [$days]);
    if ($count > 0) {
        audit('purge', 'feedback', null, "Automatic: $count message(s) older than $days days");
    }
}
