<?php
/* Admin: categories for programs, news, downloads and FAQ topics (publishers and up). */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'categories',
    'title' => 'Categories',
    'singular' => 'category',
    'label' => 'name',
    'ability' => 'categories',
    'columns' => ['name' => 'Name', 'type' => 'Used for', 'slug' => 'Web address name'],
    'search' => ['name', 'slug'],
    'order' => 'type, sort_order, name',
    'publishable' => false,
    'soft_delete' => false,
    'fields' => [
        ['name' => 'name', 'label' => 'Name', 'type' => 'text', 'required' => true, 'max' => 100],
        ['name' => 'type', 'label' => 'Used for', 'type' => 'select', 'required' => true,
         'options' => ['program' => 'Programs and services', 'news' => 'News', 'download' => 'Downloads', 'faq' => 'FAQ topics']],
        ['name' => 'slug', 'label' => 'Web address name', 'type' => 'slug', 'from' => 'name', 'max' => 100, 'hint' => 'Used in filter links. Leave empty to make it from the name.'],
        ['name' => 'sort_order', 'label' => 'Order', 'type' => 'number', 'min' => 0, 'max' => 999, 'default' => '0'],
    ],
];
require __DIR__ . '/../includes/admin-crud.php';
