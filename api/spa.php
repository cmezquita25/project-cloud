<?php

declare(strict_types=1);

/**
 * Entrega el index.html del frontend con el nombre de la organización en el
 * título y en las etiquetas de vista previa (ver Services/SpaShell). El
 * .htaccess raíz manda aquí las rutas de la app (SPA fallback).
 *
 * Si algo falla (sin instalar, sin BD…), envía el index.html tal cual: la app
 * nunca deja de cargar por esto.
 */

$index = dirname(__DIR__) . '/index.html';
$html = @file_get_contents($index);
if ($html === false) {
    http_response_code(404);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('X-Content-Type-Options: nosniff');

try {
    $isConfigured = require __DIR__ . '/bootstrap.php';
    if ($isConfigured) {
        $path = (string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/');
        $html = \ProjectCloud\Services\SpaShell::render($html, $path, \ProjectCloud\Services\SpaShell::origin());
    }
} catch (\Throwable $e) {
    error_log('[ProjectCloud] spa.php: ' . $e->getMessage());
}

echo $html;
