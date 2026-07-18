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
 * Papelera (Fase 7): listar, restaurar, borrar definitivamente y vaciar.
 *
 * Modelo: el borrado es soft (deleted_at). Al borrar una carpeta, todo su
 * subárbol queda marcado y el binario se mueve a /storage/.trash/{user} como una
 * única entrada de la carpeta raíz. Por eso solo se listan/operan las "raíces"
 * del borrado; sus descendientes viajan con ellas.
 *
 * Cuota: el uso se descuenta al enviar a papelera y se vuelve a sumar al
 * restaurar. Purgar no altera la cuota (ya estaba descontada).
 */
final class TrashService
{
    /** Días que un elemento permanece en la papelera antes de purgarse solo. */
    public const RETENTION_DAYS = 30;

    private PDO $pdo;

    public function __construct(
        private readonly FolderRepository $folders,
        private readonly FileRepository $files,
        private readonly FileSystemService $fs,
        private readonly UserRepository $users,
        ?PDO $pdo = null,
    ) {
        $this->pdo = $pdo ?? Database::pdo();
    }

    // --- Restaurar ---

    public function restoreFile(int $userId, string $username, int $id): array
    {
        $file = $this->files->findTrashed($id, $userId);
        if ($file === null) {
            throw HttpException::notFound('Archivo no encontrado en la papelera');
        }

        // Si su carpeta contenedora ya no existe (viva), restaura en la raíz.
        [$targetFolderId, $parentPath] = $this->liveTargetFolder($userId, $file['folder_id']);

        $name = (string) $file['name'];
        $ext  = $file['extension'] !== null ? (string) $file['extension'] : null;
        if ($this->files->existsByName($userId, $targetFolderId, $name)) {
            $name = PathHelper::uniqueName(
                $name,
                fn (string $n): bool => $this->files->existsByName($userId, $targetFolderId, $n)
            );
            $ext = PathHelper::extension($name);
        }
        $oldPath = (string) $file['path'];
        $newPath = PathHelper::join($parentPath, $name);

        $this->transaction(function () use ($id, $userId, $username, $targetFolderId, $name, $ext, $oldPath, $newPath, $file) {
            $this->files->restore($id, $targetFolderId, $name, $newPath, $ext);
            $this->fs->restoreFromTrash($username, 'f' . $id, $oldPath, $newPath);
            $this->users->addUsedBytes($userId, (int) $file['size_bytes']);
        });

        return $this->files->find($id, $userId) ?? [];
    }

    public function restoreFolder(int $userId, string $username, int $id): array
    {
        $folder = $this->folders->findTrashed($id, $userId);
        if ($folder === null) {
            throw HttpException::notFound('Carpeta no encontrada en la papelera');
        }

        [$targetParentId, $parentPath] = $this->liveTargetFolder($userId, $folder['parent_id']);

        $name = (string) $folder['name'];
        if ($this->folders->existsByName($userId, $targetParentId, $name)) {
            $name = PathHelper::uniqueName(
                $name,
                fn (string $n): bool => $this->folders->existsByName($userId, $targetParentId, $n)
            );
        }
        $oldPath = (string) $folder['path'];
        $newPath = PathHelper::join($parentPath, $name);

        $freed = $this->files->sumTrashedSizesUnderPath($userId, $oldPath);
        $reparented = ($name !== (string) $folder['name']) || $newPath !== $oldPath;

        $this->transaction(function () use (
            $id,
            $userId,
            $username,
            $targetParentId,
            $name,
            $oldPath,
            $newPath,
            $freed,
            $reparented
        ) {
            // 1) Reactiva subárbol (carpetas + archivos).
            $this->folders->restoreSubtree($userId, $id, $oldPath);
            $this->files->restoreUnderPath($userId, $oldPath);

            // 2) Si cambió el nombre/ubicación, recoloca raíz y reescribe rutas de descendientes.
            if ($reparented) {
                $this->folders->updateRestoredRoot($id, $targetParentId, $name, $newPath);
                $this->folders->rewriteDescendantPaths($userId, $oldPath, $newPath);
                $this->files->rewritePathPrefix($userId, $oldPath, $newPath);
            }

            // 3) Devuelve el binario a su sitio y recupera la cuota.
            $this->fs->restoreFromTrash($username, 'd' . $id, $oldPath, $newPath);
            if ($freed > 0) {
                $this->users->addUsedBytes($userId, $freed);
            }
        });

        return $this->folders->find($id, $userId) ?? [];
    }

