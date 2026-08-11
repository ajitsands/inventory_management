<?php
namespace App\Models;

use Core\Model;

class Vendor extends Model
{
    protected static $table = 'vendors';

    public static function getAllWithTransactionCheck()
    {
        $sql = "SELECT v.*,
                    (SELECT COUNT(*) FROM purchase_invoices WHERE vendor_id = v.id) +
                    (SELECT COUNT(*) FROM item_batches WHERE vendor_id = v.id) AS tx_count
                FROM vendors v
                ORDER BY v.id DESC";
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
                    (SELECT COUNT(*) FROM purchase_invoices WHERE vendor_id = ?) +
                    (SELECT COUNT(*) FROM item_batches WHERE vendor_id = ?) AS total_tx";
        $row = static::queryOne($sql, [$id, $id]);
        return ($row['total_tx'] ?? 0) > 0;
    }
}
