<?php
require_once __DIR__ . '/../../core/Controller.php';

class AuditController extends Controller {

    public function getLogs() {
        $this->requireRoles(['ADMIN', 'AUDITOR']);
        $pdo = Model::getDB();

        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;
        $status = $_GET['status'] ?? null;
        $module = $_GET['module'] ?? null;

        $where = ["1=1"];
        $params = [];

        if (!empty($startDate)) {
            $where[] = "DATE(sat.timestamp) >= ?";
            $params[] = $startDate;
        }

        if (!empty($endDate)) {
            $where[] = "DATE(sat.timestamp) <= ?";
            $params[] = $endDate;
        }

        if (!empty($status) && $status !== 'ALL') {
            $where[] = "sat.status = ?";
            $params[] = $status;
        }

        if (!empty($module) && $module !== 'ALL') {
            $where[] = "sat.module = ?";
            $params[] = $module;
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT sat.*, l.name AS location_name
                FROM `system_audit_trail` sat
                LEFT JOIN `locations` l ON sat.location_id = l.id
                WHERE {$whereSql}
                ORDER BY sat.id DESC LIMIT 1000";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->json([
            'success' => true,
            'logs'    => $logs
        ]);
    }
}
