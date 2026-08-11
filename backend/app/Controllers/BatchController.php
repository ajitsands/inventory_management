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
        $locationId = $_GET['location_id'] ?? 1;
        if (strpos($locationId, 'enc_') === 0) {
            $locationId = UrlSecurity::decrypt($locationId);
        }

        $batches = ItemBatch::getBatchesByLocation((int)$locationId);
        $encrypted = array_map(function($b) {
            $b['raw_id'] = (int)$b['id'];
            $b['id'] = UrlSecurity::encrypt($b['id']);
            $b['batch_id'] = UrlSecurity::encrypt($b['batch_id'] ?? $b['raw_id']);
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
