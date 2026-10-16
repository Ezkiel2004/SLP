<?php
/* Admin: frequently asked questions, grouped by topic. */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'faqs',
    'title' => 'FAQs',
    'singular' => 'question',
    'label' => 'question',
    'columns' => ['question' => 'Question', 'sort_order' => 'Order'],
    'search' => ['question', 'answer'],
    'order' => 'topic_id, sort_order, id',
    'publishable' => true,
    'soft_delete' => true,
    'fields' => [
        ['name' => 'question', 'label' => 'Question', 'type' => 'text', 'required' => true, 'max' => 300],
        ['name' => 'answer', 'label' => 'Answer', 'type' => 'textarea', 'rows' => 4, 'required' => true, 'max' => 2000, 'hint' => 'Short sentences in plain words.'],
        ['name' => 'topic_id', 'label' => 'Topic', 'type' => 'category', 'category_type' => 'faq', 'required' => true],
        ['name' => 'sort_order', 'label' => 'Order within the topic', 'type' => 'number', 'min' => 0, 'max' => 999, 'default' => '0'],
    ],
];
require __DIR__ . '/../includes/admin-crud.php';
