<?php
// Local settings for this machine (created at install). Never share or commit this file.
// Local XAMPP uses root without a password because this MariaDB's privilege tables
// (mysql.db, mysql.proxies_priv) are corrupt, so GRANT fails. Use the least-privilege
// account from docs/phase-3-setup.md on any real server.
return [
    'db_user' => 'root',
    'db_pass' => '',
    'app_secret' => '081c9c001054240043ae8de0a907dd9b42ccc0db6192fffe3d2789ae05828f91',
];
