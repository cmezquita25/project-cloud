<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Registro de actividad (auditoría).
 */
class ActivityRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    /** @param array<string,mixed>|null $details */
    public function log(
        ?int $userId,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        ?array $details = null,
        ?string $ip = null,
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId,
            $action,
            $entityType,
            $entityId,
            $details !== null ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
            $ip,
        ]);
    }

    /**
     * @return array{items:array<int,array<string,mixed>>,total:int}
     */
    public function paginate(int $limit, int $offset): array
    {
        $total = (int) $this->pdo->query('SELECT COUNT(*) FROM activity_log')->fetchColumn();

        $stmt = $this->pdo->prepare(
            'SELECT a.*, u.display_name, u.username
               FROM activity_log a
               LEFT JOIN users u ON u.id = a.user_id
              ORDER BY a.created_at DESC, a.id DESC
              LIMIT ? OFFSET ?'
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $offset, PDO::PARAM_INT);
        $stmt->execute();

        return ['items' => $stmt->fetchAll(), 'total' => $total];
    }
}
