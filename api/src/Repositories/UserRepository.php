<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Acceso a datos de usuarios (PDO prepared statements).
 */
class UserRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    /** Busca por correo O nombre de usuario (para el login). */
    public function findByLogin(string $login): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1'
        );
        $stmt->execute([$login, $login]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Ajusta el uso de almacenamiento cacheado (delta puede ser negativo). */
    public function addUsedBytes(int $id, int $delta): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users SET used_bytes = GREATEST(0, CAST(used_bytes AS SIGNED) + ?) WHERE id = ?'
        );
        $stmt->execute([$delta, $id]);
    }
}
