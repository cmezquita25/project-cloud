<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\UserRepository;

/**
 * Visibilidad de archivos y carpetas de «Mi unidad».
 *
 * Reglas:
 *   - Solo el propietario la cambia (los invitados, aunque tengan permiso
 *     completo, no).
 *   - Una carpeta privada hace privado todo su contenido, incluido lo que se
 *     suba, mueva, copie o restaure dentro después.
 *   - Una carpeta pública puede contener archivos privados sueltos.
 *   - Cada archivo se mueve de inmediato y su fila se actualiza justo después:
 *     si algo falla a mitad de una carpeta, lo ya movido queda coherente.
 */
final class VisibilityService
{
    private PDO $pdo;
    private PrivateFileStore $store;

    public function __construct(?PDO $pdo = null, ?PrivateFileStore $store = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
        $this->store = $store ?? new PrivateFileStore();
    }

    /** @return array<string,mixed> Archivo actualizado */
    public function setFile(int $userId, int $fileId, string $visibility): array
    {
        self::assertValue($visibility);
        $file = $this->ownedFile($userId, $fileId);
        if ($visibility === 'public' && $this->folderIsPrivate($file['folder_id'] !== null ? (int) $file['folder_id'] : null)) {
            throw new HttpException(422, 'PARENT_PRIVATE', 'Este archivo está dentro de una carpeta privada. Para hacerlo público, muévelo fuera o haz pública la carpeta.');
        }
        $this->applyToFile($this->username($userId), $file, $visibility);
        return $this->fileRow($fileId);
    }

    /**
     * Cambia la visibilidad de una carpeta y de todo su contenido.
     *
     * @return array{folder:array<string,mixed>, files:int}
     */
    public function setFolder(int $userId, int $folderId, string $visibility): array
    {
        self::assertValue($visibility);
        $stmt = $this->pdo->prepare('SELECT * FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
        $stmt->execute([$folderId, $userId]);
        $folder = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$folder) {
            throw HttpException::forbidden('Solo el propietario puede cambiar la visibilidad de esta carpeta.');
        }
        if ($visibility === 'public' && $this->folderIsPrivate($folder['parent_id'] !== null ? (int) $folder['parent_id'] : null)) {
            throw new HttpException(422, 'PARENT_PRIVATE', 'Esta carpeta está dentro de otra carpeta privada. Haz pública la carpeta superior primero.');
        }
        $changed = $this->applyToSubtree($userId, $this->username($userId), (string) $folder['path'], $visibility);
        $stmt = $this->pdo->prepare('SELECT * FROM folders WHERE id = ?');
        $stmt->execute([$folderId]);
        return ['folder' => (array) $stmt->fetch(PDO::FETCH_ASSOC), 'files' => $changed];
    }

    /** ¿La carpeta (o alguna superior) es privada? */
    public function folderIsPrivate(?int $folderId): bool
    {
        if ($folderId === null) {
            return false;
        }
        $stmt = $this->pdo->prepare('SELECT visibility FROM folders WHERE id = ?');
        $stmt->execute([$folderId]);
        return $stmt->fetchColumn() === 'private';
    }

    /** Visibilidad de un archivo nuevo en esa carpeta: privada si la carpeta lo es; si no, la preferencia del usuario. */
    public function defaultFor(int $ownerId, ?int $folderId): string
    {
        if ($this->folderIsPrivate($folderId)) {
            return 'private';
        }
        $stmt = $this->pdo->prepare('SELECT default_visibility FROM users WHERE id = ?');
        $stmt->execute([$ownerId]);
        return $stmt->fetchColumn() === 'private' ? 'private' : 'public';
    }

    /**
     * Tras mover, copiar o restaurar un archivo: si quedó dentro de una carpeta
     * privada, se hace privado.
     */
    public function enforceFile(int $fileId): void
    {
        $file = $this->fileRow($fileId);
        if ($file !== [] && $file['visibility'] !== 'private' && $file['deleted_at'] === null
            && $this->folderIsPrivate($file['folder_id'] !== null ? (int) $file['folder_id'] : null)) {
            $this->applyToFile($this->username((int) $file['user_id']), $file, 'private');
        }
    }

    /** Tras mover, copiar o restaurar una carpeta: si quedó dentro de una privada, todo su contenido se hace privado. */
    public function enforceFolder(int $folderId): void
    {
        $stmt = $this->pdo->prepare('SELECT * FROM folders WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$folderId]);
        $folder = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($folder && $this->folderIsPrivate($folder['parent_id'] !== null ? (int) $folder['parent_id'] : null)) {
            $this->applyToSubtree((int) $folder['user_id'], $this->username((int) $folder['user_id']), (string) $folder['path'], 'private');
        }
    }

    // ── Internos ─────────────────────────────────────────────────────────────

    /** @return int archivos cambiados */
    private function applyToSubtree(int $userId, string $username, string $path, string $visibility): int
    {
        $like = rtrim($path, '/') . '/%';
        $this->pdo->prepare('UPDATE folders SET visibility = ?, updated_at = updated_at WHERE user_id = ? AND deleted_at IS NULL AND (path = ? OR path LIKE ?)')
            ->execute([$visibility, $userId, $path, $like]);

        // Cuando se hace pública, los archivos privados sueltos de dentro también
        // pasan a públicos: el admin pidió hacer pública la carpeta entera.
        $stmt = $this->pdo->prepare('SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL AND visibility <> ? AND (path = ? OR path LIKE ?)');
        $stmt->execute([$userId, $visibility, $path, $like]);
        $count = 0;
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $file) {
            $this->applyToFile($username, $file, $visibility);
            $count++;
        }
        return $count;
    }

    /** @param array<string,mixed> $file */
    private function applyToFile(string $username, array $file, string $visibility): void
    {
        if (($file['visibility'] ?? 'public') === $visibility) {
            return;
        }
        if ($file['deleted_at'] === null) {
            $visibility === 'private' ? $this->store->toPrivate($username, $file) : $this->store->toPublic($username, $file);
        }
        $this->pdo->prepare('UPDATE files SET visibility = ?, updated_at = updated_at WHERE id = ?')->execute([$visibility, (int) $file['id']]);
    }

    /** @return array<string,mixed> */
    private function ownedFile(int $userId, int $fileId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
        $stmt->execute([$fileId, $userId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$file) {
            throw HttpException::forbidden('Solo el propietario puede cambiar la visibilidad de este archivo.');
        }
        return $file;
    }

    /** @return array<string,mixed> */
    private function fileRow(int $fileId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM files WHERE id = ?');
        $stmt->execute([$fileId]);
        return (array) ($stmt->fetch(PDO::FETCH_ASSOC) ?: []);
    }

    private function username(int $userId): string
    {
        return (string) ((new UserRepository($this->pdo))->findById($userId)['username'] ?? '');
    }

    private static function assertValue(string $visibility): void
    {
        if (!in_array($visibility, ['public', 'private'], true)) {
            throw HttpException::validation(['visibility' => ['Debe ser «public» o «private».']]);
        }
    }
}
