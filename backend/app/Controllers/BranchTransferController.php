<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class BranchTransferController extends Controller
{
    public function createBranchTransfer()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        $rawFromLoc = UrlSecurity::decrypt($body['from_location_id'] ?? null);
        $fromLoc = !empty($rawFromLoc) ? (int)$rawFromLoc : (int)($body['raw_from_location_id'] ?? $body['from_location_id'] ?? 1);

        $rawToLoc = UrlSecurity::decrypt($body['to_location_id'] ?? null);
        $toLoc = !empty($rawToLoc) ? (int)$rawToLoc : (int)($body['raw_to_location_id'] ?? $body['to_location_id'] ?? 0);

        if (!$fromLoc || !$toLoc || empty($body['items']) || !is_array($body['items'])) {
            $this->error('Missing parameters or destination sub-branch for branch transfer.', 400);
            return;
        }

        if ($fromLoc === $toLoc) {
            $this->error('Source and destination locations cannot be identical.', 400);
            return;
        }

        $vatPercent = (float)($body['vat_percent'] ?? 10.00);

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $invoiceNo = SequenceService::generateNextNumber('branch_transfer');
            $transferNo = 'TRF-' . str_replace(['/', '-'], '', $invoiceNo);

            $validatedItems = [];
            $grossSubtotal = 0.00;

            foreach ($body['items'] as $idx => $line) {
                $rawItemId = UrlSecurity::decrypt($line['item_id'] ?? null);
                $itemId = !empty($rawItemId) ? (int)$rawItemId : (int)($line['raw_item_id'] ?? $line['item_id'] ?? 0);

                $rawBatchId = UrlSecurity::decrypt($line['batch_id'] ?? null);
                $batchId = !empty($rawBatchId) ? (int)$rawBatchId : (int)($line['raw_batch_id'] ?? $line['batch_id'] ?? 0);

                $qty = (int)($line['qty'] ?? 0);
                $unitPrice = (float)($line['unit_price'] ?? 0);

                if (!$itemId || !$batchId || $qty <= 0) {
                    Model::rollBack();
                    $this->error("Batch line #" . ($idx + 1) . " requires a valid batch selection and transfer quantity greater than 0.", 400);
                    return;
                }

                $subtotal = $unitPrice * $qty;
                $grossSubtotal += $subtotal;

                $validatedItems[] = [
                    'item_id'    => $itemId,
                    'batch_id'   => $batchId,
                    'qty'        => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal'   => $subtotal
                ];
            }

            $vatAmount = round($grossSubtotal * ($vatPercent / 100), 3);
            $grandTotal = round($grossSubtotal + $vatAmount, 3);
            $initialPaid = isset($body['paid_amount']) ? (float)$body['paid_amount'] : 0.00;

            $paymentStatus = 'UNPAID';
            if ($initialPaid >= $grandTotal && $grandTotal > 0) {
                $paymentStatus = 'PAID';
            } elseif ($initialPaid > 0) {
                $paymentStatus = 'PARTIAL';
            }

            $stmtHeader = $pdo->prepare("INSERT INTO `stock_transfers` 
                (`transfer_no`, `from_location_id`, `to_location_id`, `transfer_type`, `status`, `invoice_no`, `subtotal`, `vat_amount`, `total_val`, `paid_amount`, `payment_status`, `remarks`, `created_by`, `dispatched_at`, `received_at`, `received_by`)
                VALUES (?, ?, ?, 'BRANCH_INVOICED', 'RECEIVED', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)");

            $stmtHeader->execute([
                $transferNo,
                $fromLoc,
                $toLoc,
                $invoiceNo,
                $grossSubtotal,
                $vatAmount,
                $grandTotal,
                $initialPaid,
                $paymentStatus,
                $body['remarks'] ?? null,
                $user['user_id'],
                $user['user_id']
            ]);

            $transferId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO `stock_transfer_items` 
                (`transfer_id`, `item_id`, `batch_id`, `qty`, `unit_price`, `subtotal`)
                VALUES (?, ?, ?, ?, ?, ?)");

            foreach ($validatedItems as $line) {
                $stmtItem->execute([
                    $transferId,
                    $line['item_id'],
                    $line['batch_id'],
                    $line['qty'],
                    $line['unit_price'],
                    $line['subtotal']
                ]);

                // Debit Main Store & Credit Sub Branch
                InventoryLedgerService::debitStock($fromLoc, $line['batch_id'], $line['qty']);
                InventoryLedgerService::creditStock($toLoc, $line['batch_id'], $line['qty']);

                // Movement Ledger
                InventoryLedgerService::recordMovement('BRANCH_TRANSFER', $transferNo, $line['item_id'], $line['batch_id'], $fromLoc, $toLoc, $line['qty'], $line['unit_price'], $line['unit_price'], $user['user_id']);
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'BRANCH_TRANSFER', 'CREATE_BRANCH_INVOICE_TRANSFER', null, [
                'transfer_id' => $transferId,
                'transfer_no' => $transferNo,
                'invoice_no'  => $invoiceNo,
                'from_loc'    => $fromLoc,
                'to_loc'      => $toLoc,
                'subtotal'    => $grossSubtotal,
                'vat_amount'  => $vatAmount,
                'total_val'   => $grandTotal,
                'paid_amount' => $initialPaid
            ], $fromLoc);

            $this->json([
                'success'     => true,
                'message'     => 'Branch invoiced stock transfer completed successfully.',
                'transfer_no' => $transferNo,
                'invoice_no'  => $invoiceNo,
                'transfer_id' => $transferId
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('Branch transfer failed: ' . $e->getMessage(), 500);
        }
    }

    public function recordPayment()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        $rawTransferId = UrlSecurity::decrypt($body['transfer_id'] ?? null);
        $transferId = !empty($rawTransferId) ? (int)$rawTransferId : (int)($body['raw_transfer_id'] ?? $body['transfer_id'] ?? 0);
        $paymentAmount = (float)($body['amount_paid'] ?? 0.00);

        if (!$transferId || $paymentAmount <= 0) {
            $this->error('Transfer ID and valid payment amount are required.', 400);
            return;
        }

        $pdo = Model::getDB();
        $stmt = $pdo->prepare("SELECT * FROM `stock_transfers` WHERE `id` = ?");
        $stmt->execute([$transferId]);
        $transfer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$transfer) {
            $this->error('Transfer record not found.', 404);
            return;
        }

        $newPaidAmount = round((float)$transfer['paid_amount'] + $paymentAmount, 3);
        $grandTotal = (float)$transfer['total_val'];

        $newStatus = 'PARTIAL';
        if ($newPaidAmount >= $grandTotal) {
            $newPaidAmount = $grandTotal;
            $newStatus = 'PAID';
        }

        $updateStmt = $pdo->prepare("UPDATE `stock_transfers` SET `paid_amount` = ?, `payment_status` = ? WHERE `id` = ?");
        $updateStmt->execute([$newPaidAmount, $newStatus, $transferId]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'BRANCH_TRANSFER', 'RECORD_BRANCH_PAYMENT', null, [
            'transfer_id'   => $transferId,
            'payment_added' => $paymentAmount,
            'new_total_paid'=> $newPaidAmount,
            'status'        => $newStatus
        ]);

        $this->json([
            'success'        => true,
            'message'        => 'Payment of BHD ' . number_format($paymentAmount, 3) . ' recorded successfully!',
            'paid_amount'    => $newPaidAmount,
            'payment_status' => $newStatus
        ]);
    }

    public function getTransfers()
    {
        $this->requireAuth();
        $pdo = Model::getDB();

        $sql = "SELECT st.*, fl.name AS from_location_name, tl.name AS to_location_name, u.full_name AS created_by_name
                FROM `stock_transfers` st
                JOIN `locations` fl ON st.from_location_id = fl.id
                JOIN `locations` tl ON st.to_location_id = tl.id
                JOIN `users` u ON st.created_by = u.id
                ORDER BY st.id DESC";

        $transfers = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT sti.*, i.name AS item_name, i.item_code, b.batch_code, b.expiry_date
                                    FROM `stock_transfer_items` sti
                                    JOIN `items` i ON sti.item_id = i.id
                                    JOIN `item_batches` b ON sti.batch_id = b.id
                                    WHERE sti.transfer_id = ?");

        $stmtLedger = $pdo->prepare("SELECT sml.*, i.name AS item_name, i.item_code, b.batch_code,
                                           fl.name AS from_location_name, tl.name AS to_location_name, u.full_name AS created_by_name
                                    FROM `stock_movements_ledger` sml
                                    JOIN `items` i ON sml.item_id = i.id
                                    JOIN `item_batches` b ON sml.batch_id = b.id
                                    LEFT JOIN `locations` fl ON sml.from_location_id = fl.id
                                    LEFT JOIN `locations` tl ON sml.to_location_id = tl.id
                                    JOIN `users` u ON sml.created_by = u.id
                                    WHERE sml.reference_no = ?");

        foreach ($transfers as &$tr) {
            $rawId = (int)$tr['id'];
            $tr['raw_id'] = $rawId;
            $tr['raw_from_location_id'] = (int)$tr['from_location_id'];
            $tr['raw_to_location_id'] = (int)$tr['to_location_id'];
            $tr['id'] = UrlSecurity::encrypt($tr['id']);
            $tr['from_location_id'] = UrlSecurity::encrypt($tr['from_location_id']);
            $tr['to_location_id'] = UrlSecurity::encrypt($tr['to_location_id']);

            $subtotal = (float)$tr['subtotal'];
            $grandTotal = (float)$tr['total_val'];
            if ($subtotal == 0.00 && $grandTotal > 0.00) {
                $subtotal = round($grandTotal / 1.10, 3);
                $vatAmount = round($grandTotal - $subtotal, 3);
                $tr['subtotal'] = $subtotal;
                $tr['vat_amount'] = $vatAmount;
            }

            $paid = (float)($tr['paid_amount'] ?? 0.00);
            $tr['paid_amount'] = $paid;
            $tr['pending_balance'] = max(0.00, round($grandTotal - $paid, 3));

            $stmtItems->execute([$rawId]);
            $tr['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

            $stmtLedger->execute([$tr['transfer_no']]);
            $tr['ledger_movements'] = $stmtLedger->fetchAll(PDO::FETCH_ASSOC);
        }

        $this->json([
            'success'   => true,
            'transfers' => $transfers
        ]);
    }
}
