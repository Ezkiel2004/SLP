<?php
/* Admin: programs and services, with their requirements and steps. */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'programs',
    'title' => 'Programs and services',
    'singular' => 'program',
    'label' => 'title_en',
    'columns' => ['title_en' => 'Title', 'kind' => 'Type', 'updated_at' => 'Last updated'],
    'search' => ['title_en', 'title_fil', 'summary'],
    'order' => 'updated_at DESC, id DESC',
    'publishable' => true,
    'soft_delete' => true,
    'public_url' => fn (array $row) => url('program.php', ['slug' => $row['slug']]),
    'fields' => [
        ['name' => 'title_en', 'label' => 'Title (English)', 'type' => 'text', 'required' => true, 'max' => 200],
        ['name' => 'title_fil', 'label' => 'Title (Filipino)', 'type' => 'text', 'max' => 200, 'hint' => 'Optional. Shown to visitors who choose Filipino.'],
        ['name' => 'slug', 'label' => 'Web address name', 'type' => 'slug', 'from' => 'title_en', 'max' => 160, 'hint' => 'Lowercase letters, numbers and hyphens. Leave empty to make it from the English title.'],
        ['name' => 'kind', 'label' => 'Type', 'type' => 'select', 'required' => true, 'options' => ['program' => 'Program', 'service' => 'Service']],
        ['name' => 'category_id', 'label' => 'Category', 'type' => 'category', 'category_type' => 'program'],
        ['name' => 'summary', 'label' => 'Summary', 'type' => 'textarea', 'rows' => 2, 'required' => true, 'max' => 300, 'hint' => 'One plain sentence. It appears on cards and in search results.'],
        ['name' => 'description', 'label' => 'Description', 'type' => 'richtext', 'required' => true],
        ['name' => 'eligibility', 'label' => 'Who can apply', 'type' => 'lines', 'required' => true, 'hint' => 'One item per line.'],
        ['name' => 'requirements', 'label' => 'What to bring', 'type' => 'lines', 'hint' => 'One document per line.',
         'child' => ['table' => 'program_requirements', 'fk' => 'program_id', 'column' => 'requirement', 'order' => 'sort_order']],
        ['name' => 'steps', 'label' => 'How to apply', 'type' => 'lines', 'rows' => 6, 'hint' => 'One step per line, in order.',
         'child' => ['table' => 'program_steps', 'fk' => 'program_id', 'column' => 'instruction', 'order' => 'step_no']],
        ['name' => 'is_featured', 'label' => 'Feature on the home page', 'type' => 'checkbox'],
    ],
];
require __DIR__ . '/../includes/admin-crud.php';
