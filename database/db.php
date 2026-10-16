<?php
/*
   The one way to open a database connection (installer, checks and API).
   Every connection gets utf8mb4_unicode_ci, Philippine time and strict mode.
*/

// The server default is not strict: without this, a bad ENUM value is saved as ''.
const SQL_MODE = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

/* root@localhost with no password (local XAMPP only). */
function db_connect(?string $dbName = null): mysqli {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli('localhost', 'root', '', $dbName ?? '');
    $db->set_charset('utf8mb4');
    $db->query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');   // set_charset alone leaves general_ci
    $db->query("SET time_zone = '+08:00'");   // the server runs on America/Los_Angeles
    $db->query("SET SESSION sql_mode = '" . SQL_MODE . "'");
    return $db;
}
