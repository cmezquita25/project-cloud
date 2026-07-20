<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Acceso a datos de carpetas. Las rutas (`path`) son materializadas y
 * relativas a la raíz del usuario (p.ej. "docs/2026"). parent_id NULL = raíz.
 */
class FolderRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    /** Carpeta viva (no en papelera) del usuario. */
    public function find(int $id, int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([$id, $userId]);
        return $stmt->fetch() ?: null;
    }

    /** @return array<int,array<string,mixed>> Subcarpetas directas (vivas). */
    public function children(int $userId, ?int $parentId, string $sort = 'name', string $order = 'asc', ?int $limit = null, int $offset = 0, ?string $type = null, ?string $date = null): array
    {
        if ($type !== null && $type !== '' && $type !== 'folder') {
            return [];
        }

        $allowedSorts = ['name', 'updated_at', 'created_at'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'name';
        }
        $order = strtolower($order) === 'desc' ? 'DESC' : 'ASC';

        $sql = 'SELECT * FROM folders WHERE user_id = :user_id AND deleted_at IS NULL';
        $params = [':user_id' => $userId];

        if ($parentId === null) {
            $sql .= ' AND parent_id IS NULL';
        } else {
            $sql .= ' AND parent_id = :parent_id';
            $params[':parent_id'] = $parentId;
        }

        if ($date === 'today') {
            $sql .= ' AND updated_at >= DATE(UTC_TIMESTAMP())';
        } elseif ($date === '7days') {
            $sql .= ' AND updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)';
        } elseif ($date === '30days') {
            $sql .= ' AND updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)';
        }

        $sql .= " ORDER BY $sort $order";

        if ($limit !== null) {
            $sql .= ' LIMIT :limit OFFSET :offset';
        }

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        if ($limit !== null) {
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        }

        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function countChildren(int $userId, ?int $parentId, ?string $type = null, ?string $date = null): int
    {
        if ($type !== null && $type !== '' && $type !== 'folder') {
            return 0;
        }

        $sql = 'SELECT COUNT(*) FROM folders WHERE user_id = :user_id AND deleted_at IS NULL AND ' . ($parentId === null ? 'parent_id IS NULL' : 'parent_id = :parent_id');
        $params = [':user_id' => $userId];
        if ($parentId !== null) {
            $params[':parent_id'] = $parentId;
        }

        if ($date === 'today') {
            $sql .= ' AND updated_at >= DATE(UTC_TIMESTAMP())';
        } elseif ($date === '7days') {
            $sql .= ' AND updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)';
        } elseif ($date === '30days') {
            $sql .= ' AND updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)';
        }

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        return (int) $stmt->fetchColumn();
    }

    /** ¿Existe ya una carpeta con ese nombre bajo el mismo padre? */
    public function existsByName(int $userId, ?int $parentId, string $name, int $excludeId = 0): bool
    {
        $sql = 'SELECT COUNT(*) FROM folders WHERE user_id = ? AND deleted_at IS NULL AND name = ? AND id <> ? AND '
            . ($parentId === null ? 'parent_id IS NULL' : 'parent_id = ?');
        $params = [$userId, $name, $excludeId];
        if ($parentId !== null) {
            $params[] = $parentId;
        }
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn() > 0;
    }

    public function create(int $userId, ?int $parentId, string $name, string $path): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO folders (user_id, parent_id, name, path) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $parentId, $name, $path]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateNameAndPath(int $id, string $name, string $path): void
    {
        $stmt = $this->pdo->prepare('UPDATE folders SET name = ?, path = ? WHERE id = ?');
        $stmt->execute([$name, $path, $id]);
    }

    public function updateParentAndPath(int $id, ?int $parentId, string $name, string $path): void
    {
        $stmt = $this->pdo->prepare('UPDATE folders SET parent_id = ?, name = ?, path = ? WHERE id = ?');
        $stmt->execute([$parentId, $name, $path, $id]);
    }

    public function setStarred(int $id, int $userId, bool $starred): void
    {
        $stmt = $this->pdo->prepare('UPDATE folders SET is_starred = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$starred ? 1 : 0, $id, $userId]);
    }

    /**
     * Reescribe el prefijo de ruta de todos los descendientes (carpetas)
     * tras un rename/move de una carpeta. $oldPrefix y $newPrefix sin barra final.
     */
    public function rewriteDescendantPaths(int $userId, string $oldPrefix, string $newPrefix): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE folders
                SET path = CONCAT(?, SUBSTRING(path, CHAR_LENGTH(?) + 1))
              WHERE user_id = ? AND deleted_at IS NULL AND path LIKE ?"
        );
        $stmt->execute([$newPrefix, $oldPrefix, $userId, $oldPrefix . '/%']);
    }

    /** Soft-delete de una carpeta y de todo su subárbol (carpetas). */
    public function softDeleteSubtree(int $userId, int $id, string $path): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE folders SET deleted_at = UTC_TIMESTAMP()
              WHERE user_id = ? AND deleted_at IS NULL AND (id = ? OR path LIKE ?)"
        );
        $stmt->execute([$userId, $id, $path . '/%']);
    }

    /**
     * La carpeta y todos sus descendientes (vivos), ordenados por profundidad
     * (menos anidados primero). Útil para copiar/mover subárboles.
     *
     * @return array<int,array<string,mixed>>
     */
    public function subtree(int $userId, int $id, string $path): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM folders
              WHERE user_id = ? AND deleted_at IS NULL AND (id = ? OR path LIKE ?)
              ORDER BY CHAR_LENGTH(path), name"
        );
        $stmt->execute([$userId, $id, $path . '/%']);
        return $stmt->fetchAll();
    }

    // ======================================================================
    //  Fase 7 — Papelera, destacados y búsqueda
    // ======================================================================

    /** Carpeta en papelera (deleted_at NO nulo) del usuario. */
    public function findTrashed(int $id, int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL LIMIT 1'
        );
        $stmt->execute([$id, $userId]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Carpetas en papelera que son "raíz" de un borrado: su carpeta padre sigue
     * viva (o están en la raíz). Los descendientes se restauran/purgan con ella.
     *
     * @return array<int,array<string,mixed>>
     */
    public function trashedRoots(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT c.* FROM folders c
               LEFT JOIN folders p ON p.id = c.parent_id
              WHERE c.user_id = ? AND c.deleted_at IS NOT NULL
                AND (c.parent_id IS NULL OR p.deleted_at IS NULL)
              ORDER BY c.deleted_at DESC, c.name'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    /** Restaura una carpeta y todo su subárbol (deleted_at = NULL). */
    public function restoreSubtree(int $userId, int $id, string $path): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE folders SET deleted_at = NULL
              WHERE user_id = ? AND deleted_at IS NOT NULL AND (id = ? OR path LIKE ?)'
        );
        $stmt->execute([$userId, $id, $path . '/%']);
    }

    /** Recoloca (padre + nombre + ruta) una carpeta ya restaurada, si hubo renombrado/reubicación. */
    public function updateRestoredRoot(int $id, ?int $parentId, string $name, string $path): void
    {
        $this->updateParentAndPath($id, $parentId, $name, $path);
    }

    /** Borra definitivamente una carpeta y su subárbol (los archivos caen por FK ON DELETE CASCADE). */
    public function purgeSubtree(int $userId, int $id, string $path): void
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM folders WHERE user_id = ? AND deleted_at IS NOT NULL AND (id = ? OR path LIKE ?)'
        );
        $stmt->execute([$userId, $id, $path . '/%']);
    }

    /** @return array<int,array<string,mixed>> Carpetas destacadas (vivas). */
    public function starred(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT fo.*, pp.name AS location_name
               FROM folders fo
               LEFT JOIN folders pp ON pp.id = fo.parent_id
              WHERE fo.user_id = ? AND fo.deleted_at IS NULL AND fo.is_starred = 1 ORDER BY fo.name"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    /** @return array<int,array<string,mixed>> Búsqueda de carpetas por nombre (vivas). */
    public function search(int $userId, string $term, string $type = '', string $date = '', int $limit = 100): array
    {
        if ($type !== '' && $type !== 'folder') return []; // Only return folders if type is empty or 'folder'

        $limit = max(1, min(200, $limit));
        $where = ["fo.user_id = ?", "fo.deleted_at IS NULL"];
        $params = [$userId];

        if ($term !== '') {
            $where[] = "fo.name LIKE ? ESCAPE '\\\\'";
            $params[] = '%' . FileRepository::escapeLike($term) . '%';
        }

        if ($date === 'today') {
            $where[] = "fo.updated_at >= DATE(UTC_TIMESTAMP())";
        } elseif ($date === '7days') {
            $where[] = "fo.updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)";
        } elseif ($date === '30days') {
            $where[] = "fo.updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)";
        }

        $whereClause = implode(' AND ', $where);

        $stmt = $this->pdo->prepare(
            "SELECT fo.*, pp.name AS location_name
               FROM folders fo
               LEFT JOIN folders pp ON pp.id = fo.parent_id
              WHERE $whereClause
              ORDER BY fo.name LIMIT $limit"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Migas de pan desde la raíz hasta la carpeta (incluida). */
    public function breadcrumbs(int $userId, int $folderId): array
    {
        $crumbs = [];
        $currentId = $folderId;
        // Límite de profundidad defensivo.
        for ($i = 0; $i < 100 && $currentId; $i++) {
            $folder = $this->find($currentId, $userId);
            if ($folder === null) {
                break;
            }
            array_unshift($crumbs, ['id' => (int) $folder['id'], 'name' => (string) $folder['name']]);
            $currentId = $folder['parent_id'] !== null ? (int) $folder['parent_id'] : 0;
        }
        return $crumbs;
    }
}
