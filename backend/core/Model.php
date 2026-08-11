<?php
// Base Model Class wrapping PDO

class Model {
    protected static $pdo = null;

    public static function getDB() {
        if (self::$pdo === null) {
            $config = require __DIR__ . '/../config/database.php';
            $dsn = "mysql:host={$config['host']};dbname={$config['database']};charset={$config['charset']}";
            self::$pdo = new PDO($dsn, $config['username'], $config['password'], $config['options']);
        }
        return self::$pdo;
    }

    public static function beginTransaction() {
        return self::getDB()->beginTransaction();
    }

    public static function commit() {
        return self::getDB()->commit();
    }

    public static function rollBack() {
        if (self::getDB()->inTransaction()) {
            return self::getDB()->rollBack();
        }
        return false;
    }
}
