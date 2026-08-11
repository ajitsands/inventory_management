<?php
require_once __DIR__ . '/../../core/Model.php';

class SequenceService
{
    public static function getSettings()
    {
        $pdo = Model::getDB();
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings");
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Ensure default fallback if empty
        if (!isset($rows['currency_code'])) $rows['currency_code'] = 'BHD';
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
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare("SELECT * FROM system_sequences WHERE sequence_key = ? FOR UPDATE");
            $stmt->execute([$key]);
            $seq = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$seq) {
                // Fallback default
                $pdo->rollBack();
                return strtoupper(substr($key, 0, 3)) . '-' . sprintf('%04d', rand(1, 9999));
            }

            $newVal = $seq['current_val'] + 1;
            $updateStmt = $pdo->prepare("UPDATE system_sequences SET current_val = ? WHERE sequence_key = ?");
            $updateStmt->execute([$newVal, $key]);

            $pdo->commit();

            // Format Code / Number
            $year = date('Y');
            $paddedSeq = sprintf('%0' . $seq['padding_length'] . 'd', $newVal);

            $formatted = $seq['format_template'];
            $formatted = str_replace('{PREFIX}', $seq['prefix'], $formatted);
            $formatted = str_replace('{YEAR}', $year, $formatted);
            $formatted = str_replace('{SEQ}', $paddedSeq, $formatted);

            return $formatted;
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
