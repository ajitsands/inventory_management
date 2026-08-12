<?php
require_once __DIR__ . '/../../core/Model.php';

class User extends Model {

    public static function findByUsername(string $username) {
        $pdo = self::getDB();
        $stmt = $pdo->prepare("SELECT u.*, l.name AS location_name, l.code AS location_code, l.type AS location_type 
                               FROM `users` u 
                               LEFT JOIN `locations` l ON u.location_id = l.id 
                               WHERE u.username = ? AND u.status = 'ACTIVE'");
        $stmt->execute([$username]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function findById(int $id) {
        $pdo = self::getDB();
        $stmt = $pdo->prepare("SELECT u.id, u.username, u.full_name, u.email, u.role, u.location_id, u.status, u.created_at,
                               l.name AS location_name, l.code AS location_code, l.type AS location_type 
                               FROM `users` u 
                               LEFT JOIN `locations` l ON u.location_id = l.id 
                               WHERE u.id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function getAll() {
        $pdo = self::getDB();
        $stmt = $pdo->query("SELECT u.id, u.username, u.full_name, u.email, u.role, u.location_id, u.status, u.created_at,
                                    l.name AS location_name, l.type AS location_type
                             FROM `users` u 
                             LEFT JOIN `locations` l ON u.location_id = l.id 
                             ORDER BY u.id ASC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function create(array $data) {
        $pdo = self::getDB();
        $hash = password_hash($data['password'], PASSWORD_BCRYPT);

        $rawLocId = $data['raw_location_id'] ?? null;
        $locToken = $data['location_id'] ?? null;

        $targetLocId = null;
        if (!empty($rawLocId) && is_numeric($rawLocId)) {
            $targetLocId = (int)$rawLocId;
        } elseif (!empty($locToken)) {
            if (is_numeric($locToken)) {
                $targetLocId = (int)$locToken;
            } else {
                $decrypted = UrlSecurity::decrypt($locToken);
                if (!empty($decrypted) && is_numeric($decrypted)) {
                    $targetLocId = (int)$decrypted;
                }
            }
        }

        if ($targetLocId !== null && $targetLocId > 0) {
            $stmtCheck = $pdo->prepare("SELECT id FROM `locations` WHERE id = ?");
            $stmtCheck->execute([$targetLocId]);
            if (!$stmtCheck->fetchColumn()) {
                $targetLocId = null;
            }
        } else {
            $targetLocId = null;
        }

        $stmt = $pdo->prepare("INSERT INTO `users` (`username`, `full_name`, `email`, `password_hash`, `role`, `location_id`) 
                               VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['username'],
            $data['full_name'],
            $data['email'],
            $hash,
            $data['role'],
            $targetLocId
        ]);
        return $pdo->lastInsertId();
    }

    public static function updateUser($id, array $data) {
        $pdo = self::getDB();

        $rawLocId = $data['raw_location_id'] ?? null;
        $locToken = $data['location_id'] ?? null;

        $targetLocId = null;
        if (!empty($rawLocId) && is_numeric($rawLocId)) {
            $targetLocId = (int)$rawLocId;
        } elseif (!empty($locToken)) {
            if (is_numeric($locToken)) {
                $targetLocId = (int)$locToken;
            } else {
                $decrypted = UrlSecurity::decrypt($locToken);
                if (!empty($decrypted) && is_numeric($decrypted)) {
                    $targetLocId = (int)$decrypted;
                }
            }
        }

        if ($targetLocId !== null && $targetLocId > 0) {
            $stmtCheck = $pdo->prepare("SELECT id FROM `locations` WHERE id = ?");
            $stmtCheck->execute([$targetLocId]);
            if (!$stmtCheck->fetchColumn()) {
                $targetLocId = null;
            }
        } else {
            $targetLocId = null;
        }

        if (!empty($data['password'])) {
            $hash = password_hash($data['password'], PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("UPDATE `users` 
                                   SET `full_name` = ?, `email` = ?, `role` = ?, `location_id` = ?, `password_hash` = ? 
                                   WHERE `id` = ?");
            $stmt->execute([
                $data['full_name'],
                $data['email'],
                $data['role'],
                $targetLocId,
                $hash,
                (int)$id
            ]);
        } else {
            $stmt = $pdo->prepare("UPDATE `users` 
                                   SET `full_name` = ?, `email` = ?, `role` = ?, `location_id` = ? 
                                   WHERE `id` = ?");
            $stmt->execute([
                $data['full_name'],
                $data['email'],
                $data['role'],
                $targetLocId,
                (int)$id
            ]);
        }
        return true;
    }

    public static function toggleStatus($id, $newStatus) {
        $pdo = self::getDB();
        $stmt = $pdo->prepare("UPDATE `users` SET `status` = ? WHERE `id` = ?");
        return $stmt->execute([$newStatus, (int)$id]);
    }
}
