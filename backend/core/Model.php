<?php
// Base Model Class wrapping PDO

class Model {
    protected static $pdo = null;
    protected static $table = '';

    public static function getDB() {
        if (self::$pdo === null) {
            $config = require __DIR__ . '/../config/database.php';
            $dsn = "mysql:host={$config['host']};dbname={$config['database']};charset={$config['charset']}";
            self::$pdo = new PDO($dsn, $config['username'], $config['password'], $config['options']);
        }
        return self::$pdo;
    }

    public static function getTable() {
        if (!empty(static::$table)) {
            return static::$table;
        }
        $className = (new ReflectionClass(get_called_class()))->getShortName();
        return strtolower($className) . 's';
    }

    public static function query($sql, $params = []) {
        $stmt = static::getDB()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function queryOne($sql, $params = []) {
        $stmt = static::getDB()->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result !== false ? $result : null;
    }

    public static function getAll() {
        $table = static::getTable();
        return static::query("SELECT * FROM `{$table}` ORDER BY `id` DESC");
    }

    public static function all($conditions = [], $orderBy = 'id DESC') {
        $table = static::getTable();
        $sql = "SELECT * FROM `{$table}`";
        $params = [];
        if (!empty($conditions)) {
            $clauses = [];
            foreach ($conditions as $k => $v) {
                $clauses[] = "`{$k}` = ?";
                $params[] = $v;
            }
            $sql .= " WHERE " . implode(' AND ', $clauses);
        }
        if ($orderBy) {
            $sql .= " ORDER BY {$orderBy}";
        }
        return static::query($sql, $params);
    }

    public static function find($id) {
        $table = static::getTable();
        return static::queryOne("SELECT * FROM `{$table}` WHERE `id` = ?", [$id]);
    }

    public static function findWhere($conditions) {
        $rows = static::all($conditions);
        return !empty($rows) ? $rows[0] : null;
    }

    public static function create(array $data) {
        $table = static::getTable();
        $fields = array_keys($data);
        $placeholders = array_fill(0, count($fields), '?');
        $sql = "INSERT INTO `{$table}` (`" . implode('`, `', $fields) . "`) VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = static::getDB()->prepare($sql);
        $stmt->execute(array_values($data));
        return static::getDB()->lastInsertId();
    }

    public static function update($id, array $data) {
        $table = static::getTable();
        $sets = [];
        $params = [];
        foreach ($data as $k => $v) {
            $sets[] = "`{$k}` = ?";
            $params[] = $v;
        }
        $params[] = $id;
        $sql = "UPDATE `{$table}` SET " . implode(', ', $sets) . " WHERE `id` = ?";
        $stmt = static::getDB()->prepare($sql);
        return $stmt->execute($params);
    }

    public static function delete($id) {
        $table = static::getTable();
        $stmt = static::getDB()->prepare("DELETE FROM `{$table}` WHERE `id` = ?");
        return $stmt->execute([$id]);
    }

    public static function beginTransaction() {
        $db = self::getDB();
        if (!$db->inTransaction()) {
            return $db->beginTransaction();
        }
        return true;
    }

    public static function commit() {
        $db = self::getDB();
        if ($db->inTransaction()) {
            return $db->commit();
        }
        return true;
    }

    public static function rollBack() {
        $db = self::getDB();
        if ($db->inTransaction()) {
            return $db->rollBack();
        }
        return true;
    }
}
