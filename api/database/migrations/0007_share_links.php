<?php

declare(strict_types=1);

/**
 * Fase 6 — Enlaces compartidos y QR.
 *
 * - share_links: un enlace con token aleatorio a un archivo o carpeta, de
 *   «Mi unidad» (por id) o de la unidad compartida (por ruta relativa).
 * - share_link_hits: detalle de visitas y descargas (IP con hash, nunca en claro).
 */
return static function (PDO $pdo): void {
    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS `share_links` (
            `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `token`            CHAR(22) NOT NULL,
            `created_by`       BIGINT UNSIGNED NOT NULL,
            `scope`            ENUM('drive','org') NOT NULL,
            `target_type`      ENUM('file','folder') NOT NULL,
            `target_id`        BIGINT UNSIGNED NULL DEFAULT NULL,
            `target_path`      VARCHAR(1024) NULL DEFAULT NULL,
            `access`           ENUM('anyone','members') NOT NULL DEFAULT 'anyone',
            `label`            VARCHAR(120) NULL DEFAULT NULL,
            `allow_download`   TINYINT(1) NOT NULL DEFAULT 1,
            `password_hash`    VARCHAR(255) NULL DEFAULT NULL,
            `expires_at`       DATETIME NULL DEFAULT NULL,
            `view_count`       INT UNSIGNED NOT NULL DEFAULT 0,
            `download_count`   INT UNSIGNED NOT NULL DEFAULT 0,
            `last_accessed_at` DATETIME NULL DEFAULT NULL,
            `revoked_at`       DATETIME NULL DEFAULT NULL,
            `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_share_links_token` (`token`),
            KEY `idx_share_links_owner` (`created_by`, `revoked_at`),
            KEY `idx_share_links_target` (`scope`, `target_type`, `target_id`),
            CONSTRAINT `fk_share_links_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL);

    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS `share_link_hits` (
            `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `link_id`    BIGINT UNSIGNED NOT NULL,
            `kind`       ENUM('view','download') NOT NULL,
            `user_id`    BIGINT UNSIGNED NULL DEFAULT NULL,
            `ip_hash`    CHAR(64) NOT NULL,
            `user_agent` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_hits_link` (`link_id`, `created_at`),
            KEY `idx_hits_dedupe` (`link_id`, `ip_hash`, `kind`, `created_at`),
            CONSTRAINT `fk_hits_link` FOREIGN KEY (`link_id`) REFERENCES `share_links` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL);
};
