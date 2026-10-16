<?php
/* Admin: news articles. Publishing sets the publish date when it is empty. */
require __DIR__ . '/_init.php';

$resource = [
    'table' => 'news_articles',
    'title' => 'News',
    'singular' => 'article',
    'label' => 'title',
    'columns' => ['title' => 'Title', 'published_at' => 'Published'],
    'search' => ['title', 'excerpt'],
    'order' => 'COALESCE(published_at, created_at) DESC, id DESC',
    'publishable' => true,
    'soft_delete' => true,
    'author' => 'author_id',
    'public_url' => fn (array $row) => url('article.php', ['slug' => $row['slug']]),
    'fields' => [
        ['name' => 'title', 'label' => 'Title', 'type' => 'text', 'required' => true, 'max' => 200],
        ['name' => 'slug', 'label' => 'Web address name', 'type' => 'slug', 'from' => 'title', 'max' => 160, 'hint' => 'Lowercase letters, numbers and hyphens. Leave empty to make it from the title.'],
        ['name' => 'category_id', 'label' => 'Category', 'type' => 'category', 'category_type' => 'news'],
        ['name' => 'excerpt', 'label' => 'Short summary', 'type' => 'textarea', 'rows' => 2, 'required' => true, 'max' => 300, 'hint' => 'One or two sentences shown in news lists.'],
        ['name' => 'body', 'label' => 'Article', 'type' => 'richtext', 'required' => true],
        ['name' => 'cover_image', 'label' => 'Cover photo', 'type' => 'image', 'hint' => 'Optional. JPG or PNG, up to 2 MB.'],
        ['name' => 'cover_alt', 'label' => 'Describe the cover photo', 'type' => 'text', 'max' => 200, 'hint' => 'For people who cannot see the photo, for example: Volunteers packing relief goods in a warehouse.'],
    ],
    'validate' => function (array $data, array &$errors): void {
        if (!empty($data['cover_image']) && ($data['cover_alt'] ?? '') === '') {
            $errors['cover_alt'] = 'Describe the cover photo for people who cannot see it';
        }
    },
];
require __DIR__ . '/../includes/admin-crud.php';
