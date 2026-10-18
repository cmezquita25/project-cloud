<?php

declare(strict_types=1);

/**
 * Fase 5 — Archivos y carpetas privados.
 *
 * - files.visibility / folders.visibility: 'public' (URL directa, como hasta
 *   ahora) o 'private' (solo con sesión o con un enlace firmado).
 * - users.default_visibility: visibilidad de las subidas nuevas del usuario.
 *
 * Todo con default 'public': nada cambia para lo que ya existe.
 */
return static function (PDO $pdo): void {
    // SHOW no admite parámetros en consultas preparadas nativas: se usa quote().
    $hasColumn = static function (string $table, string $column) use ($pdo): bool {
        return $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE " . $pdo->quote($column))->rowCount() > 0;
    };

    if (!$hasColumn('files', 'visibility')) {
        $pdo->exec("ALTER TABLE `files` ADD COLUMN `visibility` ENUM('public','private') NOT NULL DEFAULT 'public' AFTER `extension`");
    }
    if (!$hasColumn('folders', 'visibility')) {
        $pdo->exec("ALTER TABLE `folders` ADD COLUMN `visibility` ENUM('public','private') NOT NULL DEFAULT 'public' AFTER `path`");
    }
    if (!$hasColumn('users', 'default_visibility')) {
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `default_visibility` ENUM('public','private') NOT NULL DEFAULT 'public' AFTER `status`");
    }
};
