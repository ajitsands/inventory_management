<?php
// Inventory Ledger Service - Atomic location stock updates & immutable movement ledger logging

require_once __DIR__ . '/../../core/Model.php';

class InventoryLedgerService {

    /**
     * Credit stock to a specific location for a batch
     */
    public static function creditStock(int $locationId, int $batchId, int $qty): void {
        $pdo = Model::getDB();
        $sql = "INSERT INTO `location_batch_stock` (`location_id`, `batch_id`, `quantity_available`)
                VALUES (:location_id, :batch_id, :qty)
                ON DUPLICATE KEY UPDATE `quantity_available` = `quantity_available` + :qty2";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':location_id' => $locationId,
            ':batch_id'    => $batchId,
            ':qty'         => $qty,
            ':qty2'        => $qty
        ]);
    }

    /**
     * Debit stock from a specific location for a batch
     */
    public static function debitStock(int $locationId, int $batchId, int $qty): void {
        $pdo = Model::getDB();
        
        // Verify current quantity
        $checkStmt = $pdo->prepare("SELECT `quantity_available` FROM `location_batch_stock` WHERE `location_id` = ? AND `batch_id` = ? FOR UPDATE");
        $checkStmt->execute([$locationId, $batchId]);
        $row = $checkStmt->fetch(PDO::FETCH_ASSOC);

        $current = $row ? (int)$row['quantity_available'] : 0;
        if ($current < $qty) {
            throw new Exception("Stock debit failed: Requested {$qty} units, but location only has {$current} units available for batch ID {$batchId}.");
        }

        $sql = "UPDATE `location_batch_stock` 
                SET `quantity_available` = `quantity_available` - :qty 
                WHERE `location_id` = :location_id AND `batch_id` = :batch_id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':qty'         => $qty,
            ':location_id' => $locationId,
            ':batch_id'    => $batchId
        ]);
    }

    /**
     * Record movement in stock_movements_ledger
     */
    public static function recordMovement(string $type, string $refNo, int $itemId, int $batchId, ?int $fromLocationId, ?int $toLocationId, int $qty, float $costPrice, float $sellingPrice, int $userId): void {
        $pdo = Model::getDB();
        $sql = "INSERT INTO `stock_movements_ledger` 
                (`transaction_type`, `reference_no`, `item_id`, `batch_id`, `from_location_id`, `to_location_id`, `qty`, `unit_cost`, `unit_price`, `created_by`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $type, $refNo, $itemId, $batchId, $fromLocationId, $toLocationId, $qty, $costPrice, $sellingPrice, $userId
        ]);
    }
}
