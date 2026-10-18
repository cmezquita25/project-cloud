<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Paths;
use ZipArchive;

final class DatabaseManagerService
{
    /** Marca final del dump: si falta, el volcado quedó incompleto. */
    public const DUMP_END_MARKER = '-- END OF DUMP';

    /** Filas por sentencia INSERT en el dump (equilibrio entre tamaño y velocidad). */
    private const INSERT_BATCH_ROWS = 200;

    /** En la raíz de storage: carpetas que no se copian (temporales o de sistema). */
    private const STORAGE_ROOT_EXCLUDES = ['backups', '.uploads', '.ratelimit'];

    private readonly string $storageRoot;
    private readonly string $backupsDir;

    public function __construct()
    {
        $root = (string) Config::get('storage.path', '');
        $this->storageRoot = rtrim($root, '/\\');
        // Las copias viven en api/var/backups (privado). Antes estaban en
        // storage/backups, que es público por URL directa.
        $this->backupsDir = Paths::var('backups');
        $this->migrateLegacyBackups();
    }

    /**
     * Ejecuta sentencias SQL directamente sobre la base de datos (para actualizaciones).
     * Ignora los errores idempotentes ("already exists", "duplicate…").
     */
    public function executeMigration(string $sqlContent): int
    {
        $pdo = Database::pdo();

        $count = 0;
        foreach (SqlStatementReader::fromString($sqlContent) as $statement) {
            try {
                $pdo->exec($statement);
                $count++;
            } catch (\PDOException $e) {
                $msg = strtolower($e->getMessage());
                if (
                    !str_contains($msg, 'already exists') &&
                    !str_contains($msg, 'duplicate column') &&
                    !str_contains($msg, 'duplicate key') &&
                    !str_contains($msg, 'duplicate entry')
                ) {
                    throw new HttpException(500, 'MIGRATION_ERROR', 'Error al ejecutar SQL: ' . $e->getMessage());
                }
            }
        }
        return max(1, $count);
    }

    /** Atributo de consultas con búfer (PHP 8.5 lo movió a Pdo\Mysql y depreca el antiguo). */
    private static function bufferedQueryAttr(): int
    {
        return defined('Pdo\Mysql::ATTR_USE_BUFFERED_QUERY')
            ? \Pdo\Mysql::ATTR_USE_BUFFERED_QUERY
            : PDO::MYSQL_ATTR_USE_BUFFERED_QUERY;
    }

