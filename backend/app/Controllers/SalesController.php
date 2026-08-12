<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Services/FifoAllocationEngine.php';
require_once __DIR__ . '/../Services/InventoryLedgerService.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class SalesController extends Controller
{
    public function createSalesInvoice()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER', 'OPD_USER']);
        $body = $this->getRequestBody();

        $rawClinicLoc = UrlSecurity::decrypt($body['clinic_location_id'] ?? null);
        $clinicLocId = !empty($rawClinicLoc) ? (int)$rawClinicLoc : (int)($body['raw_clinic_location_id'] ?? $body['clinic_location_id'] ?? $user['location_id'] ?? 4);

        $userLocId = $user['location_id'] ?? null;
        if ($user['role'] !== 'ADMIN' && !empty($userLocId)) {
            $clinicLocId = (int)$userLocId;
        }

        if (!$clinicLocId || empty($body['items']) || !is_array($body['items'])) {
            $this->error('Missing required parameters for OPD dispensing invoice.', 400);
            return;
        }

        $customerName = trim($body['customer_name'] ?? 'Walk-in Patient');
        $customerPhone = trim($body['customer_phone'] ?? '');
        $doctorName = trim($body['doctor_name'] ?? 'OPD Doctor');
        $discount = (float)($body['discount'] ?? 0.00);

        $pdo = Model::getDB();
        Model::beginTransaction();

        try {
            $salesInvoiceNo = SequenceService::generateNextNumber('sales_invoice');

            // Pre-calculate FIFO batch allocations for all requested items
            $invoiceLinesToProcess = [];
            $grossTotal = 0.00;

            foreach ($body['items'] as $idx => $itemLine) {
                $rawItemId = UrlSecurity::decrypt($itemLine['item_id'] ?? null);
                $itemId = !empty($rawItemId) ? (int)$rawItemId : (int)($itemLine['raw_item_id'] ?? $itemLine['item_id'] ?? 0);
                $requestedQty = (int)($itemLine['qty'] ?? 0);
                $overridePrice = isset($itemLine['unit_price']) ? (float)$itemLine['unit_price'] : null;

                if (!$itemId || $requestedQty <= 0) {
                    Model::rollBack();
                    $this->error("Line #" . ($idx + 1) . " requires a valid item selection and quantity greater than 0.", 400);
                    return;
                }

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

            // Insert Sales Invoice Header
            $stmtHeader = $pdo->prepare("INSERT INTO `sales_invoices` 
                (`sales_invoice_no`, `clinic_location_id`, `customer_name`, `customer_phone`, `doctor_name`, `total_amount`, `discount`, `net_amount`, `payment_method`, `created_by`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $stmtHeader->execute([
                $salesInvoiceNo,
                $clinicLocId,
                $customerName,
                $customerPhone,
                $doctorName,
                $grossTotal,
                $discount,
                $netAmount,
                $body['payment_method'] ?? 'CASH',
                $user['user_id']
            ]);

            $salesInvoiceId = $pdo->lastInsertId();

            // Insert Invoice Line Items, Debit Stock, & Record Movements
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

    public function getSalesInvoices()
    {
        $user = $this->requireAuth();
        $pdo = Model::getDB();

        $rawLocId = UrlSecurity::decrypt($_GET['location_id'] ?? $_GET['clinic_location_id'] ?? null);
        $locId = !empty($rawLocId) ? (int)$rawLocId : (int)($_GET['raw_location_id'] ?? $_GET['location_id'] ?? $_GET['clinic_location_id'] ?? 0);

        if ($user['role'] !== 'ADMIN' && !empty($user['location_id'])) {
            $locId = (int)$user['location_id'];
        }

        $where = ["1=1"];
        $params = [];

        if ($locId > 0) {
            $where[] = "si.clinic_location_id = ?";
            $params[] = $locId;
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT si.*, si.sales_invoice_no AS invoice_no, l.name AS clinic_name, u.full_name AS created_by_name
                FROM `sales_invoices` si
                LEFT JOIN `locations` l ON si.clinic_location_id = l.id
                LEFT JOIN `users` u ON si.created_by = u.id
                WHERE {$whereSql}
                ORDER BY si.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $invoices = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $stmtItems = $pdo->prepare("SELECT sii.*, i.name AS item_name, i.item_code, b.batch_code, b.expiry_date
                                    FROM `sales_invoice_items` sii
                                    JOIN `items` i ON sii.item_id = i.id
                                    JOIN `item_batches` b ON sii.batch_id = b.id
                                    WHERE sii.sales_invoice_id = ?");

        foreach ($invoices as &$inv) {
            $rawId = (int)$inv['id'];
            $inv['raw_id'] = $rawId;
            $inv['id'] = UrlSecurity::encrypt($inv['id']);

            $stmtItems->execute([$rawId]);
            $inv['items'] = $stmtItems->fetchAll(\PDO::FETCH_ASSOC);
        }

        $this->json([
            'success'  => true,
            'invoices' => $invoices
        ]);
    }
}
