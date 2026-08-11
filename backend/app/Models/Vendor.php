<?php
require_once __DIR__ . '/../../core/Model.php';

class Vendor extends Model {
    public static function getAll() {
        $pdo = self::getDB();
        return $pdo->query("SELECT * FROM `vendors` ORDER BY `name` ASC")->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function create(array $data) {
        $pdo = self::getDB();
        $stmt = $pdo->prepare("INSERT INTO `vendors` (`name`, `code`, `contact_person`, `phone`, `email`, `address`, `tax_id`) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['name'],
            $data['code'],
            $data['contact_person'] ?? null,
            $data['phone'] ?? null,
            $data['email'] ?? null,
            $data['address'] ?? null,
            $data['tax_id'] ?? null
        ]);
        return $pdo->lastInsertId();
    }
}
