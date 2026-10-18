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

    /** Periodos del filtro de fecha (en la hora del servidor de MySQL, la de created_at). */
    public const RANGES = ['today', '7d', '30d', 'month', 'all'];

    /**
     * @param array{range?:string, q?:string} $filters
     * @return array{items:array<int,array<string,mixed>>,total:int}
     */
    public function paginate(int $limit, int $offset, array $filters = []): array
    {
        [$where, $params] = $this->where($filters);

        $count = $this->pdo->prepare("SELECT COUNT(*) FROM activity_log a LEFT JOIN users u ON u.id = a.user_id {$where}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $stmt = $this->pdo->prepare(
            "SELECT a.*, u.display_name, u.username
               FROM activity_log a
               LEFT JOIN users u ON u.id = a.user_id
               {$where}
              ORDER BY a.created_at DESC, a.id DESC
              LIMIT {$limit} OFFSET {$offset}"
        );
        $stmt->execute($params);

        return ['items' => $stmt->fetchAll(), 'total' => $total];
    }

    /**
     * Borra los registros que cumplen el filtro (o todos). Devuelve cuántos.
     *
     * @param array{range?:string, q?:string} $filters
     */
    public function deleteMatching(array $filters): int
    {
        [$where, $params] = $this->where($filters);
        if ($where === '') {
            return (int) $this->pdo->exec('DELETE FROM activity_log');
        }
        $stmt = $this->pdo->prepare("DELETE a FROM activity_log a LEFT JOIN users u ON u.id = a.user_id {$where}");
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /** @return array{0:string, 1:list<string>} */
    private function where(array $filters): array
    {
        $conditions = [];
        $params = [];

        $range = (string) ($filters['range'] ?? 'all');
        $conditions[] = match ($range) {
            'today' => 'a.created_at >= CURDATE()',
            '7d'    => 'a.created_at >= NOW() - INTERVAL 7 DAY',
            '30d'   => 'a.created_at >= NOW() - INTERVAL 30 DAY',
            'month' => "a.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
            default => null,
        };

        $q = trim((string) ($filters['q'] ?? ''));
        if ($q !== '') {
            $like = '%' . addcslashes($q, '%_' . chr(92)) . '%'; // escapa comodines de LIKE
            $conditions[] = '(u.display_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
            array_push($params, $like, $like, $like);
        }

        $conditions = array_values(array_filter($conditions));
        return [$conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions), $params];
    }
}
