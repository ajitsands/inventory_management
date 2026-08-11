<?php
// Application General Configuration

return [
    'name'     => 'Organization Multi-Tier Inventory System',
    'env'      => 'development', // 'development' or 'production'
    'timezone' => 'Asia/Kolkata',
    'base_url' => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . 
                 "://" . ($_SERVER['HTTP_HOST'] ?? 'localhost') . 
                 rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/\\')
];
