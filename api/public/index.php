<?php

declare(strict_types=1);

/**
 * Project Cloud — Front Controller (stub de Fase 0).
 *
 * Toda petición /api/* entra por aquí. En la Fase 1 este archivo delegará
 * en el Router y los Middlewares del Core; por ahora responde /health para
 * verificar que el hosting sirve PHP correctamente.
 */

// Cabeceras de seguridad base (se ampliarán en Fase 1).
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Content-Type: application/json; charset=utf-8');

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$path = '/' . trim(str_replace('/api', '', $uri), '/');

if ($path === '/v1/health' || $path === '/health') {
    echo json_encode([
        'success' => true,
        'data' => [
            'status' => 'ok',
            'app' => 'Project Cloud API',
            'phase' => 0,
            'php' => PHP_VERSION,
        ],
        'error' => null,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

http_response_code(404);
echo json_encode([
    'success' => false,
    'data' => null,
    'error' => ['code' => 'NOT_FOUND', 'message' => 'Ruta no encontrada'],
], JSON_UNESCAPED_UNICODE);
