<?php
// Migration script: Add document_url column to purchase_invoices table for document & image uploads

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

    $stmt = $pdo->query("SHOW COLUMNS FROM `purchase_invoices` LIKE 'document_url'");
    if ($stmt->rowCount() == 0) {
        echo "Adding document_url column to purchase_invoices table...\n";
        $pdo->exec("ALTER TABLE `purchase_invoices` ADD COLUMN `document_url` VARCHAR(255) DEFAULT NULL AFTER `remarks`");
        echo "Added document_url column to purchase_invoices table successfully.\n";
    } else {
        echo "document_url column already exists in purchase_invoices table.\n";
    }

    echo "Purchase document schema update completed successfully!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
