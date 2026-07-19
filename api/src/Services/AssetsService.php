<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Unidad compartida "assets" (Fase 8, punto 6).
 *
 * Es la carpeta pública que ya vive en el hosting (hermana de /storage, servida
 * en https://host/assets). NO está en la BD: se navega directamente del sistema
 * de archivos. Solo el admin y los usuarios autorizados pueden verla e
 * interactuar con ella. Nada queda fijado a un dominio: la ruta y la URL se
 * derivan de la configuración de /storage, así que es portable.
 */
final class AssetsService
{
    private const ALLOWED_KEY = 'assets_allowed_users';

    private readonly string $root;
    private readonly string $publicBase;
    private readonly FileSystemService $fs;
    private readonly SettingsRepository $settings;

    public function __construct(
        ?string $root = null,
        ?string $publicBase = null,
        ?FileSystemService $fs = null,
        ?SettingsRepository $settings = null,
    ) {
        $storage = rtrim((string) Config::get('storage.path', ''), "/\\");
        $this->root = rtrim($root ?? (dirname($storage) . DIRECTORY_SEPARATOR . 'assets'), "/\\");
        $this->publicBase = rtrim($publicBase ?? $this->derivePublicBase(), '/');
        $this->fs = $fs ?? new FileSystemService();
        $this->settings = $settings ?? new SettingsRepository();
    }

    /** URL pública de /assets derivada de la de /storage (sin hardcodear el dominio). */
    private function derivePublicBase(): string
    {
        $url = rtrim((string) Config::get('storage.public_url', ''), '/');
        if ($url === '') {
            return '/assets';
        }
        if (preg_match('#/storage/?$#', $url) === 1) {
            return (string) preg_replace('#/storage/?$#', '/assets', $url);
        }
        return $url . '/../assets';
    }

    // --- Permisos ---

    /** @return array<int,int> IDs de usuario con acceso concedido. */
    public function allowedUserIds(): array
    {
        $raw = $this->settings->get(self::ALLOWED_KEY, '[]') ?? '[]';
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? array_values(array_map('intval', $decoded)) : [];
    }

    public function setAllowedUserIds(array $ids): void
    {
        $clean = array_values(array_unique(array_map('intval', $ids)));
        $this->settings->set(self::ALLOWED_KEY, (string) json_encode($clean));
    }

    /** El admin siempre puede; el resto, solo si está en la lista de permitidos. */
    public function canAccess(int $userId, string $role): bool
    {
        return $role === 'admin' || in_array($userId, $this->allowedUserIds(), true);
    }

    public function assertAccess(int $userId, string $role): void
    {
        if (!$this->canAccess($userId, $role)) {
            throw HttpException::forbidden('No tienes acceso a la carpeta compartida.', 'ASSETS_FORBIDDEN');
        }
    }

    // --- Navegación ---

    /** Ruta absoluta segura dentro de la raíz de assets (anti path traversal). */
    private function safe(string $relative): string
    {
        return $this->fs->safeJoin($this->root, $relative);
    }

    public function publicUrl(string $relative): string
    {
        $encoded = implode('/', array_map('rawurlencode', explode('/', $relative)));
        return $this->publicBase . '/' . $encoded;
    }

    /**
     * Lista el contenido de una carpeta de assets.
     *
     * @return array{path:string,breadcrumbs:list<array{name:string,path:string}>,folders:list<array<string,mixed>>,files:list<array<string,mixed>>}
     */
    /** Ruta absoluta (validada contra traversal) de un archivo de assets. */
    public function absoluteFile(string $relative): string
    {
        $abs = $this->safe($relative);
        if (!is_file($abs)) {
            throw HttpException::notFound('Archivo no encontrado en assets.');
        }
        return $abs;
    }

    public function list(string $relative): array
    {
        $abs = $this->safe($relative);
        if (!is_dir($abs)) {
            throw HttpException::notFound('Carpeta no encontrada en assets.');
        }

        $folders = [];
        $files = [];
        foreach (scandir($abs) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..' || $entry[0] === '.') {
                continue; // omite ocultos (.htaccess, etc.)
            }
            $childRel = ltrim($relative . '/' . $entry, '/');
            $path = $abs . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $folders[] = ['type' => 'folder', 'name' => $entry, 'path' => $childRel];
            } else {
                $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
                $files[] = [
                    'type'       => 'file',
                    'name'       => $entry,
                    'path'       => $childRel,
                    'size_bytes' => (int) @filesize($path),
                    'mime_type'  => $this->detectMime($path),
                    'extension'  => $ext !== '' ? $ext : null,
                    'url'        => $this->publicUrl($childRel),
                ];
            }
        }

        usort($folders, static fn ($a, $b) => strcasecmp((string) $a['name'], (string) $b['name']));
        usort($files, static fn ($a, $b) => strcasecmp((string) $a['name'], (string) $b['name']));

        return [
            'path'        => $relative,
            'breadcrumbs' => $this->breadcrumbs($relative),
            'folders'     => $folders,
            'files'       => $files,
        ];
    }

    /** @return list<array{name:string,path:string}> */
    private function breadcrumbs(string $relative): array
    {
        $crumbs = [];
        $acc = '';
        foreach (array_filter(explode('/', $relative), static fn ($s) => $s !== '') as $segment) {
            $acc = ltrim($acc . '/' . $segment, '/');
            $crumbs[] = ['name' => $segment, 'path' => $acc];
        }
        return $crumbs;
    }

    // --- Interacción (usuarios autorizados) ---

    public function createFolder(string $parentRelative, string $rawName): array
    {
        $name = $this->fs->sanitizeName($rawName);
        $rel = ltrim($parentRelative . '/' . $name, '/');
        $abs = $this->safe($rel);
        if (file_exists($abs)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un elemento con ese nombre.');
        }
        $this->fs->ensureDir($abs);
        return ['type' => 'folder', 'name' => $name, 'path' => $rel];
    }

    /**
     * Guarda un archivo subido (multipart) en una carpeta de assets.
     *
     * @param array{name:string,tmp_name:string,size:int,error:int} $file
     */
    public function storeUpload(string $parentRelative, array $file): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw HttpException::badRequest('No se recibió el archivo (¿supera el límite del servidor?).', 'UPLOAD_ERROR');
        }
        $name = $this->fs->sanitizeName((string) $file['name']);
        if ($this->fs->isBlockedExtension($name)) {
            throw new HttpException(422, 'BLOCKED_EXTENSION', 'Ese tipo de archivo no está permitido.');
        }
        $rel = ltrim($parentRelative . '/' . $name, '/');
        $abs = $this->safe($rel);
        if (file_exists($abs)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un archivo con ese nombre.');
        }
        $this->fs->ensureDir(dirname($abs));

        $tmp = (string) $file['tmp_name'];
        $moved = is_uploaded_file($tmp) ? @move_uploaded_file($tmp, $abs) : @rename($tmp, $abs);
        if (!$moved) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo guardar el archivo.');
        }
        @chmod($abs, 0644);

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        return [
            'type'       => 'file',
            'name'       => $name,
            'path'       => $rel,
            'size_bytes' => (int) @filesize($abs),
            'mime_type'  => $this->detectMime($abs),
            'extension'  => $ext !== '' ? $ext : null,
            'url'        => $this->publicUrl($rel),
        ];
    }

    /**
     * Mueve un archivo o carpeta de assets a otra carpeta (dentro de assets).
     * $targetFolder = '' es la raíz de assets.
     */
    public function move(string $relative, string $targetFolder): array
    {
        $src = trim($relative, '/');
        if ($src === '') {
            throw HttpException::badRequest('No se puede mover la raíz de assets.', 'INVALID_TARGET');
        }
        $srcAbs = $this->safe($relative);
        if (!file_exists($srcAbs)) {
            throw HttpException::notFound('Elemento no encontrado en assets.');
        }

        $targetRel = trim($targetFolder, '/');
        if ($targetRel !== '') {
            $targetAbs = $this->safe($targetRel);
            if (!is_dir($targetAbs)) {
                throw new HttpException(422, 'INVALID_FOLDER', 'La carpeta destino no existe.');
            }
        }

        // No mover una carpeta dentro de sí misma o de un descendiente.
        if (is_dir($srcAbs) && ($targetRel === $src || str_starts_with($targetRel, $src . '/'))) {
            throw new HttpException(422, 'INVALID_MOVE', 'No puedes mover una carpeta dentro de sí misma.');
        }

        $name = basename($src);
        $destRel = ltrim($targetRel . '/' . $name, '/');
        if ($destRel === $src) {
            return ['type' => is_dir($srcAbs) ? 'folder' : 'file', 'name' => $name, 'path' => $src];
        }
        $destAbs = $this->safe($destRel);
        if (file_exists($destAbs)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un elemento con ese nombre en el destino.');
        }
        $this->fs->ensureDir(dirname($destAbs));
        if (!@rename($srcAbs, $destAbs)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo mover el elemento.');
        }
        return ['type' => is_dir($destAbs) ? 'folder' : 'file', 'name' => $name, 'path' => $destRel];
    }

    /** Elimina definitivamente un archivo o carpeta de assets. */
    public function delete(string $relative): void
    {
        if (trim($relative, '/') === '') {
            throw HttpException::badRequest('No se puede eliminar la raíz de assets.', 'INVALID_TARGET');
        }
        $abs = $this->safe($relative);
        if (!file_exists($abs)) {
            throw HttpException::notFound('Elemento no encontrado en assets.');
        }
        $this->fs->delete($abs);
    }

    private function detectMime(string $absPath): ?string
    {
        if (!function_exists('finfo_open')) {
            return null;
        }
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false) {
            return null;
        }
        $mime = @finfo_file($finfo, $absPath);
        finfo_close($finfo);
        return is_string($mime) && $mime !== '' ? $mime : null;
    }
}
