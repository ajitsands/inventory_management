<?php
// FIFO Batch Allocation Service - Automatically selects batches based on earliest expiry date & purchase date

require_once __DIR__ . '/../../core/Model.php';

class FifoAllocationEngine {

    /**
     * Get FIFO suggested batch allocations for an item at a specific location
     * Returns array of batches: [['batch_id' => X, 'batch_code' => '...', 'allocated_qty' => Y, 'purchase_price' => P, 'selling_price' => S, 'expiry_date' => E], ...]
     */
    public static function allocateStock(int $itemId, int $requestedQty, int $locationId): array {
        $pdo = Model::getDB();

        // Fetch available non-expired active batches for this location sorted by Expiry Date ASC, Purchase Date ASC (FIFO)
        $sql = "SELECT b.id AS batch_id, b.batch_code, b.purchase_price, b.selling_price, b.mrp, b.expiry_date, b.purchase_date,
                       lbs.quantity_available
                FROM `location_batch_stock` lbs
                JOIN `item_batches` b ON lbs.batch_id = b.id
                WHERE lbs.location_id = :location_id 
                  AND b.item_id = :item_id
                  AND lbs.quantity_available > 0
                  AND b.status = 'ACTIVE'
                  AND b.expiry_date >= CURDATE()
                ORDER BY b.expiry_date ASC, b.purchase_date ASC, b.id ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':location_id' => $locationId,
            ':item_id'     => $itemId
        ]);

        $availableBatches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $allocations = [];
        $remainingToAllocate = $requestedQty;

        foreach ($availableBatches as $batch) {
            if ($remainingToAllocate <= 0) break;

            $batchAvail = (int)$batch['quantity_available'];
            $qtyToTake = min($batchAvail, $remainingToAllocate);

            $allocations[] = [
                'batch_id'       => (int)$batch['batch_id'],
                'batch_code'     => $batch['batch_code'],
                'allocated_qty'  => $qtyToTake,
                'purchase_price' => (float)$batch['purchase_price'],
                'selling_price'  => (float)$batch['selling_price'],
                'mrp'            => (float)$batch['mrp'],
                'expiry_date'    => $batch['expiry_date'],
                'available_qty'  => $batchAvail
            ];

            $remainingToAllocate -= $qtyToTake;
        }

        if ($remainingToAllocate > 0) {
            $totalAvail = $requestedQty - $remainingToAllocate;
            throw new Exception("Insufficient active non-expired stock for Item ID {$itemId} at location. Requested: {$requestedQty}, Available: {$totalAvail}");
        }

        return $allocations;
    }
}
