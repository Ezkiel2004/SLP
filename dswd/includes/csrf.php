<?php
/* CSRF protection: one random token per session, sent with every POST form
   (csrf_field) or fetch request (X-CSRF-Token header), compared in constant time. */
declare(strict_types=1);

function csrf_token(): string
{
    start_session();
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

/** Hidden input for a POST form. */
function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function csrf_valid(): bool
{
    start_session();
    $sent = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    return is_string($sent) && isset($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $sent);
}

/** Stop the request with 403 unless the token matches. */
function require_csrf(): void
{
    if (!csrf_valid()) {
        http_response_code(403);
        header('Content-Type: text/html; charset=utf-8');
        exit('<!doctype html><title>Session expired</title><p>Your session expired. Go back, reload the page and try again.</p>');
    }
}
