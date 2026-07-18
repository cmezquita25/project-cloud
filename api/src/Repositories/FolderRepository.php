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
    public function children(int $userId, ?int $parentId): array
    {
        if ($parentId === null) {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM folders WHERE user_id = ? AND parent_id IS NULL AND deleted_at IS NULL ORDER BY name'
            );
            $stmt->execute([$userId]);
        } else {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM folders WHERE user_id = ? AND parent_id = ? AND deleted_at IS NULL ORDER BY name'
            );
            $stmt->execute([$userId, $parentId]);
        }
        return $stmt->fetchAll();
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
