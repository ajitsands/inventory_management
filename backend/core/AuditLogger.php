<?php
// Central Audit Trail Logging Service

require_once __DIR__ . '/Model.php';

class AuditLogger {
    public static function log($userId, $username, $role, $module, $action, $oldValues = null, $newValues = null, $locationId = null) {
        try {
            $pdo = Model::getDB();
            
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            
            $oldJson = is_array($oldValues) || is_object($oldValues) ? json_encode($oldValues) : (string)$oldValues;
            $newJson = is_array($newValues) || is_object($newValues) ? json_encode($newValues) : (string)$newValues;

            $stmt = $pdo->prepare("INSERT INTO `system_audit_trail` 
                (`user_id`, `username`, `role`, `ip_address`, `module`, `action`, `old_values`, `new_values`, `location_id`) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
            $stmt->execute([
                $userId,
                $username ?? 'System',
                $role ?? 'SYSTEM',
                $ipAddress,
                $module,
                $action,
                $oldJson,
                $newJson,
                $locationId
            ]);
        } catch (Exception $e) {
            error_log("AuditLogger Failure: " . $e->getMessage());
        }
    }
}
