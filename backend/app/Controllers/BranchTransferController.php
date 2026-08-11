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

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $invoiceNo = SequenceService::generateNextNumber('branch_transfer');
            $transferNo = 'TRF-' . str_replace(['/', '-'], '', $invoiceNo);

            $validatedItems = [];
            $totalVal = 0.00;

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
                $totalVal += $subtotal;

                $validatedItems[] = [
                    'item_id'    => $itemId,
                    'batch_id'   => $batchId,
                    'qty'        => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal'   => $subtotal
                ];
            }

            $stmtHeader = $pdo->prepare("INSERT INTO `stock_transfers` 
                (`transfer_no`, `from_location_id`, `to_location_id`, `transfer_type`, `status`, `invoice_no`, `total_val`, `remarks`, `created_by`, `dispatched_at`, `received_at`, `received_by`)
                VALUES (?, ?, ?, 'BRANCH_INVOICED', 'RECEIVED', ?, ?, ?, ?, NOW(), NOW(), ?)");

            $stmtHeader->execute([
                $transferNo,
                $fromLoc,
                $toLoc,
                $invoiceNo,
                $totalVal,
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
                'total_val'   => $totalVal
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
        $transfers = $pdo->query($sql)->fetchAll(\PDO::FETCH_ASSOC);
        $this->json([
            'success'   => true,
            'transfers' => $transfers
        ]);
    }
}
