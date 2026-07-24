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
        $this->updateStorageHistory();
    }

    /** Fija el uso exacto (tras recalcular desde disco/BD). */
    public function setUsedBytes(int $id, int $used): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET used_bytes = ? WHERE id = ?');
        $stmt->execute([max(0, $used), $id]);
        $this->updateStorageHistory();
    }

    private function updateStorageHistory(): void
    {
        $this->pdo->exec("
            INSERT INTO storage_history (`date`, `total_bytes`)
            SELECT CURDATE(), COALESCE(SUM(used_bytes), 0) FROM users
            ON DUPLICATE KEY UPDATE `total_bytes` = VALUES(`total_bytes`)
        ");
    }

    // --- Administración ---

    /** @return array<int,array<string,mixed>> Todos los usuarios (orden por creación). */
    public function all(): array
    {
        return $this->pdo->query('SELECT * FROM users ORDER BY created_at DESC')->fetchAll();
    }

    /**
     * Paginación con orden, búsqueda y filtros opcionales.
     *
     * @param array{sort?:string,order?:string,search?:string,status?:string,role?:string,date_from?:string,date_to?:string} $filters
     * @return array{items:array<int,array<string,mixed>>,total:int}
     */
    public function paginate(int $limit, int $offset, array $filters = []): array
    {
        // --- Whitelist de columnas para ORDER BY ---
        $sortWhitelist = [
            'id'               => 'id',
            'username'         => 'username',
            'display_name'     => 'display_name',
            'role'             => 'role',
            'status'           => 'status',
            'max_upload_bytes' => 'max_upload_bytes',
            'used_bytes'       => 'used_bytes',
            'created_at'       => 'created_at',
        ];

        $sortCol = $sortWhitelist[$filters['sort'] ?? 'id'] ?? 'id';
        $sortDir = strtoupper($filters['order'] ?? 'asc') === 'DESC' ? 'DESC' : 'ASC';

        // --- WHERE dinámico ---
        $where  = [];
        $params = [];

        if (!empty($filters['search'])) {
            $where[]  = '(username LIKE ? OR display_name LIKE ?)';
            $term     = '%' . $filters['search'] . '%';
            $params[] = $term;
            $params[] = $term;
        }

        if (!empty($filters['status']) && in_array($filters['status'], ['active', 'suspended'], true)) {
            $where[]  = 'status = ?';
            $params[] = $filters['status'];
        }

        if (!empty($filters['role']) && in_array($filters['role'], ['admin', 'user'], true)) {
            $where[]  = 'role = ?';
            $params[] = $filters['role'];
        }

        if (!empty($filters['date_from'])) {
            $where[]  = 'created_at >= ?';
            $params[] = $filters['date_from'] . ' 00:00:00';
        }

        if (!empty($filters['date_to'])) {
            $where[]  = 'created_at <= ?';
            $params[] = $filters['date_to'] . ' 23:59:59';
        }

        $whereClause = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        // --- COUNT ---
        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM users{$whereClause}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // --- SELECT ---
        $sql  = "SELECT * FROM users{$whereClause} ORDER BY {$sortCol} {$sortDir} LIMIT ? OFFSET ?";
        $stmt = $this->pdo->prepare($sql);

        $i = 1;
        foreach ($params as $p) {
            $stmt->bindValue($i++, $p);
        }
        $stmt->bindValue($i++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($i, $offset, PDO::PARAM_INT);
        $stmt->execute();

        return ['items' => $stmt->fetchAll(), 'total' => $total];
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

    /** @return array{users:int,active:int,admins:int,used:int,quota:int,allocated_users:int} */
    public function stats(): array
    {
        $row = $this->pdo->query(
            "SELECT COUNT(*) AS users,
                    SUM(status = 'active') AS active,
                    SUM(role = 'admin') AS admins,
                    COALESCE(SUM(used_bytes), 0) AS used,
                    COALESCE(SUM(quota_bytes), 0) AS quota,
                    COALESCE(SUM(quota_bytes), 0) AS allocated_users
               FROM users"
        )->fetch();

        $usedFiles = (int) $this->pdo->query("SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE deleted_at IS NULL")->fetchColumn();
        $totalUsed = max((int) $row['used'], $usedFiles);

        return [
            'users'           => (int) $row['users'],
            'active'          => (int) $row['active'],
            'admins'          => (int) $row['admins'],
            'used'            => $totalUsed,
            'quota'           => (int) $row['quota'],
            // Suma de cuotas asignadas SOLO a usuarios (excluye a los admin, que
            // gestionan el conjunto): es lo que se compara con la capacidad.
            'allocated_users' => (int) $row['allocated_users'],
        ];
    }
}
