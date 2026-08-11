<?php
require_once __DIR__ . '/../../core/Controller.php';
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
        $this->json([
            'success' => true,
            'batches' => $batches
        ]);
    }

    public function getMasterData() {
        $this->requireAuth();
        $locations = Location::getAll();
        $vendors = Vendor::getAll();
        $items = Item::getAll();

        $this->json([
            'success'   => true,
            'locations' => $locations,
            'vendors'   => $vendors,
            'items'     => $items
        ]);
    }
}
