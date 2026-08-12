-- Multi-Tier Organization Inventory System Schema
-- Compatible with MySQL 5.7+ / 8.0+

CREATE DATABASE IF NOT EXISTS `inventory_system_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `inventory_system_db`;

-- Drop existing tables in reverse dependency order
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `system_audit_trail`;
DROP TABLE IF EXISTS `stock_movements_ledger`;
DROP TABLE IF EXISTS `sales_invoice_items`;
DROP TABLE IF EXISTS `sales_invoices`;
DROP TABLE IF EXISTS `stock_transfer_items`;
DROP TABLE IF EXISTS `stock_transfers`;
DROP TABLE IF EXISTS `purchase_invoice_items`;
DROP TABLE IF EXISTS `purchase_invoices`;
DROP TABLE IF EXISTS `location_batch_stock`;
DROP TABLE IF EXISTS `item_batches`;
DROP TABLE IF EXISTS `items`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `vendors`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `locations`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Locations Table
CREATE TABLE `locations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `type` ENUM('MAIN_BRANCH', 'SUB_BRANCH', 'CLINIC') NOT NULL,
  `address` TEXT,
  `phone` VARCHAR(30),
  `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Users Table
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'STORE_MANAGER', 'OPD_USER', 'AUDITOR') NOT NULL,
  `location_id` INT DEFAULT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Vendors / Suppliers Table
CREATE TABLE `vendors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `contact_person` VARCHAR(100),
  `phone` VARCHAR(30),
  `email` VARCHAR(150),
  `address` TEXT,
  `tax_id` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Item Categories Table
CREATE TABLE `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Items Table
CREATE TABLE `items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `category_id` INT NOT NULL,
  `unit_of_measure` VARCHAR(30) DEFAULT 'Unit',
  `min_reorder_level` INT DEFAULT 10,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Item Batches Table (Strict Purchase Batch Tracking)
CREATE TABLE `item_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_id` INT NOT NULL,
  `batch_code` VARCHAR(80) NOT NULL,
  `vendor_id` INT NOT NULL,
  `purchase_price` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `selling_price` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `mrp` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `manufacture_date` DATE DEFAULT NULL,
  `expiry_date` DATE NOT NULL,
  `purchase_date` DATE NOT NULL,
  `initial_qty` INT NOT NULL DEFAULT 0,
  `current_qty` INT NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE', 'EXPIRED', 'DEPLETED') DEFAULT 'ACTIVE',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`),
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`),
  INDEX `idx_batch_code` (`batch_code`),
  INDEX `idx_expiry_date` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Location Batch Stock Table (Batch Quantity per Location)
CREATE TABLE `location_batch_stock` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `location_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `quantity_available` INT NOT NULL DEFAULT 0,
  `last_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_location_batch` (`location_id`, `batch_id`),
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`),
  FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Purchase Invoices Table (Main Store Purchase from Vendors)
CREATE TABLE `purchase_invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no` VARCHAR(80) NOT NULL UNIQUE,
  `po_no` VARCHAR(80) NOT NULL,
  `po_date` DATE NOT NULL,
  `vendor_invoice_no` VARCHAR(80) NOT NULL,
  `vendor_invoice_date` DATE NOT NULL,
  `vendor_id` INT NOT NULL,
  `location_id` INT NOT NULL,
  `total_amount` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `remarks` TEXT,
  `created_by` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`),
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Purchase Invoice Items Table
CREATE TABLE `purchase_invoice_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_invoice_id` INT NOT NULL,
  `item_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `qty` INT NOT NULL,
  `purchase_price` DECIMAL(15,3) NOT NULL,
  `selling_price` DECIMAL(15,3) NOT NULL,
  `mrp` DECIMAL(15,3) NOT NULL,
  `expiry_date` DATE NOT NULL,
  `subtotal` DECIMAL(15,3) NOT NULL,
  FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`),
  FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Stock Transfers Table (Main Branch -> Sub Branch [Invoiced] & Sub Branch -> Clinic [Non-Invoiced Transfer])
