<?php
require_once __DIR__ . '/../../core/Model.php';

class SequenceService
{
    public static function getSettings()
    {
        $pdo = Model::getDB();
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings");
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Ensure default fallbacks
        if (!isset($rows['currency_code'])) $rows['currency_code'] = 'BHD';
        if (!isset($rows['vat_percent'])) $rows['vat_percent'] = '10.00';
        if (!isset($rows['vat_calculation_mode'])) $rows['vat_calculation_mode'] = 'ITEM_WISE'; // ITEM_WISE, TOTAL_BILL, NO_VAT
        if (!isset($rows['price_tax_type'])) $rows['price_tax_type'] = 'EXCLUSIVE'; // EXCLUSIVE vs INCLUSIVE
        if (!isset($rows['date_format'])) $rows['date_format'] = 'DD/MM/YYYY';
        if (!isset($rows['decimal_places'])) {
            $rows['decimal_places'] = in_array($rows['currency_code'], ['BHD', 'KWD', 'OMR']) ? '3' : '2';
        }
        return $rows;
    }

    public static function getSequences()
    {
        $pdo = Model::getDB();
        $stmt = $pdo->query("SELECT * FROM system_sequences ORDER BY id ASC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function generateNextNumber($key)
    {
        $pdo = Model::getDB();
        $inTx = $pdo->inTransaction();

        if (!$inTx) {
            $pdo->beginTransaction();
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM system_sequences WHERE sequence_key = ? FOR UPDATE");
            $stmt->execute([$key]);
            $seq = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$seq) {
                if (!$inTx && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                return strtoupper(substr($key, 0, 3)) . '-' . sprintf('%04d', rand(1, 9999));
            }

            $newVal = $seq['current_val'] + 1;
            $updateStmt = $pdo->prepare("UPDATE system_sequences SET current_val = ? WHERE sequence_key = ?");
            $updateStmt->execute([$newVal, $key]);

            if (!$inTx && $pdo->inTransaction()) {
                $pdo->commit();
            }

            // Format Code / Number
            $year = date('Y');
            $paddedSeq = sprintf('%0' . $seq['padding_length'] . 'd', $newVal);

            $formatted = $seq['format_template'];
            $formatted = str_replace('{PREFIX}', $seq['prefix'], $formatted);
            $formatted = str_replace('{YEAR}', $year, $formatted);
            $formatted = str_replace('{SEQ}', $paddedSeq, $formatted);

            return $formatted;
        } catch (\Exception $e) {
            if (!$inTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
