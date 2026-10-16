<?php
/* Admin: announcements shown on the home page between two dates. */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'announcements',
    'title' => 'Announcements',
    'singular' => 'announcement',
    'label' => 'title',
    'columns' => ['title' => 'Title', 'starts_at' => 'Shows from', 'ends_at' => 'Shows until'],
    'search' => ['title', 'body'],
    'order' => 'starts_at DESC, id DESC',
    'publishable' => true,
    'soft_delete' => true,
    'fields' => [
        ['name' => 'title', 'label' => 'Title', 'type' => 'text', 'required' => true, 'max' => 200],
        ['name' => 'body', 'label' => 'Message', 'type' => 'textarea', 'rows' => 3, 'required' => true, 'max' => 1000],
        ['name' => 'starts_at', 'label' => 'Show from', 'type' => 'date', 'required' => true],
        ['name' => 'ends_at', 'label' => 'Show until', 'type' => 'date', 'required' => true],
        ['name' => 'is_pinned', 'label' => 'Pin to the top', 'type' => 'checkbox'],
    ],
    'validate' => function (array $data, array &$errors): void {
        if (!isset($errors['starts_at']) && !isset($errors['ends_at']) && ($data['ends_at'] ?? '') < ($data['starts_at'] ?? '')) {
            $errors['ends_at'] = 'Show until must be the same as or later than Show from';
        }
    },
];
require __DIR__ . '/../includes/admin-crud.php';
