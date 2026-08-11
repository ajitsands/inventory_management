<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';

class ClinicTransferController extends Controller {

    public function createClinicTransfer() {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        $rawFromLoc = UrlSecurity::decrypt($body['from_location_id'] ?? null);
        $fromLoc = !empty($rawFromLoc) ? (int)$rawFromLoc : (int)($body['raw_from_location_id'] ?? $body['from_location_id'] ?? 0);

        $rawToLoc = UrlSecurity::decrypt($body['to_location_id'] ?? null);
        $toLoc = !empty($rawToLoc) ? (int)$rawToLoc : (int)($body['raw_to_location_id'] ?? $body['to_location_id'] ?? 0);

        if (!$fromLoc || !$toLoc || empty($body['items']) || !is_array($body['items'])) {
            $this->error('Missing parameters or destination clinic location.', 400);
            return;
        }

        if ($fromLoc === $toLoc) {
            $this->error('Source and destination locations cannot be identical.', 400);
            return;
        }

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $transferNo = 'TRF-CLN-' . date('Ymd-His') . '-' . rand(100, 999);

            $stmtHeader = $pdo->prepare("INSERT INTO `stock_transfers` 
                (`transfer_no`, `from_location_id`, `to_location_id`, `transfer_type`, `status`, `invoice_no`, `total_val`, `remarks`, `created_by`, `dispatched_at`, `received_at`, `received_by`)
                VALUES (?, ?, ?, 'CLINIC_TRANSFER', 'RECEIVED', NULL, 0.00, ?, ?, NOW(), NOW(), ?)");

            $stmtHeader->execute([
                $transferNo,
                $fromLoc,
                $toLoc,
                $body['remarks'] ?? null,
                $user['user_id'],
                $user['user_id']
            ]);

            $transferId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO `stock_transfer_items` 
                (`transfer_id`, `item_id`, `batch_id`, `qty`, `unit_price`, `subtotal`)
                VALUES (?, ?, ?, ?, 0.00, 0.00)");

            foreach ($body['items'] as $idx => $line) {
                $rawItemId = UrlSecurity::decrypt($line['item_id'] ?? null);
                $itemId = !empty($rawItemId) ? (int)$rawItemId : (int)($line['raw_item_id'] ?? $line['item_id'] ?? 0);

                $rawBatchId = UrlSecurity::decrypt($line['batch_id'] ?? null);
                $batchId = !empty($rawBatchId) ? (int)$rawBatchId : (int)($line['raw_batch_id'] ?? $line['batch_id'] ?? 0);

                $qty = (int)($line['qty'] ?? 0);

                if (!$itemId || !$batchId || $qty <= 0) {
                    Model::rollBack();
                    $this->error("Batch line #" . ($idx + 1) . " requires a valid batch selection and transfer quantity greater than 0.", 400);
                    return;
                }

                $stmtItem->execute([
                    $transferId,
                    $itemId,
                    $batchId,
                    $qty
                ]);

                // Debit Sub Branch & Credit Clinic
                InventoryLedgerService::debitStock($fromLoc, $batchId, $qty);
                InventoryLedgerService::creditStock($toLoc, $batchId, $qty);

                // Movement Ledger
                InventoryLedgerService::recordMovement('CLINIC_TRANSFER', $transferNo, $itemId, $batchId, $fromLoc, $toLoc, $qty, 0.00, 0.00, $user['user_id']);
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'CLINIC_TRANSFER', 'CREATE_CLINIC_STOCK_TRANSFER', null, [
                'transfer_id' => $transferId,
                'transfer_no' => $transferNo,
                'from_loc'    => $fromLoc,
                'to_loc'      => $toLoc,
                'items_count' => count($body['items'])
            ], $fromLoc);

            $this->json([
                'success'     => true,
                'message'     => 'Clinic stock transfer completed successfully (No invoicing).',
                'transfer_no' => $transferNo,
                'transfer_id' => $transferId
            ]);

        } catch (Exception $e) {
            Model::rollBack();
            $this->error('Clinic transfer failed: ' . $e->getMessage(), 500);
        }
    }
}
