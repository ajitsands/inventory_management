<?php
require_once __DIR__ . '/../../core/Controller.php';

class ReportController extends Controller {

    public function getMovementLedger() {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $userLocId = $user['location_id'] ?? null;
        $isGlobalAdmin = ($user['role'] === 'ADMIN') || empty($userLocId);

        if ($isGlobalAdmin) {
            $sql = "SELECT sml.*, i.name AS item_name, i.item_code, b.batch_code, b.expiry_date,
                           fl.name AS from_location_name, tl.name AS to_location_name, u.full_name AS created_by_name
                    FROM `stock_movements_ledger` sml
                    JOIN `items` i ON sml.item_id = i.id
                    JOIN `item_batches` b ON sml.batch_id = b.id
                    LEFT JOIN `locations` fl ON sml.from_location_id = fl.id
                    LEFT JOIN `locations` tl ON sml.to_location_id = tl.id
                    JOIN `users` u ON sml.created_by = u.id
                    ORDER BY sml.id DESC LIMIT 300";
            $stmt = $pdo->query($sql);
        } else {
            $sql = "SELECT sml.*, i.name AS item_name, i.item_code, b.batch_code, b.expiry_date,
                           fl.name AS from_location_name, tl.name AS to_location_name, u.full_name AS created_by_name
                    FROM `stock_movements_ledger` sml
                    JOIN `items` i ON sml.item_id = i.id
                    JOIN `item_batches` b ON sml.batch_id = b.id
                    LEFT JOIN `locations` fl ON sml.from_location_id = fl.id
                    LEFT JOIN `locations` tl ON sml.to_location_id = tl.id
                    JOIN `users` u ON sml.created_by = u.id
                    WHERE sml.from_location_id = ? OR sml.to_location_id = ?
                    ORDER BY sml.id DESC LIMIT 300";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([(int)$userLocId, (int)$userLocId]);
        }

        $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->json([
            'success'   => true,
            'movements' => $movements
        ]);
    }

    public function getExpiryAlerts() {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $userLocId = $user['location_id'] ?? null;
        $isGlobalAdmin = ($user['role'] === 'ADMIN') || empty($userLocId);

        if ($isGlobalAdmin) {
            $sql = "SELECT b.*, i.name AS item_name, i.item_code, v.name AS vendor_name,
                           SUM(lbs.quantity_available) AS total_available_qty,
                           DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry
                    FROM `item_batches` b
                    JOIN `items` i ON b.item_id = i.id
                    JOIN `vendors` v ON b.vendor_id = v.id
                    JOIN `location_batch_stock` lbs ON b.id = lbs.batch_id
                    WHERE lbs.quantity_available > 0 AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
                    GROUP BY b.id
                    ORDER BY b.expiry_date ASC";
            $stmt = $pdo->query($sql);
        } else {
            $sql = "SELECT b.*, i.name AS item_name, i.item_code, v.name AS vendor_name,
                           SUM(lbs.quantity_available) AS total_available_qty,
                           DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry
                    FROM `item_batches` b
                    JOIN `items` i ON b.item_id = i.id
                    JOIN `vendors` v ON b.vendor_id = v.id
                    JOIN `location_batch_stock` lbs ON b.id = lbs.batch_id
                    WHERE lbs.location_id = ? AND lbs.quantity_available > 0 AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
                    GROUP BY b.id
                    ORDER BY b.expiry_date ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([(int)$userLocId]);
        }

        $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->json([
            'success' => true,
            'alerts'  => $alerts
        ]);
    }

    public function getValuation() {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $userLocId = $user['location_id'] ?? null;
        $isGlobalAdmin = ($user['role'] === 'ADMIN') || empty($userLocId);

        if ($isGlobalAdmin) {
            $sql = "SELECT l.id AS location_id, l.name AS location_name, l.type AS location_type,
                           COUNT(DISTINCT lbs.batch_id) AS total_batches,
                           SUM(lbs.quantity_available) AS total_units,
                           SUM(lbs.quantity_available * b.purchase_price) AS total_cost_valuation,
                           SUM(lbs.quantity_available * b.selling_price) AS total_sales_valuation
                    FROM `locations` l
                    LEFT JOIN `location_batch_stock` lbs ON l.id = lbs.location_id
                    LEFT JOIN `item_batches` b ON lbs.batch_id = b.id
                    WHERE l.status = 'ACTIVE'
                    GROUP BY l.id
                    ORDER BY l.type ASC, l.name ASC";
            $stmt = $pdo->query($sql);
        } else {
            $sql = "SELECT l.id AS location_id, l.name AS location_name, l.type AS location_type,
                           COUNT(DISTINCT lbs.batch_id) AS total_batches,
                           SUM(lbs.quantity_available) AS total_units,
                           SUM(lbs.quantity_available * b.purchase_price) AS total_cost_valuation,
                           SUM(lbs.quantity_available * b.selling_price) AS total_sales_valuation
                    FROM `locations` l
                    LEFT JOIN `location_batch_stock` lbs ON l.id = lbs.location_id
                    LEFT JOIN `item_batches` b ON lbs.batch_id = b.id
                    WHERE l.id = ? AND l.status = 'ACTIVE'
                    GROUP BY l.id
                    ORDER BY l.type ASC, l.name ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([(int)$userLocId]);
        }

        $valuation = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->json([
            'success'   => true,
            'valuation' => $valuation
        ]);
    }
}
