<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Models/ItemBatch.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class PurchaseController extends Controller
{
    public function createPurchaseInvoice()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        // Handle multipart FormData submission payload if sent as JSON string in $_POST['payload'] or $_POST['data']
        if (isset($_POST['payload'])) {
            $parsedPayload = json_decode($_POST['payload'], true);
            if (is_array($parsedPayload)) {
                $body = array_merge($body, $parsedPayload);
            }
        } elseif (isset($_POST['items']) && is_string($_POST['items'])) {
            $body['items'] = json_decode($_POST['items'], true);
            if (isset($_POST['po_no'])) $body['po_no'] = $_POST['po_no'];
            if (isset($_POST['po_date'])) $body['po_date'] = $_POST['po_date'];
            if (isset($_POST['vendor_invoice_no'])) $body['vendor_invoice_no'] = $_POST['vendor_invoice_no'];
            if (isset($_POST['vendor_invoice_date'])) $body['vendor_invoice_date'] = $_POST['vendor_invoice_date'];
            if (isset($_POST['vendor_id'])) $body['vendor_id'] = $_POST['vendor_id'];
            if (isset($_POST['remarks'])) $body['remarks'] = $_POST['remarks'];
        }

        // Process uploaded document file if attached
        $documentUrl = null;
        $fileKey = isset($_FILES['document_file']) ? 'document_file' : (isset($_FILES['file']) ? 'file' : null);

        if ($fileKey && isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES[$fileKey];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

            if (!in_array($ext, $allowedExts)) {
                $this->error('Invalid document file format. Allowed formats: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (JPG, PNG, GIF, WEBP).', 400);
                return;
            }

            $uploadDir = __DIR__ . '/../../uploads/purchase_documents/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $filename = 'po_doc_' . time() . '_' . rand(1000, 9999) . '.' . $ext;
            $targetPath = $uploadDir . $filename;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $documentUrl = '/uploads/purchase_documents/' . $filename;
            }
        }

        $rawVendorId = UrlSecurity::decrypt($body['vendor_id'] ?? null);
        $vendorId = !empty($rawVendorId) ? (int)$rawVendorId : (int)($body['raw_vendor_id'] ?? $body['vendor_id'] ?? 0);

        if (!$vendorId || empty($body['po_no']) || empty($body['po_date']) || empty($body['vendor_invoice_no']) || empty($body['items']) || !is_array($body['items'])) {
            $this->error('Please select a valid vendor, enter invoice details, and add at least 1 item line.', 400);
            return;
        }

        $rawQuotationId = UrlSecurity::decrypt($body['quotation_id'] ?? null);
        $quotationId = !empty($rawQuotationId) ? (int)$rawQuotationId : (int)($body['raw_quotation_id'] ?? $body['quotation_id'] ?? 0);
        if (!$quotationId) $quotationId = null;

        $rawLocationId = UrlSecurity::decrypt($body['location_id'] ?? null);
        $locationId = !empty($rawLocationId) ? (int)$rawLocationId : (int)($body['raw_location_id'] ?? $body['location_id'] ?? 1);

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $invoiceNo = SequenceService::generateNextNumber('purchase_invoice');

            // Calculate total amount & validate items
            $totalAmount = 0.00;
            $validatedItems = [];

            foreach ($body['items'] as $idx => $item) {
                $rawItemId = UrlSecurity::decrypt($item['item_id'] ?? null);
                $itemId = !empty($rawItemId) ? (int)$rawItemId : (int)($item['raw_item_id'] ?? $item['item_id'] ?? 0);
                $qty = (int)($item['qty'] ?? 0);
                $purchasePrice = (float)($item['purchase_price'] ?? 0);
                $sellingPrice = (float)($item['selling_price'] ?? 0);
                $mrp = (float)($item['mrp'] ?? $sellingPrice);
                $expiryDate = $item['expiry_date'] ?? date('Y-m-d', strtotime('+1 year'));
                $batchCode = trim($item['batch_code'] ?? '') ?: ('BTC-' . date('Ymd') . '-' . rand(1000, 9999));

                if (!$itemId || $qty <= 0) {
                    Model::rollBack();
                    $this->error("Line #" . ($idx + 1) . " requires a valid item selection and quantity greater than 0.", 400);
                    return;
                }

                $subtotal = $purchasePrice * $qty;
                $totalAmount += $subtotal;

                $validatedItems[] = [
                    'item_id'        => $itemId,
                    'batch_code'     => $batchCode,
                    'qty'            => $qty,
                    'purchase_price' => $purchasePrice,
                    'selling_price'  => $sellingPrice,
                    'mrp'            => $mrp,
                    'expiry_date'    => $expiryDate,
                    'subtotal'       => $subtotal
                ];
            }

            // Insert Purchase Invoice Header with document_url
            $stmtHeader = $pdo->prepare("INSERT INTO `purchase_invoices` 
                (`invoice_no`, `po_no`, `po_date`, `vendor_invoice_no`, `vendor_invoice_date`, `vendor_id`, `location_id`, `total_amount`, `remarks`, `document_url`, `created_by`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
            $stmtHeader->execute([
                $invoiceNo,
                $body['po_no'],
                $body['po_date'],
                $body['vendor_invoice_no'],
                $body['vendor_invoice_date'] ?? date('Y-m-d'),
                $vendorId,
                $locationId,
                $totalAmount,
                $body['remarks'] ?? null,
                $documentUrl,
                $user['user_id']
            ]);

            $purchaseInvoiceId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO `purchase_invoice_items` 
                (`purchase_invoice_id`, `item_id`, `batch_id`, `qty`, `purchase_price`, `selling_price`, `mrp`, `expiry_date`, `subtotal`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $today = date('Y-m-d');

            // Statement for updating quotation received qty if linked
            $stmtUpdateQuotationItem = $pdo->prepare("UPDATE `vendor_quotation_items` SET `received_qty` = `received_qty` + ? WHERE `quotation_id` = ? AND `item_id` = ?");

            foreach ($validatedItems as $line) {
                // Create Item Batch record
                $batchId = ItemBatch::createBatch([
                    'item_id'        => $line['item_id'],
                    'batch_code'     => $line['batch_code'],
                    'vendor_id'      => $vendorId,
                    'purchase_price' => $line['purchase_price'],
                    'selling_price'  => $line['selling_price'],
                    'mrp'            => $line['mrp'],
                    'expiry_date'    => $line['expiry_date'],
                    'purchase_date'  => $today,
                    'qty'            => $line['qty']
                ]);

                // Insert Invoice Item Line
                $stmtItem->execute([
                    $purchaseInvoiceId,
                    $line['item_id'],
                    $batchId,
                    $line['qty'],
                    $line['purchase_price'],
                    $line['selling_price'],
                    $line['mrp'],
                    $line['expiry_date'],
                    $line['subtotal']
                ]);

                // Update linked Quotation received qty if applicable
                if ($quotationId) {
                    $stmtUpdateQuotationItem->execute([$line['qty'], $quotationId, $line['item_id']]);
                }

                // Credit stock to Main Branch
                InventoryLedgerService::creditStock($locationId, $batchId, $line['qty']);

                // Log Item Movement Ledger
                InventoryLedgerService::recordMovement('PURCHASE', $invoiceNo, $line['item_id'], $batchId, null, $locationId, $line['qty'], $line['purchase_price'], $line['selling_price'], $user['user_id']);
            }

            // Check if linked Quotation should be marked PARTIALLY_RECEIVED or CLOSED
            if ($quotationId) {
                $stmtCheck = $pdo->prepare("SELECT COUNT(*) AS total_items, 
                                                   SUM(CASE WHEN received_qty >= ordered_qty THEN 1 ELSE 0 END) AS completed_items,
                                                   SUM(received_qty) AS total_received
                                            FROM `vendor_quotation_items` WHERE `quotation_id` = ?");
                $stmtCheck->execute([$quotationId]);
                $checkRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);

                if ($checkRow['completed_items'] >= $checkRow['total_items']) {
                    $pdo->prepare("UPDATE `vendor_quotations` SET `status` = 'CLOSED', `closure_reason` = 'All items completely received' WHERE `id` = ?")->execute([$quotationId]);
                } elseif ($checkRow['total_received'] > 0) {
                    $pdo->prepare("UPDATE `vendor_quotations` SET `status` = 'PARTIALLY_RECEIVED' WHERE `id` = ?")->execute([$quotationId]);
                }
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'PURCHASE', 'CREATE_PURCHASE_INVOICE', null, [
                'purchase_invoice_id' => $purchaseInvoiceId,
                'invoice_no'          => $invoiceNo,
                'quotation_id'        => $quotationId,
                'total_amount'        => $totalAmount,
                'items_count'         => count($validatedItems)
            ], $locationId);

            $this->json([
                'success'             => true,
                'message'             => 'Purchase invoice posted successfully.',
                'invoice_no'          => $invoiceNo,
                'purchase_invoice_id' => $purchaseInvoiceId,
                'total_amount'        => $totalAmount
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('Failed to post purchase invoice: ' . $e->getMessage(), 500);
        }
    }

    public function getPurchaseInvoices()
    {
        $this->requireAuth();
        $pdo = Model::getDB();
        $sql = "SELECT pi.*, v.name AS vendor_name, l.name AS location_name, u.full_name AS created_by_name
                FROM `purchase_invoices` pi
                JOIN `vendors` v ON pi.vendor_id = v.id
                JOIN `locations` l ON pi.location_id = l.id
                JOIN `users` u ON pi.created_by = u.id
                ORDER BY pi.id DESC";
        $invoices = $pdo->query($sql)->fetchAll(\PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT pii.*, i.name AS item_name, i.item_code, i.unit_of_measure, ib.batch_code
                                    FROM `purchase_invoice_items` pii
                                    JOIN `items` i ON pii.item_id = i.id
                                    JOIN `item_batches` ib ON pii.batch_id = ib.id
                                    WHERE pii.purchase_invoice_id = ?");

        foreach ($invoices as &$inv) {
            $rawId = (int)$inv['id'];
            $inv['raw_id'] = $rawId;
            $inv['id'] = UrlSecurity::encrypt($inv['id']);
            $stmtItems->execute([$rawId]);
            $itemsList = $stmtItems->fetchAll(\PDO::FETCH_ASSOC);
            foreach ($itemsList as &$it) {
                $it['raw_item_id'] = (int)$it['item_id'];
                $it['item_id'] = UrlSecurity::encrypt($it['item_id']);
            }
            $inv['items'] = $itemsList;
        }

        $this->json([
            'success'  => true,
            'invoices' => $invoices
        ]);
    }
}
