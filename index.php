<?php
// Root router for PHP built-in server (php -S localhost:3031)

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 1. Route API requests to backend MVC framework
if (strpos($uri, '/api/') === 0) {
    require_once __DIR__ . '/backend/public/index.php';
    exit;
}

// 2. Serve frontend production static files if dist exists
$distFile = __DIR__ . '/frontend/dist' . $uri;
if ($uri !== '/' && file_exists($distFile) && !is_dir($distFile)) {
    $mime = mime_content_type($distFile);
    if (str_ends_with($uri, '.css')) $mime = 'text/css';
    if (str_ends_with($uri, '.js')) $mime = 'application/javascript';
    if (str_ends_with($uri, '.png')) $mime = 'image/png';
    if (str_ends_with($uri, '.jpg')) $mime = 'image/jpeg';
    header("Content-Type: $mime");
    readfile($distFile);
    exit;
}

// 3. Fallback to built React Single Page Application (frontend/dist/index.html)
$distIndex = __DIR__ . '/frontend/dist/index.html';
if (file_exists($distIndex)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($distIndex);
    exit;
}

// 4. If dist is not built, forward to backend API info page
require_once __DIR__ . '/backend/public/index.php';
