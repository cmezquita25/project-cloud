-- ==========================================================================
--  Project Cloud — Esquema de base de datos
--  Motor: MariaDB 10.3+ / MySQL 5.7+  ·  Charset: utf8mb4
--
--  Lo ejecuta automáticamente el instalador (Fase 2). También puede importarse
--  manualmente por phpMyAdmin. Usa CREATE TABLE IF NOT EXISTS para ser idempotente.
-- ==========================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------------
--  users — cuentas de usuario e inquilinos
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username`         VARCHAR(64)  NOT NULL,                       -- slug usado en /storage/{username}
    `email`            VARCHAR(190) NOT NULL,
    `password_hash`    VARCHAR(255) NOT NULL,                       -- Argon2id / bcrypt
    `display_name`     VARCHAR(120) NOT NULL,
    `role`             ENUM('admin','user') NOT NULL DEFAULT 'user',
    `quota_bytes`      BIGINT UNSIGNED NOT NULL DEFAULT 5368709120,  -- 5 GB por defecto
    `max_upload_bytes` BIGINT UNSIGNED NOT NULL DEFAULT 2147483648,  -- 2 GB por archivo
    `used_bytes`       BIGINT UNSIGNED NOT NULL DEFAULT 0,           -- uso agregado (cache)
    `status`           ENUM('active','suspended') NOT NULL DEFAULT 'active',
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
--  refresh_tokens — sesiones (JWT refresh con rotación y detección de reuso)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `token_hash`  CHAR(64) NOT NULL,                                -- SHA-256 hex del token (nunca en claro)
    `family_id`   CHAR(36) NOT NULL,                                -- UUID de familia (rotacion) para deteccion de reuso
    `expires_at`  DATETIME NOT NULL,
    `revoked_at`  DATETIME NULL DEFAULT NULL,
    `user_agent`  VARCHAR(255) NULL DEFAULT NULL,
    `ip`          VARCHAR(45)  NULL DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_refresh_token_hash` (`token_hash`),
    KEY `idx_refresh_user` (`user_id`),
    KEY `idx_refresh_family` (`family_id`),
    KEY `idx_refresh_expires` (`expires_at`),
    CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
--  folders — árbol de carpetas (parent_id NULL = raíz de la unidad del usuario)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `folders` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `parent_id`  BIGINT UNSIGNED NULL DEFAULT NULL,
    `name`       VARCHAR(255)  NOT NULL,
    `path`       VARCHAR(1024) NOT NULL,                            -- ruta virtual materializada (relativa a la raíz del usuario)
    `is_starred` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` DATETIME NULL DEFAULT NULL,                        -- soft delete (papelera)
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_folders_user_parent` (`user_id`, `parent_id`),
    KEY `idx_folders_deleted` (`deleted_at`),
    CONSTRAINT `fk_folders_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`   (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_folders_parent` FOREIGN KEY (`parent_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
--  files — metadatos de archivos (el binario vive en /storage)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `files` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `folder_id`  BIGINT UNSIGNED NULL DEFAULT NULL,                 -- NULL = raíz
    `name`       VARCHAR(255)  NOT NULL,
    `path`       VARCHAR(1024) NOT NULL,                            -- ruta virtual relativa
    `size_bytes` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `mime_type`  VARCHAR(150) NULL DEFAULT NULL,
    `extension`  VARCHAR(32)  NULL DEFAULT NULL,
    `is_starred` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_files_user_folder` (`user_id`, `folder_id`),
    KEY `idx_files_name` (`name`),
    KEY `idx_files_deleted` (`deleted_at`),
    CONSTRAINT `fk_files_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`   (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_files_folder` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
--  activity_log — auditoría de acciones
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_log` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     BIGINT UNSIGNED NULL DEFAULT NULL,
    `action`      VARCHAR(64) NOT NULL,                             -- login, upload, delete, rename...
    `entity_type` VARCHAR(32) NULL DEFAULT NULL,                    -- file, folder, user...
    `entity_id`   BIGINT UNSIGNED NULL DEFAULT NULL,
    `details`     JSON NULL DEFAULT NULL,                           -- MariaDB 10.2+: alias de LONGTEXT
    `ip`          VARCHAR(45) NULL DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_activity_user` (`user_id`),
    KEY `idx_activity_created` (`created_at`),
    CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
--  settings — configuración global (clave/valor)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
    `key`        VARCHAR(64) NOT NULL,
    `value`      TEXT NULL DEFAULT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valores por defecto de configuración global.
INSERT INTO `settings` (`key`, `value`) VALUES
    ('site_name', 'Project Cloud'),
    ('allow_registration', '0'),
    ('default_quota_bytes', '5368709120'),
    ('schema_version', '1')
ON DUPLICATE KEY UPDATE `key` = `key`;

SET FOREIGN_KEY_CHECKS = 1;
