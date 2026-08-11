<?php
// Script to create vendor_quotations and vendor_quotation_items tables

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

    // 1. Ensure min_reorder_level column in items table
    echo "Checking items table structure...\n";
    $columns = $pdo->query("SHOW COLUMNS FROM `items` LIKE 'min_reorder_level'")->fetchAll();
    if (empty($columns)) {
        $pdo->exec("ALTER TABLE `items` ADD COLUMN `min_reorder_level` INT NOT NULL DEFAULT 10 AFTER `unit_of_measure`");
    }

    // 2. Create vendor_quotations table
    echo "Creating vendor_quotations table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `vendor_quotations` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `quotation_no` VARCHAR(100) NOT NULL UNIQUE,
        `vendor_id` INT NOT NULL,
        `location_id` INT NOT NULL DEFAULT 1,
        `quotation_date` DATE NOT NULL,
        `expected_delivery_date` DATE DEFAULT NULL,
        `total_amount` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        `status` ENUM('OPEN', 'PARTIALLY_RECEIVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
        `closure_reason` VARCHAR(255) DEFAULT NULL,
        `created_by` INT NOT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 3. Create vendor_quotation_items table
    echo "Creating vendor_quotation_items table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `vendor_quotation_items` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `quotation_id` INT NOT NULL,
        `item_id` INT NOT NULL,
        `ordered_qty` INT NOT NULL,
        `received_qty` INT NOT NULL DEFAULT 0,
        `unit_price` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        `subtotal` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        FOREIGN KEY (`quotation_id`) REFERENCES `vendor_quotations`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    echo "Vendor Quotations & Items Schema update completed successfully!\n";
} catch (Exception $e) {
    echo "Error updating schema: " . $e->getMessage() . "\n";
}
