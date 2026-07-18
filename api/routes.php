<?php

declare(strict_types=1);

/**
 * Definición de rutas de la API (prefijo lógico /v1, tras normalizar /api).
 * Recibe el Router del front controller y registra los endpoints.
 *
 * A medida que avancen las fases se añaden aquí los controladores de
 * auth, folders, files, uploads y admin.
 */

use ProjectCloud\Core\Router;
use ProjectCloud\Controllers\HealthController;
use ProjectCloud\Controllers\InstallController;

return static function (Router $router): void {
    // --- Diagnóstico ---
    $router->get('/v1/health', [HealthController::class, 'index']);
    $router->get('/health', [HealthController::class, 'index']); // alias de conveniencia

    // --- Fase 2: Instalador ---
    $router->get('/v1/install/status',    [InstallController::class, 'status']);
    $router->get('/v1/install/check',      [InstallController::class, 'check']);
    $router->post('/v1/install/database',  [InstallController::class, 'database']);
    $router->post('/v1/install/admin',     [InstallController::class, 'admin']);

    // --- Fase 3: Autenticación ---
    // $router->post('/v1/auth/login',   [AuthController::class, 'login'], [new RateLimit('login', 5, 300)]);
    // $router->post('/v1/auth/refresh', [AuthController::class, 'refresh']);
    // $router->post('/v1/auth/logout',  [AuthController::class, 'logout']);
    // $router->get('/v1/auth/me',       [AuthController::class, 'me'], [new AuthMiddleware()]);
};
