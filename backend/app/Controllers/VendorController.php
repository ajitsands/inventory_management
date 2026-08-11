<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../Models/Vendor.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class VendorController extends Controller
{
    public function index()
    {
        $vendors = Vendor::getAllWithTransactionCheck();
        $encryptedVendors = array_map(function($v) {
            $v['id'] = UrlSecurity::encryptId($v['id']);
            return $v;
        }, $vendors);

        $this->json(['success' => true, 'vendors' => $encryptedVendors]);
    }

    public function store()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $contactPerson = trim($data['contact_person'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $address = trim($data['address'] ?? '');
        $taxId = trim($data['tax_id'] ?? '');

        if (empty($name)) {
            $this->json(['error' => 'Vendor name is required.'], 400);
            return;
        }

        // Auto-increment code if empty
        if (empty($code)) {
            $code = SequenceService::generateNextNumber('vendor');
        } else {
            $existing = Vendor::findWhere(['code' => $code]);
            if ($existing) {
                $this->json(['error' => "Vendor code '{$code}' already exists."], 400);
                return;
            }
        }

        $id = Vendor::create([
            'name' => $name,
            'code' => $code,
            'contact_person' => $contactPerson,
            'phone' => $phone,
            'email' => $email,
            'address' => $address,
            'tax_id' => $taxId,
            'status' => 'ACTIVE'
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_VENDOR', 'CREATE_VENDOR', null, [
            'vendor_id' => $id, 'name' => $name, 'code' => $code
        ]);

        $this->json([
            'success' => true,
            'message' => "Vendor '{$name}' created successfully with code {$code}.",
            'vendor_id' => UrlSecurity::encryptId($id),
            'code' => $code
        ]);
    }

    public function update()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = $data['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'Vendor ID is required.'], 400);
            return;
        }

        $vendor = Vendor::find($id);
        if (!$vendor) {
            $this->json(['error' => 'Vendor not found.'], 404);
            return;
        }

        $name = trim($data['name'] ?? $vendor['name']);
        $contactPerson = trim($data['contact_person'] ?? $vendor['contact_person']);
        $phone = trim($data['phone'] ?? $vendor['phone']);
        $email = trim($data['email'] ?? $vendor['email']);
        $address = trim($data['address'] ?? $vendor['address']);
        $taxId = trim($data['tax_id'] ?? $vendor['tax_id']);

        Vendor::update($id, [
            'name' => $name,
            'contact_person' => $contactPerson,
            'phone' => $phone,
            'email' => $email,
            'address' => $address,
            'tax_id' => $taxId
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_VENDOR', 'UPDATE_VENDOR', $vendor, [
            'id' => $id, 'name' => $name
        ]);

        $this->json(['success' => true, 'message' => "Vendor updated successfully."]);
    }

    public function toggleStatus()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = $data['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'Vendor ID is required.'], 400);
            return;
        }

        $vendor = Vendor::find($id);
        if (!$vendor) {
            $this->json(['error' => 'Vendor not found.'], 404);
            return;
        }

        $newStatus = ($vendor['status'] === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
        Vendor::update($id, ['status' => $newStatus]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_VENDOR', 'TOGGLE_VENDOR_STATUS', ['status' => $vendor['status']], ['status' => $newStatus]);

        $this->json([
            'success' => true,
            'message' => "Vendor status changed to {$newStatus}.",
            'status' => $newStatus
        ]);
    }

    public function destroy()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = $data['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'Vendor ID is required.'], 400);
            return;
        }

        $vendor = Vendor::find($id);
        if (!$vendor) {
            $this->json(['error' => 'Vendor not found.'], 404);
            return;
        }

        if (Vendor::hasTransactions($id)) {
            $this->json([
                'error' => "Cannot delete vendor '{$vendor['name']}'. Existing purchase invoices or item batches are linked to this vendor."
            ], 400);
            return;
        }

        Vendor::delete($id);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_VENDOR', 'DELETE_VENDOR', $vendor, null);

        $this->json(['success' => true, 'message' => "Vendor '{$vendor['name']}' deleted successfully."]);
    }
}
