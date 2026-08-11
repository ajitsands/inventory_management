<?php
// Security & URL Encryption Configuration

return [
    'secret_key' => 'InvSys_Secret_AES256_Key_2026_x89a', // 32 chars key
    'cipher'     => 'aes-256-gcm',
    'jwt_secret' => 'JWT_Auth_Secret_Key_InventorySystem_2026_99x!',
    'jwt_expiry' => 86400 // 24 hours
];
