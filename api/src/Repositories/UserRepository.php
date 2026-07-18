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

    /** Fija el uso exacto (tras recalcular desde disco/BD). */
    public function setUsedBytes(int $id, int $used): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET used_bytes = ? WHERE id = ?');
        $stmt->execute([max(0, $used), $id]);
    }

    // --- Administración ---

    /** @return array<int,array<string,mixed>> Todos los usuarios (orden por creación). */
    public function all(): array
    {
        return $this->pdo->query('SELECT * FROM users ORDER BY created_at DESC')->fetchAll();
    }

    public function existsByUsernameOrEmail(string $username, string $email, int $excludeId = 0): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM users WHERE (username = ? OR email = ?) AND id <> ?'
        );
        $stmt->execute([$username, $email, $excludeId]);
        return (int) $stmt->fetchColumn() > 0;
    }

    public function create(
        string $username,
        string $email,
        string $passwordHash,
        string $displayName,
        string $role,
        int $quotaBytes,
        int $maxUploadBytes,
    ): int {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (username, email, password_hash, display_name, role, quota_bytes, max_upload_bytes)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$username, $email, $passwordHash, $displayName, $role, $quotaBytes, $maxUploadBytes]);
        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Actualiza campos permitidos del usuario.
     * @param array<string,mixed> $fields
     */
    public function update(int $id, array $fields): void
    {
        $allowed = ['email', 'display_name', 'role', 'quota_bytes', 'max_upload_bytes', 'status'];
        $set = [];
        $params = [];
        foreach ($allowed as $col) {
            if (array_key_exists($col, $fields)) {
                $set[] = "$col = ?";
                $params[] = $fields[$col];
            }
        }
        if ($set === []) {
            return;
        }
        $params[] = $id;
        $stmt = $this->pdo->prepare('UPDATE users SET ' . implode(', ', $set) . ' WHERE id = ?');
        $stmt->execute($params);
    }

    public function updatePassword(int $id, string $passwordHash): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([$passwordHash, $id]);
    }

    public function delete(int $id): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
    }

    /** @return array{users:int,active:int,admins:int,used:int,quota:int} */
    public function stats(): array
    {
        $row = $this->pdo->query(
            "SELECT COUNT(*) AS users,
                    SUM(status = 'active') AS active,
                    SUM(role = 'admin') AS admins,
                    COALESCE(SUM(used_bytes), 0) AS used,
                    COALESCE(SUM(quota_bytes), 0) AS quota
               FROM users"
        )->fetch();
        return [
            'users'  => (int) $row['users'],
            'active' => (int) $row['active'],
            'admins' => (int) $row['admins'],
            'used'   => (int) $row['used'],
            'quota'  => (int) $row['quota'],
        ];
    }
}
