<?php
require_once __DIR__ . '/../../core/Model.php';

class Location extends Model {
    public static function getAll() {
        $pdo = self::getDB();
        return $pdo->query("SELECT * FROM `locations` WHERE `status` = 'ACTIVE' ORDER BY `type` ASC, `name` ASC")->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function getByType(string $type) {
        $pdo = self::getDB();
        $stmt = $pdo->prepare("SELECT * FROM `locations` WHERE `type` = ? AND `status` = 'ACTIVE' ORDER BY `name` ASC");
        $stmt->execute([$type]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
