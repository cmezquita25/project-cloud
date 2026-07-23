<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Services\DatabaseManagerService;
use ProjectCloud\Services\ActivityLogger;

final class DatabaseController
{
    private function service(): DatabaseManagerService
    {
        return new DatabaseManagerService();
    }

    /** POST /admin/database/migrate */
    public function migrate(Request $request): Response
    {
        if (!isset($_FILES['sql_file']) || $_FILES['sql_file']['error'] !== UPLOAD_ERR_OK) {
            throw HttpException::badRequest('No se recibió el archivo SQL o hubo un error en la subida.', 'UPLOAD_ERROR');
        }

        $tmpPath = $_FILES['sql_file']['tmp_name'];
        $content = file_get_contents($tmpPath);
        if ($content === false) {
            throw new HttpException(500, 'READ_ERROR', 'No se pudo leer el archivo SQL.');
        }

        $count = $this->service()->executeMigration($content);
        
        ActivityLogger::log($request, 'database_migrate', 'system', 0, [
            'file_name' => $_FILES['sql_file']['name'] ?? 'unknown',
            'statements_executed' => $count,
        ]);

        return Response::success(['ok' => true, 'statements' => $count]);
    }

    /** POST /admin/database/migrate-auto */
    public function migrateAuto(Request $request): Response
    {
        $migrator = new \ProjectCloud\Services\SchemaMigrator();
        $count = $migrator->run();
        
        ActivityLogger::log($request, 'database_migrate_auto', 'system', 0, [
            'statements_executed' => $count,
        ]);

        return Response::success(['ok' => true, 'statements' => $count]);
    }

    /** GET /admin/database/backups */
    public function listBackups(Request $request): Response
    {
        $backups = $this->service()->listBackups();
        return Response::success(['backups' => $backups]);
    }

    /** POST /admin/database/backups */
    public function createBackup(Request $request): Response
    {
        // Esto podría tardar en bases de datos muy pesadas
        set_time_limit(300);

        $filename = $this->service()->createBackup();
        
        ActivityLogger::log($request, 'backup_create', 'system', 0, [
            'filename' => $filename,
        ]);

        return Response::created(['ok' => true, 'filename' => $filename]);
    }

    /** POST /admin/database/backups/{filename}/restore */
    public function restoreBackup(Request $request): Response
    {
        set_time_limit(600);
        $filename = (string) $request->param('filename');
        
        $this->service()->restoreBackup($filename);
        
        ActivityLogger::log($request, 'backup_restore', 'system', 0, [
            'filename' => $filename,
        ]);

        return Response::success(['ok' => true]);
    }

    /** DELETE /admin/database/backups/{filename} */
    public function deleteBackup(Request $request): Response
    {
        $filename = (string) $request->param('filename');
        $this->service()->deleteBackup($filename);
        
        ActivityLogger::log($request, 'backup_delete', 'system', 0, [
            'filename' => $filename,
        ]);

        return Response::success(['ok' => true]);
    }

    /** GET /admin/database/backups/{filename}/download */
    public function downloadBackup(Request $request): void
    {
        $filename = (string) $request->param('filename');
        $path = $this->service()->getBackupPath($filename);

        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        readfile($path);
        exit;
    }
}
