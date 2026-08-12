<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Models/ItemBatch.php';
require_once __DIR__ . '/../Models/Location.php';
require_once __DIR__ . '/../Models/Vendor.php';
require_once __DIR__ . '/../Models/Item.php';

class BatchController extends Controller {

    public function getStockByLocation() {
        $user = $this->requireAuth();
        $userLocId = $user['location_id'] ?? null;
        $isGlobalAdmin = ($user['role'] === 'ADMIN') || empty($userLocId);

        $rawLocId = $_GET['raw_location_id'] ?? null;
        $locationId = $_GET['location_id'] ?? null;

        $targetLocId = 0;
        if (!empty($rawLocId) && is_numeric($rawLocId)) {
            $targetLocId = (int)$rawLocId;
        } elseif (!empty($locationId)) {
            if (is_numeric($locationId)) {
                $targetLocId = (int)$locationId;
            } else {
                $formattedToken = str_replace(' ', '+', $locationId);
                $decrypted = UrlSecurity::decrypt($formattedToken);
                $targetLocId = (!empty($decrypted) && is_numeric($decrypted)) ? (int)$decrypted : (int)$locationId;
            }
        }

        if (!$isGlobalAdmin && !empty($userLocId)) {
            $targetLocId = (int)$userLocId;
        } elseif ($targetLocId <= 0) {
            $targetLocId = 1;
        }

        $batches = ItemBatch::getBatchesByLocation($targetLocId);
        $encrypted = array_map(function($b) {
            $rawStockId = (int)$b['stock_id'];
            $rawBatchId = (int)($b['batch_id'] ?? $rawStockId);
            $b['raw_id'] = $rawStockId;
            $b['id'] = UrlSecurity::encrypt($rawStockId);
            $b['raw_batch_id'] = $rawBatchId;
            $b['batch_id'] = UrlSecurity::encrypt($rawBatchId);
            $b['vendor_name'] = $b['vendor_name'] ?? 'N/A';
            return $b;
        }, $batches);

        $this->json([
            'success' => true,
            'batches' => $encrypted
        ]);
    }

    public function getMasterData() {
        $this->requireAuth();
        $locations = Location::getAll();
        $vendors = Vendor::getAll();
        $items = Item::getAll();

        $encLocations = array_map(function($l) { $l['raw_id'] = (int)$l['id']; $l['id'] = UrlSecurity::encrypt($l['id']); return $l; }, $locations);
        $encVendors = array_map(function($v) { $v['raw_id'] = (int)$v['id']; $v['id'] = UrlSecurity::encrypt($v['id']); return $v; }, $vendors);
        $encItems = array_map(function($i) { $i['raw_id'] = (int)$i['id']; $i['id'] = UrlSecurity::encrypt($i['id']); return $i; }, $items);

        $this->json([
            'success'   => true,
            'locations' => $encLocations,
            'vendors'   => $encVendors,
            'items'     => $encItems
        ]);
    }

    public function trackBatchTimeline() {
        $this->requireAuth();
        $pdo = Model::getDB();

        $batchQuery = trim($_GET['batch_code'] ?? $_GET['query'] ?? $_GET['batch_id'] ?? '');

        if (empty($batchQuery)) {
            $this->error('Please provide a valid Batch Code or Batch ID to track.', 400);
            return;
        }

        // 1. Find target batch info
        $stmtBatch = $pdo->prepare("SELECT b.*, i.name AS item_name, i.item_code, i.unit_of_measure, v.name AS vendor_name, v.code AS vendor_code
                                    FROM `item_batches` b
                                    JOIN `items` i ON b.item_id = i.id
                                    LEFT JOIN `vendors` v ON b.vendor_id = v.id
                                    WHERE b.batch_code = ? OR b.id = ?");

        $rawQueryId = UrlSecurity::decrypt($batchQuery);
        $stmtBatch->execute([$batchQuery, is_numeric($batchQuery) ? (int)$batchQuery : (is_numeric($rawQueryId) ? (int)$rawQueryId : -1)]);
        $batch = $stmtBatch->fetch(PDO::FETCH_ASSOC);

        if (!$batch) {
            $this->error("No batch record found matching code or ID '{$batchQuery}'.", 404);
            return;
        }

        $realBatchId = (int)$batch['id'];
        $batch['raw_id'] = $realBatchId;
        $batch['id'] = UrlSecurity::encrypt($realBatchId);
        $batch['vendor_name'] = $batch['vendor_name'] ?? 'N/A';

        // 2. Fetch location stock distribution for this batch
        $stmtStock = $pdo->prepare("SELECT lbs.*, l.name AS location_name, l.code AS location_code, l.type AS location_type
                                    FROM `location_batch_stock` lbs
                                    JOIN `locations` l ON lbs.location_id = l.id
                                    WHERE lbs.batch_id = ?
                                    ORDER BY l.id ASC");
        $stmtStock->execute([$realBatchId]);
        $locationStocks = $stmtStock->fetchAll(PDO::FETCH_ASSOC);

        // 3. Fetch full movement timeline trajectory from ledger in chronological order (ASC)
        $stmtMovements = $pdo->prepare("SELECT sml.*, 
                                               i.name AS item_name, i.item_code,
                                               b.batch_code, b.expiry_date,
                                               fl.name AS from_location_name, fl.code AS from_location_code, fl.type AS from_location_type,
                                               tl.name AS to_location_name, tl.code AS to_location_code, tl.type AS to_location_type,
                                               u.full_name AS created_by_name
                                        FROM `stock_movements_ledger` sml
                                        JOIN `items` i ON sml.item_id = i.id
                                        JOIN `item_batches` b ON sml.batch_id = b.id
                                        LEFT JOIN `locations` fl ON sml.from_location_id = fl.id
                                        LEFT JOIN `locations` tl ON sml.to_location_id = tl.id
                                        JOIN `users` u ON sml.created_by = u.id
                                        WHERE sml.batch_id = ?
                                        ORDER BY sml.id ASC");
        $stmtMovements->execute([$realBatchId]);
        $timeline = $stmtMovements->fetchAll(PDO::FETCH_ASSOC);

        $this->json([
            'success'          => true,
            'batch_info'       => $batch,
            'location_stocks'  => $locationStocks,
            'timeline'         => $timeline
        ]);
    }
}
