<?php
// Database Schema Update Script for Multi-Stage Return Wallet Workflow
require_once __DIR__ . '/../core/Model.php';

try {
    $pdo = Model::getDB();

    echo "Updating database schema for Return Wallet workflow...\n";

    // 1. stock_returns table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `stock_returns` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `return_reference` VARCHAR(50) NOT NULL UNIQUE,
        `return_type` ENUM('CLINIC_TO_BRANCH', 'BRANCH_TO_MAIN') NOT NULL,
        `from_location_id` INT NOT NULL,
        `to_location_id` INT NOT NULL,
        `original_transfer_id` INT NULL,
        `original_transfer_no` VARCHAR(50) NULL,
        `reason` VARCHAR(255) NOT NULL,
        `notes` TEXT NULL,
        `document_url` VARCHAR(255) NULL,
        `status` ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED') NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
        `created_by` INT NOT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `action_by` INT NULL,
        `action_at` DATETIME NULL,
        `rejection_reason` TEXT NULL,
        FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT,
        FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT,
        FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 2. stock_return_items table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `stock_return_items` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `return_id` INT NOT NULL,
        `item_id` INT NOT NULL,
        `batch_id` INT NOT NULL,
        `batch_code` VARCHAR(100) NOT NULL,
        `quantity` INT NOT NULL,
        `accepted_qty` INT DEFAULT 0,
        `rejected_qty` INT DEFAULT 0,
        `unit_rate` DECIMAL(15,4) DEFAULT 0.0000,
        `total_amount` DECIMAL(15,4) DEFAULT 0.0000,
        `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        FOREIGN KEY (`return_id`) REFERENCES `stock_returns`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT,
        FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 3. stock_return_wallets table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `stock_return_wallets` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `return_id` INT NOT NULL,
        `return_item_id` INT NOT NULL,
        `target_location_id` INT NOT NULL,
        `item_id` INT NOT NULL,
        `batch_id` INT NOT NULL,
        `quantity` INT NOT NULL,
        `wallet_type` ENUM('PENDING_RETURN', 'CLINIC_REJECT', 'MAIN_STORE_DAMAGED') NOT NULL DEFAULT 'PENDING_RETURN',
        `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'RESTORED_TO_STOCK') NOT NULL DEFAULT 'PENDING',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`return_id`) REFERENCES `stock_returns`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`return_item_id`) REFERENCES `stock_return_items`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`target_location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT,
        FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 4. stock_return_rejections (Clinic Reject Wallet)
    $pdo->exec("CREATE TABLE IF NOT EXISTS `stock_return_rejections` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `return_id` INT NOT NULL,
        `return_item_id` INT NOT NULL,
        `clinic_location_id` INT NOT NULL,
        `item_id` INT NOT NULL,
        `batch_id` INT NOT NULL,
        `batch_code` VARCHAR(100) NOT NULL,
        `quantity` INT NOT NULL,
        `rejection_reason` TEXT NULL,
        `status` ENUM('IN_REJECT_WALLET', 'RESTORED_TO_STOCK') NOT NULL DEFAULT 'IN_REJECT_WALLET',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `restored_at` DATETIME NULL,
        `restored_by` INT NULL,
        FOREIGN KEY (`return_id`) REFERENCES `stock_returns`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`clinic_location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT,
        FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 5. credit_notes table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `credit_notes` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `credit_note_no` VARCHAR(50) NOT NULL UNIQUE,
        `return_id` INT NOT NULL,
        `branch_location_id` INT NOT NULL,
        `original_transfer_no` VARCHAR(50) NULL,
        `total_amount` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
        `reason` TEXT NULL,
        `created_by` INT NOT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`return_id`) REFERENCES `stock_returns`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`branch_location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 6. credit_note_items table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `credit_note_items` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `credit_note_id` INT NOT NULL,
        `item_id` INT NOT NULL,
        `batch_id` INT NOT NULL,
        `batch_code` VARCHAR(100) NOT NULL,
        `quantity` INT NOT NULL,
        `unit_rate` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
        `total_amount` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
        FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT,
        FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 7. damaged_stock table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `damaged_stock` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `return_id` INT NOT NULL,
        `return_item_id` INT NOT NULL,
        `location_id` INT NOT NULL,
        `item_id` INT NOT NULL,
        `batch_id` INT NOT NULL,
        `batch_code` VARCHAR(100) NOT NULL,
        `quantity` INT NOT NULL,
        `reason` TEXT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`return_id`) REFERENCES `stock_returns`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT,
        FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Register return sequence if not present
    $checkSeq = $pdo->query("SELECT * FROM `system_sequences` WHERE `sequence_key` IN ('return', 'credit_note')")->fetchAll();
    $existingModules = array_column($checkSeq, 'sequence_key');

    if (!in_array('return', $existingModules)) {
        $pdo->exec("INSERT INTO `system_sequences` (`sequence_key`, `prefix`, `current_val`, `padding_length`) VALUES ('return', 'RET-', 0, 4)");
    }
    if (!in_array('credit_note', $existingModules)) {
        $pdo->exec("INSERT INTO `system_sequences` (`sequence_key`, `prefix`, `current_val`, `padding_length`) VALUES ('credit_note', 'CN-', 0, 4)");
    }

    echo "Schema updated successfully for Return Wallet workflow!\n";
} catch (\Exception $e) {
    echo "Error updating schema: " . $e->getMessage() . "\n";
}
