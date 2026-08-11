<?php
namespace App\Controllers;

use Core\Controller;
use Core\Model;
use App\Services\SequenceService;
use App\Services\AuditLogger;

class SettingsController extends Controller
{
    public function index()
    {
        $settings = SequenceService::getSettings();
        $sequences = SequenceService::getSequences();

        $this->json([
            'success' => true,
            'settings' => $settings,
            'sequences' => $sequences
        ]);
    }

    public function updateSettings()
    {
        $user = $this->requireAuth();
        if ($user['role'] !== 'ADMIN') {
            $this->json(['error' => 'Admin authorization required.'], 403);
            return;
        }

        $data = $this->getRequestBody();
        $pdo = Model::getDB();

        $allowedSettings = [
            'store_name', 'timezone', 'currency_code', 'currency_symbol',
            'vat_percent', 'company_address', 'company_phone', 'company_email'
        ];

        // Automatic decimal places rule: BHD, KWD, OMR = 3 decimals; rest = 2 decimals
        $currency = $data['currency_code'] ?? 'BHD';
        $decimalPlaces = in_array($currency, ['BHD', 'KWD', 'OMR']) ? '3' : '2';
        $data['decimal_places'] = $decimalPlaces;
        $allowedSettings[] = 'decimal_places';

        $stmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");

        foreach ($allowedSettings as $key) {
            if (isset($data[$key])) {
                $stmt->execute([$key, trim($data[$key])]);
            }
        }

        AuditLogger::log($user['user_id'], 'STORE_SETTINGS', 'UPDATE_STORE_SETTINGS', null, $data);

        $this->json([
            'success' => true,
            'message' => 'Store settings updated successfully!',
            'settings' => SequenceService::getSettings()
        ]);
    }

    public function updateSequences()
    {
        $user = $this->requireAuth();
        if ($user['role'] !== 'ADMIN') {
            $this->json(['error' => 'Admin authorization required.'], 403);
            return;
        }

        $data = $this->getRequestBody();
        $sequences = $data['sequences'] ?? [];

        if (empty($sequences) || !is_array($sequences)) {
            $this->json(['error' => 'Sequences payload is required.'], 400);
            return;
        }

        $pdo = Model::getDB();
        $stmt = $pdo->prepare("UPDATE system_sequences SET prefix = ?, padding_length = ?, format_template = ? WHERE sequence_key = ?");

        foreach ($sequences as $seq) {
            if (isset($seq['sequence_key'])) {
                $stmt->execute([
                    trim($seq['prefix'] ?? ''),
                    (int)($seq['padding_length'] ?? 4),
                    trim($seq['format_template'] ?? '{PREFIX}{SEQ}'),
                    $seq['sequence_key']
                ]);
            }
        }

        AuditLogger::log($user['user_id'], 'STORE_SETTINGS', 'UPDATE_SEQUENCE_PREFIXES', null, $sequences);

        $this->json([
            'success' => true,
            'message' => 'Auto-increment prefixes and format templates updated successfully!',
            'sequences' => SequenceService::getSequences()
        ]);
    }
}
