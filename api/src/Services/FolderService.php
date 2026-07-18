<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Operaciones de carpetas: espejan el cambio en disco y en BD de forma
 * transaccional. Las rutas materializadas de descendientes se reescriben
 * en rename/move.
 */
final class FolderService
{
    private PDO $pdo;

    public function __construct(
        private readonly FolderRepository $folders,
        private readonly FileRepository $files,
        private readonly FileSystemService $fs,
        ?PDO $pdo = null,
    ) {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function create(int $userId, string $username, ?int $parentId, string $rawName): array
    {
        $name = $this->fs->sanitizeName($rawName);
        $parentPath = $this->parentPath($userId, $parentId);

        if ($this->folders->existsByName($userId, $parentId, $name)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe una carpeta con ese nombre.');
        }

        $path = PathHelper::join($parentPath, $name);
        $this->fs->makeDir($username, $path);
        $id = $this->folders->create($userId, $parentId, $name, $path);

        return $this->folders->find($id, $userId) ?? [];
    }

    public function rename(int $userId, string $username, int $id, string $rawName): array
    {
        $folder = $this->require($id, $userId);
        $name = $this->fs->sanitizeName($rawName);
        if ($name === $folder['name']) {
            return $folder;
        }

        $parentId = $folder['parent_id'] !== null ? (int) $folder['parent_id'] : null;
        if ($this->folders->existsByName($userId, $parentId, $name, $id)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe una carpeta con ese nombre.');
        }

        $oldPath = (string) $folder['path'];
        $newPath = PathHelper::join(PathHelper::parent($oldPath), $name);

        $this->transaction(function () use ($id, $userId, $username, $name, $oldPath, $newPath) {
            $this->folders->updateNameAndPath($id, $name, $newPath);
            $this->folders->rewriteDescendantPaths($userId, $oldPath, $newPath);
            $this->files->rewritePathPrefix($userId, $oldPath, $newPath);
            $this->fs->move($username, $oldPath, $newPath);
        });

        return $this->folders->find($id, $userId) ?? [];
    }

    public function move(int $userId, string $username, int $id, ?int $targetParentId): array
    {
        $folder = $this->require($id, $userId);
        $oldPath = (string) $folder['path'];
        $name = (string) $folder['name'];

        // No se puede mover una carpeta dentro de sí misma o de un descendiente.
        if ($targetParentId === $id) {
            throw new HttpException(422, 'INVALID_MOVE', 'No puedes mover una carpeta dentro de sí misma.');
        }
        if ($targetParentId !== null) {
            $target = $this->require($targetParentId, $userId);
            $targetPath = (string) $target['path'];
            if ($targetPath === $oldPath || str_starts_with($targetPath, $oldPath . '/')) {
                throw new HttpException(422, 'INVALID_MOVE', 'No puedes mover una carpeta dentro de sí misma.');
            }
        }

        $newParentPath = $this->parentPath($userId, $targetParentId);
        if ($this->folders->existsByName($userId, $targetParentId, $name, $id)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe una carpeta con ese nombre en el destino.');
        }
        $newPath = PathHelper::join($newParentPath, $name);
        if ($newPath === $oldPath) {
            return $folder;
        }

        $this->transaction(function () use ($id, $userId, $username, $targetParentId, $name, $oldPath, $newPath) {
            $this->folders->updateParentAndPath($id, $targetParentId, $name, $newPath);
            $this->folders->rewriteDescendantPaths($userId, $oldPath, $newPath);
            $this->files->rewritePathPrefix($userId, $oldPath, $newPath);
            $this->fs->move($username, $oldPath, $newPath);
        });

        return $this->folders->find($id, $userId) ?? [];
    }

    public function delete(int $userId, string $username, int $id): void
    {
        $folder = $this->require($id, $userId);
        $path = (string) $folder['path'];

        $freed = $this->files->sumSizesUnderPath($userId, $path);
        $this->transaction(function () use ($id, $userId, $username, $path, $freed) {
            $this->folders->softDeleteSubtree($userId, $id, $path);
            $this->files->softDeleteUnderPath($userId, $path);
            $this->fs->moveToTrash($username, $path, 'd' . $id);
            if ($freed > 0) {
                (new UserRepository())->addUsedBytes($userId, -$freed);
            }
        });
    }

    public function setStarred(int $userId, int $id, bool $starred): array
    {
        $this->require($id, $userId);
        $this->folders->setStarred($id, $userId, $starred);
        return $this->folders->find($id, $userId) ?? [];
    }

    public function copy(int $userId, string $username, int $id, ?int $targetParentId): array
    {
        $folder = $this->require($id, $userId);
        $oldRootPath = (string) $folder['path'];

        if ($targetParentId !== null) {
            $target = $this->require($targetParentId, $userId);
            $targetPath = (string) $target['path'];
            if ($targetPath === $oldRootPath || str_starts_with($targetPath, $oldRootPath . '/')) {
                throw new HttpException(422, 'INVALID_COPY', 'No puedes copiar una carpeta dentro de sí misma.');
            }
        }

        $parentPath = $this->parentPath($userId, $targetParentId);
        $newName = PathHelper::uniqueName(
            (string) $folder['name'],
            fn (string $n): bool => $this->folders->existsByName($userId, $targetParentId, $n)
        );
        $newRootPath = PathHelper::join($parentPath, $newName);

        $newRootId = 0;
        $this->transaction(function () use (
            $userId,
            $username,
            $folder,
            $targetParentId,
            $newName,
            $oldRootPath,
            $newRootPath,
            &$newRootId
        ) {
            // Copia física del subárbol.
            $this->fs->copy($username, $oldRootPath, $newRootPath);

            // Recrea la carpeta raíz de la copia.
            $newRootId = $this->folders->create($userId, $targetParentId, $newName, $newRootPath);

            // Mapea oldFolderId -> newFolderId para recolocar padres.
            $map = [(int) $folder['id'] => $newRootId];

            // Recrea subcarpetas (ordenadas por profundidad).
            foreach ($this->folders->subtree($userId, (int) $folder['id'], $oldRootPath) as $sub) {
                $subId = (int) $sub['id'];
                if ($subId === (int) $folder['id']) {
                    continue;
                }
                $newSubPath = $newRootPath . substr((string) $sub['path'], strlen($oldRootPath));
                $oldParent = $sub['parent_id'] !== null ? (int) $sub['parent_id'] : null;
                $newParent = $oldParent !== null ? ($map[$oldParent] ?? $newRootId) : $newRootId;
                $map[$subId] = $this->folders->create($userId, $newParent, (string) $sub['name'], $newSubPath);
            }

            // Recrea archivos del subárbol.
            $copiedBytes = 0;
            foreach ($this->files->subtreeUnderPath($userId, $oldRootPath) as $file) {
                $newFilePath = $newRootPath . substr((string) $file['path'], strlen($oldRootPath));
                $oldFolder = $file['folder_id'] !== null ? (int) $file['folder_id'] : null;
                $newFolder = $oldFolder !== null ? ($map[$oldFolder] ?? $newRootId) : $newRootId;
                $this->files->create(
                    $userId,
                    $newFolder,
                    (string) $file['name'],
                    $newFilePath,
                    (int) $file['size_bytes'],
                    $file['mime_type'] !== null ? (string) $file['mime_type'] : null,
                    $file['extension'] !== null ? (string) $file['extension'] : null,
                );
                $copiedBytes += (int) $file['size_bytes'];
            }
            if ($copiedBytes > 0) {
                (new UserRepository())->addUsedBytes($userId, $copiedBytes);
            }
        });

        return $this->folders->find($newRootId, $userId) ?? [];
    }

    // --- Helpers ---

    private function require(int $id, int $userId): array
    {
        $folder = $this->folders->find($id, $userId);
        if ($folder === null) {
            throw HttpException::notFound('Carpeta no encontrada');
        }
        return $folder;
    }

    private function parentPath(int $userId, ?int $parentId): string
    {
        if ($parentId === null) {
            return '';
        }
        $parent = $this->folders->find($parentId, $userId);
        if ($parent === null) {
            throw new HttpException(422, 'INVALID_PARENT', 'La carpeta destino no existe.');
        }
        return (string) $parent['path'];
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
