<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;

/**
 * Operaciones de archivos (metadatos en BD + binario en /storage), espejadas
 * de forma transaccional.
 */
final class FileService
{
    private PDO $pdo;

    public function __construct(
        private readonly FileRepository $files,
        private readonly FolderRepository $folders,
        private readonly FileSystemService $fs,
        ?PDO $pdo = null,
    ) {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function rename(int $userId, string $username, int $id, string $rawName): array
    {
        $file = $this->require($id, $userId);
        $name = $this->fs->sanitizeName($rawName);
        if ($this->fs->isBlockedExtension($name)) {
            throw new HttpException(422, 'BLOCKED_EXTENSION', 'Ese tipo de archivo no está permitido.');
        }
        if ($name === $file['name']) {
            return $file;
        }

        $folderId = $file['folder_id'] !== null ? (int) $file['folder_id'] : null;
        if ($this->files->existsByName($userId, $folderId, $name, $id)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un archivo con ese nombre.');
        }

        $oldPath = (string) $file['path'];
        $newPath = PathHelper::join(PathHelper::parent($oldPath), $name);

        $this->transaction(function () use ($id, $username, $name, $oldPath, $newPath) {
            $this->files->updateNameAndPath($id, $name, $newPath, PathHelper::extension($name));
            $this->fs->move($username, $oldPath, $newPath);
        });

        return $this->files->find($id, $userId) ?? [];
    }

    public function move(int $userId, string $username, int $id, ?int $targetFolderId): array
    {
        $file = $this->require($id, $userId);
        $name = (string) $file['name'];
        $oldPath = (string) $file['path'];

        $targetPath = $this->folderPath($userId, $targetFolderId);
        if ($this->files->existsByName($userId, $targetFolderId, $name, $id)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un archivo con ese nombre en el destino.');
        }
        $newPath = PathHelper::join($targetPath, $name);
        if ($newPath === $oldPath) {
            return $file;
        }

        $this->transaction(function () use ($id, $username, $targetFolderId, $oldPath, $newPath) {
            $this->files->updateFolderAndPath($id, $targetFolderId, $newPath);
            $this->fs->move($username, $oldPath, $newPath);
        });

        return $this->files->find($id, $userId) ?? [];
    }

    public function duplicate(int $userId, string $username, int $id): array
    {
        $file = $this->require($id, $userId);
        $folderId = $file['folder_id'] !== null ? (int) $file['folder_id'] : null;
        $parentPath = PathHelper::parent((string) $file['path']);

        $newName = PathHelper::uniqueName(
            (string) $file['name'],
            fn (string $n): bool => $this->files->existsByName($userId, $folderId, $n)
        );
        $newPath = PathHelper::join($parentPath, $newName);

        $newId = 0;
        $this->transaction(function () use ($userId, $username, $file, $folderId, $newName, $newPath, &$newId) {
            $this->fs->copy($username, (string) $file['path'], $newPath);
            $newId = $this->files->create(
                $userId,
                $folderId,
                $newName,
                $newPath,
                (int) $file['size_bytes'],
                $file['mime_type'] !== null ? (string) $file['mime_type'] : null,
                PathHelper::extension($newName),
            );
        });

        return $this->files->find($newId, $userId) ?? [];
    }

    public function copy(int $userId, string $username, int $id, ?int $targetFolderId): array
    {
        $file = $this->require($id, $userId);
        $targetPath = $this->folderPath($userId, $targetFolderId);
        $newName = PathHelper::uniqueName(
            (string) $file['name'],
            fn (string $n): bool => $this->files->existsByName($userId, $targetFolderId, $n)
        );
        $newPath = PathHelper::join($targetPath, $newName);

        $newId = 0;
        $this->transaction(function () use ($userId, $username, $file, $targetFolderId, $newName, $newPath, &$newId) {
            $this->fs->copy($username, (string) $file['path'], $newPath);
            $newId = $this->files->create(
                $userId,
                $targetFolderId,
                $newName,
                $newPath,
                (int) $file['size_bytes'],
                $file['mime_type'] !== null ? (string) $file['mime_type'] : null,
                PathHelper::extension($newName),
            );
        });

        return $this->files->find($newId, $userId) ?? [];
    }

    public function delete(int $userId, string $username, int $id): void
    {
        $file = $this->require($id, $userId);
        $this->transaction(function () use ($id, $username, $file) {
            $this->files->softDelete($id);
            $this->fs->moveToTrash($username, (string) $file['path'], 'f' . $id);
        });
    }

    public function setStarred(int $userId, int $id, bool $starred): array
    {
        $this->require($id, $userId);
        $this->files->setStarred($id, $userId, $starred);
        return $this->files->find($id, $userId) ?? [];
    }

    /** URL pública directa del archivo. */
    public static function publicUrl(string $username, string $path): string
    {
        $base = rtrim((string) Config::get('storage.public_url', ''), '/');
        $encoded = implode('/', array_map('rawurlencode', explode('/', $path)));
        return "$base/" . rawurlencode($username) . '/' . $encoded;
    }

    // --- Helpers ---

    private function require(int $id, int $userId): array
    {
        $file = $this->files->find($id, $userId);
        if ($file === null) {
            throw HttpException::notFound('Archivo no encontrado');
        }
        return $file;
    }

    private function folderPath(int $userId, ?int $folderId): string
    {
        if ($folderId === null) {
            return '';
        }
        $folder = $this->folders->find($folderId, $userId);
        if ($folder === null) {
            throw new HttpException(422, 'INVALID_FOLDER', 'La carpeta destino no existe.');
        }
        return (string) $folder['path'];
    }

    private function transaction(callable $fn): void
    {
        $this->pdo->beginTransaction();
        try {
            $fn();
            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }
}
