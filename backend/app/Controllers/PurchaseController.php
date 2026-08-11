<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../Models/ItemBatch.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class PurchaseController extends Controller
{
    public function createPurchaseInvoice()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        if (empty($body['vendor_id']) || empty($body['po_no']) || empty($body['po_date']) || empty($body['vendor_invoice_no']) || empty($body['items']) || !is_array($body['items'])) {
            $this->error('Missing required purchase invoice parameters or items array.', 400);
        }

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $invoiceNo = SequenceService::generateNextNumber('purchase_invoice');
            $locationId = $body['location_id'] ?? 1; // Default to Central Main Store
            $quotationId = !empty($body['quotation_id']) ? (int)$body['quotation_id'] : null;

            // Calculate total amount
            $totalAmount = 0.00;
            foreach ($body['items'] as $item) {
                $subtotal = (float)$item['purchase_price'] * (int)$item['qty'];
                $totalAmount += $subtotal;
            }

            // Insert Purchase Invoice Header
            $stmtHeader = $pdo->prepare("INSERT INTO `purchase_invoices` 
                (`invoice_no`, `po_no`, `po_date`, `vendor_invoice_no`, `vendor_invoice_date`, `vendor_id`, `location_id`, `total_amount`, `remarks`, `created_by`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
            $stmtHeader->execute([
                $invoiceNo,
                $body['po_no'],
                $body['po_date'],
                $body['vendor_invoice_no'],
                $body['vendor_invoice_date'] ?? date('Y-m-d'),
                $body['vendor_id'],
                $locationId,
                $totalAmount,
                $body['remarks'] ?? null,
                $user['user_id']
            ]);

            $purchaseInvoiceId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO `purchase_invoice_items` 
                (`purchase_invoice_id`, `item_id`, `batch_id`, `qty`, `purchase_price`, `selling_price`, `mrp`, `expiry_date`, `subtotal`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $today = date('Y-m-d');

            // Statement for updating quotation received qty if linked
            $stmtUpdateQuotationItem = $pdo->prepare("UPDATE `vendor_quotation_items` SET `received_qty` = `received_qty` + ? WHERE `quotation_id` = ? AND `item_id` = ?");

            foreach ($body['items'] as $line) {
                $itemId = (int)$line['item_id'];
                $qty = (int)$line['qty'];
                $purchasePrice = (float)$line['purchase_price'];
                $sellingPrice = (float)$line['selling_price'];
                $mrp = (float)($line['mrp'] ?? $sellingPrice);
                $expiryDate = $line['expiry_date'];
                $batchCode = trim($line['batch_code'] ?? '') ?: ('BTC-' . date('Ymd') . '-' . rand(1000, 9999));
                $subtotal = $purchasePrice * $qty;

                // Create Item Batch record
                $batchId = ItemBatch::createBatch([
                    'item_id'        => $itemId,
                    'batch_code'     => $batchCode,
                    'vendor_id'      => $body['vendor_id'],
                    'purchase_price' => $purchasePrice,
                    'selling_price'  => $sellingPrice,
                    'mrp'            => $mrp,
                    'expiry_date'    => $expiryDate,
                    'purchase_date'  => $today,
                    'qty'            => $qty
                ]);

                // Insert Invoice Item Line
                $stmtItem->execute([
                    $purchaseInvoiceId,
                    $itemId,
                    $batchId,
                    $qty,
                    $purchasePrice,
                    $sellingPrice,
                    $mrp,
                    $expiryDate,
                    $subtotal
                ]);

                // Update linked Quotation received qty if applicable
                if ($quotationId) {
                    $stmtUpdateQuotationItem->execute([$qty, $quotationId, $itemId]);
                }

                // Credit stock to Main Branch
                InventoryLedgerService::creditStock($locationId, $batchId, $qty);

                // Log Item Movement Ledger
                InventoryLedgerService::recordMovement('PURCHASE', $invoiceNo, $itemId, $batchId, null, $locationId, $qty, $purchasePrice, $sellingPrice, $user['user_id']);
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
                'items_count'         => count($body['items'])
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
        $this->json([
            'success'  => true,
            'invoices' => $invoices
        ]);
    }
}
