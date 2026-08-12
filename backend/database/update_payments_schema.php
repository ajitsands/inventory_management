<?php
// Update Database Schema for Payment Methods (Cash, Bank Transfer, Cheque) & Payment Ledger Records

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

    // 1. Create invoice_payment_records table if not exists
    echo "Creating invoice_payment_records table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `invoice_payment_records` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `transfer_id` INT NOT NULL,
        `invoice_no` VARCHAR(80) NOT NULL,
        `amount_paid` DECIMAL(12,2) NOT NULL,
        `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE') NOT NULL DEFAULT 'CASH',
        `bank_name` VARCHAR(150) DEFAULT NULL,
        `bank_reference` VARCHAR(100) DEFAULT NULL,
        `cheque_no` VARCHAR(80) DEFAULT NULL,
        `cheque_date` DATE DEFAULT NULL,
        `remarks` TEXT DEFAULT NULL,
        `created_by` INT NOT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
        INDEX `idx_pay_transfer` (`transfer_id`),
        INDEX `idx_pay_invoice` (`invoice_no`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "invoice_payment_records table created/verified.\n";

    // 2. Add columns to stock_transfers if missing
    $columns = [
        'payment_method' => "ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE') DEFAULT 'CASH' AFTER `payment_status`",
        'bank_name' => "VARCHAR(150) DEFAULT NULL AFTER `payment_method`",
        'bank_reference' => "VARCHAR(100) DEFAULT NULL AFTER `bank_name`",
        'cheque_no' => "VARCHAR(80) DEFAULT NULL AFTER `bank_reference`",
        'cheque_date' => "DATE DEFAULT NULL AFTER `cheque_no`"
    ];

    foreach ($columns as $col => $def) {
        $stmt = $pdo->query("SHOW COLUMNS FROM `stock_transfers` LIKE '$col'");
        if ($stmt->rowCount() == 0) {
            $pdo->exec("ALTER TABLE `stock_transfers` ADD COLUMN `$col` $def");
            echo "Added $col column to stock_transfers table.\n";
        }
    }

    echo "Payment schema update completed successfully!\n";

} catch (Exception $e) {
    echo "Error updating payment schema: " . $e->getMessage() . "\n";
}
