<?php
require_once __DIR__ . '/../../core/Controller.php';

class AuditController extends Controller {

    public function getLogs() {
        $this->requireRoles(['ADMIN', 'AUDITOR']);
        $pdo = Model::getDB();

        $sql = "SELECT sat.*, l.name AS location_name
                FROM `system_audit_trail` sat
                LEFT JOIN `locations` l ON sat.location_id = l.id
                ORDER BY sat.id DESC LIMIT 200";

        $logs = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        $this->json([
            'success' => true,
            'logs'    => $logs
        ]);
    }
}
