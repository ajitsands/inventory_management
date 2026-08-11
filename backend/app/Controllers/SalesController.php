<?php
namespace App\Controllers;

use Core\Controller;
use Core\Model;
use App\Services\FifoAllocationEngine;
use App\Services\InventoryLedgerService;
use App\Services\AuditLogger;
use App\Services\SequenceService;

class SalesController extends Controller {

    public function createSalesInvoice() {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER', 'OPD_USER']);
        $body = $this->getRequestBody();

        if (empty($body['clinic_location_id']) || empty($body['items']) || !is_array($body['items'])) {
            $this->error('Missing required parameters for OPD dispensing invoice.', 400);
        }

        $clinicLocId = (int)$body['clinic_location_id'];
        $customerName = trim($body['customer_name'] ?? 'Walk-in Customer');
        $customerPhone = trim($body['customer_phone'] ?? '');
        $discount = (float)($body['discount'] ?? 0.00);

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $salesInvoiceNo = SequenceService::generateNextNumber('sales_invoice');

            // Step 1: Pre-calculate FIFO batch allocations for all requested items
            $invoiceLinesToProcess = [];
            $grossTotal = 0.00;

            foreach ($body['items'] as $itemLine) {
                $itemId = (int)$itemLine['item_id'];
                $requestedQty = (int)$itemLine['qty'];
                $overridePrice = isset($itemLine['unit_price']) ? (float)$itemLine['unit_price'] : null;

                // Automatic FIFO Batch Allocation Service Call
                $allocatedBatches = FifoAllocationEngine::allocateStock($itemId, $requestedQty, $clinicLocId);

                foreach ($allocatedBatches as $alloc) {
                    $unitPrice = $overridePrice !== null ? $overridePrice : $alloc['selling_price'];
                    $subtotal = $unitPrice * $alloc['allocated_qty'];
                    $grossTotal += $subtotal;

                    $invoiceLinesToProcess[] = [
                        'item_id'        => $itemId,
                        'batch_id'       => $alloc['batch_id'],
                        'batch_code'     => $alloc['batch_code'],
                        'qty'            => $alloc['allocated_qty'],
                        'purchase_price' => $alloc['purchase_price'],
                        'unit_price'     => $unitPrice,
                        'subtotal'       => $subtotal,
                        'expiry_date'    => $alloc['expiry_date']
                    ];
                }
            }

            $netAmount = max(0.00, $grossTotal - $discount);

            // Step 2: Insert Sales Invoice Header
            $stmtHeader = $pdo->prepare("INSERT INTO `sales_invoices` 
                (`sales_invoice_no`, `clinic_location_id`, `customer_name`, `customer_phone`, `total_amount`, `discount`, `net_amount`, `payment_method`, `created_by`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $stmtHeader->execute([
                $salesInvoiceNo,
                $clinicLocId,
                $customerName,
                $customerPhone,
                $grossTotal,
                $discount,
                $netAmount,
                $body['payment_method'] ?? 'CASH',
                $user['user_id']
            ]);

            $salesInvoiceId = $pdo->lastInsertId();

            // Step 3: Insert Invoice Line Items, Debit Stock, & Record Movements
            $stmtLine = $pdo->prepare("INSERT INTO `sales_invoice_items` 
                (`sales_invoice_id`, `item_id`, `batch_id`, `qty`, `unit_price`, `subtotal`)
                VALUES (?, ?, ?, ?, ?, ?)");

            foreach ($invoiceLinesToProcess as $line) {
                $stmtLine->execute([
                    $salesInvoiceId,
                    $line['item_id'],
                    $line['batch_id'],
                    $line['qty'],
                    $line['unit_price'],
                    $line['subtotal']
                ]);

                // Debit stock from Clinic Batch Inventory
                InventoryLedgerService::debitStock($clinicLocId, $line['batch_id'], $line['qty']);

                // Record FIFO Customer Sale Movement
                InventoryLedgerService::recordMovement('CUSTOMER_SALE', $salesInvoiceNo, $line['item_id'], $line['batch_id'], $clinicLocId, null, $line['qty'], $line['purchase_price'], $line['unit_price'], $user['user_id']);
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'OPD_DISPENSING', 'CREATE_SALES_INVOICE', null, [
                'sales_invoice_id' => $salesInvoiceId,
                'sales_invoice_no' => $salesInvoiceNo,
                'clinic_id'        => $clinicLocId,
                'net_amount'       => $netAmount,
                'lines_count'      => count($invoiceLinesToProcess)
            ], $clinicLocId);

            $this->json([
                'success'          => true,
                'message'          => 'OPD dispensing invoice created successfully with FIFO batch allocation.',
                'sales_invoice_no' => $salesInvoiceNo,
                'sales_invoice_id' => $salesInvoiceId,
                'net_amount'       => $netAmount,
                'fifo_batches'     => $invoiceLinesToProcess
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('OPD Dispensing sale failed: ' . $e->getMessage(), 500);
        }
    }

    public function getSalesInvoices() {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $sql = "SELECT si.*, l.name AS clinic_name, u.full_name AS created_by_name
                FROM `sales_invoices` si
                JOIN `locations` l ON si.clinic_location_id = l.id
                JOIN `users` u ON si.created_by = u.id";
        
        // Scope OPD users to their own clinic if restricted
        if ($user['role'] === 'OPD_USER' && !empty($user['location_id'])) {
            $sql .= " WHERE si.clinic_location_id = " . (int)$user['location_id'];
        }

        $sql .= " ORDER BY si.id DESC";

        $invoices = $pdo->query($sql)->fetchAll(\PDO::FETCH_ASSOC);

        $this->json([
            'success'  => true,
            'invoices' => $invoices
        ]);
    }
}
