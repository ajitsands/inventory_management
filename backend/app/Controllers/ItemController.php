<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Models/Item.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class ItemController extends Controller
{
    public function index()
    {
        $items = Item::getAll();
        $encrypted = array_map(function($i) {
            $i['raw_id'] = (int)$i['id'];
            $i['id'] = UrlSecurity::encrypt($i['id']);
            return $i;
        }, $items);

        $this->json(['success' => true, 'items' => $encrypted]);
    }

    public function store()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $data = $this->getRequestBody();

        $name = trim($data['name'] ?? '');
        $code = trim($data['item_code'] ?? '');
        $categoryId = (int)($data['category_id'] ?? 1);
        $uom = trim($data['unit_of_measure'] ?? 'Unit');
        $minReorder = (int)($data['min_reorder_level'] ?? 10);

        if (empty($name)) {
            $this->json(['error' => 'Item name is required.'], 400);
            return;
        }

        if (empty($code)) {
            $code = SequenceService::generateNextNumber('item');
        } else {
            $existing = Item::findWhere(['item_code' => $code]);
            if ($existing) {
                $code = SequenceService::generateNextNumber('item');
            }
        }

        $id = Item::create([
            'name' => $name,
            'item_code' => $code,
            'category_id' => $categoryId,
            'unit_of_measure' => $uom,
            'min_reorder_level' => $minReorder
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_ITEM', 'CREATE_ITEM', null, [
            'item_id' => $id, 'name' => $name, 'item_code' => $code, 'min_reorder_level' => $minReorder
        ]);

        $this->json([
            'success' => true,
            'message' => "Item '{$name}' created successfully with code {$code}.",
            'item_id' => UrlSecurity::encrypt($id),
            'item_code' => $code
        ]);
    }

    public function importExcel()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $data = $this->getRequestBody();

        $itemsList = $data['items'] ?? [];
        if (empty($itemsList) || !is_array($itemsList)) {
            $this->json(['error' => 'Items array payload is required for Excel import.'], 400);
            return;
        }

        $importedCount = 0;
        $skippedCount = 0;

        foreach ($itemsList as $row) {
            $name = trim($row['name'] ?? '');
            if (empty($name)) {
                $skippedCount++;
                continue;
            }

            $code = trim($row['item_code'] ?? '');
            if (empty($code)) {
                $code = SequenceService::generateNextNumber('item');
            } else {
                $existing = Item::findWhere(['item_code' => $code]);
                if ($existing) {
                    $code = SequenceService::generateNextNumber('item');
                }
            }

            $uom = trim($row['unit_of_measure'] ?? 'Unit');
            $minReorder = (int)($row['min_reorder_level'] ?? 10);
            $categoryId = 1; // Default general category

            Item::create([
                'name' => $name,
                'item_code' => $code,
                'category_id' => $categoryId,
                'unit_of_measure' => $uom,
                'min_reorder_level' => $minReorder
            ]);

            $importedCount++;
        }

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_ITEM', 'IMPORT_ITEMS_EXCEL', null, [
            'imported_count' => $importedCount,
            'skipped_count' => $skippedCount
        ]);

        $this->json([
            'success' => true,
            'message' => "Successfully imported {$importedCount} items from Excel file! ({$skippedCount} skipped)",
            'imported_count' => $importedCount
        ]);
    }

    public function update()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $data = $this->getRequestBody();

        $id = UrlSecurity::decrypt($data['id'] ?? null);
        if (!$id) {
            $this->json(['error' => 'Item ID is required.'], 400);
            return;
        }

        $item = Item::find($id);
        if (!$item) {
            $this->json(['error' => 'Item not found.'], 404);
            return;
        }

        $name = trim($data['name'] ?? $item['name']);
        $uom = trim($data['unit_of_measure'] ?? $item['unit_of_measure']);
        $minReorder = (int)($data['min_reorder_level'] ?? $item['min_reorder_level']);

        Item::update($id, [
            'name' => $name,
            'unit_of_measure' => $uom,
            'min_reorder_level' => $minReorder
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_ITEM', 'UPDATE_ITEM', $item, [
            'id' => $id, 'name' => $name
        ]);

        $this->json(['success' => true, 'message' => "Item updated successfully."]);
    }
}
