<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Models/ItemBatch.php';
require_once __DIR__ . '/../Models/Location.php';
require_once __DIR__ . '/../Models/Vendor.php';
require_once __DIR__ . '/../Models/Item.php';

class BatchController extends Controller {

    public function getStockByLocation() {
        $this->requireAuth();
        $locationId = $_GET['location_id'] ?? $_GET['raw_location_id'] ?? 1;
        
        if (is_string($locationId) && (strpos($locationId, 'enc_') === 0 || strpos($locationId, 'enc ') === 0)) {
            $formattedToken = str_replace(' ', '+', $locationId);
            $decrypted = UrlSecurity::decrypt($formattedToken);
            if ($decrypted !== null && $decrypted !== false && $decrypted !== '') {
                $locationId = $decrypted;
            }
        }

        $targetLocId = (int)$locationId;
        if ($targetLocId <= 0) $targetLocId = 1;

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
}
