<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../Models/Location.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class LocationController extends Controller
{
    public function index()
    {
        $locations = Location::getAllWithTransactionCheck();
        $encrypted = array_map(function($l) {
            $l['id'] = UrlSecurity::encryptId($l['id']);
            return $l;
        }, $locations);

        $this->json(['success' => true, 'locations' => $encrypted]);
    }

    public function store()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $type = trim($data['type'] ?? 'SUB_BRANCH'); // SUB_BRANCH or CLINIC
        $address = trim($data['address'] ?? '');
        $phone = trim($data['phone'] ?? '');

        if (empty($name)) {
            $this->json(['error' => 'Location name is required.'], 400);
            return;
        }

        if (!in_array($type, ['MAIN_BRANCH', 'SUB_BRANCH', 'CLINIC'])) {
            $this->json(['error' => 'Invalid location type.'], 400);
            return;
        }

        if (empty($code)) {
            $seqKey = ($type === 'CLINIC') ? 'clinic' : 'branch';
            $code = SequenceService::generateNextNumber($seqKey);
        } else {
            $existing = Location::findWhere(['code' => $code]);
            if ($existing) {
                $this->json(['error' => "Location code '{$code}' already exists."], 400);
                return;
            }
        }

        $id = Location::create([
            'name' => $name,
            'code' => $code,
            'type' => $type,
            'address' => $address,
            'phone' => $phone,
            'status' => 'ACTIVE'
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_LOCATION', 'CREATE_LOCATION', null, [
            'location_id' => $id, 'name' => $name, 'type' => $type, 'code' => $code
        ]);

        $this->json([
            'success' => true,
            'message' => "Location '{$name}' created successfully with code {$code}.",
            'location_id' => UrlSecurity::encryptId($id),
            'code' => $code
        ]);
    }

    public function update()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = $data['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'Location ID is required.'], 400);
            return;
        }

        $location = Location::find($id);
        if (!$location) {
            $this->json(['error' => 'Location not found.'], 404);
            return;
        }

        $name = trim($data['name'] ?? $location['name']);
        $address = trim($data['address'] ?? $location['address']);
        $phone = trim($data['phone'] ?? $location['phone']);

        Location::update($id, [
            'name' => $name,
            'address' => $address,
            'phone' => $phone
        ]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_LOCATION', 'UPDATE_LOCATION', $location, [
            'id' => $id, 'name' => $name
        ]);

        $this->json(['success' => true, 'message' => "Location updated successfully."]);
    }

    public function toggleStatus()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = $data['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'Location ID is required.'], 400);
            return;
        }

        $location = Location::find($id);
        if (!$location) {
            $this->json(['error' => 'Location not found.'], 404);
            return;
        }

        $newStatus = ($location['status'] === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
        Location::update($id, ['status' => $newStatus]);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_LOCATION', 'TOGGLE_LOCATION_STATUS', ['status' => $location['status']], ['status' => $newStatus]);

        $this->json([
            'success' => true,
            'message' => "Location status changed to {$newStatus}.",
            'status' => $newStatus
        ]);
    }

    public function destroy()
    {
        $user = $this->requireAuth();
        $data = $this->getRequestBody();

        $id = $data['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'Location ID is required.'], 400);
            return;
        }

        $location = Location::find($id);
        if (!$location) {
            $this->json(['error' => 'Location not found.'], 404);
            return;
        }

        if ($location['type'] === 'MAIN_BRANCH') {
            $this->json(['error' => 'Cannot delete Central Main Branch.'], 400);
            return;
        }

        if (Location::hasTransactions($id)) {
            $this->json([
                'error' => "Cannot delete location '{$location['name']}'. Existing stock transfers, sales, or assigned users are linked to this location."
            ], 400);
            return;
        }

        Location::delete($id);

        AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_LOCATION', 'DELETE_LOCATION', $location, null);

        $this->json(['success' => true, 'message' => "Location '{$location['name']}' deleted successfully."]);
    }
}
