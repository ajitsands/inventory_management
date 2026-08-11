<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../../core/Model.php';
require_once __DIR__ . '/../../core/AuditLogger.php';
require_once __DIR__ . '/../../core/UrlSecurity.php';
require_once __DIR__ . '/../Services/SequenceService.php';

class DoctorController extends Controller
{
    public function index()
    {
        $this->requireAuth();
        $pdo = Model::getDB();

        $sql = "SELECT d.*, l.name AS location_name, l.code AS location_code, l.type AS location_type
                FROM `doctors` d
                JOIN `locations` l ON d.location_id = l.id
                ORDER BY d.id DESC";

        $doctors = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        foreach ($doctors as &$d) {
            $d['raw_id'] = (int)$d['id'];
            $d['raw_location_id'] = (int)$d['location_id'];
            $d['id'] = UrlSecurity::encrypt($d['id']);
            $d['location_id'] = UrlSecurity::encrypt($d['location_id']);
        }

        $this->json(['success' => true, 'doctors' => $doctors]);
    }

    public function getByLocation()
    {
        $this->requireAuth();
        $inputLocId = $_GET['location_id'] ?? null;
        $locationId = 0;

        if (is_numeric($inputLocId)) {
            $locationId = (int)$inputLocId;
        } elseif (!empty($inputLocId)) {
            $decrypted = UrlSecurity::decrypt($inputLocId);
            $locationId = !empty($decrypted) ? (int)$decrypted : 0;
        }

        if (!$locationId) {
            $this->json(['success' => true, 'doctors' => []]);
            return;
        }

        $pdo = Model::getDB();
        $sql = "SELECT d.*, l.name AS location_name
                FROM `doctors` d
                JOIN `locations` l ON d.location_id = l.id
                WHERE d.location_id = ? AND d.status = 'ACTIVE'
                ORDER BY d.name ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$locationId]);
        $doctors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($doctors as &$d) {
            $d['raw_id'] = (int)$d['id'];
            $d['raw_location_id'] = (int)$d['location_id'];
            $d['id'] = UrlSecurity::encrypt($d['id']);
            $d['location_id'] = UrlSecurity::encrypt($d['location_id']);
        }

        $this->json(['success' => true, 'doctors' => $doctors]);
    }

    public function store()
    {
        $user = $this->requireRoles(['ADMIN', 'STORE_MANAGER']);
        $data = $this->getRequestBody();

        $name = trim($data['name'] ?? '');
        $speciality = trim($data['speciality'] ?? 'General Physician');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');

        $rawLocId = UrlSecurity::decrypt($data['location_id'] ?? null);
        $locationId = !empty($rawLocId) ? (int)$rawLocId : (int)($data['raw_location_id'] ?? $data['location_id'] ?? 0);

        if (empty($name) || !$locationId) {
            $this->error('Doctor Name and Assigned Clinic / Location are required.', 400);
            return;
        }

        $pdo = Model::getDB();

        // Auto generate doctor code if not provided
        $doctorCode = trim($data['doctor_code'] ?? '');
        if (empty($doctorCode)) {
            $doctorCode = 'DOC-' . sprintf('%03d', rand(100, 999));
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO `doctors` (`doctor_code`, `name`, `speciality`, `phone`, `email`, `location_id`, `status`) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')");
            $stmt->execute([$doctorCode, $name, $speciality, $phone, $email, $locationId]);

            $docId = $pdo->lastInsertId();

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_ENTRIES', 'CREATE_DOCTOR', null, [
                'doctor_id'   => $docId,
                'doctor_code' => $doctorCode,
                'name'        => $name,
                'location_id' => $locationId
            ]);

            $this->json([
                'success' => true,
                'message' => "Doctor {$name} ({$doctorCode}) added successfully!",
                'id'      => UrlSecurity::encrypt($docId)
            ]);
        } catch (\Exception $e) {
            $this->error('Failed to create doctor: ' . $e->getMessage(), 500);
        }
    }

    public function update()
    {
        $user = $this->requireRoles(['ADMIN']);
        $data = $this->getRequestBody();

        $rawDocId = UrlSecurity::decrypt($data['id'] ?? null);
        $docId = !empty($rawDocId) ? (int)$rawDocId : (int)($data['raw_id'] ?? $data['id'] ?? 0);

        $name = trim($data['name'] ?? '');
        $speciality = trim($data['speciality'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $status = $data['status'] ?? 'ACTIVE';

        $rawLocId = UrlSecurity::decrypt($data['location_id'] ?? null);
        $locationId = !empty($rawLocId) ? (int)$rawLocId : (int)($data['raw_location_id'] ?? $data['location_id'] ?? 0);

        if (!$docId || empty($name) || !$locationId) {
            $this->error('Doctor ID, Name, and Assigned Location are required.', 400);
            return;
        }

        $pdo = Model::getDB();
        try {
            $stmt = $pdo->prepare("UPDATE `doctors` SET `name` = ?, `speciality` = ?, `phone` = ?, `email` = ?, `location_id` = ?, `status` = ? WHERE `id` = ?");
            $stmt->execute([$name, $speciality, $phone, $email, $locationId, $status, $docId]);

            AuditLogger::log($user['user_id'], $user['username'], $user['role'], 'MASTER_ENTRIES', 'UPDATE_DOCTOR', null, [
                'doctor_id'   => $docId,
                'name'        => $name,
                'location_id' => $locationId
            ]);

            $this->json([
                'success' => true,
                'message' => "Doctor {$name} updated successfully!"
            ]);
        } catch (\Exception $e) {
            $this->error('Failed to update doctor: ' . $e->getMessage(), 500);
        }
    }
}
