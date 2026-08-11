<?php
// Update Database Schema for Master Management (Vendors, Branches, Clinics, Customers)

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

    // 1. Create Customers Table if not exists
    echo "Creating customers table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `customers` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(150) NOT NULL,
        `code` VARCHAR(50) NOT NULL UNIQUE,
        `phone` VARCHAR(30),
        `email` VARCHAR(150),
        `address` TEXT,
        `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Add status column to vendors if missing
    echo "Checking status column in vendors table...\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM `vendors` LIKE 'status'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE `vendors` ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' AFTER `tax_id`");
        echo "Added status column to vendors table.\n";
    }

    // 3. Add customer_id column to sales_invoices if missing
    echo "Checking customer_id column in sales_invoices table...\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM `sales_invoices` LIKE 'customer_id'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE `sales_invoices` ADD COLUMN `customer_id` INT DEFAULT NULL AFTER `clinic_location_id`");
        echo "Added customer_id column to sales_invoices table.\n";
    }

    // 4. Seed initial customers if empty
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `customers`");
    $cnt = $stmt->fetch(PDO::FETCH_ASSOC)['cnt'];
    if ($cnt == 0) {
        echo "Seeding initial customer master data...\n";
        $pdo->exec("INSERT INTO `customers` (`name`, `code`, `phone`, `email`, `address`, `status`) VALUES
            ('Walk-in General Customer', 'CUST-001', '+1 555-0101', 'walkin@patient.org', 'OPD Clinic Desk', 'ACTIVE'),
            ('John Doe (Patient #102)', 'CUST-002', '+1 555-0102', 'john.doe@email.com', '12 Maple Street', 'ACTIVE'),
            ('Jane Smith (Patient #103)', 'CUST-003', '+1 555-0103', 'jane.smith@email.com', '88 Oak Ridge Way', 'ACTIVE'),
            ('St. Jude Health Insurance Client', 'CUST-004', '+1 555-0104', 'billing@stjude-health.org', 'Corporate HQ Suite 400', 'ACTIVE')
        ");
        echo "Seeded 4 initial customer records.\n";
    }

    echo "Master schema update completed successfully!\n";
} catch (Exception $e) {
    echo "Error updating master schema: " . $e->getMessage() . "\n";
}
