<?php
/* Admin: office directory. */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'offices',
    'title' => 'Offices',
    'singular' => 'office',
    'label' => 'name',
    'columns' => ['name' => 'Office', 'region' => 'Region'],
    'search' => ['name', 'address'],
    'order' => 'sort_order, name',
    'publishable' => true,
    'soft_delete' => true,
    'fields' => [
        ['name' => 'name', 'label' => 'Office name', 'type' => 'text', 'required' => true, 'max' => 150],
        ['name' => 'region', 'label' => 'Region', 'type' => 'select', 'required' => true, 'options' => REGIONS],
        ['name' => 'address', 'label' => 'Address', 'type' => 'textarea', 'rows' => 2, 'required' => true, 'max' => 300],
        ['name' => 'phone', 'label' => 'Phone', 'type' => 'text', 'max' => 60],
        ['name' => 'email', 'label' => 'Email', 'type' => 'email', 'max' => 190],
        ['name' => 'hours', 'label' => 'Office hours', 'type' => 'text', 'max' => 120, 'default' => 'Monday to Friday, 8:00 AM to 5:00 PM'],
        ['name' => 'sort_order', 'label' => 'Order in the list', 'type' => 'number', 'min' => 0, 'max' => 999, 'default' => '0'],
    ],
];
require __DIR__ . '/../includes/admin-crud.php';
