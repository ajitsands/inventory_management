<?php
// Pure PHP Lightweight Regex Router

require_once __DIR__ . '/UrlSecurity.php';

class Router {
    private array $routes = [];

    public function add(string $method, string $path, $handler) {
        // Convert route parameters like {id} or {code} to regex match groups
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<\1>[^/]+)', $path);
        $pattern = "#^" . $pattern . "$#";

        $this->routes[] = [
            'method'  => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler
        ];
    }

    public function get(string $path, $handler) {
        $this->add('GET', $path, $handler);
    }

    public function post(string $path, $handler) {
        $this->add('POST', $path, $handler);
    }

    public function put(string $path, $handler) {
        $this->add('PUT', $path, $handler);
    }

    public function delete(string $path, $handler) {
        $this->add('DELETE', $path, $handler);
    }

    public function dispatch(string $method, string $uri) {
        // Handle OPTIONS preflight requests for CORS
        if ($method === 'OPTIONS') {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            http_response_code(200);
            exit;
        }

        // Clean URI query string
        $path = parse_url($uri, PHP_URL_PATH);
        
        // Strip base path if hosted in subdirectory (e.g., /inventory_system/backend/public)
        $scriptName = dirname($_SERVER['SCRIPT_NAME']);
        if ($scriptName !== '/' && strpos($path, $scriptName) === 0) {
            $path = substr($path, strlen($scriptName));
        }
        $path = '/' . trim($path, '/');

        foreach ($this->routes as $route) {
            if ($route['method'] === strtoupper($method) && preg_match($route['pattern'], $path, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

                // Auto-decrypt encrypted parameter tokens in URL paths or query params
                foreach ($params as $k => $v) {
                    if (strpos($v, 'enc_') === 0) {
                        $params[$k] = UrlSecurity::decrypt($v);
                    }
                }

                // If handler is [ControllerClass, 'methodName']
                if (is_array($route['handler'])) {
                    list($controllerClass, $methodName) = $route['handler'];
                    require_once __DIR__ . "/../app/Controllers/$controllerClass.php";
                    $controller = new $controllerClass();
                    return call_user_func_array([$controller, $methodName], $params);
                }

                if (is_callable($route['handler'])) {
                    return call_user_func_array($route['handler'], $params);
                }
            }
        }

        // 404 Not Found
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'API Route Not Found', 'path' => $path]);
        exit;
    }
}