    /**
     * Escribe un volcado completo de la base de datos (estructuras e inserts)
     * directamente a un archivo, sin cargarlo entero en memoria.
     */
    private function writeDatabaseDump(string $path): void
    {
        $out = fopen($path, 'wb');
        if ($out === false) {
            throw new HttpException(500, 'BACKUP_FAILED', 'No se pudo escribir el volcado de la base de datos.');
        }

        $pdo = Database::pdo();
        $buffered = $pdo->getAttribute(self::bufferedQueryAttr());

        try {
            fwrite($out, "-- Project Cloud - Database Backup\n");
            fwrite($out, '-- Generado: ' . gmdate('Y-m-d H:i:s') . " UTC\n");
            fwrite($out, '-- Version: ' . AppVersion::current() . "\n\n");
            fwrite($out, "SET NAMES utf8mb4;\n");
            fwrite($out, "SET FOREIGN_KEY_CHECKS = 0;\n\n");

            $tables = [];
            $stmt = $pdo->query('SHOW TABLES');
            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                $tables[] = (string) $row[0];
            }

            foreach ($tables as $table) {
                fwrite($out, "DROP TABLE IF EXISTS `$table`;\n");
                $createRow = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
                if (isset($createRow['Create Table'])) {
                    fwrite($out, $createRow['Create Table'] . ";\n\n");
                }

                // Lectura sin búfer: las filas llegan en streaming desde MySQL.
                // quote() no consulta al servidor, así que es seguro mientras
                // el cursor sigue abierto.
                $pdo->setAttribute(self::bufferedQueryAttr(), false);
                $rows = $pdo->query("SELECT * FROM `$table`");
                $columns = null;
                $batch = [];
                while ($row = $rows->fetch(PDO::FETCH_ASSOC)) {
                    $columns ??= implode(', ', array_map(static fn(string $k): string => "`$k`", array_keys($row)));
                    $values = array_map(static fn($v): string => $v === null ? 'NULL' : $pdo->quote((string) $v), array_values($row));
                    $batch[] = '(' . implode(', ', $values) . ')';
                    if (count($batch) >= self::INSERT_BATCH_ROWS) {
                        fwrite($out, "INSERT INTO `$table` ($columns) VALUES\n" . implode(",\n", $batch) . ";\n");
                        $batch = [];
                    }
                }
                $rows->closeCursor();
                $pdo->setAttribute(self::bufferedQueryAttr(), $buffered);

                if ($batch !== []) {
                    fwrite($out, "INSERT INTO `$table` ($columns) VALUES\n" . implode(",\n", $batch) . ";\n");
                }
                fwrite($out, "\n");
            }

            fwrite($out, "SET FOREIGN_KEY_CHECKS = 1;\n");
            fwrite($out, self::DUMP_END_MARKER . "\n");
        } finally {
            $pdo->setAttribute(self::bufferedQueryAttr(), $buffered);
            fclose($out);
        }
    }

    /**
     * Crea el backup en ZIP: volcado SQL, configuración y un manifiesto
     * `backup.json`. La copia completa ('full') añade el storage de usuarios
     * (con papeleras y logos) y la unidad compartida; la de sistema ('system')
     * solo lleva base de datos y configuración (segundos, pocos MB).
     *
     * @param string      $scope full | system
     * @param string|null $label Etiqueta en el nombre (p. ej. "pre-update-2.1.1").
     */
    public function createBackup(string $scope = 'full', ?string $label = null): string
    {
        if (!class_exists('ZipArchive')) {
            throw new HttpException(500, 'NO_ZIP_ARCHIVE', 'La extensión ZipArchive de PHP no está instalada en el servidor.');
        }

        $full = $scope !== 'system';
        $timestamp = gmdate('Y-m-d_H-i-s');
        $suffix = $label !== null ? '_' . preg_replace('/[^a-z0-9.-]+/', '-', strtolower($label)) : '';
        $filename = "backup_{$timestamp}{$suffix}.zip";
        $zipPath = $this->backupsDir . DIRECTORY_SEPARATOR . $filename;
        $dumpPath = Paths::var('tmp') . DIRECTORY_SEPARATOR . 'dump_' . bin2hex(random_bytes(6)) . '.sql';

        try {
            $this->writeDatabaseDump($dumpPath);

            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new HttpException(500, 'BACKUP_FAILED', 'No se pudo crear el archivo ZIP para el backup.');
            }

            // 1. Base de datos
            $zip->addFile($dumpPath, 'database_dump.sql');

            // 2. Storage
            if ($full) {
                $this->addFolderToZip($this->storageRoot, $zip, 'storage');
            }

            // 3. Configuración
            $configDir = Paths::apiRoot() . DIRECTORY_SEPARATOR . 'config';
            foreach (['config.php', 'install.lock'] as $configFile) {
                if (is_file($configDir . DIRECTORY_SEPARATOR . $configFile)) {
                    $zip->addFile($configDir . DIRECTORY_SEPARATOR . $configFile, 'config/' . $configFile);
                }
            }

            // 4. Unidad compartida (assets)
            $assetsRoot = (new AssetsService())->rootPath();
            $assetsFolder = $full && is_dir($assetsRoot) ? basename($assetsRoot) : null;
            if ($assetsFolder !== null) {
                $this->addFolderToZip($assetsRoot, $zip, $assetsFolder);
            }

            // 5. Manifiesto de la copia (lo usará el diagnóstico de restauración).
            $version = AppVersion::info();
            $zip->addFromString('backup.json', (string) json_encode([
                'format'      => 1,
                'app_version' => $version['version'],
                'schema'      => $version['schema'],
                'created_at'  => gmdate('c'),
                'scope'       => $full ? 'full' : 'system',
                'label'       => $label,
                'includes'    => array_values(array_filter([
                    'database',
                    'config',
                    $full ? 'storage' : null,
                    $assetsFolder !== null ? 'shared_unit' : null,
                ])),
                'shared_unit_folder' => $assetsFolder,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            // close() es quien lee los archivos añadidos: el dump debe existir hasta aquí.
            if ($zip->close() !== true) {
                throw new HttpException(500, 'BACKUP_FAILED', 'No se pudo completar el archivo ZIP del backup.');
            }
        } catch (\Throwable $e) {
            @unlink($zipPath);
            throw $e;
        } finally {
            @unlink($dumpPath);
        }

        return $filename;
    }

    /**
     * Añade recursivamente los archivos al zip. En la raíz de storage excluye
     * las carpetas temporales y la antigua carpeta de backups.
     */
    private function addFolderToZip(string $folder, ZipArchive $zip, string $zipDir = ''): void
    {
        $handle = opendir($folder);
        if ($handle === false) {
            return;
        }

        while (($entry = readdir($handle)) !== false) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            if ($folder === $this->storageRoot && in_array($entry, self::STORAGE_ROOT_EXCLUDES, true)) {
                continue;
            }

            $path = $folder . DIRECTORY_SEPARATOR . $entry;
            $localPath = $zipDir !== '' ? $zipDir . '/' . $entry : $entry;

            if (is_dir($path)) {
                $zip->addEmptyDir($localPath);
                $this->addFolderToZip($path, $zip, $localPath);
            } elseif (is_file($path)) {
                $zip->addFile($path, $localPath);
            }
        }
        closedir($handle);
    }

    /**
     * Devuelve una lista de los backups disponibles.
     */
    public function listBackups(): array
    {
        $backups = [];
        foreach (glob($this->backupsDir . DIRECTORY_SEPARATOR . '*.zip') ?: [] as $path) {
            $mtime = filemtime($path);
            $name = basename($path);
            $backups[] = [
                'filename' => $name,
                'size_bytes' => filesize($path),
                'created_at' => $mtime ? gmdate('Y-m-d H:i:s', $mtime) : null,
                'kind' => str_contains($name, '_pre-update-') ? 'pre-update' : 'manual',
            ];
        }

        // Ordenar más recientes primero
        usort($backups, static fn($a, $b) => $b['created_at'] <=> $a['created_at']);

        return $backups;
    }

    /**
     * Restaura un backup: ejecuta el volcado SQL sentencia por sentencia y
     * reemplaza configuración y archivos.
     */
    public function restoreBackup(string $filename): void
    {
        $zipPath = $this->getBackupPath($filename);

        if (!class_exists('ZipArchive')) {
            throw new HttpException(500, 'NO_ZIP_ARCHIVE', 'La extensión ZipArchive no está habilitada.');
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new HttpException(500, 'RESTORE_FAILED', 'No se pudo abrir el archivo ZIP.');
        }

        $tempExtractDir = Paths::var('tmp') . DIRECTORY_SEPARATOR . 'restore_' . bin2hex(random_bytes(6));
        @mkdir($tempExtractDir, 0775, true);

        try {
            if (!$zip->extractTo($tempExtractDir)) {
                throw new HttpException(500, 'RESTORE_FAILED', 'No se pudo extraer el archivo ZIP.');
            }
            $zip->close();

            // 1. Base de datos
            $dumpFile = $tempExtractDir . DIRECTORY_SEPARATOR . 'database_dump.sql';
            if (is_file($dumpFile)) {
                $this->runDumpFile($dumpFile);
            }

            // 2. Configuración (si existía en el backup)
            $extractedConfig = $tempExtractDir . DIRECTORY_SEPARATOR . 'config';
            if (is_dir($extractedConfig)) {
                $this->copyRecursive($extractedConfig, Paths::apiRoot() . DIRECTORY_SEPARATOR . 'config');
            }

            // 3. Directorios de almacenamiento: 'storage' va a storage.path y el
            //    resto (unidad compartida) al mismo nivel que storage.
            $skip = ['.', '..', 'config'];
            foreach (scandir($tempExtractDir) ?: [] as $entry) {
                $extractedPath = $tempExtractDir . DIRECTORY_SEPARATOR . $entry;
                if (in_array($entry, $skip, true) || !is_dir($extractedPath)) {
                    continue;
                }
                $target = $entry === 'storage'
                    ? $this->storageRoot
                    : dirname($this->storageRoot) . DIRECTORY_SEPARATOR . $entry;
                $this->copyRecursive($extractedPath, $target);
            }
        } finally {
            $this->deleteRecursive($tempExtractDir);
        }
    }

    /** Ejecuta un volcado completo sentencia por sentencia (estricto: cualquier error aborta). */
    private function runDumpFile(string $dumpFile): void
    {
        $handle = fopen($dumpFile, 'rb');
        if ($handle === false) {
            throw new HttpException(500, 'RESTORE_FAILED', 'No se pudo leer el volcado de la base de datos.');
        }

        $pdo = Database::pdo();
        $index = 0;
        try {
            foreach (SqlStatementReader::fromHandle($handle) as $statement) {
                $index++;
                try {
                    $pdo->exec($statement);
                } catch (\PDOException $e) {
                    throw new HttpException(500, 'RESTORE_SQL_ERROR', "Error en la sentencia #{$index} del volcado: " . $e->getMessage());
                }
            }
        } finally {
            fclose($handle);
            // Por si el volcado se cortó antes de reactivarlas.
            $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }

    /**
     * Conserva solo las $keep copias más recientes cuyo nombre lleva la etiqueta
     * dada (p. ej. las copias pre-actualización tienen su propia cola de 1).
     */
    public function pruneLabeled(string $labelPrefix, int $keep, ?string $except = null): void
    {
        $matches = array_values(array_filter(
            $this->listBackups(),
            static fn(array $b): bool => str_contains($b['filename'], '_' . $labelPrefix) && $b['filename'] !== $except
        ));
        foreach (array_slice($matches, max(0, $keep - ($except !== null ? 1 : 0))) as $old) {
            $this->deleteBackup($old['filename']);
        }
    }

    public function deleteBackup(string $filename): void
    {
        $zipPath = $this->backupsDir . DIRECTORY_SEPARATOR . basename($filename);
        if (file_exists($zipPath)) {
            @unlink($zipPath);
        }
    }

    public function getBackupPath(string $filename): string
    {
        $path = $this->backupsDir . DIRECTORY_SEPARATOR . basename($filename);
        if (!is_file($path)) {
            throw new HttpException(404, 'NOT_FOUND', 'El archivo de backup no existe.');
        }
        return $path;
    }

    /**
     * Mueve las copias de la ubicación antigua (storage/backups, pública por
     * URL) a api/var/backups y deja bloqueada la ruta antigua en el .htaccess
     * de storage. Idempotente: si no queda nada que mover, no hace nada.
     */
    private function migrateLegacyBackups(): void
    {
        if ($this->storageRoot === '') {
            return;
        }

        $legacy = $this->storageRoot . DIRECTORY_SEPARATOR . 'backups';
        if (is_dir($legacy)) {
            foreach (glob($legacy . DIRECTORY_SEPARATOR . '*.zip') ?: [] as $file) {
                $target = $this->backupsDir . DIRECTORY_SEPARATOR . basename($file);
                if (!file_exists($target)) {
                    @rename($file, $target);
                }
            }
            @rmdir($legacy); // solo se borra si quedó vacía
        }

        $htaccess = $this->storageRoot . DIRECTORY_SEPARATOR . '.htaccess';
        if (is_file($htaccess)) {
            $content = (string) @file_get_contents($htaccess);
            if (!str_contains($content, '^/storage/backups')) {
                @file_put_contents(
                    $htaccess,
                    rtrim($content) . "\n\n# 5. Copias de seguridad antiguas (ahora viven en api/var/backups, fuera de la web).\nRedirectMatch 404 ^/storage/backups\n",
                    LOCK_EX
                );
            }
        }
    }

    private function copyRecursive(string $src, string $dst): void
    {
        if (is_dir($src)) {
            @mkdir($dst, 0775, true);
            $handle = opendir($src);
            if ($handle !== false) {
                while (($entry = readdir($handle)) !== false) {
                    if ($entry === '.' || $entry === '..') {
                        continue;
                    }
                    $this->copyRecursive(
                        $src . DIRECTORY_SEPARATOR . $entry,
                        $dst . DIRECTORY_SEPARATOR . $entry
                    );
                }
                closedir($handle);
            }
        } elseif (is_file($src)) {
            @copy($src, $dst);
        }
    }

    private function deleteRecursive(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $handle = opendir($dir);
        if ($handle !== false) {
            while (($entry = readdir($handle)) !== false) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                $path = $dir . DIRECTORY_SEPARATOR . $entry;
                is_dir($path) ? $this->deleteRecursive($path) : @unlink($path);
            }
            closedir($handle);
        }
        @rmdir($dir);
    }
}
