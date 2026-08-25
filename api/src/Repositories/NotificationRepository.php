<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Gestión de la tabla `notifications` en la base de datos.
 */
class NotificationRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
        $this->ensureTableExists();
    }

    private function ensureTableExists(): void
    {
        try {
            $stmt = $this->pdo->query("SHOW TABLES LIKE 'notifications'");
            if ($stmt && $stmt->rowCount() === 0) {
                $this->pdo->exec("
                    CREATE TABLE IF NOT EXISTS `notifications` (
                        `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                        `user_id`    BIGINT UNSIGNED NOT NULL,
                        `actor_id`   BIGINT UNSIGNED NULL DEFAULT NULL,
                        `type`       VARCHAR(64) NOT NULL,
                        `title`      VARCHAR(255) NOT NULL,
                        `message`    TEXT NOT NULL,
                        `target_url` VARCHAR(500) NULL DEFAULT NULL,
                        `is_read`    TINYINT(1) NOT NULL DEFAULT 0,
                        `read_at`    DATETIME NULL DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_notif_user_read` (`user_id`, `is_read`, `created_at`),
                        KEY `idx_notif_user_created` (`user_id`, `created_at`),
                        CONSTRAINT `fk_notif_user`  FOREIGN KEY (`user_id`)  REFERENCES `users` (`id`) ON DELETE CASCADE,
                        CONSTRAINT `fk_notif_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");
            }
        } catch (\Throwable) {}
    }

    /**
     * Crea una notificación para un usuario destinatario.
     */
    public function create(
        int $userId,
        ?int $actorId,
        string $type,
        string $title,
        string $message,
        ?string $targetUrl = null
    ): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO notifications (user_id, actor_id, type, title, message, target_url, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
        ");
        $stmt->execute([$userId, $actorId, $type, $title, $message, $targetUrl]);
        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Obtiene el conteo de notificaciones no leídas para un usuario.
     */
    public function unreadCount(int $userId): int
    {
        try {
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) FROM notifications
                WHERE user_id = ? AND is_read = 0
            ");
            $stmt->execute([$userId]);
            return (int) $stmt->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * Paginación de notificaciones de un usuario.
     *
     * @return array{items:list<array<string,mixed>>,total:int,unread_count:int}
     */
    public function paginateForUser(int $userId, int $page = 1, int $limit = 20, ?string $filter = null): array
    {
        try {
            $offset = max(0, ($page - 1) * $limit);
            $where = ['n.user_id = ?'];
            $params = [$userId];

        if ($filter === 'unread') {
            $where[] = 'n.is_read = 0';
        }

        $whereClause = ' WHERE ' . implode(' AND ', $where);

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM notifications n{$whereClause}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "
            SELECT 
                n.id,
                n.user_id,
                n.actor_id,
                n.type,
                n.title,
                n.message,
                n.target_url,
                n.is_read,
                n.read_at,
                n.created_at,
                u.username AS actor_username,
                u.display_name AS actor_display_name
            FROM notifications n
            LEFT JOIN users u ON n.actor_id = u.id
            {$whereClause}
            ORDER BY n.created_at DESC
            LIMIT ? OFFSET ?
        ";

        $stmt = $this->pdo->prepare($sql);
        $i = 1;
        foreach ($params as $p) {
            $stmt->bindValue($i++, $p);
        }
        $stmt->bindValue($i++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($i, $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $unreadTotal = $this->unreadCount($userId);

        return [
            'items'        => $items,
            'total'        => $total,
            'unread_count' => $unreadTotal,
        ];
        } catch (\Throwable) {
            return [
                'items'        => [],
                'total'        => 0,
                'unread_count' => 0,
            ];
        }
    }

    /**
     * Marca una notificación como leída si pertenece al usuario.
     */
    public function markAsRead(int $id, int $userId): bool
    {
        $stmt = $this->pdo->prepare("
            UPDATE notifications 
            SET is_read = 1, read_at = NOW() 
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$id, $userId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Marca todas las notificaciones no leídas del usuario como leídas.
     */
    public function markAllAsRead(int $userId): int
    {
        $stmt = $this->pdo->prepare("
            UPDATE notifications 
            SET is_read = 1, read_at = NOW() 
            WHERE user_id = ? AND is_read = 0
        ");
        $stmt->execute([$userId]);
        return $stmt->rowCount();
    }

    /**
     * Marca una lista de notificaciones como leídas si pertenecen al usuario.
     *
     * @param list<int> $ids
     */
    public function markBulkRead(array $ids, int $userId): int
    {
        if (empty($ids)) return 0;
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("
            UPDATE notifications 
            SET is_read = 1, read_at = NOW() 
            WHERE user_id = ? AND id IN ({$in}) AND is_read = 0
        ");
        $stmt->execute(array_merge([$userId], $ids));
        return $stmt->rowCount();
    }

    /**
     * Elimina una notificación específica del usuario.
     */
    public function delete(int $id, int $userId): bool
    {
        $stmt = $this->pdo->prepare("
            DELETE FROM notifications WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$id, $userId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Elimina una lista de notificaciones del usuario.
     *
     * @param list<int> $ids
     */
    public function deleteBulk(array $ids, int $userId): int
    {
        if (empty($ids)) return 0;
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("
            DELETE FROM notifications WHERE user_id = ? AND id IN ({$in})
        ");
        $stmt->execute(array_merge([$userId], $ids));
        return $stmt->rowCount();
    }

    /**
     * Elimina todas las notificaciones del usuario.
     */
    public function deleteAll(int $userId): int
    {
        $stmt = $this->pdo->prepare("
            DELETE FROM notifications WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        return $stmt->rowCount();
    }
}

