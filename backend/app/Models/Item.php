<?php
require_once __DIR__ . '/../../core/Model.php';

class Item extends Model {
    public static function getAll() {
        $pdo = self::getDB();
        $sql = "SELECT i.*, c.name AS category_name, c.code AS category_code,
                       IFNULL(SUM(lbs.quantity_available), 0) AS total_system_stock
                FROM `items` i
                JOIN `categories` c ON i.category_id = c.id
                LEFT JOIN `item_batches` b ON i.id = b.item_id
                LEFT JOIN `location_batch_stock` lbs ON b.id = lbs.batch_id
                GROUP BY i.id
                ORDER BY i.name ASC";
        return $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function create(array $data) {
        $pdo = self::getDB();
        $stmt = $pdo->prepare("INSERT INTO `items` (`item_code`, `name`, `category_id`, `unit_of_measure`, `min_reorder_level`) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['item_code'],
            $data['name'],
            $data['category_id'],
            $data['unit_of_measure'] ?? 'Unit',
            $data['min_reorder_level'] ?? 10
        ]);
        return $pdo->lastInsertId();
    }
}
