<?php

declare(strict_types=1);

/**
 * v2.4.0
 *
 * - users.theme_preset: estilo de color propio del usuario (NULL = el de la plataforma).
 * - users.last_seen_at: última actividad (columna «Última conexión» de Usuarios).
 * - shared_access.can_share: el invitado puede crear enlaces y QR de lo compartido.
 * - shared_access.block_download: el invitado ve, pero sin descargar ni copiar.
 * - share_links.max_views: límite de visitas de un enlace (NULL = sin límite).
 *
 * Todo con valores por defecto que no cambian nada de lo existente.
 */
return static function (PDO $pdo): void {
    // SHOW no admite parámetros en consultas preparadas nativas: se usa quote().
    $hasColumn = static function (string $table, string $column) use ($pdo): bool {
        return $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE " . $pdo->quote($column))->rowCount() > 0;
    };

    if (!$hasColumn('users', 'theme_preset')) {
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `theme_preset` VARCHAR(20) NULL DEFAULT NULL AFTER `default_visibility`");
    }
    if (!$hasColumn('users', 'last_seen_at')) {
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `last_seen_at` DATETIME NULL DEFAULT NULL AFTER `theme_preset`");
    }
    if (!$hasColumn('shared_access', 'can_share')) {
        $pdo->exec("ALTER TABLE `shared_access` ADD COLUMN `can_share` TINYINT(1) NOT NULL DEFAULT 0 AFTER `permission_level`");
    }
    if (!$hasColumn('shared_access', 'block_download')) {
        $pdo->exec("ALTER TABLE `shared_access` ADD COLUMN `block_download` TINYINT(1) NOT NULL DEFAULT 0 AFTER `can_share`");
    }
    if (!$hasColumn('share_links', 'max_views')) {
        $pdo->exec("ALTER TABLE `share_links` ADD COLUMN `max_views` INT UNSIGNED NULL DEFAULT NULL AFTER `expires_at`");
    }
};
