<?php
// Seed Database Script for Inventory System

$host = 'localhost';
$user = 'root';
$pass = 'S@nds1@b';
$dbname = 'inventory_system_db';

try {
    echo "Connecting to MySQL server...\n";
    $pdo = new PDO("mysql:host=$host", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);

    // Read schema.sql
    $schemaSql = file_get_contents(__DIR__ . '/schema.sql');
    echo "Executing schema.sql...\n";
    $pdo->exec($schemaSql);
    echo "Schema created successfully!\n";

    // Seed Data
    $pdo->exec("USE `$dbname`");

    // 1. Locations
    $pdo->exec("INSERT INTO `locations` (`id`, `name`, `code`, `type`, `address`, `phone`) VALUES
        (1, 'Central Main Warehouse & Branch', 'LOC-MAIN-01', 'MAIN_BRANCH', '100 Central Avenue, Tech City', '+1 800-555-0100'),
        (2, 'North Regional Sub-Branch', 'LOC-SUB-01', 'SUB_BRANCH', '45 North Hub, Metro Region', '+1 800-555-0200'),
        (3, 'South Regional Sub-Branch', 'LOC-SUB-02', 'SUB_BRANCH', '88 South Depot, Commercial Zone', '+1 800-555-0300'),
        (4, 'City Wellness Clinic Outlet #1', 'LOC-CLN-01', 'CLINIC', '12 Downtown Medical Complex', '+1 800-555-0401'),
        (5, 'Metro Care Clinic Outlet #2', 'LOC-CLN-02', 'CLINIC', '99 Metro Care Center, East Wing', '+1 800-555-0402')
    ");

    // 2. Users (Password: password123)
    $passwordHash = password_hash('password123', PASSWORD_BCRYPT);

    $stmtUser = $pdo->prepare("INSERT INTO `users` (`username`, `full_name`, `email`, `password_hash`, `role`, `location_id`) VALUES (?, ?, ?, ?, ?, ?)");
    
    // Admin (Full System Access)
    $stmtUser->execute(['admin', 'System Administrator', 'admin@organization.org', $passwordHash, 'ADMIN', 1]);
    
    // Store Manager (Stock Operations)
    $stmtUser->execute(['store_mgr', 'Main Store Manager', 'store.manager@organization.org', $passwordHash, 'STORE_MANAGER', 1]);
    
    // Sub Branch Manager
    $stmtUser->execute(['sub_mgr_north', 'North Branch Manager', 'north.mgr@organization.org', $passwordHash, 'STORE_MANAGER', 2]);

    // OPD / Clinic User (Consumption & Dispensing Entry)
    $stmtUser->execute(['clinic_user1', 'City Clinic Pharmacist', 'clinic1@organization.org', $passwordHash, 'OPD_USER', 4]);

    // Auditor (Reports & Inspection Only)
    $stmtUser->execute(['auditor', 'Senior System Auditor', 'auditor@organization.org', $passwordHash, 'AUDITOR', NULL]);

    // 3. Vendors
    $pdo->exec("INSERT INTO `vendors` (`id`, `name`, `code`, `contact_person`, `phone`, `email`, `address`, `tax_id`) VALUES
        (1, 'MediTech Pharma Supplies', 'VEND-001', 'John Stevenson', '+1 555-111-2222', 'sales@meditech.com', '500 Pharma Way, Industrial Park', 'TAX-8899001'),
        (2, 'Global BioHealth Logistics', 'VEND-002', 'Sarah Jenkins', '+1 555-333-4444', 'orders@biohealth.com', '75 Logistics Blvd, Port City', 'TAX-8899002'),
        (3, 'Apex Medical Instruments', 'VEND-003', 'Robert Chen', '+1 555-777-8888', 'contact@apexmedical.com', '320 Precision Drive, Tech Hub', 'TAX-8899003')
    ");

    // 4. Item Categories
    $pdo->exec("INSERT INTO `categories` (`id`, `name`, `code`, `description`) VALUES
        (1, 'Pharmaceuticals & Medicines', 'CAT-MED', 'Prescription drugs, antibiotics, pain relievers, and syrups'),
        (2, 'Medical Consumables', 'CAT-CON', 'Syringes, bandages, gloves, surgical drapes, and IV sets'),
        (3, 'Diagnostic Equipment', 'CAT-DIAG', 'Blood glucose monitors, test strips, thermometers, and BP cuffs')
    ");

    // 5. Items Master
    $pdo->exec("INSERT INTO `items` (`id`, `item_code`, `name`, `category_id`, `unit_of_measure`, `min_reorder_level`) VALUES
        (1, 'MED-PAR-500', 'Paracetamol 500mg Tablets (Box of 100)', 1, 'Box', 20),
        (2, 'MED-AMO-500', 'Amoxicillin 500mg Capsules (Box of 50)', 1, 'Box', 15),
        (3, 'MED-AZI-250', 'Azithromycin 250mg Tablets (Box of 30)', 1, 'Box', 10),
        (4, 'CON-GLV-LAT', 'Latex Examination Gloves (Box of 100)', 2, 'Box', 50),
        (5, 'CON-SYR-05M', 'Sterile Syringe 5ml (Pack of 50)', 2, 'Pack', 30),
        (6, 'DIA-GLU-STR', 'Blood Glucose Test Strips (Pack of 50)', 3, 'Pack', 15)
    ");

    // 6. Sample Initial Batches for Main Store (Location 1)
    $today = date('Y-m-d');
    $exp1 = date('Y-m-d', strtotime('+18 months'));
    $exp2 = date('Y-m-d', strtotime('+6 months')); // Earlier expiry for FIFO test
    $exp3 = date('Y-m-d', strtotime('+24 months'));

    // Batch 1: Paracetamol (Earliest Expiry - Batch A)
    $pdo->exec("INSERT INTO `item_batches` (`id`, `item_id`, `batch_code`, `vendor_id`, `purchase_price`, `selling_price`, `mrp`, `expiry_date`, `purchase_date`, `initial_qty`, `current_qty`, `status`) VALUES
        (1, 1, 'BTC-PAR-2026-A', 1, 12.50, 20.00, 25.00, '$exp2', '$today', 100, 100, 'ACTIVE'),
        (2, 1, 'BTC-PAR-2026-B', 1, 14.00, 22.00, 26.00, '$exp1', '$today', 150, 150, 'ACTIVE'),
        (3, 2, 'BTC-AMO-2026-A', 2, 25.00, 40.00, 45.00, '$exp1', '$today', 80, 80, 'ACTIVE'),
        (4, 4, 'BTC-GLV-2026-A', 3, 8.00, 15.00, 18.00, '$exp3', '$today', 200, 200, 'ACTIVE')
    ");

    // 7. Initial Location Batch Stock for Main Branch (Location 1)
    $pdo->exec("INSERT INTO `location_batch_stock` (`location_id`, `batch_id`, `quantity_available`) VALUES
        (1, 1, 100),
        (1, 2, 150),
        (1, 3, 80),
        (1, 4, 200)
    ");

    // 8. Log initial stock entries in Movements Ledger & Audit Trail
    $pdo->exec("INSERT INTO `stock_movements_ledger` (`transaction_type`, `reference_no`, `item_id`, `batch_id`, `from_location_id`, `to_location_id`, `qty`, `unit_cost`, `unit_price`, `created_by`) VALUES
        ('PURCHASE', 'INIT-PO-001', 1, 1, NULL, 1, 100, 12.50, 20.00, 1),
        ('PURCHASE', 'INIT-PO-001', 1, 2, NULL, 1, 150, 14.00, 22.00, 1),
        ('PURCHASE', 'INIT-PO-001', 2, 3, NULL, 1, 80, 25.00, 40.00, 1),
        ('PURCHASE', 'INIT-PO-001', 4, 4, NULL, 1, 200, 8.00, 15.00, 1)
    ");

    $pdo->exec("INSERT INTO `system_audit_trail` (`user_id`, `username`, `role`, `module`, `action`, `new_values`, `location_id`) VALUES
        (1, 'admin', 'ADMIN', 'SYSTEM_INIT', 'DATABASE_SEED', 'Initial system seeding with locations, users, vendors, items, and batches.', 1)
    ");

    echo "\nSuccessfully seeded database 'inventory_system_db'!\n";
    echo "Seed Summary:\n";
    echo "- 5 Locations (Main Store, 2 Sub Branches, 2 Clinics)\n";
    echo "- 5 Users (Admin, Store Manager, Sub Mgr, OPD/Clinic User, Auditor)\n";
    echo "- 3 Vendors, 3 Categories, 6 Master Items, 4 Initial Batches\n";

} catch (Exception $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
    exit(1);
}
