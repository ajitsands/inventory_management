<?php
// Migration script: Add 'STOCK_RETURN' to stock_movements_ledger.transaction_type ENUM
// and update existing return records.

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

    echo "Modifying stock_movements_ledger transaction_type ENUM column...\n";
    $pdo->exec("ALTER TABLE `stock_movements_ledger` 
                MODIFY COLUMN `transaction_type` ENUM('PURCHASE', 'BRANCH_TRANSFER', 'CLINIC_TRANSFER', 'CUSTOMER_SALE', 'STOCK_RETURN', 'ADJUSTMENT') NOT NULL");

    echo "Updating existing return movement records in ledger...\n";
    $stmt = $pdo->exec("UPDATE `stock_movements_ledger` 
                       SET `transaction_type` = 'STOCK_RETURN' 
                       WHERE `reference_no` LIKE 'RET-%' OR `transaction_type` = '' OR `transaction_type` IS NULL");

    echo "Updated {$stmt} stock movement ledger records to 'STOCK_RETURN'.\n";
    echo "Ledger ENUM migration completed successfully!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
