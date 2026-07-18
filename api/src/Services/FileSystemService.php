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

        // La normalización léxica anterior (array_pop en '..') ya garantiza que
        // la ruta no puede salir de la raíz del usuario. Permite rutas que aún no
        // existen (carpetas/archivos a crear), sin exigir que el padre exista.
        $candidate = $segments === []
            ? $userRootReal
            : $userRootReal . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $segments);

        // Verificación defensiva de contención.
        if ($candidate !== $userRootReal && !str_starts_with($candidate, $userRootReal . DIRECTORY_SEPARATOR)) {
            throw HttpException::forbidden('Ruta fuera del área permitida', 'PATH_TRAVERSAL');
        }
        return $candidate;
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

    // --- Operaciones por ruta virtual (Fase 4) ---

    /** Ruta absoluta segura de una ruta virtual del usuario (guarda contra traversal). */
    public function abs(string $username, string $virtualPath): string
    {
        return $this->safeJoin($this->provisionUser($username), $virtualPath);
    }

    /** Crea la carpeta física de una ruta virtual. */
    public function makeDir(string $username, string $virtualPath): void
    {
        $this->ensureDir($this->abs($username, $virtualPath));
    }

    /** Renombra/mueve físicamente de una ruta virtual a otra. */
    public function move(string $username, string $oldVirtual, string $newVirtual): void
    {
        $src = $this->abs($username, $oldVirtual);
        $dst = $this->abs($username, $newVirtual);
        if (!file_exists($src)) {
            return; // nada físico (p.ej. destino aún no materializado); la BD manda
        }
        if (file_exists($dst)) {
            throw new HttpException(409, 'FS_CONFLICT', 'Ya existe un elemento con ese nombre en el destino.');
        }
        $this->ensureDir(dirname($dst));
        if (!@rename($src, $dst)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo mover el elemento.');
        }
    }

    /** Copia recursiva de una ruta virtual a otra. */
    public function copy(string $username, string $srcVirtual, string $dstVirtual): void
    {
        $src = $this->abs($username, $srcVirtual);
        $dst = $this->abs($username, $dstVirtual);
        if (!file_exists($src)) {
            return;
        }
        $this->copyRecursive($src, $dst);
    }

    private function copyRecursive(string $src, string $dst): void
    {
        if (is_dir($src)) {
            $this->ensureDir($dst);
            foreach (scandir($src) ?: [] as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                $this->copyRecursive(
                    $src . DIRECTORY_SEPARATOR . $entry,
                    $dst . DIRECTORY_SEPARATOR . $entry
                );
            }
        } elseif (is_file($src)) {
            if (!@copy($src, $dst)) {
                throw new HttpException(500, 'FS_ERROR', 'No se pudo copiar un archivo.');
            }
        }
    }

    /**
     * Mueve físicamente un elemento a la papelera interna (/storage/.trash/{user}),
     * dejándolo fuera del alcance de la URL pública. $trashKey identifica el
     * elemento (p.ej. "f123"/"d45") para poder restaurarlo en la Fase 7.
     */
    public function moveToTrash(string $username, string $virtualPath, string $trashKey): void
    {
        $src = $this->abs($username, $virtualPath);
        if (!file_exists($src)) {
            return;
        }
        $this->ensureDir($this->trashDir($username));
        $dst = $this->trashEntry($username, $trashKey, $virtualPath);
        @rename($src, $dst);
    }

    /**
     * Restaura físicamente un elemento desde la papelera interna a su ruta de
     * destino (Fase 7). $originalPath localiza la entrada en la papelera (por su
     * basename original); $destPath es dónde recolocarlo (puede diferir si hubo
     * renombrado por colisión de nombre).
     */
    public function restoreFromTrash(string $username, string $trashKey, string $originalPath, string $destPath): void
    {
        $src = $this->trashEntry($username, $trashKey, $originalPath);
        if (!file_exists($src)) {
            return; // nada físico; la BD manda
        }
        $dst = $this->abs($username, $destPath);
        if (file_exists($dst)) {
            throw new HttpException(409, 'FS_CONFLICT', 'Ya existe un elemento con ese nombre en el destino.');
        }
        $this->ensureDir(dirname($dst));
        @rename($src, $dst);
    }

    /** Borra definitivamente un elemento de la papelera interna (Fase 7). */
    public function deleteFromTrash(string $username, string $trashKey, string $originalPath): void
    {
        $this->delete($this->trashEntry($username, $trashKey, $originalPath));
    }

    /** Carpeta de papelera interna del usuario: /storage/.trash/{username}. */
    private function trashDir(string $username): string
    {
        return $this->storageRoot . DIRECTORY_SEPARATOR . '.trash'
            . DIRECTORY_SEPARATOR . $this->sanitizeName($username);
    }

    /** Ruta física de una entrada en papelera: {trashDir}/{trashKey}__{basename}. */
    private function trashEntry(string $username, string $trashKey, string $virtualPath): string
    {
        $base = basename(str_replace('\\', '/', $virtualPath));
        return $this->trashDir($username) . DIRECTORY_SEPARATOR . $trashKey . '__' . $base;
    }
}
