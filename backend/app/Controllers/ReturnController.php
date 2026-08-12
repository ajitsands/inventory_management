<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class ReturnController extends Controller
{
    public function createReturn()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        // Handle FormData JSON string payload if submitted with document attachment
        if (isset($_POST['payload'])) {
            $rawPayload = $_POST['payload'];
            if (function_exists('get_magic_quotes_gpc') && get_magic_quotes_gpc()) {
                $rawPayload = stripslashes($rawPayload);
            }
            $parsedPayload = json_decode($rawPayload, true);
            if (is_array($parsedPayload)) {
                $body = array_merge($body, $this->decryptArrayParams($parsedPayload));
            }
        } elseif (isset($_POST['items']) && is_string($_POST['items'])) {
            $rawItems = $_POST['items'];
            if (function_exists('get_magic_quotes_gpc') && get_magic_quotes_gpc()) {
                $rawItems = stripslashes($rawItems);
            }
            $decodedItems = json_decode($rawItems, true);
            if (is_array($decodedItems)) {
                $body['items'] = $this->decryptArrayParams($decodedItems);
            }
            foreach ($_POST as $k => $v) {
                if ($k !== 'items' && $k !== 'payload') {
                    $body[$k] = $v;
                }
            }
        }

        // Process document upload if attached
        $documentUrl = null;
        $fileKey = isset($_FILES['document_file']) ? 'document_file' : (isset($_FILES['file']) ? 'file' : null);

        if ($fileKey && isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES[$fileKey];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

            if (!in_array($ext, $allowedExts)) {
                $this->error('Invalid file format. Allowed formats: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (JPG, PNG, GIF, WEBP).', 400);
                return;
            }

            $uploadDirRoot = __DIR__ . '/../../../uploads/return_documents/';
            $uploadDirBackend = __DIR__ . '/../../uploads/return_documents/';

            if (!is_dir($uploadDirRoot)) @mkdir($uploadDirRoot, 0777, true);
            if (!is_dir($uploadDirBackend)) @mkdir($uploadDirBackend, 0777, true);

            $filename = 'ret_doc_' . time() . '_' . rand(1000, 9999) . '.' . $ext;
            $targetPathBackend = $uploadDirBackend . $filename;
            $targetPathRoot = $uploadDirRoot . $filename;

            if (move_uploaded_file($file['tmp_name'], $targetPathBackend)) {
                @copy($targetPathBackend, $targetPathRoot);
                $documentUrl = '/uploads/return_documents/' . $filename;
            }
        }

        $returnType = trim($body['return_type'] ?? '');
        $allowedTypes = ['CLINIC_TO_BRANCH', 'BRANCH_TO_MAIN', 'MAIN_TO_VENDOR'];

        if (!in_array($returnType, $allowedTypes)) {
            $this->error('Please select a valid return workflow type.', 400);
            return;
        }

        $fromLoc = (int)($body['raw_from_location_id'] ?? UrlSecurity::decrypt($body['from_location_id'] ?? null) ?? $body['from_location_id'] ?? 0);
        $toLoc = (int)($body['raw_to_location_id'] ?? UrlSecurity::decrypt($body['to_location_id'] ?? null) ?? $body['to_location_id'] ?? 0);
        $vendorId = (int)($body['raw_vendor_id'] ?? UrlSecurity::decrypt($body['vendor_id'] ?? null) ?? $body['vendor_id'] ?? 0);

        if (!$fromLoc) {
            $this->error('Please select a valid source location for the stock return.', 400);
            return;
        }

        if ($returnType === 'MAIN_TO_VENDOR') {
            if ($user['role'] !== 'ADMIN') {
                $this->error('Main Store to Vendor Supplier returns can only be processed by System Administrator.', 403);
                return;
            }
            if (!$vendorId) {
                $this->error('Please select a destination vendor supplier for Main Store return.', 400);
                return;
            }
        }

        if ($returnType !== 'MAIN_TO_VENDOR' && !$toLoc) {
            $this->error('Please select a valid destination location for the return.', 400);
            return;
        }

        if (empty($body['items']) || !is_array($body['items'])) {
            $this->error('Please add at least 1 line item to dispatch the return.', 400);
            return;
        }

        $returnReason = $body['return_reason'] ?? 'EXCESS_STOCK';
        $allowedReasons = ['EXPIRED', 'DAMAGED', 'EXCESS_STOCK', 'WRONG_ITEM', 'OTHER'];
        if (!in_array($returnReason, $allowedReasons)) {
            $returnReason = 'EXCESS_STOCK';
        }

        $settings = SequenceService::getSettings();
        $isNoVat = ($settings['vat_calculation_mode'] ?? '') === 'NO_VAT' || (float)($settings['vat_percent'] ?? 0) === 0.0;
        $vatPercent = $isNoVat ? 0.00 : (float)($body['vat_percent'] ?? $settings['vat_percent'] ?? 10.00);

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            // Check cumulative requested quantity per batch against source location stock
            $batchTotals = [];
            $batchDuplicateCounts = [];

            foreach ($body['items'] as $line) {
                $bId = (int)($line['raw_batch_id'] ?? UrlSecurity::decrypt($line['batch_id'] ?? null) ?? $line['batch_id'] ?? 0);
                $q = (int)($line['qty'] ?? 0);
                if ($bId > 0 && $q > 0) {
                    $batchTotals[$bId] = ($batchTotals[$bId] ?? 0) + $q;
                    $batchDuplicateCounts[$bId] = ($batchDuplicateCounts[$bId] ?? 0) + 1;
                }
            }

            foreach ($batchTotals as $bId => $totalReqQty) {
                $stmtCheck = $pdo->prepare("SELECT ib.batch_code, COALESCE(lbs.quantity_available, 0) as avail 
                                           FROM `item_batches` ib 
                                           LEFT JOIN `location_batch_stock` lbs ON lbs.batch_id = ib.id AND lbs.location_id = ? 
                                           WHERE ib.id = ?");
                $stmtCheck->execute([$fromLoc, $bId]);
                $batchStock = $stmtCheck->fetch(PDO::FETCH_ASSOC);
                $batchCode = $batchStock['batch_code'] ?? "Batch #{$bId}";
                $availQty = (int)($batchStock['avail'] ?? 0);

                if (($batchDuplicateCounts[$bId] ?? 0) > 1) {
                    Model::rollBack();
                    $this->error("Duplicate batch entry blocked: Batch '{$batchCode}' is selected on multiple lines! Cumulative requested ({$totalReqQty}) exceeds available stock ({$availQty}). Please combine into a single line.", 400);
                    return;
                }

                if ($totalReqQty > $availQty) {
                    Model::rollBack();
                    $this->error("Stock return blocked: Cumulative requested quantity ({$totalReqQty}) for batch '{$batchCode}' exceeds available stock ({$availQty}) at source location.", 400);
                    return;
                }
            }

            $returnNo = SequenceService::generateNextNumber('stock_return');
            $grossSubtotal = 0.00;
            $vatAmount = 0.00;
            $grandTotal = 0.00;
            $validatedItems = [];

            foreach ($body['items'] as $idx => $line) {
                $itemId = (int)($line['raw_item_id'] ?? UrlSecurity::decrypt($line['item_id'] ?? null) ?? $line['item_id'] ?? 0);
                $batchId = (int)($line['raw_batch_id'] ?? UrlSecurity::decrypt($line['batch_id'] ?? null) ?? $line['batch_id'] ?? 0);
                $qty = (int)($line['qty'] ?? 0);
                $unitPrice = (float)($line['unit_price'] ?? 0);

                if (!$itemId || !$batchId || $qty <= 0) {
                    Model::rollBack();
                    $this->error("Line #" . ($idx + 1) . " requires a valid batch selection and quantity > 0.", 400);
                    return;
                }

                $lineSubtotal = round($unitPrice * $qty, 3);
                $grossSubtotal += $lineSubtotal;

                $validatedItems[] = [
                    'item_id'    => $itemId,
                    'batch_id'   => $batchId,
                    'qty'        => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal'   => $lineSubtotal
                ];
            }

            $grossSubtotal = round($grossSubtotal, 3);
            $vatAmount = $isNoVat ? 0.00 : round($grossSubtotal * ($vatPercent / 100), 3);
            $grandTotal = round($grossSubtotal + $vatAmount, 3);

            $stmtHeader = $pdo->prepare("INSERT INTO `stock_returns` 
                (`return_no`, `return_type`, `from_location_id`, `to_location_id`, `vendor_id`, `return_reason`, `remarks`, `subtotal`, `vat_amount`, `total_val`, `document_url`, `created_by`, `created_at`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");

            $stmtHeader->execute([
                $returnNo,
                $returnType,
                $fromLoc,
                $returnType === 'MAIN_TO_VENDOR' ? null : $toLoc,
                $returnType === 'MAIN_TO_VENDOR' ? $vendorId : null,
                $returnReason,
                $body['remarks'] ?? null,
                $grossSubtotal,
                $vatAmount,
                $grandTotal,
                $documentUrl,
                $user['user_id']
            ]);

            $returnId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO `stock_return_items` 
                (`return_id`, `item_id`, `batch_id`, `qty`, `unit_price`, `subtotal`)
                VALUES (?, ?, ?, ?, ?, ?)");

            foreach ($validatedItems as $line) {
                $stmtItem->execute([
                    $returnId,
                    $line['item_id'],
                    $line['batch_id'],
                    $line['qty'],
                    $line['unit_price'],
                    $line['subtotal']
                ]);

                // Stock deductions & transfers
                // 1. Always Debit stock from Source Location
                InventoryLedgerService::debitStock($fromLoc, $line['batch_id'], $line['qty']);

                // 2. If Destination Location exists (CLINIC_TO_BRANCH or BRANCH_TO_MAIN), credit stock to Destination
                if ($returnType !== 'MAIN_TO_VENDOR' && $toLoc) {
                    InventoryLedgerService::creditStock($toLoc, $line['batch_id'], $line['qty']);
                }

                // 3. Record Audit Trajectory in Stock Movements Ledger
                InventoryLedgerService::recordMovement('STOCK_RETURN', $returnNo, $line['item_id'], $line['batch_id'], $fromLoc, ($returnType === 'MAIN_TO_VENDOR' ? null : $toLoc), $line['qty'], $line['unit_price'], $line['unit_price'], $user['user_id']);
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'STOCK_RETURN', 'POST_STOCK_RETURN', null, [
                'return_id'    => $returnId,
                'return_no'    => $returnNo,
                'return_type'  => $returnType,
                'from_loc'     => $fromLoc,
                'to_loc'       => $toLoc,
                'vendor_id'    => $vendorId,
                'total_val'    => $grandTotal
            ], $fromLoc);

            $this->json([
                'success'   => true,
                'message'   => "Stock Return {$returnNo} posted successfully.",
                'return_no' => $returnNo,
                'return_id' => $returnId,
                'total_val' => $grandTotal
            ]);

        } catch (Exception $e) {
            Model::rollBack();
            $this->error('Failed to post stock return: ' . $e->getMessage(), 500);
        }
    }

    public function getReturns()
    {
        $this->requireAuth();
        $pdo = Model::getDB();

        $sql = "SELECT sr.*, 
                       fl.name AS from_location_name, fl.code AS from_location_code,
                       tl.name AS to_location_name, tl.code AS to_location_code,
                       v.name AS vendor_name, v.code AS vendor_code,
                       u.full_name AS created_by_name
                FROM `stock_returns` sr
                LEFT JOIN `locations` fl ON sr.from_location_id = fl.id
                LEFT JOIN `locations` tl ON sr.to_location_id = tl.id
                LEFT JOIN `vendors` v ON sr.vendor_id = v.id
                JOIN `users` u ON sr.created_by = u.id
                ORDER BY sr.id DESC";

        $returns = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT sri.*, i.name AS item_name, i.item_code, i.unit_of_measure, ib.batch_code, ib.expiry_date
                                    FROM `stock_return_items` sri
                                    JOIN `items` i ON sri.item_id = i.id
                                    JOIN `item_batches` ib ON sri.batch_id = ib.id
                                    WHERE sri.return_id = ?");

        foreach ($returns as &$ret) {
            $rawId = (int)$ret['id'];
            $ret['raw_id'] = $rawId;
            $ret['id'] = UrlSecurity::encrypt($ret['id']);

            $stmtItems->execute([$rawId]);
            $itemsList = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
            foreach ($itemsList as &$it) {
                $it['raw_item_id'] = (int)$it['item_id'];
                $it['item_id'] = UrlSecurity::encrypt($it['item_id']);
                $it['raw_batch_id'] = (int)$it['batch_id'];
                $it['batch_id'] = UrlSecurity::encrypt($it['batch_id']);
            }
            $ret['items'] = $itemsList;
        }

        $this->json([
            'success' => true,
            'returns' => $returns
        ]);
    }
}
