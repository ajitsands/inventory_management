<?php
require_once __DIR__ . '/../../core/Model.php';

class ItemBatch extends Model {
    
    public static function getBatchesByLocation(int $locationId) {
        $pdo = self::getDB();
        $sql = "SELECT lbs.id AS stock_id, lbs.quantity_available, lbs.last_updated,
                       b.id AS batch_id, b.batch_code, b.purchase_price, b.selling_price, b.mrp, b.expiry_date, b.purchase_date, b.status AS batch_status,
                       i.id AS item_id, i.item_code, i.name AS item_name, i.unit_of_measure,
                       v.id AS vendor_id, v.name AS vendor_name
                FROM `location_batch_stock` lbs
                JOIN `item_batches` b ON lbs.batch_id = b.id
                JOIN `items` i ON b.item_id = i.id
                LEFT JOIN `vendors` v ON b.vendor_id = v.id
                WHERE lbs.location_id = ? AND lbs.quantity_available > 0
                ORDER BY b.expiry_date ASC, i.name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$locationId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get ALL batches across ALL locations, summed per batch.
     * Also includes a comma-separated list of location names with stock.
     */
    public static function getAllLocationsStock() {
        $pdo = self::getDB();
        $sql = "SELECT
                    MIN(lbs.id) AS stock_id,
                    SUM(lbs.quantity_available) AS quantity_available,
                    MAX(lbs.last_updated) AS last_updated,
                    b.id AS batch_id, b.batch_code, b.purchase_price, b.selling_price, b.mrp, b.expiry_date, b.purchase_date, b.status AS batch_status,
                    i.id AS item_id, i.item_code, i.name AS item_name, i.unit_of_measure,
                    v.id AS vendor_id, v.name AS vendor_name,
                    GROUP_CONCAT(CONCAT(l.name, ': ', lbs.quantity_available) ORDER BY l.id SEPARATOR ' | ') AS location_breakdown
                FROM `location_batch_stock` lbs
                JOIN `item_batches` b ON lbs.batch_id = b.id
                JOIN `items` i ON b.item_id = i.id
                JOIN `locations` l ON lbs.location_id = l.id
                LEFT JOIN `vendors` v ON b.vendor_id = v.id
                WHERE lbs.quantity_available > 0
                GROUP BY b.id, b.batch_code, b.purchase_price, b.selling_price, b.mrp, b.expiry_date, b.purchase_date, b.status, i.id, i.item_code, i.name, i.unit_of_measure, v.id, v.name
                HAVING SUM(lbs.quantity_available) > 0
                ORDER BY b.expiry_date ASC, i.name ASC";

        $stmt = $pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }


    public static function createBatch(array $data) {
        $pdo = self::getDB();
        $stmt = $pdo->prepare("INSERT INTO `item_batches` 
            (`item_id`, `batch_code`, `vendor_id`, `purchase_price`, `selling_price`, `mrp`, `manufacture_date`, `expiry_date`, `purchase_date`, `initial_qty`, `current_qty`, `status`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')");
            
        $stmt->execute([
            $data['item_id'],
            $data['batch_code'],
            $data['vendor_id'],
            $data['purchase_price'],
            $data['selling_price'],
            $data['mrp'],
            $data['manufacture_date'] ?? null,
            $data['expiry_date'],
            $data['purchase_date'],
            $data['qty'],
            $data['qty']
        ]);
        return $pdo->lastInsertId();
    }
}
