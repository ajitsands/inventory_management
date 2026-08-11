<?php
// Single Entry Point for Pure PHP MVC API

require_once __DIR__ . '/../core/App.php';
require_once __DIR__ . '/../core/Router.php';

// Instantiate Router
$router = new Router();

// Auth Routes
$router->post('/api/v1/auth/login', ['AuthController', 'login']);
$router->get('/api/v1/auth/me', ['AuthController', 'me']);
$router->get('/api/v1/users', ['AuthController', 'getUsers']);
$router->post('/api/v1/users', ['AuthController', 'createUser']);

// Master Data & Stock
$router->get('/api/v1/master-data', ['BatchController', 'getMasterData']);
$router->get('/api/v1/stock/location', ['BatchController', 'getStockByLocation']);

// Movement Routes
$router->post('/api/v1/purchase/create', ['PurchaseController', 'createPurchaseInvoice']);
$router->get('/api/v1/purchase/list', ['PurchaseController', 'getPurchaseInvoices']);

$router->post('/api/v1/transfer/branch', ['BranchTransferController', 'createBranchTransfer']);
$router->get('/api/v1/transfer/list', ['BranchTransferController', 'getTransfers']);

$router->post('/api/v1/transfer/clinic', ['ClinicTransferController', 'createClinicTransfer']);

$router->post('/api/v1/sales/create', ['SalesController', 'createSalesInvoice']);
$router->get('/api/v1/sales/list', ['SalesController', 'getSalesInvoices']);

// Audit & Report Routes
$router->get('/api/v1/audit/logs', ['AuditController', 'getLogs']);
$router->get('/api/v1/reports/movement-ledger', ['ReportController', 'getMovementLedger']);
$router->get('/api/v1/reports/expiry-alerts', ['ReportController', 'getExpiryAlerts']);
$router->get('/api/v1/reports/valuation', ['ReportController', 'getValuation']);

// Dispatch Request
$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
