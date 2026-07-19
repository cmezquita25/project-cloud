<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Acceso a la tabla `settings` (configuración global clave/valor).
 */
class SettingsRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function get(string $key, ?string $default = null): ?string
    {
        $stmt = $this->pdo->prepare('SELECT `value` FROM settings WHERE `key` = ? LIMIT 1');
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();
        return $value === false ? $default : (string) $value;
    }

    public function getInt(string $key, int $default = 0): int
    {
        $value = $this->get($key);
        return ($value === null || $value === '') ? $default : (int) $value;
    }

    public function set(string $key, string $value): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO settings (`key`, `value`) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)'
        );
        $stmt->execute([$key, $value]);
    }

    /** Elimina una clave de configuración (p. ej. al vaciar nombre/eslogan). */
    public function delete(string $key): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM settings WHERE `key` = ?');
        $stmt->execute([$key]);
    }
}