CREATE TABLE `stock_transfers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transfer_no` VARCHAR(80) NOT NULL UNIQUE,
  `from_location_id` INT NOT NULL,
  `to_location_id` INT NOT NULL,
  `transfer_type` ENUM('BRANCH_INVOICED', 'CLINIC_TRANSFER') NOT NULL,
  `status` ENUM('DISPATCHED', 'RECEIVED', 'CANCELLED') DEFAULT 'DISPATCHED',
  `invoice_no` VARCHAR(80) DEFAULT NULL,
  `subtotal` DECIMAL(15,3) DEFAULT 0.00,
  `vat_amount` DECIMAL(15,3) DEFAULT 0.00,
  `total_val` DECIMAL(15,3) DEFAULT 0.00,
  `paid_amount` DECIMAL(15,3) DEFAULT 0.00,
  `payment_status` ENUM('UNPAID', 'PARTIAL', 'PAID') DEFAULT 'UNPAID',
  `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE') DEFAULT 'CASH',
  `bank_name` VARCHAR(150) DEFAULT NULL,
  `bank_reference` VARCHAR(100) DEFAULT NULL,
  `cheque_no` VARCHAR(80) DEFAULT NULL,
  `cheque_date` DATE DEFAULT NULL,
  `remarks` TEXT,
  `created_by` INT NOT NULL,
  `received_by` INT DEFAULT NULL,
  `dispatched_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `received_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`),
  FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`received_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10b. Invoice Payment Records Table (Partial & Full Payment Receipts Ledger)
CREATE TABLE `invoice_payment_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transfer_id` INT NOT NULL,
  `invoice_no` VARCHAR(80) NOT NULL,
  `amount_paid` DECIMAL(15,3) NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Stock Transfer Items Table
CREATE TABLE `stock_transfer_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transfer_id` INT NOT NULL,
  `item_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `qty` INT NOT NULL,
  `unit_price` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`),
  FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Sales Invoices Table (Clinic -> Customer / Patient OPD Dispensing)
CREATE TABLE `sales_invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sales_invoice_no` VARCHAR(80) NOT NULL UNIQUE,
  `clinic_location_id` INT NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL DEFAULT 'Walk-in Customer',
  `customer_phone` VARCHAR(30),
  `total_amount` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `net_amount` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) DEFAULT 'CASH',
  `created_by` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`clinic_location_id`) REFERENCES `locations`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Sales Invoice Items Table
CREATE TABLE `sales_invoice_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sales_invoice_id` INT NOT NULL,
  `item_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `qty` INT NOT NULL,
  `unit_price` DECIMAL(15,3) NOT NULL,
  `subtotal` DECIMAL(15,3) NOT NULL,
  FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`),
  FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Stock Movements Ledger Table (Immutable Item Movement Trajectory)
CREATE TABLE `stock_movements_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_type` ENUM('PURCHASE', 'BRANCH_TRANSFER', 'CLINIC_TRANSFER', 'CUSTOMER_SALE', 'STOCK_RETURN', 'ADJUSTMENT') NOT NULL,
  `reference_no` VARCHAR(80) NOT NULL,
  `item_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `from_location_id` INT DEFAULT NULL,
  `to_location_id` INT DEFAULT NULL,
  `qty` INT NOT NULL,
  `unit_cost` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `unit_price` DECIMAL(15,3) NOT NULL DEFAULT 0.00,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT NOT NULL,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`),
  FOREIGN KEY (`batch_id`) REFERENCES `item_batches`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
  INDEX `idx_mov_batch` (`batch_id`),
  INDEX `idx_mov_ref` (`reference_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. System Audit Trail Table (Full System Event Tracking)
CREATE TABLE `system_audit_trail` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `user_id` INT DEFAULT NULL,
  `username` VARCHAR(80) DEFAULT 'System',
  `role` VARCHAR(50) DEFAULT 'SYSTEM',
  `ip_address` VARCHAR(50),
  `module` VARCHAR(80) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `old_values` LONGTEXT DEFAULT NULL,
  `new_values` LONGTEXT DEFAULT NULL,
  `location_id` INT DEFAULT NULL,
  INDEX `idx_audit_module` (`module`),
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_time` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
