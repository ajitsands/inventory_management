<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class BranchTransferController extends Controller
{
    public function createBranchTransfer()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        if (empty($body['from_location_id']) || empty($body['to_location_id']) || empty($body['items']) || !is_array($body['items'])) {
            $this->error('Missing parameters for branch transfer.', 400);
        }

        $fromLoc = (int)$body['from_location_id'];
        $toLoc = (int)$body['to_location_id'];

        if ($fromLoc === $toLoc) {
            $this->error('Source and destination locations cannot be identical.', 400);
        }

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $invoiceNo = SequenceService::generateNextNumber('branch_transfer');
            $transferNo = 'TRF-' . str_replace(['/', '-'], '', $invoiceNo);

            $totalVal = 0.00;
            foreach ($body['items'] as $item) {
                $totalVal += (float)$item['unit_price'] * (int)$item['qty'];
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

            foreach ($body['items'] as $line) {
                $itemId = (int)$line['item_id'];
                $batchId = (int)$line['batch_id'];
                $qty = (int)$line['qty'];
                $unitPrice = (float)$line['unit_price'];
                $subtotal = $unitPrice * $qty;

                $stmtItem->execute([
                    $transferId,
                    $itemId,
                    $batchId,
                    $qty,
                    $unitPrice,
                    $subtotal
                ]);

                // Debit Main Store & Credit Sub Branch
                InventoryLedgerService::debitStock($fromLoc, $batchId, $qty);
                InventoryLedgerService::creditStock($toLoc, $batchId, $qty);

                // Movement Ledger
                InventoryLedgerService::recordMovement('BRANCH_TRANSFER', $transferNo, $itemId, $batchId, $fromLoc, $toLoc, $qty, $unitPrice, $unitPrice, $user['user_id']);
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
