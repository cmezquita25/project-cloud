<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\UserRepository;

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
        $file = $this->require($id, $userId, 'full');
        $ownerUserId = (int) $file['user_id'];
        $ownerUser = (new UserRepository())->findById($ownerUserId);
        $ownerUsername = $ownerUser !== null ? (string) $ownerUser['username'] : $username;

        $name = $this->fs->sanitizeName($rawName);
        if ($this->fs->isBlockedExtension($name)) {
            throw new HttpException(422, 'BLOCKED_EXTENSION', 'Ese tipo de archivo no está permitido.');
        }
        if ($name === $file['name']) {
            return $file;
        }

        $folderId = $file['folder_id'] !== null ? (int) $file['folder_id'] : null;
        if ($this->files->existsByName($ownerUserId, $folderId, $name, $id)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un archivo con ese nombre.');
        }

        $oldPath = (string) $file['path'];
        $newPath = PathHelper::join(PathHelper::parent($oldPath), $name);

        $this->transaction(function () use ($id, $ownerUsername, $name, $oldPath, $newPath, $file) {
            $this->files->updateNameAndPath($id, $name, $newPath, PathHelper::extension($name));
            $this->fs->move($ownerUsername, $oldPath, $newPath); // sin efecto si es privado
            if (($file['visibility'] ?? 'public') === 'private') {
                // El binario privado se llama {id}.{ext}: si cambió la extensión, se renombra.
                $store = new PrivateFileStore($this->fs);
                $from = $store->path($ownerUsername, $id, $file['extension']);
                $to = $store->path($ownerUsername, $id, PathHelper::extension($name));
                if ($from !== $to && is_file($from) && !@rename($from, $to)) {
                    throw new HttpException(500, 'FS_ERROR', 'No se pudo renombrar el archivo privado.');
                }
            }
        });

        return $this->files->findAnyById($id) ?? [];
    }

    public function move(int $userId, string $username, int $id, ?int $targetFolderId): array
    {
        $file = $this->require($id, $userId, 'full');
        $ownerUserId = (int) $file['user_id'];
        $ownerUser = (new UserRepository())->findById($ownerUserId);
        $ownerUsername = $ownerUser !== null ? (string) $ownerUser['username'] : $username;

        $name = (string) $file['name'];
        $oldPath = (string) $file['path'];

        $targetPath = $this->folderPath($userId, $targetFolderId);
        if ($this->files->existsByName($ownerUserId, $targetFolderId, $name, $id)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un archivo con ese nombre en el destino.');
        }
        $newPath = PathHelper::join($targetPath, $name);
        if ($newPath === $oldPath) {
            return $file;
        }

        $this->transaction(function () use ($id, $ownerUsername, $targetFolderId, $oldPath, $newPath) {
            $this->files->updateFolderAndPath($id, $targetFolderId, $newPath);
            $this->fs->move($ownerUsername, $oldPath, $newPath);
        });
        (new VisibilityService($this->pdo))->enforceFile($id);

        return $this->files->findAnyById($id) ?? [];
    }

    public function duplicate(int $userId, string $username, int $id): array
    {
        $file = $this->require($id, $userId, 'read');
        $ownerUserId = (int) $file['user_id'];
        $ownerUser = (new UserRepository())->findById($ownerUserId);
        $ownerUsername = $ownerUser !== null ? (string) $ownerUser['username'] : $username;

        $folderId = $file['folder_id'] !== null ? (int) $file['folder_id'] : null;
        $parentPath = PathHelper::parent((string) $file['path']);

        $newName = PathHelper::uniqueName(
            (string) $file['name'],
            fn (string $n): bool => $this->files->existsByName($ownerUserId, $folderId, $n)
        );
        $newPath = PathHelper::join($parentPath, $newName);

        $newId = 0;
        $this->transaction(function () use ($ownerUserId, $ownerUsername, $file, $folderId, $newName, $newPath, &$newId) {
            $this->fs->copy($ownerUsername, (string) $file['path'], $newPath);
            $newId = $this->files->create(
                $ownerUserId,
                $folderId,
                $newName,
                $newPath,
                (int) $file['size_bytes'],
                $file['mime_type'] !== null ? (string) $file['mime_type'] : null,
                PathHelper::extension($newName),
            );
            (new UserRepository())->addUsedBytes($ownerUserId, (int) $file['size_bytes']);
            $this->copyPrivacy($ownerUsername, $file, $newId, PathHelper::extension($newName));
        });
        (new VisibilityService($this->pdo))->enforceFile($newId);

        return $this->files->findAnyById($newId) ?? [];
    }

    public function copy(int $userId, string $username, int $id, ?int $targetFolderId): array
    {
        $file = $this->require($id, $userId, 'read');
        $ownerUserId = (int) $file['user_id'];
        $ownerUser = (new UserRepository())->findById($ownerUserId);
        $ownerUsername = $ownerUser !== null ? (string) $ownerUser['username'] : $username;

        $targetPath = $this->folderPath($userId, $targetFolderId);
        $newName = PathHelper::uniqueName(
            (string) $file['name'],
            fn (string $n): bool => $this->files->existsByName($ownerUserId, $targetFolderId, $n)
        );
        $newPath = PathHelper::join($targetPath, $newName);

        $newId = 0;
        $this->transaction(function () use ($ownerUserId, $ownerUsername, $file, $targetFolderId, $newName, $newPath, &$newId) {
            $this->fs->copy($ownerUsername, (string) $file['path'], $newPath);
            $newId = $this->files->create(
                $ownerUserId,
                $targetFolderId,
                $newName,
                $newPath,
                (int) $file['size_bytes'],
                $file['mime_type'] !== null ? (string) $file['mime_type'] : null,
                PathHelper::extension($newName),
            );
            (new UserRepository())->addUsedBytes($ownerUserId, (int) $file['size_bytes']);
            $this->copyPrivacy($ownerUsername, $file, $newId, PathHelper::extension($newName));
        });
        (new VisibilityService($this->pdo))->enforceFile($newId);

        return $this->files->findAnyById($newId) ?? [];
    }

    public function delete(int $userId, string $username, int $id): void
    {
        $file = $this->require($id, $userId, 'full');
        $ownerUserId = (int) $file['user_id'];
        $ownerUser = (new UserRepository())->findById($ownerUserId);
        $ownerUsername = $ownerUser !== null ? (string) $ownerUser['username'] : $username;

        $this->transaction(function () use ($id, $ownerUserId, $ownerUsername, $file) {
            $this->files->softDelete($id);
            $this->fs->moveToTrash($ownerUsername, (string) $file['path'], 'f' . $id);
            (new UserRepository())->addUsedBytes($ownerUserId, -(int) $file['size_bytes']);
        });
    }

    public function setStarred(int $userId, int $id, bool $starred): array
    {
        $file = $this->require($id, $userId, 'read');
        $this->files->setStarred($id, $userId, $starred);
        return $this->files->findAnyById($id) ?? [];
    }

    /** URL pública directa del archivo. */
    public static function publicUrl(string $username, string $path): string
    {
        $base = rtrim((string) Config::get('storage.public_url', ''), '/');
        $encoded = implode('/', array_map('rawurlencode', explode('/', $path)));
        return "$base/" . rawurlencode($username) . '/' . $encoded;
    }

    // --- Helpers ---

    /**
     * Un archivo copiado de uno privado también es privado: se marca y se copia
     * su binario (la copia física de /storage no lo encuentra, porque no está ahí).
     *
     * @param array<string,mixed> $source
     */
    private function copyPrivacy(string $ownerUsername, array $source, int $newId, ?string $newExtension): void
    {
        if (($source['visibility'] ?? 'public') !== 'private') {
            return;
        }
        $this->pdo->prepare("UPDATE files SET visibility = 'private' WHERE id = ?")->execute([$newId]);
        (new PrivateFileStore($this->fs))->copy($ownerUsername, (int) $source['id'], $source['extension'], $newId, $newExtension);
    }

    private function require(int $id, int $userId, string $requiredPermission = 'read'): array
    {
        $file = $this->files->find($id, $userId);
        if ($file !== null) {
            return $file;
        }

        $file = $this->files->findAnyById($id);
        if ($file !== null) {
            $permService = new SharePermissionService($this->pdo);
            if ($permService->canAccessFile($userId, $id, $requiredPermission)) {
                return $file;
            }
        }

        throw HttpException::notFound('Archivo no encontrado');
    }

    private function folderPath(int $userId, ?int $folderId): string
    {
        if ($folderId === null) {
            return '';
        }
        $folder = $this->folders->find($folderId, $userId);
        if ($folder !== null) {
            return (string) $folder['path'];
        }

        $folder = $this->folders->findAnyById($folderId);
        if ($folder !== null) {
            $permService = new SharePermissionService($this->pdo);
            if ($permService->canAccessFolder($userId, $folderId, 'read')) {
                return (string) $folder['path'];
            }
        }

        throw new HttpException(422, 'INVALID_FOLDER', 'La carpeta destino no existe.');
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
