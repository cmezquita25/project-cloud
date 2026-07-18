<?php

declare(strict_types=1);

/**
 * Project Cloud — Front Controller.
 *
 * Punto de entrada único de la API. Toda petición /api/* se enruta aquí desde
 * el .htaccess raíz. Flujo:
 *   bootstrap (autoloader + config) → CORS (dev) → Router → Response JSON.
 *
 * Las subcarpetas sensibles (src/, config/) quedan protegidas por sus propios
 * .htaccess y porque cualquier acceso a /api/* pasa por este controlador.
 */

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Router;
use ProjectCloud\Middleware\Cors;

$isConfigured = require __DIR__ . '/bootstrap.php';

// Cabeceras de seguridad base para todas las respuestas de la API.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

// CORS de desarrollo: si es preflight (OPTIONS), responde y termina.
if (Cors::handle()) {
    exit;
}

try {
    $request = Request::capture();

    // Rutas siempre disponibles aunque la app no esté instalada.
    $isInstallRoute = str_starts_with($request->path, '/v1/install');
    $isHealthRoute = $request->path === '/health' || $request->path === '/v1/health';

    if (!$isConfigured && !$isInstallRoute && !$isHealthRoute) {
        Response::error('NOT_INSTALLED', 'La aplicación aún no está instalada.', 503)->send();
        exit;
    }

    $router = new Router();
    /** @var callable(Router):void $register */
    $register = require __DIR__ . '/routes.php';
    $register($router);

    $response = $router->dispatch($request);
} catch (HttpException $e) {
    $response = Response::fromException($e);
} catch (\Throwable $e) {
    // Registra siempre el detalle real en el log del servidor.
    error_log('[ProjectCloud] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());

    // Exponemos el detalle en desarrollo o MIENTRAS la app no esté instalada
    // (sin install.lock), para facilitar el diagnóstico del despliegue.
    // Una vez instalada, se ocultan automáticamente.
    $isDev = \ProjectCloud\Core\Config::get('env', 'production') === 'development';
    $notInstalled = !is_file(__DIR__ . '/config/install.lock');
    $expose = $isDev || $notInstalled;

    $response = Response::error(
        'SERVER_ERROR',
        $expose ? $e->getMessage() : 'Error interno del servidor',
        500,
        $expose ? ['file' => basename($e->getFile()), 'line' => $e->getLine()] : null
    );
}

$response->send();
