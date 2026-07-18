<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;

/**
 * Primitivas seguras de sistema de archivos sobre /storage.
 *
 * Reglas de seguridad:
 *  - Todo path se resuelve y se verifica que cae DENTRO de la raíz del usuario
 *    (defensa contra path traversal: ../, symlinks, rutas absolutas).
 *  - Los nombres se sanitizan (sin separadores ni caracteres de control).
 *  - Las extensiones ejecutables están en lista negra (no se pueden crear/subir).
 */
final class FileSystemService
{
    /** Extensiones que jamás deben escribirse en /storage (evita ejecución en el servidor). */
    private const BLOCKED_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar', 'pht',
        'cgi', 'pl', 'py', 'sh', 'bash', 'htaccess', 'htpasswd', 'ini', 'asp',
        'aspx', 'jsp', 'exe', 'com',
    ];

    private readonly string $storageRoot;

    public function __construct(?string $storageRoot = null)
    {
        $root = $storageRoot ?? (string) Config::get('storage.path', '');
        // Normaliza a ruta absoluta con separadores del sistema.
        $this->storageRoot = rtrim($root, '/\\');
    }

    /** Raíz absoluta de la unidad de un usuario: /storage/{username}. */
    public function userRoot(string $username): string
    {
        return $this->storageRoot . DIRECTORY_SEPARATOR . $this->sanitizeName($username);
    }

    /** Crea (si no existe) la carpeta raíz del usuario. */
    public function provisionUser(string $username): string
    {
        $root = $this->userRoot($username);
        $this->ensureDir($root);
        return $root;
    }

    public function ensureDir(string $absPath): void
    {
        if (!is_dir($absPath) && !@mkdir($absPath, 0775, true) && !is_dir($absPath)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo crear la carpeta');
        }
    }

    /**
     * Sanitiza un nombre de archivo/carpeta: sin separadores, sin control chars,
     * sin nombres reservados. NO permite rutas (solo un segmento).
     */
    public function sanitizeName(string $name): string
    {
        $name = trim($name);
        // Solo el último segmento, por si llega con separadores.
        $name = basename(str_replace('\\', '/', $name));
        // Elimina caracteres de control y los prohibidos en Windows/URLs.
        $name = preg_replace('/[\x00-\x1F\x7F\/\\\\:*?"<>|]/', '', $name) ?? '';
        // Evita "." y ".." y nombres vacíos.
        if ($name === '' || $name === '.' || $name === '..') {
            throw HttpException::badRequest('Nombre inválido', 'INVALID_NAME');
        }
        return $name;
    }

    public function isBlockedExtension(string $filename): bool
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return $ext !== '' && in_array($ext, self::BLOCKED_EXTENSIONS, true);
    }

    /**
     * Resuelve una ruta relativa dentro de la raíz de un usuario y garantiza
     * que no escape de ella. Devuelve la ruta absoluta segura.
     *
     * @param string $relative Ruta virtual relativa (p.ej. "docs/2026/informe.pdf")
     */
    public function safeJoin(string $userRoot, string $relative): string
    {
        $userRootReal = $this->realOrRoot($userRoot);

        // Normaliza separadores y descompone en segmentos, resolviendo . y ..
        $relative = str_replace('\\', '/', $relative);
        $segments = [];
        foreach (explode('/', $relative) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments); // no dejamos que suba más allá de la raíz
                continue;
            }
            $segments[] = $segment;
        }

        $candidate = $userRootReal . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $segments);

        // Verificación final: la ruta resuelta debe empezar por la raíz del usuario.
        $resolved = $this->resolveWithinParent($candidate);
        if (!str_starts_with($resolved, $userRootReal)) {
            throw HttpException::forbidden('Ruta fuera del área permitida', 'PATH_TRAVERSAL');
        }
        return $resolved;
    }

    /**
     * Resuelve realpath del elemento; si no existe aún (archivo/carpeta a crear),
     * resuelve el padre y le anexa el nombre. Bloquea si el padre no existe.
     */
    private function resolveWithinParent(string $path): string
    {
        $real = realpath($path);
        if ($real !== false) {
            return $real;
        }
        $parent = realpath(dirname($path));
        if ($parent === false) {
            throw HttpException::badRequest('La ruta padre no existe', 'INVALID_PATH');
        }
        return $parent . DIRECTORY_SEPARATOR . basename($path);
    }

    /** realpath de la raíz del usuario, creándola si hiciera falta. */
    private function realOrRoot(string $userRoot): string
    {
        $this->ensureDir($userRoot);
        $real = realpath($userRoot);
        if ($real === false) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo resolver la raíz de almacenamiento');
        }
        return $real;
    }

    // --- Operaciones (se amplían en Fase 4) ---

    public function delete(string $absPath): void
    {
        if (is_dir($absPath)) {
            $this->deleteRecursive($absPath);
        } elseif (is_file($absPath)) {
            @unlink($absPath);
        }
    }

    private function deleteRecursive(string $dir): void
    {
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            is_dir($path) ? $this->deleteRecursive($path) : @unlink($path);
        }
        @rmdir($dir);
    }
}
