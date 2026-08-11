<?php
// Base Controller Class

require_once __DIR__ . '/UrlSecurity.php';
require_once __DIR__ . '/AuditLogger.php';

class Controller {

    /**
     * Send JSON Response
     */
    protected function json($data, $statusCode = 200) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        
        // Auto encrypt IDs in response payload
        $encryptedPayload = UrlSecurity::encryptPayload($data);

        echo json_encode($encryptedPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Send Error JSON Response
     */
    protected function error($message, $statusCode = 400, $errors = []) {
        $this->json([
            'success' => false,
            'message' => $message,
            'errors'  => $errors
        ], $statusCode);
    }

    /**
     * Parse Request JSON Body
     */
    protected function getRequestBody() {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        // Automatically decrypt any encrypted parameter IDs in incoming payload
        return $this->decryptArrayParams($data);
    }

    private function decryptArrayParams($data) {
        if (is_array($data)) {
            $result = [];
            foreach ($data as $key => $val) {
                if (is_string($val) && strpos($val, 'enc_') === 0) {
                    $result[$key] = UrlSecurity::decrypt($val);
                } elseif (is_array($val)) {
                    $result[$key] = $this->decryptArrayParams($val);
                } else {
                    $result[$key] = $val;
                }
            }
            return $result;
        }
        return $data;
    }

    /**
     * Generate simple JWT / Auth Token for user
     */
    protected function generateAuthToken($user) {
        $secConfig = require __DIR__ . '/../config/security.php';
        $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = base64_encode(json_encode([
            'sub'         => UrlSecurity::encrypt($user['id']),
            'user_id'     => $user['id'],
            'username'    => $user['username'],
            'full_name'   => $user['full_name'],
            'role'        => $user['role'],
            'location_id' => $user['location_id'],
            'exp'         => time() + $secConfig['jwt_expiry']
        ]));

        $signature = hash_hmac('sha256', "$header.$payload", $secConfig['jwt_secret']);
        return "$header.$payload.$signature";
    }

    /**
     * Authenticate Request User from JWT Bearer Header
     */
    protected function requireAuth() {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (!$authHeader || strpos($authHeader, 'Bearer ') !== 0) {
            $this->error('Unauthorized: Missing or invalid Authorization header.', 401);
        }

        $token = substr($authHeader, 7);
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            $this->error('Unauthorized: Invalid token format.', 401);
        }

        list($headerB64, $payloadB64, $signature) = $parts;

        $secConfig = require __DIR__ . '/../config/security.php';
        $validSignature = hash_hmac('sha256', "$headerB64.$payloadB64", $secConfig['jwt_secret']);

        if (!hash_equals($validSignature, $signature)) {
            $this->error('Unauthorized: Token signature verification failed.', 401);
        }

        $payload = json_decode(base64_decode($payloadB64), true);

        if (!$payload || ($payload['exp'] ?? 0) < time()) {
            $this->error('Unauthorized: Token expired. Please log in again.', 401);
        }

        return $payload;
    }

    /**
     * Enforce Role-Based Access Control (RBAC)
     */
    protected function requireRoles(array $allowedRoles) {
        $user = $this->requireAuth();
        if (!in_array($user['role'], $allowedRoles, true)) {
            $this->error("Forbidden: Access restricted to [" . implode(', ', $allowedRoles) . "] roles.", 403);
        }
        return $user;
    }
}
