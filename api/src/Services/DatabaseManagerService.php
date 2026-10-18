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
     * @param string        $scope    full | system
     * @param string|null   $label    Etiqueta en el nombre (p. ej. "pre-update-2.1.1").
     * @param array|null    $content  Qué incluye la copia completa (ver BackupSettings::content()):
     *                                users, shared, trash, avatars (bool), ext_mode (all|only|except), extensions (list)
     * @param callable|null $progress fn(int $files, int $bytes): void — se llama cada cierto número de archivos
     */
    public function createBackup(string $scope = 'full', ?string $label = null, ?array $content = null, ?callable $progress = null): string
    {
        if (!class_exists('ZipArchive')) {
            throw new HttpException(500, 'NO_ZIP_ARCHIVE', 'La extensión ZipArchive de PHP no está instalada en el servidor.');
        }

        $full = $scope !== 'system';
        $this->content = ($content ?? []) + ['users' => true, 'shared' => true, 'trash' => true, 'avatars' => true, 'ext_mode' => 'all', 'extensions' => []];
        $this->content['extensions'] = array_map('strtolower', (array) $this->content['extensions']);
        $this->progress = $progress;
        $this->filesAdded = 0;
        $this->bytesAdded = 0;
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

            // 2. Storage: logos siempre; unidades de usuarios y papeleras según la configuración.
            if ($full) {
                $this->addFolderToZip($this->storageRoot, $zip, 'storage', 'storage-root');
            } elseif (is_dir($this->storageRoot . DIRECTORY_SEPARATOR . 'platform')) {
                $this->addFolderToZip($this->storageRoot . DIRECTORY_SEPARATOR . 'platform', $zip, 'storage/platform', 'always');
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
            $assetsFolder = $full && $this->content['shared'] && is_dir($assetsRoot) ? basename($assetsRoot) : null;
            if ($assetsFolder !== null) {
                $this->addFolderToZip($assetsRoot, $zip, $assetsFolder, 'shared-root');
            }

            // 4b. Avatares (carpeta hermana de storage)
            $avatarsDir = dirname($this->storageRoot) . DIRECTORY_SEPARATOR . 'avatars';
            $withAvatars = $full && $this->content['avatars'] && is_dir($avatarsDir);
            if ($withAvatars) {
                $this->addFolderToZip($avatarsDir, $zip, 'avatars', 'always');
            }

            if ($this->progress !== null) {
                ($this->progress)($this->filesAdded, $this->bytesAdded); // total final
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
                    'logos',
                    $full && $this->content['users'] ? 'storage' : null,
                    $full && $this->content['trash'] ? 'trash' : null,
                    $assetsFolder !== null ? 'shared_unit' : null,
                    $withAvatars ? 'avatars' : null,
                ])),
                'shared_unit_folder' => $assetsFolder,
                // Con filtro de extensiones, la BD puede listar archivos que no están en la copia.
                'extension_filter' => $full && $this->content['ext_mode'] !== 'all'
                    ? ['mode' => $this->content['ext_mode'], 'extensions' => $this->content['extensions']]
                    : null,
                'files'       => $this->filesAdded,
                'files_bytes' => $this->bytesAdded,
                'excluded_by_filter' => $full && $this->content['users'] ? $this->excludedByFilter() : null,
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

    /** Opciones de contenido de la copia en curso (ver createBackup()). */
    private array $content = [];
    /** @var callable|null */
    private $progress = null;
    private int $filesAdded = 0;
    private int $bytesAdded = 0;

    /**
     * Añade recursivamente los archivos al zip respetando el contenido elegido.
     *
     * $kind indica qué es la carpeta:
     *   storage-root → raíz de storage: excluye temporales; unidades y .trash según opciones; platform siempre
     *   shared-root  → raíz de la unidad compartida: .trash según opciones
     *   files        → archivos de usuarios: aplica el filtro de extensiones
     *   always       → se copia entero (logos, avatares)
     */
    private function addFolderToZip(string $folder, ZipArchive $zip, string $zipDir, string $kind = 'files'): void
    {
        $handle = opendir($folder);
        if ($handle === false) {
            return;
        }

        while (($entry = readdir($handle)) !== false) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $path = $folder . DIRECTORY_SEPARATOR . $entry;
            $localPath = $zipDir !== '' ? $zipDir . '/' . $entry : $entry;
            $childKind = $kind === 'always' ? 'always' : 'files';

            if ($kind === 'storage-root') {
                if (in_array($entry, self::STORAGE_ROOT_EXCLUDES, true)) {
                    continue;
                }
                if ($entry === 'platform') {
                    $childKind = 'always';
                } elseif ($entry === '.trash' ? !$this->content['trash'] : !$this->content['users']) {
                    continue;
                }
            } elseif ($kind === 'shared-root' && $entry === '.trash' && !$this->content['trash']) {
                continue;
            }

            if (is_dir($path)) {
                $zip->addEmptyDir($localPath);
                $this->addFolderToZip($path, $zip, $localPath, $childKind);
            } elseif (is_file($path)) {
                if ($kind !== 'always' && $kind !== 'storage-root' && !$this->extensionAllowed($entry)) {
                    continue;
                }
                $zip->addFile($path, $localPath);
                $this->filesAdded++;
                $this->bytesAdded += (int) @filesize($path);
                if ($this->progress !== null && $this->filesAdded % 100 === 0) {
                    ($this->progress)($this->filesAdded, $this->bytesAdded);
                }
            }
        }
        closedir($handle);
    }

    /**
     * Archivos de usuarios registrados en la BD que el filtro de extensiones dejó
     * fuera de la copia: tras restaurar aparecerán como no disponibles.
     *
     * @return array{count:int, bytes:int}
     */
    private function excludedByFilter(): array
    {
        $mode = $this->content['ext_mode'] ?? 'all';
        $exts = $this->content['extensions'];
        if ($mode === 'all' || $exts === []) {
            return ['count' => 0, 'bytes' => 0];
        }
        $in = implode(',', array_fill(0, count($exts), '?'));
        $where = $mode === 'only'
            ? "(extension IS NULL OR LOWER(extension) NOT IN ({$in}))"
            : "LOWER(extension) IN ({$in})";
        $stmt = Database::pdo()->prepare("SELECT COUNT(*), COALESCE(SUM(size_bytes), 0) FROM files WHERE deleted_at IS NULL AND {$where}");
        $stmt->execute($exts);
        [$count, $bytes] = $stmt->fetch(PDO::FETCH_NUM);
        return ['count' => (int) $count, 'bytes' => (int) $bytes];
    }

    private function extensionAllowed(string $filename): bool
    {
        $mode = $this->content['ext_mode'] ?? 'all';
        if ($mode === 'all') {
            return true;
        }
        // Las protecciones de carpeta (p. ej. carpetas privadas de la unidad
        // compartida) siempre van en la copia, filtre lo que filtre.
        if ($filename === '.htaccess') {
            return true;
        }
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $listed = in_array($ext, $this->content['extensions'], true);
        return $mode === 'only' ? $listed : !$listed;
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
                'kind' => match (true) {
                    str_contains($name, '_pre-update-') => 'pre-update',
                    str_contains($name, '_pre-restore') => 'pre-restore',
                    default => 'manual',
                },
            ];
        }

        // Ordenar más recientes primero
        usort($backups, static fn($a, $b) => $b['created_at'] <=> $a['created_at']);

        return $backups;
    }

    /**
     * Ejecuta un volcado SQL completo leído de un stream (p. ej. directamente
     * del ZIP, sin extraerlo). Estricto: cualquier error aborta. Devuelve el
     * número de sentencias ejecutadas.
     *
     * @param resource      $handle
     * @param callable|null $progress fn(int $statements): void, cada 200 sentencias
     */
    public function runDump($handle, ?callable $progress = null): int
    {
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
                if ($progress !== null && $index % 200 === 0) {
                    $progress($index);
                }
            }
        } finally {
            // Por si el volcado se cortó antes de reactivarlas.
            $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
        return $index;
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
}
