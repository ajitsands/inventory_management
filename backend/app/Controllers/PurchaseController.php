<?php
namespace App\Controllers;

use Core\Controller;
use Core\Model;
use App\Models\ItemBatch;
use App\Services\InventoryLedgerService;
use App\Services\AuditLogger;
use App\Services\SequenceService;

class PurchaseController extends Controller {

    public function createPurchaseInvoice() {
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

                // Credit stock to Main Branch
                InventoryLedgerService::creditStock($locationId, $batchId, $qty);

                // Log Item Movement Ledger
                InventoryLedgerService::recordMovement('PURCHASE', $invoiceNo, $itemId, $batchId, null, $locationId, $qty, $purchasePrice, $sellingPrice, $user['user_id']);
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'PURCHASE', 'CREATE_PURCHASE_INVOICE', null, [
                'purchase_invoice_id' => $purchaseInvoiceId,
                'invoice_no'          => $invoiceNo,
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

    public function getPurchaseInvoices() {
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
