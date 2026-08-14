<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;

/**
 * Ejecuta el esquema SQL de forma idempotente (CREATE TABLE IF NOT EXISTS).
 *
 * Es la única fuente de verdad para crear/actualizar tablas y la comparte el
 * instalador (Fase 2) y el endpoint admin "Aplicar migraciones" (para instancias
 * ya instaladas donde el instalador está bloqueado). Reutiliza el mismo parseo
 * que usaba el instalador: normaliza saltos, elimina comentarios "--" y divide
 * por ';'.
 */
final class SchemaMigrator
{
    private string $schemaPath;

    public function __construct(?string $schemaPath = null)
    {
        // api/src/Services -> api/database/schema.sql
        $this->schemaPath = $schemaPath ?? __DIR__ . '/../../database/schema.sql';
    }

    /**
     * Ejecuta todas las sentencias del esquema sobre el PDO dado (o el global).
     * Devuelve el número de sentencias ejecutadas.
     */
    public function run(?PDO $pdo = null): int
    {
        $pdo = $pdo ?? Database::pdo();

        $sql = @file_get_contents($this->schemaPath);
        if ($sql === false) {
            throw new HttpException(500, 'SCHEMA_MISSING', 'No se encontró el esquema de la base de datos.');
        }

        // Normaliza saltos de línea.
        $sql = str_replace(["\r\n", "\r"], "\n", $sql);
        // Elimina comentarios "--" (completos e inline) antes de dividir por ';',
        // porque un ';' dentro de un comentario cortaría la sentencia.
        $sql = preg_replace('/--[^\n]*/', '', $sql) ?? $sql;

        $count = 0;
        foreach (explode(';', $sql) as $statement) {
            $statement = trim($statement);
            if ($statement !== '') {
                $pdo->exec($statement);
                $count++;
            }
        }

        // Aplicar migraciones estructurales sobre tablas existentes
        $this->applyManualMigrations($pdo);

        return $count;
    }

    private function applyManualMigrations(PDO $pdo): void
    {
        // Añadir blocked_actions a assets_metadata
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM `assets_metadata` LIKE 'blocked_actions'");
            if ($stmt && $stmt->rowCount() === 0) {
                $pdo->exec("ALTER TABLE `assets_metadata` ADD COLUMN `blocked_actions` VARCHAR(255) NULL DEFAULT NULL AFTER `user_id`");
            }
        } catch (\Exception $e) {
            // La tabla podría no existir aún o haber otro error, ignorar silenciosamente
        }

        // Crear tabla shared_access si no existe
        try {
            $stmt = $pdo->query("SHOW TABLES LIKE 'shared_access'");
            if ($stmt && $stmt->rowCount() === 0) {
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `shared_access` (
                        `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `owner_id`         BIGINT UNSIGNED NOT NULL,
                        `invited_user_id`  BIGINT UNSIGNED NOT NULL,
                        `target_type`      ENUM('unit', 'folder', 'file') NOT NULL,
                        `target_id`        BIGINT UNSIGNED NULL DEFAULT NULL,
                        `permission_level` ENUM('read', 'full') NOT NULL DEFAULT 'read',
                        `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `uq_shared_target` (`owner_id`, `invited_user_id`, `target_type`, `target_id`),
                        KEY `idx_shared_invited` (`invited_user_id`),
                        KEY `idx_shared_owner` (`owner_id`),
                        CONSTRAINT `fk_shared_owner`   FOREIGN KEY (`owner_id`)       REFERENCES `users` (`id`) ON DELETE CASCADE,
                        CONSTRAINT `fk_shared_invited` FOREIGN KEY (`invited_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");
            }
        } catch (\Exception $e) {
            // Ignorar si falla
        }

        // Eliminar FKs conflictivas fk_shared_folder y fk_shared_file en instalaciones existentes
        try {
            $pdo->exec("ALTER TABLE `shared_access` DROP FOREIGN KEY `fk_shared_folder`");
        } catch (\Exception $e) {
            // Ignorar si no existe
        }
        try {
            $pdo->exec("ALTER TABLE `shared_access` DROP FOREIGN KEY `fk_shared_file`");
        } catch (\Exception $e) {
            // Ignorar si no existe
        }
    }

}
