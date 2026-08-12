<?php
// Migration script: Create stock_returns and stock_return_items tables for 3-way Return Workflows
// (Clinic -> Branch, Branch -> Main Store, Main Store -> Vendor)

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

    // 1. Create stock_returns Header Table
    echo "Creating stock_returns table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `stock_returns` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `return_no` VARCHAR(80) NOT NULL UNIQUE,
        `return_type` ENUM('CLINIC_TO_BRANCH', 'BRANCH_TO_MAIN', 'MAIN_TO_VENDOR') NOT NULL,
        `from_location_id` INT DEFAULT NULL,
        `to_location_id` INT DEFAULT NULL,
        `vendor_id` INT DEFAULT NULL,
        `return_reason` ENUM('EXPIRED', 'DAMAGED', 'EXCESS_STOCK', 'WRONG_ITEM', 'OTHER') NOT NULL DEFAULT 'EXCESS_STOCK',
        `remarks` TEXT DEFAULT NULL,
        `subtotal` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        `vat_amount` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        `total_val` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        `document_url` VARCHAR(255) DEFAULT NULL,
        `created_by` INT NOT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`),
        FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`),
        FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`),
        FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Create stock_return_items Detail Table
    echo "Creating stock_return_items table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `stock_return_items` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `return_id` INT NOT NULL,
        `item_id` INT NOT NULL,
        `batch_id` INT NOT NULL,
        `qty` INT NOT NULL,
        `unit_price` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        `subtotal` DECIMAL(15, 3) NOT NULL DEFAULT '0.000',
        FOREIGN KEY (`return_id`) REFERENCES `stock_returns`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`item_id`) REFERENCES `items`(`id`),
        FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 3. Add sequence record for stock_returns if missing in system_sequences
    echo "Checking return sequence configuration...\n";
    $stmtSeq = $pdo->query("SELECT COUNT(*) as cnt FROM `system_sequences` WHERE sequence_key = 'stock_return'");
    if ($stmtSeq->fetch(PDO::FETCH_ASSOC)['cnt'] == 0) {
        $pdo->exec("INSERT INTO `system_sequences` (`sequence_key`, `prefix`, `current_val`, `padding_length`, `format_template`) 
                    VALUES ('stock_return', 'RET-', 0, 4, '{PREFIX}{SEQ}')");
        echo "Added sequence key 'stock_return' to system_sequences table.\n";
    }

    echo "Stock Returns schema migration completed successfully!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
