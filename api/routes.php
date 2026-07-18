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
use ProjectCloud\Controllers\AuthController;
use ProjectCloud\Controllers\FolderController;
use ProjectCloud\Controllers\FileController;
use ProjectCloud\Controllers\UploadController;
use ProjectCloud\Controllers\QuotaController;
use ProjectCloud\Controllers\AdminController;
use ProjectCloud\Controllers\TrashController;
use ProjectCloud\Controllers\LibraryController;
use ProjectCloud\Middleware\AuthMiddleware;
use ProjectCloud\Middleware\AdminOnly;
use ProjectCloud\Middleware\RateLimit;

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
    $router->post('/v1/auth/login',   [AuthController::class, 'login'], [new RateLimit('login', 8, 300)]);
    $router->post('/v1/auth/refresh', [AuthController::class, 'refresh'], [new RateLimit('refresh', 60, 300)]);
    $router->post('/v1/auth/logout',  [AuthController::class, 'logout']);
    $router->get('/v1/auth/me',       [AuthController::class, 'me'], [new AuthMiddleware()]);

    // --- Fase 4: Explorador de archivos (requiere sesión) ---
    $auth = [new AuthMiddleware()];

    // Carpetas
    $router->get('/v1/folders/{id}/children', [FolderController::class, 'children'], $auth);
    $router->post('/v1/folders',              [FolderController::class, 'create'], $auth);
    $router->patch('/v1/folders/{id}',        [FolderController::class, 'update'], $auth);
    $router->post('/v1/folders/{id}/copy',    [FolderController::class, 'copy'], $auth);
    $router->delete('/v1/folders/{id}',       [FolderController::class, 'delete'], $auth);

    // Archivos
    $router->patch('/v1/files/{id}',           [FileController::class, 'update'], $auth);
    $router->post('/v1/files/{id}/duplicate',  [FileController::class, 'duplicate'], $auth);
    $router->post('/v1/files/{id}/copy',       [FileController::class, 'copy'], $auth);
    $router->get('/v1/files/{id}/url',         [FileController::class, 'url'], $auth);
    $router->delete('/v1/files/{id}',          [FileController::class, 'delete'], $auth);

    // --- Fase 5: Subidas por chunks ---
    $router->post('/v1/uploads/init',            [UploadController::class, 'init'], $auth);
    $router->post('/v1/uploads/{id}/chunk',      [UploadController::class, 'chunk'], $auth);
    $router->post('/v1/uploads/{id}/complete',   [UploadController::class, 'complete'], $auth);
    $router->delete('/v1/uploads/{id}',          [UploadController::class, 'cancel'], $auth);

    // --- Fase 6: Cuota (usuario) ---
    $router->get('/v1/quota', [QuotaController::class, 'index'], $auth);

    // --- Fase 7: Recientes, destacados y búsqueda ---
    $router->get('/v1/recent',  [LibraryController::class, 'recent'], $auth);
    $router->get('/v1/starred', [LibraryController::class, 'starred'], $auth);
    $router->get('/v1/search',  [LibraryController::class, 'search'], $auth);

    // --- Fase 7: Papelera ---
    $router->get('/v1/trash',                      [TrashController::class, 'index'], $auth);
    $router->delete('/v1/trash',                   [TrashController::class, 'empty'], $auth);
    $router->post('/v1/trash/files/{id}/restore',  [TrashController::class, 'restoreFile'], $auth);
    $router->post('/v1/trash/folders/{id}/restore', [TrashController::class, 'restoreFolder'], $auth);
    $router->delete('/v1/trash/files/{id}',        [TrashController::class, 'purgeFile'], $auth);
    $router->delete('/v1/trash/folders/{id}',      [TrashController::class, 'purgeFolder'], $auth);

    // --- Fase 6: Administración (requiere admin) ---
    $admin = [new AuthMiddleware(), new AdminOnly()];
    $router->get('/v1/admin/stats',               [AdminController::class, 'stats'], $admin);
    $router->get('/v1/admin/activity',            [AdminController::class, 'activity'], $admin);
    $router->get('/v1/admin/users',               [AdminController::class, 'users'], $admin);
    $router->post('/v1/admin/users',              [AdminController::class, 'createUser'], $admin);
    $router->patch('/v1/admin/users/{id}',        [AdminController::class, 'updateUser'], $admin);
    $router->patch('/v1/admin/users/{id}/password', [AdminController::class, 'resetPassword'], $admin);
    $router->delete('/v1/admin/users/{id}',       [AdminController::class, 'deleteUser'], $admin);
};
