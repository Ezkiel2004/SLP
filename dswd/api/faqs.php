<?php
/* GET api/faqs.php  → published FAQs grouped by topic */
require __DIR__ . '/../includes/api.php';

require_method('GET');
$topics = [];
foreach (get_faqs() as $topic => $faqs) {
    $topics[] = ['topic' => $topic, 'questions' => array_map(fn ($f) => ['question' => $f['question'], 'answer' => $f['answer']], $faqs)];
}
json_out(['topics' => $topics], 200, 300);
