<?php
/* GET api/downloads.php?q=&category=&year=&page=  → published files, 20 per page */
require __DIR__ . '/../includes/api.php';

require_method('GET');
$categories = get_categories('download');
$page = int_param('page', 1);
$result = get_downloads([
    'q' => param('q'),
    'category' => isset($categories[param('category')]) ? param('category') : '',
    'year' => int_param('year') ?: '',
], $page, 20);
json_out(['page' => $page, 'per_page' => 20, 'total' => $result['total'], 'items' => array_map('api_download', $result['items'])], 200, 300);
