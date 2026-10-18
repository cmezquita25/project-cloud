<?php

declare(strict_types=1);

namespace ProjectCloud\Updater;

use RuntimeException;

/** Operaciones de archivos del actualizador (todas lanzan excepción si fallan). */
final class FileOps
{
    public static function ensureDir(string $dir): void
    {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('No se pudo crear la carpeta: ' . $dir);
        }
    }

    /**
     * Escribe un archivo de forma atómica: copia a un temporal junto al destino
     * y lo renombra encima. Nunca queda un archivo a medio escribir.
     */
    public static function atomicCopy(string $from, string $to): void
    {
        self::ensureDir(dirname($to));
        $tmp = $to . '.pc-new';
        if (!@copy($from, $tmp)) {
            throw new RuntimeException('No se pudo escribir: ' . $to);
        }
        if (!@rename($tmp, $to)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo reemplazar: ' . $to);
        }
    }

    public static function atomicWrite(string $to, string $content): void
    {
        self::ensureDir(dirname($to));
        $tmp = $to . '.pc-new';
        if (@file_put_contents($tmp, $content) === false || !@rename($tmp, $to)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo escribir: ' . $to);
        }
    }

    public static function copy(string $from, string $to): void
    {
        self::ensureDir(dirname($to));
        if (!@copy($from, $to)) {
            throw new RuntimeException('No se pudo copiar: ' . $from);
        }
    }

    public static function deleteTree(string $path): void
    {
        if (is_file($path) || is_link($path)) {
            @unlink($path);
            return;
        }
        if (!is_dir($path)) {
            return;
        }
        foreach (scandir($path) ?: [] as $entry) {
            if ($entry !== '.' && $entry !== '..') {
                self::deleteTree($path . DIRECTORY_SEPARATOR . $entry);
            }
        }
        @rmdir($path);
    }

    public static function treeSize(string $path): int
    {
        if (is_file($path)) {
            return (int) filesize($path);
        }
        $size = 0;
        foreach (is_dir($path) ? (scandir($path) ?: []) : [] as $entry) {
            if ($entry !== '.' && $entry !== '..') {
                $size += self::treeSize($path . DIRECTORY_SEPARATOR . $entry);
            }
        }
        return $size;
    }

    /** Borra carpetas vacías desde $dir hacia arriba sin pasar de $stopAt. */
    public static function pruneEmptyDirs(string $dir, string $stopAt): void
    {
        $stopAt = rtrim($stopAt, '/\\');
        while (strlen($dir) > strlen($stopAt) && is_dir($dir) && count(scandir($dir) ?: []) === 2) {
            @rmdir($dir);
            $dir = dirname($dir);
        }
    }

    /** ¿Se puede escribir realmente en la carpeta? (is_writable miente en algunos hostings). */
    public static function canWrite(string $dir): bool
    {
        if (!is_dir($dir)) {
            return false;
        }
        $probe = $dir . DIRECTORY_SEPARATOR . '.pc-write-test-' . bin2hex(random_bytes(4));
        if (@file_put_contents($probe, 'ok') === false) {
            return false;
        }
        @unlink($probe);
        return true;
    }
}
