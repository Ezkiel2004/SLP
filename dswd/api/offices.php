<?php
/* GET api/offices.php?region=  → published offices */
require __DIR__ . '/../includes/api.php';

require_method('GET');
$region = isset(REGIONS[param('region')]) ? param('region') : '';
json_out(['offices' => array_map(fn ($o) => [
    'name' => $o['name'], 'region' => $o['region'], 'region_name' => $o['region_label'],
    'address' => $o['address'], 'phone' => $o['phone'], 'email' => $o['email'], 'hours' => $o['hours'],
], get_offices($region))], 200, 300);
