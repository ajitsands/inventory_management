<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class ReturnController extends Controller
{
    /**
     * Get eligible stock items for return from a specific source location
     * Enforces batch-level received quantity validation & remaining returnable limits
     */
    public function getEligibleItems()
    {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        // Always use the authenticated user's location_id for non-ADMIN users
        // For ADMIN, allow location_id query param override
        if ($user['role'] !== 'ADMIN' && !empty($user['location_id'])) {
            $locId = (int)$user['location_id'];
        } else {
            $rawLocId = UrlSecurity::decrypt($_GET['location_id'] ?? null);
            $locId = !empty($rawLocId) ? (int)$rawLocId : (int)($_GET['raw_location_id'] ?? $_GET['location_id'] ?? 0);
        }

        if (!$locId) {
            $this->error('Location ID is required.', 400);
            return;
        }

        // Fetch current active stock batches at this location from location_batch_stock
        $sql = "SELECT lbs.batch_id, lbs.quantity_available,
                       b.batch_code, b.expiry_date, b.purchase_price AS unit_cost, b.selling_price,
                       i.id AS item_id, i.name AS item_name, i.item_code, i.unit_of_measure
                FROM `location_batch_stock` lbs
                JOIN `item_batches` b ON lbs.batch_id = b.id
                JOIN `items` i ON b.item_id = i.id
                WHERE lbs.location_id = ? AND lbs.quantity_available > 0
                ORDER BY i.name ASC, b.expiry_date ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$locId]);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($batches as $b) {
            $batchId = (int)$b['batch_id'];

            // Find the MOST RECENT stock_transfer that delivered this batch to this location
            // This tells us which Sub-Branch to return to
            $stmtTransfer = $pdo->prepare("SELECT st.from_location_id, SUM(sti.qty) AS total_received
                                          FROM `stock_transfer_items` sti
                                          JOIN `stock_transfers` st ON sti.transfer_id = st.id
                                          WHERE st.to_location_id = ? AND sti.batch_id = ?
                                          GROUP BY st.from_location_id
                                          ORDER BY MAX(st.id) DESC
                                          LIMIT 1");
            $stmtTransfer->execute([$locId, $batchId]);
            $transferRow = $stmtTransfer->fetch(PDO::FETCH_ASSOC);
            $totalReceived = (int)($transferRow['total_received'] ?? 0);
            $transferFromLocId = $transferRow ? (int)$transferRow['from_location_id'] : null;

            // Calculate quantity already returned or in return process
            $stmtRet = $pdo->prepare("SELECT COALESCE(SUM(sri.quantity), 0) AS total_returned
                                     FROM `stock_return_items` sri
                                     JOIN `stock_returns` sr ON sri.return_id = sr.id
                                     WHERE sr.from_location_id = ? AND sri.batch_id = ? AND sr.status != 'REJECTED'");
            $stmtRet->execute([$locId, $batchId]);
            $retRow = $stmtRet->fetch(PDO::FETCH_ASSOC);
            $totalReturned = (int)($retRow['total_returned'] ?? 0);

            // Remaining returnable quantity
            $availQty = (int)$b['quantity_available'];
            $eligibleByTransfer = max(0, $totalReceived - $totalReturned);

            // If transfer history is tracked, limit by eligible; otherwise fallback to availQty
            $maxReturnable = ($totalReceived > 0) ? min($availQty, $eligibleByTransfer) : $availQty;

            $b['raw_id'] = $batchId;
            $b['raw_batch_id'] = $batchId;
            $b['batch_id'] = $batchId;            // keep raw int for frontend matching
            $b['id'] = UrlSecurity::encrypt($batchId);
            $b['raw_item_id'] = (int)$b['item_id'];
            $b['item_id'] = (int)$b['raw_item_id'];  // keep raw int
            $b['total_received'] = $totalReceived > 0 ? $totalReceived : $availQty;
            $b['total_returned'] = $totalReturned;
            $b['max_returnable_qty'] = $maxReturnable > 0 ? $maxReturnable : $availQty;
            // Tell frontend which Sub-Branch to auto-select as Destination
            $b['transfer_from_location_id'] = $transferFromLocId;

            if ($b['max_returnable_qty'] > 0) {
                $result[] = $b;
            }
        }

        $this->json(['success' => true, 'items' => $result]);
    }


    /**
     * Create Return Request (Clinic -> Branch or Branch -> Main Store)
     * Deducts stock from source location & places quantity into destination's Return Wallet (PENDING_ACCEPTANCE)
     */
    public function createReturn()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER', 'OPD_USER']);
        $body = $this->getRequestBody();

        $returnType = trim($body['return_type'] ?? '');
        $allowedTypes = ['CLINIC_TO_BRANCH', 'BRANCH_TO_MAIN'];

        if (!in_array($returnType, $allowedTypes)) {
            $this->error('Please select a valid internal return type (Clinic to Branch or Branch to Main Store).', 400);
            return;
        }

        $fromLoc = (int)($body['raw_from_location_id'] ?? UrlSecurity::decrypt($body['from_location_id'] ?? null) ?? $body['from_location_id'] ?? 0);
        $toLoc = (int)($body['raw_to_location_id'] ?? UrlSecurity::decrypt($body['to_location_id'] ?? null) ?? $body['to_location_id'] ?? 0);
        $reason = trim($body['reason'] ?? '');
        $notes = trim($body['notes'] ?? '');
        $items = $body['items'] ?? [];

        $userLocId = $user['location_id'] ?? null;
        if ($user['role'] !== 'ADMIN' && !empty($userLocId)) {
            $fromLoc = (int)$userLocId;
        }

        if (!$fromLoc || !$toLoc) {
            $this->error('Valid source and destination locations are required.', 400);
            return;
        }

        if ($fromLoc === $toLoc) {
            $this->error('Source and destination locations cannot be the same.', 400);
            return;
        }

        if (empty($reason)) {
            $this->error('Please select a return reason.', 400);
            return;
        }

        if (empty($items) || !is_array($items)) {
            $this->error('Please select at least one stock item batch to return.', 400);
            return;
        }

        $pdo = Model::getDB();

        try {
            Model::beginTransaction();

            $returnRef = SequenceService::generateNextNumber('return');

            $stmtReturn = $pdo->prepare("INSERT INTO `stock_returns` 
                (`return_reference`, `return_type`, `from_location_id`, `to_location_id`, `reason`, `notes`, `status`, `created_by`, `created_at`) 
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE', ?, NOW())");
            $stmtReturn->execute([$returnRef, $returnType, $fromLoc, $toLoc, $reason, $notes, $user['user_id']]);
            $returnId = (int)$pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO `stock_return_items` 
                (`return_id`, `item_id`, `batch_id`, `batch_code`, `quantity`, `unit_rate`, `total_amount`, `status`) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')");

            $stmtWallet = $pdo->prepare("INSERT INTO `stock_return_wallets` 
                (`return_id`, `return_item_id`, `target_location_id`, `item_id`, `batch_id`, `quantity`, `wallet_type`, `status`, `created_at`) 
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING_RETURN', 'PENDING', NOW())");

            foreach ($items as $itemData) {
                $rawItemId = (int)($itemData['raw_item_id'] ?? UrlSecurity::decrypt($itemData['item_id'] ?? null) ?? $itemData['item_id'] ?? 0);
                $rawBatchId = (int)($itemData['raw_batch_id'] ?? UrlSecurity::decrypt($itemData['batch_id'] ?? null) ?? $itemData['batch_id'] ?? 0);
                $qty = (int)($itemData['quantity'] ?? 0);
                $unitRate = (float)($itemData['unit_rate'] ?? 0);

                if (!$rawItemId || !$rawBatchId || $qty <= 0) {
                    throw new \Exception('Invalid item batch or return quantity specified.');
                }

                // Verify batch available stock from location_batch_stock
                $stmtBatch = $pdo->prepare("SELECT lbs.quantity_available, b.batch_code 
                                           FROM `location_batch_stock` lbs
                                           JOIN `item_batches` b ON lbs.batch_id = b.id
                                           WHERE lbs.batch_id = ? AND lbs.location_id = ? FOR UPDATE");
                $stmtBatch->execute([$rawBatchId, $fromLoc]);
                $batchRow = $stmtBatch->fetch(PDO::FETCH_ASSOC);

                if (!$batchRow) {
                    throw new \Exception("Batch ID {$rawBatchId} not found at source location.");
                }

                if ((int)$batchRow['quantity_available'] < $qty) {
                    throw new \Exception("Insufficient available stock for batch {$batchRow['batch_code']}. Avail: {$batchRow['quantity_available']}, Requested Return: {$qty}.");
                }

                $batchCode = $batchRow['batch_code'];
                $totalAmt = $qty * $unitRate;

                // Insert stock_return_items
                $stmtItem->execute([$returnId, $rawItemId, $rawBatchId, $batchCode, $qty, $unitRate, $totalAmt]);
                $returnItemId = (int)$pdo->lastInsertId();

                // Deduct stock from source location
                InventoryLedgerService::debitStock($fromLoc, $rawBatchId, $qty);
                InventoryLedgerService::recordMovement(
                    'STOCK_RETURN_OUT',
                    $returnRef,
                    $rawItemId,
                    $rawBatchId,
                    $fromLoc,
                    $toLoc,
                    $qty,
                    $unitRate,
                    $unitRate,
                    $user['user_id']
                );

                // Insert into Return Wallet of destination location
                $stmtWallet->execute([$returnId, $returnItemId, $toLoc, $rawItemId, $rawBatchId, $qty]);
            }

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'STOCK_RETURN', 'CREATE_RETURN', null, [
                'return_id' => $returnId,
                'return_ref' => $returnRef,
                'from_loc' => $fromLoc,
                'to_loc' => $toLoc,
                'return_type' => $returnType
            ], $fromLoc);

            $this->json([
                'success' => true,
                'message' => "Stock Return {$returnRef} submitted successfully! Placed into receiving location's Return Wallet pending acceptance.",
                'return_reference' => $returnRef,
                'return_id' => UrlSecurity::encrypt($returnId)
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('Failed to create stock return: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get Pending Return Wallet entries targeted to the current location (Branch or Main Store)
     */
    public function getReturnWallet()
    {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $rawLocId = UrlSecurity::decrypt($_GET['location_id'] ?? null);
        $locId = !empty($rawLocId) ? (int)$rawLocId : (int)($_GET['raw_location_id'] ?? $_GET['location_id'] ?? 0);

        if ($user['role'] !== 'ADMIN' && !empty($user['location_id'])) {
            $locId = (int)$user['location_id'];
        }

        $sql = "SELECT sr.*, lfrom.name AS from_location_name, lfrom.code AS from_location_code,
                       lto.name AS to_location_name, u.full_name AS created_by_name
                FROM `stock_returns` sr
                JOIN `locations` lfrom ON sr.from_location_id = lfrom.id
                JOIN `locations` lto ON sr.to_location_id = lto.id
                JOIN `users` u ON sr.created_by = u.id
                WHERE sr.status = 'PENDING_ACCEPTANCE'";

        $params = [];
        if ($locId > 0 && $user['role'] !== 'ADMIN') {
            $sql .= " AND sr.to_location_id = ?";
            $params[] = $locId;
        }

        $sql .= " ORDER BY sr.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $returns = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT sri.*, i.name AS item_name, i.item_code, i.unit_of_measure, b.batch_code, b.expiry_date
                                    FROM `stock_return_items` sri
                                    JOIN `items` i ON sri.item_id = i.id
                                    JOIN `item_batches` b ON sri.batch_id = b.id
                                    WHERE sri.return_id = ?");

        foreach ($returns as &$ret) {
            $rawId = (int)$ret['id'];
            $ret['raw_id'] = $rawId;
            $ret['id'] = UrlSecurity::encrypt($rawId);

            $stmtItems->execute([$rawId]);
            $ret['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
        }

        $this->json(['success' => true, 'wallet_returns' => $returns]);
    }

    /**
     * Accept Pending Return Request
     * Moves stock from Return Wallet -> Destination Location's Available Stock
     */
    public function acceptReturn()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        $rawReturnId = (int)($body['raw_return_id'] ?? UrlSecurity::decrypt($body['return_id'] ?? null) ?? $body['return_id'] ?? 0);

        if (!$rawReturnId) {
            $this->error('Return ID is required.', 400);
            return;
        }

        $pdo = Model::getDB();

        try {
            Model::beginTransaction();

            $stmtRet = $pdo->prepare("SELECT * FROM `stock_returns` WHERE id = ? FOR UPDATE");
            $stmtRet->execute([$rawReturnId]);
            $returnRow = $stmtRet->fetch(PDO::FETCH_ASSOC);

            if (!$returnRow) {
                throw new \Exception('Stock Return record not found.');
            }

            if ($returnRow['status'] !== 'PENDING_ACCEPTANCE') {
                throw new \Exception('This return request has already been processed or closed.');
            }

            $toLocId = (int)$returnRow['to_location_id'];
            $fromLocId = (int)$returnRow['from_location_id'];

            // Fetch return items
            $stmtItems = $pdo->prepare("SELECT * FROM `stock_return_items` WHERE return_id = ?");
            $stmtItems->execute([$rawReturnId]);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

            foreach ($items as $item) {
                $rawItemId = (int)$item['item_id'];
                $rawBatchId = (int)$item['batch_id'];
                $qty = (int)$item['quantity'];

                $stmtBatch = $pdo->prepare("SELECT batch_code, expiry_date, purchase_price, selling_price FROM `item_batches` WHERE id = ?");
                $stmtBatch->execute([$rawBatchId]);
                $origBatch = $stmtBatch->fetch(PDO::FETCH_ASSOC);

                if (!$origBatch) {
                    throw new \Exception("Original batch record ID {$rawBatchId} missing.");
                }

                // Credit stock to destination location's available stock using InventoryLedgerService
                InventoryLedgerService::creditStock($toLocId, $rawBatchId, $qty);
                InventoryLedgerService::recordMovement(
                    'STOCK_RETURN_IN',
                    $returnRow['return_reference'],
                    $rawItemId,
                    $rawBatchId,
                    $fromLocId,
                    $toLocId,
                    $qty,
                    (float)$origBatch['purchase_price'],
                    (float)$origBatch['selling_price'],
                    $user['user_id']
                );

                // Update return item status
                $stmtUpdItem = $pdo->prepare("UPDATE `stock_return_items` SET `accepted_qty` = ?, `status` = 'ACCEPTED' WHERE id = ?");
                $stmtUpdItem->execute([$qty, $item['id']]);

                // Update return wallet status
                $stmtUpdWallet = $pdo->prepare("UPDATE `stock_return_wallets` SET `status` = 'ACCEPTED' WHERE return_item_id = ?");
                $stmtUpdWallet->execute([$item['id']]);
            }

            // Update main return status
            $stmtUpdReturn = $pdo->prepare("UPDATE `stock_returns` SET `status` = 'ACCEPTED', `action_by` = ?, `action_at` = NOW() WHERE id = ?");
            $stmtUpdReturn->execute([$user['user_id'], $rawReturnId]);

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'STOCK_RETURN', 'ACCEPT_RETURN', null, [
                'return_id' => $rawReturnId,
                'return_ref' => $returnRow['return_reference']
            ], $toLocId);

            $this->json([
                'success' => true,
                'message' => "Stock Return {$returnRow['return_reference']} accepted successfully! Stock credited to available inventory."
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('Failed to accept stock return: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Reject Pending Return Request
     * - Clinic -> Branch rejection: Moves stock to Clinic Return Reject Wallet
     * - Branch -> Main Store rejection: Moves stock to Damaged Stock & generates Credit Note against Branch
     */
    public function rejectReturn()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $body = $this->getRequestBody();

        $rawReturnId = (int)($body['raw_return_id'] ?? UrlSecurity::decrypt($body['return_id'] ?? null) ?? $body['return_id'] ?? 0);
        $rejectionReason = trim($body['rejection_reason'] ?? 'Rejected by receiving authority');

        if (!$rawReturnId) {
            $this->error('Return ID is required.', 400);
            return;
        }

        $pdo = Model::getDB();

        try {
            Model::beginTransaction();

            $stmtRet = $pdo->prepare("SELECT * FROM `stock_returns` WHERE id = ? FOR UPDATE");
            $stmtRet->execute([$rawReturnId]);
            $returnRow = $stmtRet->fetch(PDO::FETCH_ASSOC);

            if (!$returnRow) {
                throw new \Exception('Stock Return record not found.');
            }

            if ($returnRow['status'] !== 'PENDING_ACCEPTANCE') {
                throw new \Exception('This return request has already been processed.');
            }

            $returnType = $returnRow['return_type'];
            $fromLocId = (int)$returnRow['from_location_id'];
            $toLocId = (int)$returnRow['to_location_id'];

            // Fetch return items
            $stmtItems = $pdo->prepare("SELECT * FROM `stock_return_items` WHERE return_id = ?");
            $stmtItems->execute([$rawReturnId]);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

            $creditNoteItems = [];
            $totalCreditNoteAmount = 0.00;

            foreach ($items as $item) {
                $rawItemId = (int)$item['item_id'];
                $rawBatchId = (int)$item['batch_id'];
                $qty = (int)$item['quantity'];

                // Update item status
                $stmtUpdItem = $pdo->prepare("UPDATE `stock_return_items` SET `rejected_qty` = ?, `status` = 'REJECTED' WHERE id = ?");
                $stmtUpdItem->execute([$qty, $item['id']]);

                // Update return wallet status
                $stmtUpdWallet = $pdo->prepare("UPDATE `stock_return_wallets` SET `status` = 'REJECTED' WHERE return_item_id = ?");
                $stmtUpdWallet->execute([$item['id']]);

                if ($returnType === 'CLINIC_TO_BRANCH') {
                    // Move to Clinic Return Reject Wallet
                    $stmtRej = $pdo->prepare("INSERT INTO `stock_return_rejections` 
                        (`return_id`, `return_item_id`, `clinic_location_id`, `item_id`, `batch_id`, `batch_code`, `quantity`, `rejection_reason`, `status`, `created_at`) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'IN_REJECT_WALLET', NOW())");
                    $stmtRej->execute([$rawReturnId, $item['id'], $fromLocId, $rawItemId, $rawBatchId, $item['batch_code'], $qty, $rejectionReason]);
                } else if ($returnType === 'BRANCH_TO_MAIN') {
                    // Move to Damaged / Rejected Stock at Main Store
                    $stmtDmg = $pdo->prepare("INSERT INTO `damaged_stock` 
                        (`return_id`, `return_item_id`, `location_id`, `item_id`, `batch_id`, `batch_code`, `quantity`, `reason`, `created_at`) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
                    $stmtDmg->execute([$rawReturnId, $item['id'], $toLocId, $rawItemId, $rawBatchId, $item['batch_code'], $qty, $rejectionReason]);

                    $creditNoteItems[] = $item;
                    $totalCreditNoteAmount += (float)$item['total_amount'];
                }
            }

            // Generate Credit Note if Branch -> Main Store rejection
            $creditNoteNo = null;
            if ($returnType === 'BRANCH_TO_MAIN' && !empty($creditNoteItems)) {
                $creditNoteNo = SequenceService::generateNextNumber('credit_note');

                $stmtCN = $pdo->prepare("INSERT INTO `credit_notes` 
                    (`credit_note_no`, `return_id`, `branch_location_id`, `original_transfer_no`, `total_amount`, `reason`, `created_by`, `created_at`) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())");
                $stmtCN->execute([$creditNoteNo, $rawReturnId, $fromLocId, $returnRow['original_transfer_no'], $totalCreditNoteAmount, $rejectionReason, $user['user_id']]);
                $creditNoteId = (int)$pdo->lastInsertId();

                $stmtCNItem = $pdo->prepare("INSERT INTO `credit_note_items` 
                    (`credit_note_id`, `item_id`, `batch_id`, `batch_code`, `quantity`, `unit_rate`, `total_amount`) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)");

                foreach ($creditNoteItems as $cItem) {
                    $stmtCNItem->execute([
                        $creditNoteId,
                        $cItem['item_id'],
                        $cItem['batch_id'],
                        $cItem['batch_code'],
                        $cItem['quantity'],
                        $cItem['unit_rate'],
                        $cItem['total_amount']
                    ]);
                }
            }

            // Update main return status
            $stmtUpdReturn = $pdo->prepare("UPDATE `stock_returns` SET `status` = 'REJECTED', `rejection_reason` = ?, `action_by` = ?, `action_at` = NOW() WHERE id = ?");
            $stmtUpdReturn->execute([$rejectionReason, $user['user_id'], $rawReturnId]);

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'STOCK_RETURN', 'REJECT_RETURN', null, [
                'return_id' => $rawReturnId,
                'return_ref' => $returnRow['return_reference'],
                'credit_note_no' => $creditNoteNo
            ], $toLocId);

            $msg = $returnType === 'CLINIC_TO_BRANCH' 
                ? "Return {$returnRow['return_reference']} rejected and placed into Clinic Return Reject Wallet."
                : "Return {$returnRow['return_reference']} rejected. Stock logged in Damaged Stock and Credit Note {$creditNoteNo} generated against Branch.";

            $this->json([
                'success' => true,
                'message' => $msg,
                'credit_note_no' => $creditNoteNo
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('Failed to reject stock return: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get Clinic Return Reject Wallet items
     */
    public function getClinicRejectWallet()
    {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $rawLocId = UrlSecurity::decrypt($_GET['clinic_id'] ?? $_GET['location_id'] ?? null);
        $locId = !empty($rawLocId) ? (int)$rawLocId : (int)($_GET['raw_clinic_id'] ?? $_GET['raw_location_id'] ?? $_GET['clinic_id'] ?? $_GET['location_id'] ?? 0);

        if ($user['role'] !== 'ADMIN' && !empty($user['location_id'])) {
            $locId = (int)$user['location_id'];
        }

        $sql = "SELECT srr.*, sr.return_reference, i.name AS item_name, i.item_code, i.unit_of_measure, l.name AS clinic_name
                FROM `stock_return_rejections` srr
                JOIN `stock_returns` sr ON srr.return_id = sr.id
                JOIN `items` i ON srr.item_id = i.id
                JOIN `locations` l ON srr.clinic_location_id = l.id
                WHERE srr.status = 'IN_REJECT_WALLET'";

        $params = [];
        if ($locId > 0) {
            $sql .= " AND srr.clinic_location_id = ?";
            $params[] = $locId;
        }

        $sql .= " ORDER BY srr.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rejects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rejects as &$r) {
            $r['raw_id'] = (int)$r['id'];
            $r['id'] = UrlSecurity::encrypt($r['id']);
        }

        $this->json(['success' => true, 'reject_wallet' => $rejects]);
    }

    /**
     * Restore item from Clinic Return Reject Wallet back into Clinic Available Stock
     */
    public function restoreRejectStock()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER', 'OPD_USER']);
        $body = $this->getRequestBody();

        $rawRejId = (int)($body['raw_rejection_id'] ?? UrlSecurity::decrypt($body['rejection_id'] ?? null) ?? $body['rejection_id'] ?? 0);

        if (!$rawRejId) {
            $this->error('Rejection ID is required.', 400);
            return;
        }

        $pdo = Model::getDB();

        try {
            Model::beginTransaction();

            $stmtRej = $pdo->prepare("SELECT * FROM `stock_return_rejections` WHERE id = ? FOR UPDATE");
            $stmtRej->execute([$rawRejId]);
            $rejRow = $stmtRej->fetch(PDO::FETCH_ASSOC);

            if (!$rejRow) {
                throw new \Exception('Reject wallet record not found.');
            }

            if ($rejRow['status'] !== 'IN_REJECT_WALLET') {
                throw new \Exception('This rejected stock item has already been restored.');
            }

            $clinicId = (int)$rejRow['clinic_location_id'];
            $rawItemId = (int)$rejRow['item_id'];
            $rawBatchId = (int)$rejRow['batch_id'];
            $qty = (int)$rejRow['quantity'];

            // Credit stock back to Clinic Available Stock using InventoryLedgerService
            InventoryLedgerService::creditStock($clinicId, $rawBatchId, $qty);
            InventoryLedgerService::recordMovement(
                'STOCK_RESTORE_IN',
                "REJ-RESTORE-{$rawRejId}",
                $rawItemId,
                $rawBatchId,
                null,
                $clinicId,
                $qty,
                0,
                0,
                $user['user_id']
            );

            // Update rejection record status
            $stmtUpd = $pdo->prepare("UPDATE `stock_return_rejections` SET `status` = 'RESTORED_TO_STOCK', `restored_by` = ?, `restored_at` = NOW() WHERE id = ?");
            $stmtUpd->execute([$user['user_id'], $rawRejId]);

            Model::commit();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'STOCK_RETURN', 'RESTORE_REJECT_STOCK', null, [
                'rejection_id' => $rawRejId,
                'clinic_id' => $clinicId
            ], $clinicId);

            $this->json([
                'success' => true,
                'message' => 'Stock item successfully restored back into Clinic Available Stock!'
            ]);

        } catch (\Exception $e) {
            Model::rollBack();
            $this->error('Failed to restore rejected stock: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get Credit Notes List
     */
    public function getCreditNotes()
    {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $sql = "SELECT cn.*, l.name AS branch_name, l.code AS branch_code, u.full_name AS created_by_name
                FROM `credit_notes` cn
                JOIN `locations` l ON cn.branch_location_id = l.id
                JOIN `users` u ON cn.created_by = u.id";

        $params = [];
        if ($user['role'] === 'STORE_MANAGER' && !empty($user['location_id'])) {
            $sql .= " WHERE cn.branch_location_id = ?";
            $params[] = (int)$user['location_id'];
        }

        $sql .= " ORDER BY cn.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT cni.*, i.name AS item_name, i.item_code, i.unit_of_measure
                                    FROM `credit_note_items` cni
                                    JOIN `items` i ON cni.item_id = i.id
                                    WHERE cni.credit_note_id = ?");

        foreach ($notes as &$cn) {
            $rawId = (int)$cn['id'];
            $cn['raw_id'] = $rawId;
            $cn['id'] = UrlSecurity::encrypt($rawId);

            $stmtItems->execute([$rawId]);
            $cn['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
        }

        $this->json(['success' => true, 'credit_notes' => $notes]);
    }

    /**
     * Get Damaged / Rejected Stock Ledger at Main Store
     */
    public function getDamagedStock()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $pdo = Model::getDB();

        $sql = "SELECT ds.*, sr.return_reference, i.name AS item_name, i.item_code, i.unit_of_measure, l.name AS location_name
                FROM `damaged_stock` ds
                JOIN `stock_returns` sr ON ds.return_id = sr.id
                JOIN `items` i ON ds.item_id = i.id
                JOIN `locations` l ON ds.location_id = l.id
                ORDER BY ds.id DESC";

        $stmt = $pdo->query($sql);
        $damaged = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($damaged as &$d) {
            $d['raw_id'] = (int)$d['id'];
            $d['id'] = UrlSecurity::encrypt($d['id']);
        }

        $this->json(['success' => true, 'damaged_stock' => $damaged]);
    }

    /**
     * Get Full Return History Audit Trail
     */
    public function getReturns()
    {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $rawLocId = UrlSecurity::decrypt($_GET['location_id'] ?? null);
        $locId = !empty($rawLocId) ? (int)$rawLocId : (int)($_GET['raw_location_id'] ?? $_GET['location_id'] ?? 0);

        if ($user['role'] !== 'ADMIN' && !empty($user['location_id'])) {
            $locId = (int)$user['location_id'];
        }

        $sql = "SELECT sr.*, lfrom.name AS from_location_name, lfrom.code AS from_location_code,
                       lto.name AS to_location_name, lto.code AS to_location_code,
                       u1.full_name AS created_by_name, u2.full_name AS action_by_name
                FROM `stock_returns` sr
                JOIN `locations` lfrom ON sr.from_location_id = lfrom.id
                JOIN `locations` lto ON sr.to_location_id = lto.id
                JOIN `users` u1 ON sr.created_by = u1.id
                LEFT JOIN `users` u2 ON sr.action_by = u2.id";

        $params = [];
        if ($locId > 0 && $user['role'] !== 'ADMIN') {
            $sql .= " WHERE (sr.from_location_id = ? OR sr.to_location_id = ?)";
            $params[] = $locId;
            $params[] = $locId;
        }

        $sql .= " ORDER BY sr.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $returns = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT sri.*, i.name AS item_name, i.item_code, i.unit_of_measure, b.batch_code, b.expiry_date
                                    FROM `stock_return_items` sri
                                    JOIN `items` i ON sri.item_id = i.id
                                    JOIN `item_batches` b ON sri.batch_id = b.id
                                    WHERE sri.return_id = ?");

        foreach ($returns as &$ret) {
            $rawId = (int)$ret['id'];
            $ret['raw_id'] = $rawId;
            $ret['id'] = UrlSecurity::encrypt($rawId);

            $stmtItems->execute([$rawId]);
            $ret['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
        }

        $this->json(['success' => true, 'returns' => $returns]);
    }
}
