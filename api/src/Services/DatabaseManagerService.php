<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ZipArchive;

final class DatabaseManagerService
{
    private readonly string $storageRoot;
    private readonly string $backupsDir;

    public function __construct()
    {
        $root = (string) Config::get('storage.path', '');
        $this->storageRoot = rtrim($root, '/\\');
        $this->backupsDir = $this->storageRoot . DIRECTORY_SEPARATOR . 'backups';
        
        if (!is_dir($this->backupsDir)) {
            @mkdir($this->backupsDir, 0775, true);
        }
    }

    /**
     * Ejecuta sentencias SQL directamente sobre la base de datos (para actualizaciones).
     */
    public function executeMigration(string $sqlContent): int
    {
        $pdo = Database::pdo();
        
        // Ejecuta todas las consultas en bloque de forma nativa en lugar de dividirlas.
        // Esto previene que inserciones de textos con punto y coma (ej. hashes, descripciones) fallen.
        
        try {
            $pdo->exec($sqlContent);
            return 1; // Retorna > 0 en éxito
        } catch (\PDOException $e) {
            throw new \ProjectCloud\Core\HttpException(500, 'MIGRATION_ERROR', 'Error al ejecutar SQL: ' . $e->getMessage());
        }
    }

    /**
     * Genera un volcado completo de la base de datos (estructuras e inserts).
     */
    private function exportDatabaseToSql(): string
    {
        $pdo = Database::pdo();
        $sql = "-- Project Cloud - Database Backup\n";
        $sql .= "-- Generado: " . gmdate('Y-m-d H:i:s') . " UTC\n\n";
        $sql .= "SET NAMES utf8mb4;\n";
        $sql .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

        $stmt = $pdo->query("SHOW TABLES");
        $tables = [];
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $tables[] = (string) $row[0];
        }

        foreach ($tables as $table) {
            $sql .= "DROP TABLE IF EXISTS `$table`;\n";
            
            $createStmt = $pdo->query("SHOW CREATE TABLE `$table`");
            $createRow = $createStmt->fetch(PDO::FETCH_ASSOC);
            if (isset($createRow['Create Table'])) {
                $sql .= $createRow['Create Table'] . ";\n\n";
            }

            $rowsStmt = $pdo->query("SELECT * FROM `$table`");
            while ($row = $rowsStmt->fetch(PDO::FETCH_ASSOC)) {
                $keys = array_map(static fn(string $k): string => "`$k`", array_keys($row));
                $values = array_map(static fn($v): string => $v === null ? 'NULL' : $pdo->quote((string)$v), array_values($row));
                $sql .= "INSERT INTO `$table` (" . implode(', ', $keys) . ") VALUES (" . implode(', ', $values) . ");\n";
            }
            $sql .= "\n";
        }

        $sql .= "SET FOREIGN_KEY_CHECKS = 1;\n";
        return $sql;
    }

    /**
     * Crea el backup en ZIP que incluye el .sql y la carpeta storage de los usuarios (incluyendo .trash, excluyendo platform).
     */
    public function createBackup(): string
    {
        if (!class_exists('ZipArchive')) {
            throw new HttpException(500, 'NO_ZIP_ARCHIVE', 'La extensión ZipArchive de PHP no está instalada en el servidor.');
        }

        $timestamp = gmdate('Y-m-d_H-i-s');
        $filename = "backup_{$timestamp}.zip";
        $zipPath = $this->backupsDir . DIRECTORY_SEPARATOR . $filename;

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new HttpException(500, 'BACKUP_FAILED', 'No se pudo crear el archivo ZIP para el backup.');
        }

        // 1. Base de datos
        $dbSql = $this->exportDatabaseToSql();
        $zip->addFromString('database_dump.sql', $dbSql);

        // 2. Storage
        $this->addFolderToZip($this->storageRoot, $zip, 'storage');

        $zip->close();
        
        return $filename;
    }

    /**
     * Añade recursivamente los archivos al zip. Excluye platform (assets) y backups.
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

            // En la raíz de storage, excluye platform (assets compartidos) y backups.
            if ($folder === $this->storageRoot && in_array($entry, ['platform', 'backups'], true)) {
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
        if (!is_dir($this->backupsDir)) {
            return $backups;
        }

        $handle = opendir($this->backupsDir);
        if ($handle === false) {
            return $backups;
        }

        while (($entry = readdir($handle)) !== false) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            if (pathinfo($entry, PATHINFO_EXTENSION) === 'zip') {
                $path = $this->backupsDir . DIRECTORY_SEPARATOR . $entry;
                $backups[] = [
                    'filename' => $entry,
                    'size_bytes' => filesize($path),
                    'created_at' => filemtime($path) ? gmdate('Y-m-d H:i:s', filemtime($path)) : null,
                ];
            }
        }
        closedir($handle);

        // Ordenar más recientes primero
        usort($backups, static fn($a, $b) => $b['created_at'] <=> $a['created_at']);

        return $backups;
    }

    /**
     * Restaura un backup descomprimiéndolo temporalmente, inyectando SQL y reemplazando archivos.
     */
    public function restoreBackup(string $filename): void
    {
        $zipPath = $this->backupsDir . DIRECTORY_SEPARATOR . basename($filename);
        if (!file_exists($zipPath)) {
            throw new HttpException(404, 'NOT_FOUND', 'El archivo de backup no existe.');
        }

        if (!class_exists('ZipArchive')) {
            throw new HttpException(500, 'NO_ZIP_ARCHIVE', 'La extensión ZipArchive no está habilitada.');
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new HttpException(500, 'RESTORE_FAILED', 'No se pudo abrir el archivo ZIP.');
        }

        // Leer y ejecutar SQL
        $sqlContent = $zip->getFromName('database_dump.sql');
        if ($sqlContent !== false) {
            $this->executeMigration($sqlContent);
        }

        // Extraer los archivos storage/ a storage/
        // Ojo, si extractTo extrae con la misma estructura, sobreescribirá / creará.
        $tempExtractDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cloud_restore_' . uniqid();
        @mkdir($tempExtractDir);
        
        $zip->extractTo($tempExtractDir);
        $zip->close();

        // Mover los archivos de $tempExtractDir/storage/ al $this->storageRoot real.
        $extractedStorage = $tempExtractDir . DIRECTORY_SEPARATOR . 'storage';
        if (is_dir($extractedStorage)) {
            $this->copyRecursive($extractedStorage, $this->storageRoot);
        }

        $this->deleteRecursive($tempExtractDir);
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
        if (!file_exists($path)) {
            throw new HttpException(404, 'NOT_FOUND', 'El archivo de backup no existe.');
        }
        return $path;
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