    // --- Borrado definitivo ---

    public function purgeFile(int $userId, string $username, int $id): void
    {
        $file = $this->files->findTrashed($id, $userId);
        if ($file === null) {
            throw HttpException::notFound('Archivo no encontrado en la papelera');
        }
        $this->transaction(function () use ($id, $username, $file) {
            $this->files->purge($id);
            $this->fs->deleteFromTrash($username, 'f' . $id, (string) $file['path']);
        });
    }

    public function purgeFolder(int $userId, string $username, int $id): void
    {
        $folder = $this->folders->findTrashed($id, $userId);
        if ($folder === null) {
            throw HttpException::notFound('Carpeta no encontrada en la papelera');
        }
        $path = (string) $folder['path'];
        $this->transaction(function () use ($id, $userId, $username, $path) {
            $this->files->purgeUnderPath($userId, $path);
            $this->folders->purgeSubtree($userId, $id, $path);
            $this->fs->deleteFromTrash($username, 'd' . $id, $path);
        });
    }

    /** Vacía la papelera del usuario. Devuelve cuántos elementos raíz se purgaron. */
    public function empty(int $userId, string $username): int
    {
        $count = 0;
        foreach ($this->files->trashedRoots($userId) as $f) {
            $this->purgeFile($userId, $username, (int) $f['id']);
            $count++;
        }
        foreach ($this->folders->trashedRoots($userId) as $d) {
            $this->purgeFolder($userId, $username, (int) $d['id']);
            $count++;
        }
        return $count;
    }

    /**
     * Auto-purga perezosa: elimina los elementos raíz con más de RETENTION_DAYS
     * en la papelera. Se invoca al listar (best-effort, nunca rompe la petición).
     */
    public function collectGarbage(int $userId, string $username): void
    {
        $threshold = time() - self::RETENTION_DAYS * 86400;
        try {
            foreach ($this->files->trashedRoots($userId) as $f) {
                if ($this->isExpired($f['deleted_at'] ?? null, $threshold)) {
                    $this->purgeFile($userId, $username, (int) $f['id']);
                }
            }
            foreach ($this->folders->trashedRoots($userId) as $d) {
                if ($this->isExpired($d['deleted_at'] ?? null, $threshold)) {
                    $this->purgeFolder($userId, $username, (int) $d['id']);
                }
            }
        } catch (\Throwable) {
            // La limpieza automática nunca debe impedir ver la papelera.
        }
    }

    // --- Helpers ---

    /**
     * Resuelve la carpeta destino viva para restaurar. Si la carpeta original
     * fue borrada o no existe, cae a la raíz de la unidad.
     *
     * @return array{0:?int,1:string} [folderId|null, parentPath]
     */
    private function liveTargetFolder(int $userId, mixed $rawFolderId): array
    {
        if ($rawFolderId === null) {
            return [null, ''];
        }
        $parent = $this->folders->find((int) $rawFolderId, $userId); // solo vivas
        if ($parent === null) {
            return [null, ''];
        }
        return [(int) $parent['id'], (string) $parent['path']];
    }

    private function isExpired(mixed $deletedAt, int $threshold): bool
    {
        if (!is_string($deletedAt) || $deletedAt === '') {
            return false;
        }
        $ts = strtotime($deletedAt . ' UTC');
        return $ts !== false && $ts < $threshold;
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
