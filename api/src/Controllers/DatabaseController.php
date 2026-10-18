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
        $result = (new \ProjectCloud\Services\MigrationRunner())->run();

        ActivityLogger::log($request, 'database_migrate_auto', 'system', 0, $result);

        return Response::success(['ok' => true, 'statements' => count($result['applied']), 'schema' => $result]);
    }

    /** GET /admin/database/backups */
    public function listBackups(Request $request): Response
    {
        $backups = $this->service()->listBackups();
        return Response::success(['backups' => $backups]);
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
