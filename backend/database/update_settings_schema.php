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

    // 3. Seed default system settings if empty
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `system_settings`");
    if ($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] == 0) {
        echo "Seeding default store settings...\n";
        $defaultSettings = [
            'store_name' => 'Organization Central Inventory',
            'timezone' => 'Asia/Bahrain',
            'currency_code' => 'BHD',
            'currency_symbol' => 'BD',
            'vat_percent' => '10.00',
            'decimal_places' => '3', // 3 for BHD, 2 for others
            'company_address' => 'Central Highway, Manama, Kingdom of Bahrain',
            'company_phone' => '+973 1700 0000',
            'company_email' => 'admin@organization.bh'
        ];
        $stmtInsert = $pdo->prepare("INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES (?, ?)");
        foreach ($defaultSettings as $k => $v) {
            $stmtInsert->execute([$k, $v]);
        }
    }

    // 4. Seed default auto-increment sequence formats if empty
    $stmtSeq = $pdo->query("SELECT COUNT(*) as cnt FROM `system_sequences`");
    if ($stmtSeq->fetch(PDO::FETCH_ASSOC)['cnt'] == 0) {
        echo "Seeding default sequence prefixes & templates...\n";
        $defaultSequences = [
            ['sequence_key' => 'vendor', 'prefix' => 'VND-', 'current_val' => 2, 'padding_length' => 4, 'format_template' => '{PREFIX}{SEQ}'],
            ['sequence_key' => 'branch', 'prefix' => 'LOC-SUB-', 'current_val' => 2, 'padding_length' => 4, 'format_template' => '{PREFIX}{SEQ}'],
            ['sequence_key' => 'clinic', 'prefix' => 'LOC-CLN-', 'current_val' => 2, 'padding_length' => 4, 'format_template' => '{PREFIX}{SEQ}'],
            ['sequence_key' => 'customer', 'prefix' => 'CUST-', 'current_val' => 4, 'padding_length' => 4, 'format_template' => '{PREFIX}{SEQ}'],
            ['sequence_key' => 'item', 'prefix' => 'ITM-', 'current_val' => 5, 'padding_length' => 4, 'format_template' => '{PREFIX}{SEQ}'],
            ['sequence_key' => 'purchase_invoice', 'prefix' => 'PO-INV/', 'current_val' => 1, 'padding_length' => 5, 'format_template' => '{PREFIX}{YEAR}/{SEQ}'],
            ['sequence_key' => 'branch_transfer', 'prefix' => 'BINV/', 'current_val' => 1, 'padding_length' => 5, 'format_template' => '{PREFIX}{YEAR}/{SEQ}'],
            ['sequence_key' => 'sales_invoice', 'prefix' => 'SA-INV/', 'current_val' => 1, 'padding_length' => 5, 'format_template' => '{PREFIX}{YEAR}/{SEQ}'],
            ['sequence_key' => 'quotation', 'prefix' => 'SA-QTN/', 'current_val' => 0, 'padding_length' => 4, 'format_template' => '{PREFIX}{YEAR}/{SEQ}']
        ];
        $stmtInsertSeq = $pdo->prepare("INSERT INTO `system_sequences` (`sequence_key`, `prefix`, `current_val`, `padding_length`, `format_template`) VALUES (?, ?, ?, ?, ?)");
        foreach ($defaultSequences as $seq) {
            $stmtInsertSeq->execute([$seq['sequence_key'], $seq['prefix'], $seq['current_val'], $seq['padding_length'], $seq['format_template']]);
        }
    }

    echo "Store settings & sequences schema update completed!\n";
} catch (Exception $e) {
    echo "Error updating settings schema: " . $e->getMessage() . "\n";
}
