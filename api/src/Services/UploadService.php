<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use finfo;
use PDO;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Subida por CHUNKS. Permite subir archivos grandes superando los límites de
 * PHP (upload_max_filesize/post_max_size) enviando trozos al cuerpo crudo.
 *
 * Flujo: init (valida cuota/tamaño, crea sesión) → chunk* (anexa) → complete
 * (verifica MIME real, mueve a destino, registra en BD, actualiza uso).
 *
 * La sesión se guarda en /storage/.uploads/{userId}/{id}.json + {id}.part
 * (fuera del alcance web por el .htaccess de /storage).
 */
final class UploadService
{
    private const SESSION_TTL = 86400; // 24 h

    private PDO $pdo;

    public function __construct(
        private readonly FileRepository $files,
        private readonly FolderRepository $folders,
        private readonly UserRepository $users,
        private readonly FileSystemService $fs,
        ?PDO $pdo = null,
    ) {
        $this->pdo = $pdo ?? Database::pdo();
    }

    /**
     * Inicia una subida. Valida extensión, tamaño por archivo y cuota.
     *
     * @return array{upload_id:string,chunk_size:int,offset:int,name:string}
     */
    public function init(int $userId, ?int $folderId, string $rawName, int $size, ?string $mime): array
    {
        $this->cleanupOrphans($userId);

        $name = $this->fs->sanitizeName($rawName);
        if ($this->fs->isBlockedExtension($name)) {
            throw new HttpException(422, 'BLOCKED_EXTENSION', 'Ese tipo de archivo no está permitido.');
        }
        if ($size < 0) {
            throw new HttpException(422, 'INVALID_SIZE', 'Tamaño inválido.');
        }

        $user = $this->users->findById($userId);
        if ($user === null) {
            throw HttpException::unauthorized();
        }
        $maxUpload = (int) $user['max_upload_bytes'];
        if ($maxUpload > 0 && $size > $maxUpload) {
            throw new HttpException(413, 'FILE_TOO_LARGE', 'El archivo supera el tamaño máximo por archivo.', [
                'max_upload_bytes' => $maxUpload,
            ]);
        }
        $quota = (int) $user['quota_bytes'];
        if ($quota > 0 && (int) $user['used_bytes'] + $size > $quota) {
            throw new HttpException(413, 'QUOTA_EXCEEDED', 'No tienes espacio suficiente.', [
                'quota_bytes' => $quota,
                'used_bytes'  => (int) $user['used_bytes'],
            ]);
        }

        // Resuelve la carpeta destino y evita colisiones de nombre.
        $folderPath = '';
        if ($folderId !== null) {
            $folder = $this->folders->find($folderId, $userId);
            if ($folder === null) {
                throw new HttpException(422, 'INVALID_FOLDER', 'La carpeta destino no existe.');
            }
            $folderPath = (string) $folder['path'];
        }
        $name = PathHelper::uniqueName(
            $name,
            fn (string $n): bool => $this->files->existsByName($userId, $folderId, $n)
        );

        $uploadId = bin2hex(random_bytes(16));
        $dir = $this->uploadsDir($userId);
        file_put_contents("$dir/$uploadId.json", json_encode([
            'user_id'     => $userId,
            'name'        => $name,
            'folder_id'   => $folderId,
            'folder_path' => $folderPath,
            'size'        => $size,
            'mime'        => $mime,
            'created_at'  => time(),
        ]));
        file_put_contents("$dir/$uploadId.part", '');

        return [
            'upload_id'  => $uploadId,
            'chunk_size' => $this->chunkSize(),
            'offset'     => 0,
            'name'       => $name,
        ];
    }

    /** Anexa un trozo en el offset indicado. @return array{offset:int} */
    public function chunk(int $userId, string $uploadId, int $offset, string $data): array
    {
        [$meta, $partPath] = $this->session($userId, $uploadId);
        $current = (int) (filesize($partPath) ?: 0);

        if ($offset !== $current) {
            throw new HttpException(409, 'OFFSET_MISMATCH', 'Offset incorrecto.', ['expected' => $current]);
        }
        $len = strlen($data);
        if ($current + $len > (int) $meta['size']) {
            throw new HttpException(413, 'CHUNK_TOO_LARGE', 'El trozo excede el tamaño declarado.');
        }

        $fh = fopen($partPath, 'ab');
        if ($fh === false) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo escribir el trozo.');
        }
        fwrite($fh, $data);
        fclose($fh);

