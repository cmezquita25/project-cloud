<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Acceso a datos de los enlaces compartidos (`share_links`) y sus visitas.
 *
 * Las fechas se comparan y calculan siempre en SQL (NOW()): PHP y MySQL pueden
 * tener zonas horarias distintas en el hosting. Por eso cada fila trae además
 * `expires_in`, `accessed_ago` y `is_expired` ya calculados por la base.
 */
class ShareLinkRepository
{
    private const COLUMNS = 'l.*,
        (l.expires_at IS NOT NULL AND l.expires_at <= NOW()) AS is_expired,
        TIMESTAMPDIFF(SECOND, NOW(), l.expires_at) AS expires_in,
        TIMESTAMPDIFF(SECOND, l.last_accessed_at, NOW()) AS accessed_ago,
        TIMESTAMPDIFF(SECOND, l.created_at, NOW()) AS created_ago';

    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function findByToken(string $token): ?array
    {
        $stmt = $this->pdo->prepare('SELECT ' . self::COLUMNS . ' FROM share_links l WHERE l.token = ? LIMIT 1');
        $stmt->execute([$token]);
        return $stmt->fetch() ?: null;
    }

    public function find(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT ' . self::COLUMNS . ' FROM share_links l WHERE l.id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Enlaces (no revocados) de un archivo o carpeta, los más nuevos primero.
     *
     * @return list<array<string,mixed>>
     */
    public function forTarget(string $scope, string $targetType, ?int $targetId, ?string $targetPath): array
    {
        $sql = 'SELECT ' . self::COLUMNS . ' FROM share_links l
                 WHERE l.scope = ? AND l.target_type = ? AND l.revoked_at IS NULL AND ';
        $params = [$scope, $targetType];
        if ($scope === 'drive') {
            $sql .= 'l.target_id = ?';
            $params[] = (int) $targetId;
        } else {
            $sql .= 'l.target_path = ?';
            $params[] = (string) $targetPath;
        }
        $stmt = $this->pdo->prepare($sql . ' ORDER BY l.id DESC');
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * @param array{token:string,created_by:int,scope:string,target_type:string,target_id:?int,target_path:?string,access:string,label:?string,allow_download:bool,password_hash:?string,expires_in:?int} $data
     */
    public function create(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO share_links
                (token, created_by, scope, target_type, target_id, target_path, access, label, allow_download, password_hash, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? IS NULL, NULL, DATE_ADD(NOW(), INTERVAL ? SECOND)))'
        );
        $stmt->execute([
            $data['token'],
            $data['created_by'],
            $data['scope'],
            $data['target_type'],
            $data['target_id'],
            $data['target_path'],
            $data['access'],
            $data['label'],
            $data['allow_download'] ? 1 : 0,
            $data['password_hash'],
            $data['expires_in'],
            $data['expires_in'],
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Actualiza los campos indicados. `expires_in` (segundos desde ahora) se
     * convierte en SQL; `null` = sin caducidad.
     *
     * @param array<string,mixed> $fields access, label, allow_download, password_hash, expires_in
     */
    public function update(int $id, array $fields): void
    {
        $sets = [];
        $params = [];
        foreach (['access', 'label', 'password_hash'] as $col) {
            if (array_key_exists($col, $fields)) {
                $sets[] = "`{$col}` = ?";
                $params[] = $fields[$col];
            }
        }
        if (array_key_exists('allow_download', $fields)) {
            $sets[] = '`allow_download` = ?';
            $params[] = $fields['allow_download'] ? 1 : 0;
        }
        if (array_key_exists('expires_in', $fields)) {
            if ($fields['expires_in'] === null) {
                $sets[] = '`expires_at` = NULL';
            } else {
                $sets[] = '`expires_at` = DATE_ADD(NOW(), INTERVAL ? SECOND)';
                $params[] = (int) $fields['expires_in'];
            }
        }
        if ($sets === []) {
            return;
        }
        $params[] = $id;
        $this->pdo->prepare('UPDATE share_links SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    }

    public function revoke(int $id): void
    {
        $this->pdo->prepare('UPDATE share_links SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL')->execute([$id]);
    }

    /**
     * Registra una visita o descarga. Las repeticiones de la misma IP en menos
     * de 30 min no suben el contador (recargas, rangos de vídeo…).
     */
    public function recordHit(int $linkId, string $kind, string $ipHash, ?int $userId, string $userAgent): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM share_link_hits
              WHERE link_id = ? AND ip_hash = ? AND kind = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
              LIMIT 1'
        );
        $stmt->execute([$linkId, $ipHash, $kind]);
        $counted = $stmt->fetchColumn() === false;

        $this->pdo->prepare(
            'INSERT INTO share_link_hits (link_id, kind, user_id, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?)'
        )->execute([$linkId, $kind, $userId, $ipHash, mb_substr($userAgent, 0, 255)]);

        $column = $kind === 'download' ? 'download_count' : 'view_count';
        $this->pdo->prepare(
            // updated_at no cambia: una visita no es una edición del enlace.
            "UPDATE share_links SET last_accessed_at = NOW(), updated_at = updated_at"
            . ($counted ? ", {$column} = {$column} + 1" : '')
            . ' WHERE id = ?'
        )->execute([$linkId]);

        return $counted;
    }

    /**
     * La unidad compartida guarda la ruta del destino: al mover o renombrar
     * una carpeta o archivo, los enlaces que apuntan a él (o a algo dentro)
     * se actualizan para seguir funcionando.
     */
    public function rewriteOrgPath(string $oldPath, string $newPath): void
    {
        $like = addcslashes($oldPath, '%_' . chr(92)) . '/%';
        $this->pdo->prepare(
            "UPDATE share_links
                SET target_path = CONCAT(?, SUBSTRING(target_path, ?)), updated_at = updated_at
              WHERE scope = 'org' AND (target_path = ? OR target_path LIKE ?)"
        )->execute([$newPath, mb_strlen($oldPath) + 1, $oldPath, $like]);
    }

    /** ¿El token ya existe? (colisión prácticamente imposible, pero se comprueba). */
    public function tokenExists(string $token): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM share_links WHERE token = ? LIMIT 1');
        $stmt->execute([$token]);
        return $stmt->fetchColumn() !== false;
    }
}
