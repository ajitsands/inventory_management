<?php
// Dynamic DB Migration: Alters ALL DECIMAL columns in the database to DECIMAL(15, 3)
// Guarantees 3-decimal precision (e.g. 0.235, 0.365) for BHD, KWD, OMR without truncation

$host = 'localhost';
$user = 'root';
$pass = 'S@nds1@b';
$dbname = 'inventory_system_db';

try {
    echo "Connecting to MySQL server...\n";
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);

    // Find all columns with DATA_TYPE 'decimal' in current database
    $sql = "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND DATA_TYPE = 'decimal'";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$dbname]);
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($columns) . " DECIMAL column(s) across database tables.\n";

    foreach ($columns as $col) {
        $table = $col['TABLE_NAME'];
        $column = $col['COLUMN_NAME'];
        $nullable = $col['IS_NULLABLE'] === 'YES' ? 'NULL' : 'NOT NULL';
        
        $default = '';
        if ($col['COLUMN_DEFAULT'] !== null) {
            $default = "DEFAULT '" . $col['COLUMN_DEFAULT'] . "'";
        } else if ($col['IS_NULLABLE'] === 'YES') {
            $default = "DEFAULT NULL";
        } else {
            $default = "DEFAULT '0.000'";
        }

        $alterSql = "ALTER TABLE `$table` MODIFY COLUMN `$column` DECIMAL(15, 3) $nullable $default";
        echo "Modifying `$table`.`$column` from {$col['COLUMN_TYPE']} to DECIMAL(15, 3)...\n";
        try {
            $pdo->exec($alterSql);
            echo "Successfully updated `$table`.`$column`.\n";
        } catch (Exception $e) {
            echo "Error updating `$table`.`$column`: " . $e->getMessage() . "\n";
        }
    }

    echo "Decimal precision migration completed successfully!\n";
} catch (Exception $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
}
