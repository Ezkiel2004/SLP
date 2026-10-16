<?php
/* Admin: downloadable files (forms, reports, budgets, issuances). */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'downloads',
    'title' => 'Downloads',
    'singular' => 'file',
    'label' => 'title',
    'columns' => ['title' => 'Title', 'year' => 'Year'],
    'search' => ['title'],
    'order' => 'year DESC, title',
    'publishable' => true,
    'soft_delete' => true,
    'fields' => [
        ['name' => 'title', 'label' => 'Title', 'type' => 'text', 'required' => true, 'max' => 200],
        ['name' => 'category_id', 'label' => 'Category', 'type' => 'category', 'category_type' => 'download', 'required' => true],
        ['name' => 'program_id', 'label' => 'Program form', 'type' => 'program', 'hint' => 'Optional. Choose a program to list this file on its page under Forms to download.'],
        ['name' => 'year', 'label' => 'Year', 'type' => 'number', 'required' => true, 'min' => 1990, 'max' => 2100],
        ['name' => 'file_path', 'label' => 'File', 'type' => 'file', 'required' => true, 'size_column' => 'file_size', 'hint' => 'PDF, JPG or PNG, up to 10 MB.'],
    ],
];
require __DIR__ . '/../includes/admin-crud.php';
