<?php
// URL Encryption Engine (AES-256-GCM) - Ensures No Open Raw IDs in URLs

class UrlSecurity {
    private static $key;
    private static $cipher = 'aes-256-gcm';

    private static function getKey() {
        if (!self::$key) {
            $config = require __DIR__ . '/../config/security.php';
            self::$key = hash('sha256', $config['secret_key'], true);
        }
        return self::$key;
    }

    /**
     * Encrypt an ID or string value into an URL-safe hex string
     */
    public static function encrypt($value) {
        if ($value === null || $value === '') return $value;
        $key = self::getKey();
        $iv = openssl_random_pseudo_bytes(12); // 96 bits for GCM
        $tag = '';
        $encrypted = openssl_encrypt((string)$value, self::$cipher, $key, OPENSSL_RAW_DATA, $iv, $tag);
        
        // Pack IV (12 bytes) + Tag (16 bytes) + Encrypted Data
        $packed = $iv . $tag . $encrypted;
        return 'enc_' . bin2hex($packed);
    }

    /**
     * Decrypt an URL-safe hex string back to original value
     */
    public static function decrypt($token) {
        if (empty($token) || !is_string($token) || strpos($token, 'enc_') !== 0) {
            return $token; // Return as-is if numeric or unencrypted
        }

        $hex = substr($token, 4);
        $bin = @hex2bin($hex);
        if (!$bin || strlen($bin) < 28) { // 12 iv + 16 tag = 28 min
            return null;
        }

        $key = self::getKey();
        $iv = substr($bin, 0, 12);
        $tag = substr($bin, 12, 16);
        $encrypted = substr($bin, 28);

        $decrypted = openssl_decrypt($encrypted, self::$cipher, $key, OPENSSL_RAW_DATA, $iv, $tag);
        return $decrypted !== false ? $decrypted : null;
    }

    /**
     * Encrypt all sensitive ID keys in an associative array before sending JSON
     */
    public static function encryptPayload($data, $keysToEncrypt = ['id', 'user_id', 'vendor_id', 'location_id', 'item_id', 'batch_id', 'purchase_invoice_id', 'transfer_id', 'sales_invoice_id', 'from_location_id', 'to_location_id', 'category_id']) {
        if (is_array($data)) {
            $result = [];
            foreach ($data as $key => $val) {
                if (in_array($key, $keysToEncrypt, true) && (is_numeric($val) || is_string($val))) {
                    $result[$key] = self::encrypt($val);
                    $result['raw_' . $key] = (int)$val; // Keep raw for internal frontend use if needed
                } elseif (is_array($val)) {
                    $result[$key] = self::encryptPayload($val, $keysToEncrypt);
                } else {
                    $result[$key] = $val;
                }
            }
            return $result;
        }
        return $data;
    }
}
