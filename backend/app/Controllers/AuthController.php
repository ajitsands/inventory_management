<?php
require_once __DIR__ . '/../../core/Controller.php';
require_once __DIR__ . '/../Models/User.php';

class AuthController extends Controller {

    public function login() {
        $data = $this->getRequestBody();

        $username = trim($data['username'] ?? '');
        $password = trim($data['password'] ?? '');

        if (empty($username) || empty($password)) {
            $this->error('Username and password are required.', 400);
        }

        $user = User::findByUsername($username);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            AuditLogger::log(null, $username, 'UNAUTHENTICATED', 'AUTH', 'LOGIN_FAILED', null, ['reason' => 'Invalid credentials']);
            $this->error('Invalid username or password.', 401);
        }

        $token = $this->generateAuthToken($user);

        // Sanitize return object
        unset($user['password_hash']);

        AuditLogger::log($user['id'], $user['username'], $user['role'], 'AUTH', 'LOGIN_SUCCESS', null, ['user_id' => $user['id']], $user['location_id']);

        $this->json([
            'success' => true,
            'message' => 'Login successful.',
            'token'   => $token,
            'user'    => $user
        ]);
    }

    public function me() {
        $authUser = $this->requireAuth();
        $user = User::findById($authUser['user_id']);
        if (!$user) {
            $this->error('User not found.', 404);
        }
        $this->json([
            'success' => true,
            'user'    => $user
        ]);
    }

    public function getUsers() {
        $this->requireRoles(['ADMIN', 'AUDITOR']);
        $users = User::getAll();
        $this->json([
            'success' => true,
            'users'   => $users
        ]);
    }

    public function createUser() {
        $currentUser = $this->requireRoles(['ADMIN']);
        $body = $this->getRequestBody();

        if (empty($body['username']) || empty($body['full_name']) || empty($body['email']) || empty($body['password']) || empty($body['role'])) {
            $this->error('All required user fields must be provided.', 400);
        }

        $userId = User::create($body);

        AuditLogger::log($currentUser['user_id'], $currentUser['username'], $currentUser['role'], 'USER_MGMT', 'CREATE_USER', null, ['new_user_id' => $userId, 'role' => $body['role']], $currentUser['location_id']);

        $this->json([
            'success' => true,
            'message' => 'User created successfully.',
            'user_id' => $userId
        ]);
    }

    public function updateUser() {
        $currentUser = $this->requireRoles(['ADMIN']);
        $body = $this->getRequestBody();

        $rawUserId = UrlSecurity::decrypt($body['user_id'] ?? null);
        $userId = !empty($rawUserId) ? (int)$rawUserId : (int)($body['raw_user_id'] ?? $body['user_id'] ?? 0);

        if (!$userId || empty($body['full_name']) || empty($body['email']) || empty($body['role'])) {
            $this->error('User ID, full name, email, and role are required.', 400);
            return;
        }

        User::updateUser($userId, $body);

        AuditLogger::log($currentUser['user_id'], $currentUser['username'], $currentUser['role'], 'USER_MGMT', 'UPDATE_USER', null, ['target_user_id' => $userId, 'role' => $body['role']], $currentUser['location_id']);

        $this->json([
            'success' => true,
            'message' => 'User permissions and details updated successfully.'
        ]);
    }

    public function toggleUserStatus() {
        $currentUser = $this->requireRoles(['ADMIN']);
        $body = $this->getRequestBody();

        $rawUserId = UrlSecurity::decrypt($body['user_id'] ?? null);
        $userId = !empty($rawUserId) ? (int)$rawUserId : (int)($body['raw_user_id'] ?? $body['user_id'] ?? 0);

        $newStatus = ($body['status'] === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE';

        if (!$userId) {
            $this->error('Valid User ID required.', 400);
            return;
        }

        User::toggleStatus($userId, $newStatus);

        AuditLogger::log($currentUser['user_id'], $currentUser['username'], $currentUser['role'], 'USER_MGMT', 'TOGGLE_USER_STATUS', null, ['target_user_id' => $userId, 'status' => $newStatus], $currentUser['location_id']);

        $this->json([
            'success' => true,
            'message' => "User account set to {$newStatus}."
        ]);
    }
}
