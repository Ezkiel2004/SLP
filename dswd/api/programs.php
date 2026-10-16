<?php
/* GET api/programs.php?q=&kind=program|service&category=   → published programs
   GET api/programs.php?slug=…                              → one program in full */
require __DIR__ . '/../includes/api.php';

require_method('GET');
$slug = param('slug');
if ($slug !== '') {
    $program = get_program($slug);
    $program === null
        ? json_out(['error' => 'Not found'], 404)
        : json_out(['program' => api_program($program, true)], 200, 300);
}
$categories = get_categories('program');
$filters = [
    'q' => param('q'),
    'kind' => in_array(param('kind'), ['program', 'service'], true) ? param('kind') : '',
    'category' => isset($categories[param('category')]) ? param('category') : '',
];
json_out(['programs' => array_map(fn ($p) => api_program($p, false), get_programs($filters))], 200, 300);
