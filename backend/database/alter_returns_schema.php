<?php
// Migration: Alter existing return tables to match ReturnController expectations
require_once __DIR__ . '/../core/Model.php';

$pdo = Model::getDB();

echo "=== Running Return Schema Migration ===\n\n";

// Helper: check if column exists
function columnExists($pdo, $table, $column) {
    $r = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
    return $r->rowCount() > 0;
}

// -------------------------------------------------------
// 1. stock_returns: add missing columns
// -------------------------------------------------------
echo "1. Patching stock_returns...\n";

$alters = [];

if (!columnExists($pdo, 'stock_returns', 'return_reference'))
    $alters[] = "ADD COLUMN `return_reference` VARCHAR(80) NULL";

if (!columnExists($pdo, 'stock_returns', 'reason'))
    $alters[] = "ADD COLUMN `reason` VARCHAR(255) NULL";

if (!columnExists($pdo, 'stock_returns', 'notes'))
    $alters[] = "ADD COLUMN `notes` TEXT NULL";

if (!columnExists($pdo, 'stock_returns', 'status'))
    $alters[] = "ADD COLUMN `status` ENUM('PENDING_ACCEPTANCE','ACCEPTED','REJECTED','PARTIALLY_ACCEPTED') NOT NULL DEFAULT 'PENDING_ACCEPTANCE'";

if (!columnExists($pdo, 'stock_returns', 'action_by'))
    $alters[] = "ADD COLUMN `action_by` INT NULL";

if (!columnExists($pdo, 'stock_returns', 'action_at'))
    $alters[] = "ADD COLUMN `action_at` DATETIME NULL";

if (!columnExists($pdo, 'stock_returns', 'rejection_reason'))
    $alters[] = "ADD COLUMN `rejection_reason` TEXT NULL";

if (!columnExists($pdo, 'stock_returns', 'original_transfer_no'))
    $alters[] = "ADD COLUMN `original_transfer_no` VARCHAR(80) NULL";

if ($alters) {
    $sql = "ALTER TABLE `stock_returns` " . implode(', ', $alters);
    $pdo->exec($sql);
    echo "   Added columns: " . implode(', ', array_map(fn($a) => explode(' ', $a)[2], $alters)) . "\n";
} else {
    echo "   All columns already exist.\n";
}

// -------------------------------------------------------
// 2. stock_return_items: add missing columns
// -------------------------------------------------------
echo "\n2. Patching stock_return_items...\n";

$alters2 = [];

if (!columnExists($pdo, 'stock_return_items', 'batch_code'))
    $alters2[] = "ADD COLUMN `batch_code` VARCHAR(100) NULL";

if (!columnExists($pdo, 'stock_return_items', 'quantity'))
    $alters2[] = "ADD COLUMN `quantity` INT NOT NULL DEFAULT 0";

if (!columnExists($pdo, 'stock_return_items', 'accepted_qty'))
    $alters2[] = "ADD COLUMN `accepted_qty` INT DEFAULT 0";

if (!columnExists($pdo, 'stock_return_items', 'rejected_qty'))
    $alters2[] = "ADD COLUMN `rejected_qty` INT DEFAULT 0";

if (!columnExists($pdo, 'stock_return_items', 'unit_rate'))
    $alters2[] = "ADD COLUMN `unit_rate` DECIMAL(15,4) DEFAULT 0.0000";

if (!columnExists($pdo, 'stock_return_items', 'total_amount'))
    $alters2[] = "ADD COLUMN `total_amount` DECIMAL(15,4) DEFAULT 0.0000";

if (!columnExists($pdo, 'stock_return_items', 'status'))
    $alters2[] = "ADD COLUMN `status` ENUM('PENDING','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PENDING'";

if ($alters2) {
    $sql2 = "ALTER TABLE `stock_return_items` " . implode(', ', $alters2);
    $pdo->exec($sql2);
    echo "   Added columns: " . implode(', ', array_map(fn($a) => explode(' ', $a)[2], $alters2)) . "\n";
} else {
    echo "   All columns already exist.\n";
}

// -------------------------------------------------------
// 3. Add sequence entries for return & credit_note if missing
// -------------------------------------------------------
echo "\n3. Ensuring sequence entries...\n";

$check = $pdo->query("SHOW COLUMNS FROM `system_sequences` LIKE 'sequence_key'");
if ($check->rowCount() > 0) {
    // Insert RET if missing
    $pdo->exec("INSERT IGNORE INTO `system_sequences` 
        (`sequence_key`, `prefix`, `current_val`, `padding_length`) 
        VALUES ('return', 'RET-', 0, 5)");
    // Insert CN if missing
    $pdo->exec("INSERT IGNORE INTO `system_sequences` 
        (`sequence_key`, `prefix`, `current_val`, `padding_length`) 
        VALUES ('credit_note', 'CN-', 0, 5)");
    echo "   Sequences OK.\n";
} else {
    echo "   system_sequences table not found - skipping.\n";
}

// -------------------------------------------------------
// 4. Verify credit_notes table (create if missing)
// -------------------------------------------------------
echo "\n4. Ensuring credit_notes table...\n";

$pdo->exec("CREATE TABLE IF NOT EXISTS `credit_notes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `credit_note_no` VARCHAR(80) NOT NULL UNIQUE,
    `return_id` INT NOT NULL,
    `branch_location_id` INT NOT NULL,
    `original_transfer_no` VARCHAR(80) NULL,
    `total_amount` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    `reason` TEXT NULL,
    `created_by` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS `credit_note_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `credit_note_id` INT NOT NULL,
    `item_id` INT NOT NULL,
    `batch_id` INT NOT NULL,
    `batch_code` VARCHAR(100) NULL,
    `quantity` INT NOT NULL,
    `unit_rate` DECIMAL(15,4) DEFAULT 0.0000,
    `total_amount` DECIMAL(15,4) DEFAULT 0.0000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

echo "   credit_notes & credit_note_items OK.\n";

// -------------------------------------------------------
// 5. Verify damaged_stock table (create if missing)
// -------------------------------------------------------
echo "\n5. Ensuring damaged_stock table...\n";

$pdo->exec("CREATE TABLE IF NOT EXISTS `damaged_stock` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `return_id` INT NOT NULL,
    `return_item_id` INT NULL,
    `location_id` INT NOT NULL,
    `item_id` INT NOT NULL,
    `batch_id` INT NOT NULL,
    `batch_code` VARCHAR(100) NULL,
    `quantity` INT NOT NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

echo "   damaged_stock OK.\n";

echo "\n=== Migration Complete! ===\n";
