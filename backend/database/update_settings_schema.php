<?php
// Script to create Store Settings & Auto-Increment Sequences tables

$host = 'localhost';
$user = 'root';
$pass = 'S@nds1@b';
$dbname = 'inventory_system_db';

try {
    echo "Connecting to MySQL server...\n";
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);

    // 1. Create system_settings table
    echo "Creating system_settings table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `system_settings` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `setting_key` VARCHAR(100) NOT NULL UNIQUE,
        `setting_value` TEXT NOT NULL,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Create system_sequences table
    echo "Creating system_sequences table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `system_sequences` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `sequence_key` VARCHAR(100) NOT NULL UNIQUE,
        `prefix` VARCHAR(50) NOT NULL,
        `current_val` INT NOT NULL DEFAULT 0,
        `padding_length` INT NOT NULL DEFAULT 4,
        `format_template` VARCHAR(100) DEFAULT '{PREFIX}{SEQ}',
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 3. Seed default system settings if empty or missing vat_calculation_mode
    echo "Seeding default store settings...\n";
    $defaultSettings = [
        'store_name' => 'Organization Central Inventory',
        'timezone' => 'Asia/Bahrain',
        'currency_code' => 'BHD',
        'currency_symbol' => 'BD',
        'vat_percent' => '10.00',
        'vat_calculation_mode' => 'ITEM_WISE', // ITEM_WISE (Line Item Tax) vs TOTAL_BILL (Total Bill Tax After Discount)
        'decimal_places' => '3', // 3 for BHD, 2 for others
        'date_format' => 'DD/MM/YYYY',
        'company_address' => 'Central Highway, Manama, Kingdom of Bahrain',
        'company_phone' => '+973 1700 0000',
        'company_email' => 'admin@organization.bh'
    ];
    $stmtInsert = $pdo->prepare("INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    foreach ($defaultSettings as $k => $v) {
        $stmtInsert->execute([$k, $v]);
    }

    echo "Store settings vat_calculation_mode schema update completed!\n";
} catch (Exception $e) {
    echo "Error updating settings schema: " . $e->getMessage() . "\n";
}
