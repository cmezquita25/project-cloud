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
use ProjectCloud\Controllers\SettingsController;
use ProjectCloud\Controllers\SmtpController;
use ProjectCloud\Controllers\EmailTemplateController;
use ProjectCloud\Controllers\TrashController;
use ProjectCloud\Controllers\LibraryController;
use ProjectCloud\Controllers\AssetsController;
use ProjectCloud\Controllers\DatabaseController;
use ProjectCloud\Middleware\AuthMiddleware;
use ProjectCloud\Middleware\AdminOnly;
use ProjectCloud\Middleware\RateLimit;

return static function (Router $router): void {
    // --- Diagnóstico ---
    $router->get('/v1/health', [HealthController::class, 'index']);
    $router->get('/health', [HealthController::class, 'index']); // alias de conveniencia

    // --- Fase 9: Configuraciones públicas ---
    $router->get('/v1/settings/public', [SettingsController::class, 'publicConfig']);
    $router->get('/v1/settings/logo/{type}', [SettingsController::class, 'serveLogo']);

    // Avatares de usuario (públicos, como los logos).
    $router->get('/v1/auth/avatar/{id}', [AuthController::class, 'serveAvatar']);

    // Miniaturas de imágenes (públicas; los archivos ya son públicos por URL).
    $router->get('/v1/files/{id}/thumb', [FileController::class, 'thumb']);
    $router->get('/v1/assets/thumb', [AssetsController::class, 'thumb']);

    // --- Fase 2: Instalador ---
    $router->get('/v1/install/status',    [InstallController::class, 'status']);
    $router->get('/v1/install/check',      [InstallController::class, 'check']);
    $router->post('/v1/install/database',  [InstallController::class, 'database']);
    $router->post('/v1/install/admin',     [InstallController::class, 'admin']);

    // --- Fase 3: Autenticación ---
    $router->post('/v1/auth/login',   [AuthController::class, 'login'], [new RateLimit('login', 8, 300)]);
    $router->post('/v1/auth/refresh', [AuthController::class, 'refresh'], [new RateLimit('refresh', 60, 300)]);
    $router->post('/v1/auth/logout',  [AuthController::class, 'logout']);

    // Restablecimiento de contraseña (público, con límite de tasa).
    $router->post('/v1/auth/password/forgot', [AuthController::class, 'forgotPassword'], [new RateLimit('pwforgot', 5, 900)]);
    $router->post('/v1/auth/password/reset',  [AuthController::class, 'resetPassword'], [new RateLimit('pwreset', 10, 900)]);
    $router->get('/v1/auth/password/reset/{token}/validate', [AuthController::class, 'validateResetToken']);
    $router->get('/v1/auth/me',       [AuthController::class, 'me'], [new AuthMiddleware()]);
    $router->patch('/v1/auth/me',     [AuthController::class, 'updateProfile'], [new AuthMiddleware()]);
    $router->post('/v1/auth/me/password', [AuthController::class, 'changePassword'], [new AuthMiddleware()]);
    $router->post('/v1/auth/me/avatar',   [AuthController::class, 'uploadAvatar'], [new AuthMiddleware()]);
    $router->delete('/v1/auth/me/avatar', [AuthController::class, 'deleteAvatar'], [new AuthMiddleware()]);

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

    // --- Fase 8: Unidad compartida "assets" (admin + usuarios autorizados) ---
    $router->get('/v1/assets/access',   [AssetsController::class, 'access'], $auth);
    $router->get('/v1/assets',          [AssetsController::class, 'index'], $auth);
    $router->post('/v1/assets/folder',  [AssetsController::class, 'createFolder'], $auth);
    $router->post('/v1/assets/upload',  [AssetsController::class, 'upload'], $auth);
    $router->post('/v1/assets/move',    [AssetsController::class, 'move'], $auth);
    $router->post('/v1/assets/rename',  [AssetsController::class, 'rename'], $auth);
    $router->delete('/v1/assets',       [AssetsController::class, 'delete'], $auth);

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
    $router->get('/v1/admin/charts/storage-history', [AdminController::class, 'storageHistory'], $admin);
    $router->get('/v1/admin/charts/storage-distribution', [AdminController::class, 'storageDistribution'], $admin);
    $router->get('/v1/admin/charts/workspace',    [AdminController::class, 'workspaceCharts'], $admin);
    $router->get('/v1/admin/server-info',         [AdminController::class, 'serverInfo'], $admin);
    $router->patch('/v1/admin/settings',          [AdminController::class, 'updateSettings'], $admin);
    $router->post('/v1/admin/settings/logo',      [AdminController::class, 'uploadLogo'], $admin);
    $router->get('/v1/admin/assets/permissions',  [AssetsController::class, 'permissions'], $admin);
    $router->put('/v1/admin/assets/permissions',  [AssetsController::class, 'setPermissions'], $admin);
    $router->put('/v1/admin/assets/block-actions',[AssetsController::class, 'setBlockedActions'], $admin);
    $router->post('/v1/admin/assets/activate',    [AssetsController::class, 'activate'], $admin);
    $router->put('/v1/admin/assets/folder-name',  [AssetsController::class, 'setFolderName'], $admin);
    $router->get('/v1/admin/migrate-assets',      [AdminController::class, 'migrateAssets'], $admin);
    $router->get('/v1/admin/activity',            [AdminController::class, 'activity'], $admin);
    $router->get('/v1/admin/users',               [AdminController::class, 'users'], $admin);
    $router->post('/v1/admin/users',              [AdminController::class, 'createUser'], $admin);
    $router->patch('/v1/admin/users/{id}',        [AdminController::class, 'updateUser'], $admin);
    $router->patch('/v1/admin/users/{id}/password', [AdminController::class, 'resetPassword'], $admin);
    $router->delete('/v1/admin/users/{id}',       [AdminController::class, 'deleteUser'], $admin);

    // Correo saliente (SMTP)
    $router->get('/v1/admin/smtp',        [SmtpController::class, 'get'], $admin);
    $router->patch('/v1/admin/smtp',      [SmtpController::class, 'update'], $admin);
    $router->post('/v1/admin/smtp/test',  [SmtpController::class, 'test'], $admin);

    // Plantillas de correo
    $router->get('/v1/admin/email-templates',                 [EmailTemplateController::class, 'list'], $admin);
    $router->patch('/v1/admin/email-templates/{key}',         [EmailTemplateController::class, 'update'], $admin);
    $router->post('/v1/admin/email-templates/{key}/reset',    [EmailTemplateController::class, 'reset'], $admin);
    $router->post('/v1/admin/email-templates/{key}/preview',  [EmailTemplateController::class, 'preview'], $admin);

    // Migración y Backups (Base de Datos)
    $router->post('/v1/admin/database/migrate',               [\ProjectCloud\Controllers\DatabaseController::class, 'migrate'], $admin);
    $router->post('/v1/admin/database/migrate-auto',          [\ProjectCloud\Controllers\DatabaseController::class, 'migrateAuto'], $admin);
    $router->get('/v1/admin/database/backups',                [\ProjectCloud\Controllers\DatabaseController::class, 'listBackups'], $admin);
    $router->post('/v1/admin/database/backups',               [\ProjectCloud\Controllers\DatabaseController::class, 'createBackup'], $admin);
    $router->delete('/v1/admin/database/backups/{filename}',  [\ProjectCloud\Controllers\DatabaseController::class, 'deleteBackup'], $admin);
    $router->post('/v1/admin/database/backups/{filename}/restore', [\ProjectCloud\Controllers\DatabaseController::class, 'restoreBackup'], $admin);
    $router->get('/v1/admin/database/backups/{filename}/download', [\ProjectCloud\Controllers\DatabaseController::class, 'downloadBackup'], $admin);

    // Soporte y Reportes
    $router->post('/v1/support/report', [\ProjectCloud\Controllers\SupportController::class, 'report'], $auth);
};
