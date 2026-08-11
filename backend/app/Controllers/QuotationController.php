<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class QuotationController extends Controller
{
    public function index()
    {
        $this->requireAuth();
        $pdo = Model::getDB();

        $sql = "SELECT q.*, v.name AS vendor_name, v.code AS vendor_code, u.full_name AS created_by_name
                FROM `vendor_quotations` q
                JOIN `vendors` v ON q.vendor_id = v.id
                JOIN `users` u ON q.created_by = u.id
                ORDER BY q.id DESC";

        $quotations = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        // Attach line items to each quotation
        $stmtItems = $pdo->prepare("SELECT qi.*, i.name AS item_name, i.item_code, i.unit_of_measure
                                    FROM `vendor_quotation_items` qi
                                    JOIN `items` i ON qi.item_id = i.id
                                    WHERE qi.quotation_id = ?");

        foreach ($quotations as &$q) {
            $rawId = (int)$q['id'];
            $q['raw_id'] = $rawId;
            $q['id'] = UrlSecurity::encrypt($q['id']);
            $q['vendor_id'] = UrlSecurity::encrypt($q['vendor_id']);
            $stmtItems->execute([$rawId]);
            $itemsList = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
            foreach ($itemsList as &$it) {
                $it['raw_item_id'] = (int)$it['item_id'];
                $it['item_id'] = UrlSecurity::encrypt($it['item_id']);
            }
            $q['items'] = $itemsList;
        }

        $this->json(['success' => true, 'quotations' => $quotations]);
    }

    public function getOpenByVendor()
    {
        $this->requireAuth();
        $rawVendorId = UrlSecurity::decrypt($_GET['vendor_id'] ?? null);
        $vendorId = !empty($rawVendorId) ? (int)$rawVendorId : (int)($_GET['vendor_id'] ?? 0);

        if (!$vendorId) {
            $this->json(['success' => true, 'quotations' => []]);
            return;
        }

        $pdo = Model::getDB();
        $sql = "SELECT q.*, v.name AS vendor_name
                FROM `vendor_quotations` q
                JOIN `vendors` v ON q.vendor_id = v.id
                WHERE q.vendor_id = ? AND q.status IN ('OPEN', 'PARTIALLY_RECEIVED')
                ORDER BY q.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$vendorId]);
        $quotations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT qi.*, i.name AS item_name, i.item_code, i.unit_of_measure
                                    FROM `vendor_quotation_items` qi
                                    JOIN `items` i ON qi.item_id = i.id
                                    WHERE qi.quotation_id = ? AND qi.ordered_qty > qi.received_qty");

        foreach ($quotations as &$q) {
            $rawId = (int)$q['id'];
            $q['raw_id'] = $rawId;
            $q['id'] = UrlSecurity::encrypt($q['id']);
            $stmtItems->execute([$rawId]);
            $itemsList = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
            foreach ($itemsList as &$it) {
                $it['raw_item_id'] = (int)$it['item_id'];
                $it['item_id'] = UrlSecurity::encrypt($it['item_id']);
            }
            $q['items'] = $itemsList;
        }

        $this->json(['success' => true, 'quotations' => $quotations]);
    }

    public function store()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $data = $this->getRequestBody();

        $rawVendorId = UrlSecurity::decrypt($data['vendor_id'] ?? null);
        $vendorId = !empty($rawVendorId) ? (int)$rawVendorId : (int)($data['raw_vendor_id'] ?? $data['vendor_id'] ?? 0);

        $items = $data['items'] ?? [];

        if (!$vendorId || empty($items) || !is_array($items)) {
            $this->error('Please select a valid Vendor and add at least 1 item line.', 400);
            return;
        }

        // Validate items before starting transaction
        $validatedLines = [];
        foreach ($items as $idx => $line) {
            $rawItemId = UrlSecurity::decrypt($line['item_id'] ?? null);
            $itemId = !empty($rawItemId) ? (int)$rawItemId : (int)($line['raw_item_id'] ?? $line['item_id'] ?? 0);
            $qty = (int)($line['ordered_qty'] ?? 0);
            $price = (float)($line['unit_price'] ?? 0);

            if (!$itemId || $qty <= 0) {
                $this->error("Line #" . ($idx + 1) . " requires a valid item selection and quantity greater than 0.", 400);
                return;
            }

            $validatedLines[] = [
                'item_id' => $itemId,
                'ordered_qty' => $qty,
                'unit_price' => $price,
                'subtotal' => $price * $qty
            ];
        }

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $quotationNo = SequenceService::generateNextNumber('quotation');
            $quotationDate = $data['quotation_date'] ?? date('Y-m-d');
            $expectedDate = !empty($data['expected_delivery_date']) ? $data['expected_delivery_date'] : null;

            $totalAmount = 0.00;
            foreach ($validatedLines as $line) {
                $totalAmount += $line['subtotal'];
            }

            $stmtHeader = $pdo->prepare("INSERT INTO `vendor_quotations`
                (`quotation_no`, `vendor_id`, `location_id`, `quotation_date`, `expected_delivery_date`, `total_amount`, `status`, `created_by`)
                VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)");

            $stmtHeader->execute([
                $quotationNo,
                $vendorId,
                $data['location_id'] ?? 1,
                $quotationDate,
                $expectedDate,
                $totalAmount,
                $user['user_id']
            ]);

            $quotationId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO `vendor_quotation_items`
                (`quotation_id`, `item_id`, `ordered_qty`, `received_qty`, `unit_price`, `subtotal`)
                VALUES (?, ?, ?, 0, ?, ?)");

            foreach ($validatedLines as $line) {
                $stmtItem->execute([
                    $quotationId,
                    $line['item_id'],
                    $line['ordered_qty'],
                    $line['unit_price'],
                    $line['subtotal']
                ]);
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'PURCHASE', 'CREATE_VENDOR_QUOTATION', null, [
                'quotation_id' => $quotationId,
                'quotation_no' => $quotationNo,
                'vendor_id'    => $vendorId,
                'total_amount' => $totalAmount
            ]);

            $this->json([
                'success' => true,
                'message' => "Vendor Quotation / PO {$quotationNo} generated successfully!",
                'quotation_no' => $quotationNo,
                'quotation_id' => UrlSecurity::encrypt($quotationId)
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('Failed to create quotation: ' . $e->getMessage(), 500);
        }
    }

    public function forceClose()
    {
        $user = $this->requireRoles(['ADMIN']);
        $data = $this->getRequestBody();

        $rawQuotationId = UrlSecurity::decrypt($data['quotation_id'] ?? null);
        $quotationId = !empty($rawQuotationId) ? (int)$rawQuotationId : (int)($data['quotation_id'] ?? 0);
        $reason = trim($data['reason'] ?? 'Manually closed by Admin');

        if (!$quotationId) {
            $this->error('Quotation ID is required.', 400);
            return;
        }

        $pdo = Model::getDB();
        $stmt = $pdo->prepare("UPDATE `vendor_quotations` SET `status` = 'CLOSED', `closure_reason` = ? WHERE `id` = ?");
        $stmt->execute([$reason, $quotationId]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'PURCHASE', 'FORCE_CLOSE_QUOTATION', null, [
            'quotation_id' => $quotationId,
            'reason'       => $reason
        ]);

        $this->json([
            'success' => true,
            'message' => "Quotation / PO has been manually closed and archived to Closed POs."
        ]);
    }
}
