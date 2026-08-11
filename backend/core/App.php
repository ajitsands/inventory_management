<?php
// App Bootstrap & Exception Handler

class App {
    public static function init() {
        error_reporting(E_ALL);
        ini_set('display_errors', '0');

        set_exception_handler(function ($e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Internal Server Error: ' . $e->getMessage()
            ]);
            exit;
        });
    }
}

App::init();
