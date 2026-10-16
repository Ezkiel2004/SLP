<?php
/* GET  api/feedback.php → {"csrf_token": "…"} for this site's own pages
   POST api/feedback.php → send feedback (JSON or form fields) with header X-CSRF-Token.
        201 {"reference_no"} · 422 {"errors"} · 429 rate limited · 403 bad token */
require __DIR__ . '/../includes/api.php';
require __DIR__ . '/../includes/csrf.php';
require __DIR__ . '/../includes/feedback.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_out(['csrf_token' => csrf_token()]);
}
require_method('POST');
if (!csrf_valid()) {
    json_out(['error' => 'Missing or expired security token. Reload the page and try again.'], 403);
}
$input = $_POST;
if (str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
    $decoded = json_decode((string) file_get_contents('php://input', false, null, 0, 20000), true);
    $input = is_array($decoded) ? $decoded : [];
    $input['consent'] = isset($input['consent']) && ($input['consent'] === true || $input['consent'] === '1' || $input['consent'] === 1) ? '1' : '';
}
$result = submit_feedback($input);
if (isset($result['reference'])) {
    json_out(['reference_no' => $result['reference']], 201);
}
if (!empty($result['limited'])) {
    json_out(['error' => t('contact.limited')], 429);
}
json_out(['errors' => $result['errors']], 422);
