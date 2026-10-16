<?php
/* GET api/news.php?q=&category=&page=  → published news, 10 per page
   GET api/news.php?slug=…              → one article with its body */
require __DIR__ . '/../includes/api.php';

require_method('GET');
$shape = fn (array $n) => [
    'slug' => $n['slug'], 'title' => $n['title'], 'excerpt' => $n['excerpt'], 'category' => $n['category'],
    'published_at' => $n['published_at'], 'url' => absolute_url('article.php', ['slug' => $n['slug']]),
];
$slug = param('slug');
if ($slug !== '') {
    $article = get_article($slug);
    $article === null
        ? json_out(['error' => 'Not found'], 404)
        : json_out(['article' => $shape($article) + ['body_html' => $article['body']]], 200, 300);
}
$categories = get_categories('news');
$page = int_param('page', 1);
$result = get_news(['q' => param('q'), 'category' => isset($categories[param('category')]) ? param('category') : ''], $page, 10);
json_out(['page' => $page, 'per_page' => 10, 'total' => $result['total'], 'items' => array_map($shape, $result['items'])], 200, 300);
