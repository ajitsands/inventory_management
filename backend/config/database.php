<?php
// Database Configuration

return [
    'host'     => 'localhost',
    'database' => 'inventory_system_db',
    'username' => 'root',
    'password' => 'S@nds1@b',
    'charset'  => 'utf8mb4',
    'options'  => [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]
];