        return ['offset' => $current + $len];
    }

    /** Ensambla, verifica y registra el archivo. @return array<string,mixed> */
    public function complete(int $userId, string $username, string $uploadId): array
    {
        [$meta, $partPath] = $this->session($userId, $uploadId);
        $actual = (int) (filesize($partPath) ?: 0);
        if ($actual !== (int) $meta['size']) {
            throw new HttpException(422, 'SIZE_MISMATCH', 'La subida está incompleta o corrupta.');
        }

        // MIME real del contenido (no confiamos en el declarado por el cliente).
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($partPath) ?: 'application/octet-stream';

        // Revalida cuota (por si cambió durante la subida).
        $user = $this->users->findById($userId);
        if ($user !== null && (int) $user['quota_bytes'] > 0
            && (int) $user['used_bytes'] + $actual > (int) $user['quota_bytes']) {
            @unlink($partPath);
            @unlink($this->metaPath($userId, $uploadId));
            throw new HttpException(413, 'QUOTA_EXCEEDED', 'No tienes espacio suficiente.');
        }

        $folderId = $meta['folder_id'] !== null ? (int) $meta['folder_id'] : null;
        $name = (string) $meta['name'];
        $path = PathHelper::join((string) $meta['folder_path'], $name);

        $newId = 0;
        $this->transaction(function () use ($userId, $username, $folderId, $name, $path, $partPath, $actual, $mime, &$newId) {
            $dst = $this->fs->abs($username, $path);
            $this->fs->ensureDir(dirname($dst));
            if (file_exists($dst)) {
                throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un archivo con ese nombre.');
            }
            if (!@rename($partPath, $dst)) {
                throw new HttpException(500, 'FS_ERROR', 'No se pudo guardar el archivo.');
            }
            $newId = $this->files->create($userId, $folderId, $name, $path, $actual, $mime, PathHelper::extension($name));
            $this->users->addUsedBytes($userId, $actual);
        });

        @unlink($this->metaPath($userId, $uploadId));

        return $this->files->find($newId, $userId) ?? [];
    }

    /** Cancela y limpia una sesión de subida. */
    public function cancel(int $userId, string $uploadId): void
    {
        @unlink($this->partPath($userId, $uploadId));
        @unlink($this->metaPath($userId, $uploadId));
    }

    // --- Helpers ---

    /** @return array{0:array<string,mixed>,1:string} [meta, partPath] */
    private function session(int $userId, string $uploadId): array
    {
        if (preg_match('/^[a-f0-9]{32}$/', $uploadId) !== 1) {
            throw HttpException::notFound('Sesión de subida no encontrada', 'UPLOAD_NOT_FOUND');
        }
        $metaPath = $this->metaPath($userId, $uploadId);
        $partPath = $this->partPath($userId, $uploadId);
        if (!is_file($metaPath) || !is_file($partPath)) {
            throw HttpException::notFound('Sesión de subida no encontrada', 'UPLOAD_NOT_FOUND');
        }
        $meta = json_decode((string) file_get_contents($metaPath), true);
        if (!is_array($meta) || (int) ($meta['user_id'] ?? 0) !== $userId) {
            throw HttpException::forbidden('Sesión de subida inválida');
        }
        return [$meta, $partPath];
    }

    private function uploadsDir(int $userId): string
    {
        $dir = rtrim((string) Config::get('storage.path', ''), '/\\') . '/.uploads/' . $userId;
        $this->fs->ensureDir($dir);
        return $dir;
    }

    private function metaPath(int $userId, string $uploadId): string
    {
        return $this->uploadsDir($userId) . '/' . $uploadId . '.json';
    }

    private function partPath(int $userId, string $uploadId): string
    {
        return $this->uploadsDir($userId) . '/' . $uploadId . '.part';
    }

    /** Tamaño de chunk efectivo: respeta config y post_max_size del servidor. */
    private function chunkSize(): int
    {
        $configured = (int) Config::get('storage.chunk_size', 4 * 1024 * 1024);
        $postMax = $this->iniBytes((string) ini_get('post_max_size'));
        $cap = $postMax > 0 ? (int) ($postMax * 0.9) : $configured;
        return max(256 * 1024, min($configured, $cap));
    }

    private function iniBytes(string $value): int
    {
        $value = trim($value);
        if ($value === '') {
            return 0;
        }
        $unit = strtolower($value[strlen($value) - 1]);
        $num = (int) $value;
        return match ($unit) {
            'g' => $num * 1024 * 1024 * 1024,
            'm' => $num * 1024 * 1024,
            'k' => $num * 1024,
            default => (int) $value,
        };
    }

    private function cleanupOrphans(int $userId): void
    {
        $dir = $this->uploadsDir($userId);
        foreach (glob("$dir/*.json") ?: [] as $metaFile) {
            $meta = json_decode((string) file_get_contents($metaFile), true);
            $created = is_array($meta) ? (int) ($meta['created_at'] ?? 0) : 0;
            if ($created > 0 && $created < time() - self::SESSION_TTL) {
                @unlink($metaFile);
                @unlink(substr($metaFile, 0, -5) . '.part');
            }
        }
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
