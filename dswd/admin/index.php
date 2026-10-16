<?php
/* /admin/ goes to the dashboard (or to sign in). */
require __DIR__ . '/_init.php';

redirect(current_user() ? 'admin/dashboard.php' : 'admin/login.php');
