<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Models/Customer.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class CustomerController extends Controller
{
    public function index()
    {
        $customers = Customer::getAllWithTransactionCheck();
        $encrypted = array_map(function($c) {
            $c['raw_id'] = (int)$c['id'];
            $c['id'] = UrlSecurity::encrypt($c['id']);
            return $c;
        }, $customers);

        $this->json(['success' => true, 'customers' => $encrypted]);
    }

    public function store()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $address = trim($data['address'] ?? '');

        if (empty($name)) {
            $this->json(['error' => 'Customer name is required.'], 400);
            return;
        }

        if (empty($code)) {
            $code = SequenceService::generateNextNumber('customer');
        } else {
            $existing = Customer::findWhere(['code' => $code]);
            if ($existing) {
                $code = SequenceService::generateNextNumber('customer');
            }
        }

        $id = Customer::create([
            'name' => $name,
            'code' => $code,
            'phone' => $phone,
            'email' => $email,
            'address' => $address,
            'status' => 'ACTIVE'
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_CUSTOMER', 'CREATE_CUSTOMER', null, [
            'customer_id' => $id, 'name' => $name, 'code' => $code
        ]);

        $this->json([
            'success' => true,
            'message' => "Customer '{$name}' created successfully with code {$code}.",
            'customer_id' => UrlSecurity::encrypt($id),
            'code' => $code
        ]);
    }

    public function update()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = UrlSecurity::decrypt($data['id'] ?? null);
        if (!$id) {
            $this->json(['error' => 'Customer ID is required.'], 400);
            return;
        }

        $customer = Customer::find($id);
        if (!$customer) {
            $this->json(['error' => 'Customer not found.'], 404);
            return;
        }

        $name = trim($data['name'] ?? $customer['name']);
        $phone = trim($data['phone'] ?? $customer['phone']);
        $email = trim($data['email'] ?? $customer['email']);
        $address = trim($data['address'] ?? $customer['address']);

        Customer::update($id, [
            'name' => $name,
            'phone' => $phone,
            'email' => $email,
            'address' => $address
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_CUSTOMER', 'UPDATE_CUSTOMER', $customer, [
            'id' => $id, 'name' => $name
        ]);

        $this->json(['success' => true, 'message' => "Customer updated successfully."]);
    }

    public function toggleStatus()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = UrlSecurity::decrypt($data['id'] ?? null);
        if (!$id) {
            $this->json(['error' => 'Customer ID is required.'], 400);
            return;
        }

        $customer = Customer::find($id);
        if (!$customer) {
            $this->json(['error' => 'Customer not found.'], 404);
            return;
        }

        $newStatus = ($customer['status'] === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
        Customer::update($id, ['status' => $newStatus]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_CUSTOMER', 'TOGGLE_CUSTOMER_STATUS', ['status' => $customer['status']], ['status' => $newStatus]);

        $this->json([
            'success' => true,
            'message' => "Customer status changed to {$newStatus}.",
            'status' => $newStatus
        ]);
    }

    public function destroy()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = UrlSecurity::decrypt($data['id'] ?? null);
        if (!$id) {
            $this->json(['error' => 'Customer ID is required.'], 400);
            return;
        }

        $customer = Customer::find($id);
        if (!$customer) {
            $this->json(['error' => 'Customer not found.'], 404);
            return;
        }

        if (Customer::hasTransactions($id, $customer['name'])) {
            $this->json([
                'error' => "Cannot delete customer '{$customer['name']}'. Dispensing sales invoices exist for this customer."
            ], 400);
            return;
        }

        Customer::delete($id);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_CUSTOMER', 'DELETE_CUSTOMER', $customer, null);

        $this->json(['success' => true, 'message' => "Customer '{$customer['name']}' deleted successfully."]);
    }
}
