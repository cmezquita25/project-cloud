<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;

/**
 * Binarios de los archivos privados.
 *
 * Los archivos públicos viven en storage/{usuario}/{ruta} (su URL directa). Los
 * privados, en storage/.private/{usuario}/{id}.{ext}: guardados por id y no por
 * ruta, así que renombrar o mover carpetas no los toca y el nombre en disco no
 * revela nada. La carpeta .private está bloqueada para la web (.htaccess de
 * storage); solo PHP la sirve, con sesión o con una URL firmada.
 */
final class PrivateFileStore
{
    public const DIR = '.private';

    private string $storageRoot;
    private FileSystemService $fs;

    public function __construct(?FileSystemService $fs = null)
    {
        $this->storageRoot = rtrim((string) Config::get('storage.path', ''), '/\\');
        $this->fs = $fs ?? new FileSystemService();
    }

    public function userRoot(string $username): string
    {
        return $this->storageRoot . DIRECTORY_SEPARATOR . self::DIR . DIRECTORY_SEPARATOR . $this->fs->sanitizeName($username);
    }

    /** Ruta del binario privado de un archivo. */
    public function path(string $username, int $fileId, ?string $extension): string
    {
        $ext = $extension !== null && preg_match('/^[A-Za-z0-9]{1,16}$/', $extension) === 1 ? '.' . strtolower($extension) : '';
        return $this->userRoot($username) . DIRECTORY_SEPARATOR . $fileId . $ext;
    }

    /** Ruta física real de un archivo según su visibilidad. @param array<string,mixed> $file */
    public function physicalPath(string $username, array $file): string
    {
        return ($file['visibility'] ?? 'public') === 'private'
            ? $this->path($username, (int) $file['id'], $file['extension'] ?? null)
            : $this->fs->abs($username, (string) $file['path']);
    }

    /** Mueve el binario de la ubicación pública a la privada. @param array<string,mixed> $file */
    public function toPrivate(string $username, array $file): void
    {
        $src = $this->fs->abs($username, (string) $file['path']);
        $dst = $this->path($username, (int) $file['id'], $file['extension'] ?? null);
        if (!is_file($src)) {
            return; // nada físico (p. ej. en la papelera); la BD manda
        }
        $this->fs->ensureDir(dirname($dst));
        $this->ensureWebBlock();
        if (!@rename($src, $dst)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo hacer privado el archivo.');
        }
    }

    /** Devuelve el binario a su ruta pública. @param array<string,mixed> $file */
    public function toPublic(string $username, array $file): void
    {
        $src = $this->path($username, (int) $file['id'], $file['extension'] ?? null);
        $dst = $this->fs->abs($username, (string) $file['path']);
        if (!is_file($src)) {
            return;
        }
        if (file_exists($dst)) {
            throw new HttpException(409, 'FS_CONFLICT', 'Ya existe un archivo público con esa ruta.');
        }
        $this->fs->ensureDir(dirname($dst));
        if (!@rename($src, $dst)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo hacer público el archivo.');
        }
    }

    /** Copia el binario de un archivo privado para un archivo nuevo. */
    public function copy(string $username, int $srcId, ?string $srcExt, int $dstId, ?string $dstExt): void
    {
        $src = $this->path($username, $srcId, $srcExt);
        if (!is_file($src)) {
            return;
        }
        $dst = $this->path($username, $dstId, $dstExt);
        $this->fs->ensureDir(dirname($dst));
        if (!@copy($src, $dst)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo copiar el archivo privado.');
        }
    }

    public function delete(string $username, int $fileId, ?string $extension): void
    {
        @unlink($this->path($username, $fileId, $extension));
    }

    /**
     * Borra los binarios privados de un subárbol (antes de purgar sus filas).
     */
    public function deleteUnderPath(int $userId, string $username, string $path): void
    {
        $stmt = Database::pdo()->prepare(
            "SELECT id, extension FROM files WHERE user_id = ? AND visibility = 'private' AND (path = ? OR path LIKE ?)"
        );
        $stmt->execute([$userId, $path, rtrim($path, '/') . '/%']);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $this->delete($username, (int) $row['id'], $row['extension']);
        }
    }

    public function deleteUser(string $username): void
    {
        $this->fs->delete($this->userRoot($username));
    }

    /**
     * Garantiza que storage/.htaccess bloquee /storage/.private (instalaciones
     * anteriores a esta versión no tienen la regla). Idempotente.
     */
    public function ensureWebBlock(): void
    {
        $htaccess = $this->storageRoot . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($htaccess)) {
            return;
        }
        $content = (string) @file_get_contents($htaccess);
        if (!str_contains($content, '^/storage/\\.private')) {
            @file_put_contents(
                $htaccess,
                rtrim($content) . "\n\n# 6. Archivos privados: solo los sirve PHP (con sesión o enlace firmado).\nRedirectMatch 404 ^/storage/\\.private\n",
                LOCK_EX
            );
        }
    }
}
