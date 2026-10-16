<?php
/* Admin: officials on the About page. */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'officials',
    'title' => 'Officials',
    'singular' => 'official',
    'label' => 'name',
    'columns' => ['name' => 'Name', 'position' => 'Position'],
    'search' => ['name', 'position'],
    'order' => 'sort_order, id',
    'publishable' => true,
    'soft_delete' => true,
    'fields' => [
        ['name' => 'name', 'label' => 'Name', 'type' => 'text', 'required' => true, 'max' => 150],
        ['name' => 'position', 'label' => 'Position', 'type' => 'text', 'required' => true, 'max' => 200],
        ['name' => 'photo', 'label' => 'Official photo', 'type' => 'image', 'hint' => 'Optional. JPG or PNG, up to 2 MB. Use only the approved official photo.'],
        ['name' => 'sort_order', 'label' => 'Order on the page', 'type' => 'number', 'min' => 0, 'max' => 999, 'default' => '0'],
    ],
];
require __DIR__ . '/../includes/admin-crud.php';
