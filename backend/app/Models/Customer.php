<?php
require_once __DIR__ . '/../../core/Model.php';

class Customer extends Model
{
    protected static $table = 'customers';

    public static function getAllWithTransactionCheck()
    {
        $sql = "SELECT c.*,
                    (SELECT COUNT(*) FROM sales_invoices WHERE customer_id = c.id OR customer_name = c.name) AS tx_count
                FROM customers c
                ORDER BY c.id DESC";
        $rows = static::query($sql);
        return array_map(function($row) {
            $row['tx_count'] = (int)$row['tx_count'];
            $row['has_transactions'] = $row['tx_count'] > 0;
            $row['delete_allowed'] = $row['tx_count'] === 0;
            return $row;
        }, $rows);
    }

    public static function hasTransactions($id, $name = '')
    {
        $sql = "SELECT COUNT(*) AS total_tx FROM sales_invoices WHERE customer_id = ? OR customer_name = ?";
        $row = static::queryOne($sql, [$id, $name]);
        return ($row['total_tx'] ?? 0) > 0;
    }
}
