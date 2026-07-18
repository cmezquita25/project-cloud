<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Acceso a datos de archivos (metadatos; el binario vive en /storage).
 */
class FileRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function find(int $id, int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([$id, $userId]);
        return $stmt->fetch() ?: null;
    }

    /** @return array<int,array<string,mixed>> Archivos vivos de una carpeta. */
    public function inFolder(int $userId, ?int $folderId): array
    {
        if ($folderId === null) {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM files WHERE user_id = ? AND folder_id IS NULL AND deleted_at IS NULL ORDER BY name'
            );
            $stmt->execute([$userId]);
        } else {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM files WHERE user_id = ? AND folder_id = ? AND deleted_at IS NULL ORDER BY name'
            );
            $stmt->execute([$userId, $folderId]);
        }
        return $stmt->fetchAll();
    }

    public function existsByName(int $userId, ?int $folderId, string $name, int $excludeId = 0): bool
    {
        $sql = 'SELECT COUNT(*) FROM files WHERE user_id = ? AND deleted_at IS NULL AND name = ? AND id <> ? AND '
            . ($folderId === null ? 'folder_id IS NULL' : 'folder_id = ?');
        $params = [$userId, $name, $excludeId];
        if ($folderId !== null) {
            $params[] = $folderId;
        }
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn() > 0;
    }

    /** @return int Nuevo id. */
    public function create(
        int $userId,
        ?int $folderId,
        string $name,
        string $path,
        int $sizeBytes,
        ?string $mimeType,
        ?string $extension,
    ): int {
        $stmt = $this->pdo->prepare(
            'INSERT INTO files (user_id, folder_id, name, path, size_bytes, mime_type, extension)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $folderId, $name, $path, $sizeBytes, $mimeType, $extension]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateNameAndPath(int $id, string $name, string $path, ?string $extension): void
    {
        $stmt = $this->pdo->prepare('UPDATE files SET name = ?, path = ?, extension = ? WHERE id = ?');
        $stmt->execute([$name, $path, $extension, $id]);
    }

    public function updateFolderAndPath(int $id, ?int $folderId, string $path): void
    {
        $stmt = $this->pdo->prepare('UPDATE files SET folder_id = ?, path = ? WHERE id = ?');
        $stmt->execute([$folderId, $path, $id]);
    }

    public function setStarred(int $id, int $userId, bool $starred): void
    {
        $stmt = $this->pdo->prepare('UPDATE files SET is_starred = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$starred ? 1 : 0, $id, $userId]);
    }

    public function softDelete(int $id): void
    {
        $stmt = $this->pdo->prepare('UPDATE files SET deleted_at = UTC_TIMESTAMP() WHERE id = ?');
        $stmt->execute([$id]);
    }

    /** Soft-delete de todos los archivos bajo un prefijo de ruta (subárbol de carpeta). */
    public function softDeleteUnderPath(int $userId, string $pathPrefix): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE files SET deleted_at = UTC_TIMESTAMP()
              WHERE user_id = ? AND deleted_at IS NULL AND path LIKE ?"
        );
        $stmt->execute([$userId, $pathPrefix . '/%']);
    }

    /** Suma de tamaños de archivos vivos bajo un prefijo de ruta (incluye subcarpetas). */
    public function sumSizesUnderPath(int $userId, string $pathPrefix): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE user_id = ? AND deleted_at IS NULL AND path LIKE ?'
        );
        $stmt->execute([$userId, $pathPrefix . '/%']);
        return (int) $stmt->fetchColumn();
    }

    /** @return array<int,array<string,mixed>> Archivos (vivos) bajo un prefijo de ruta. */
    public function subtreeUnderPath(int $userId, string $pathPrefix): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL AND path LIKE ? ORDER BY path"
        );
        $stmt->execute([$userId, $pathPrefix . '/%']);
        return $stmt->fetchAll();
    }

    /** Reescribe el prefijo de ruta de los archivos bajo una carpeta renombrada/movida. */
    public function rewritePathPrefix(int $userId, string $oldPrefix, string $newPrefix): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE files
                SET path = CONCAT(?, SUBSTRING(path, CHAR_LENGTH(?) + 1))
              WHERE user_id = ? AND deleted_at IS NULL AND path LIKE ?"
        );
        $stmt->execute([$newPrefix, $oldPrefix, $userId, $oldPrefix . '/%']);
    }
}
