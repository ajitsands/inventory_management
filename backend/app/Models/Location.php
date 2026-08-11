<?php
namespace App\Models;

use Core\Model;

class Location extends Model
{
    protected static $table = 'locations';

    public static function getAll()
    {
        return static::all(['status' => 'ACTIVE'], 'type ASC, name ASC');
    }

    public static function getByType(string $type)
    {
        return static::all(['type' => $type, 'status' => 'ACTIVE'], 'name ASC');
    }

    public static function getAllWithTransactionCheck()
    {
        $sql = "SELECT l.*,
                    (SELECT COUNT(*) FROM purchase_invoices WHERE location_id = l.id) +
                    (SELECT COUNT(*) FROM stock_transfers WHERE from_location_id = l.id OR to_location_id = l.id) +
                    (SELECT COUNT(*) FROM sales_invoices WHERE clinic_location_id = l.id) +
                    (SELECT COUNT(*) FROM location_batch_stock WHERE location_id = l.id AND quantity_available > 0) +
                    (SELECT COUNT(*) FROM users WHERE location_id = l.id) AS tx_count
                FROM locations l
                ORDER BY l.type ASC, l.name ASC";
        $rows = static::query($sql);
        return array_map(function($row) {
            $row['tx_count'] = (int)$row['tx_count'];
            $row['has_transactions'] = $row['tx_count'] > 0;
            $row['delete_allowed'] = $row['tx_count'] === 0;
            return $row;
        }, $rows);
    }

    public static function hasTransactions($id)
    {
        $sql = "SELECT 
                    (SELECT COUNT(*) FROM purchase_invoices WHERE location_id = ?) +
                    (SELECT COUNT(*) FROM stock_transfers WHERE from_location_id = ? OR to_location_id = ?) +
                    (SELECT COUNT(*) FROM sales_invoices WHERE clinic_location_id = ?) +
                    (SELECT COUNT(*) FROM location_batch_stock WHERE location_id = ? AND quantity_available > 0) +
                    (SELECT COUNT(*) FROM users WHERE location_id = ?) AS total_tx";
        $row = static::queryOne($sql, [$id, $id, $id, $id, $id, $id]);
        return ($row['total_tx'] ?? 0) > 0;
    }
}
