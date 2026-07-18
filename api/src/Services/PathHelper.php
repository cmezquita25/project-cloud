<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

/**
 * Utilidades puras para rutas virtuales materializadas (relativas a la raíz
 * del usuario, con "/" como separador, sin barra inicial ni final).
 */
final class PathHelper
{
    /** Porción "padre" de una ruta. "docs/2026/x" -> "docs/2026"; "x" -> "". */
    public static function parent(string $path): string
    {
        $pos = strrpos($path, '/');
        return $pos === false ? '' : substr($path, 0, $pos);
    }

    /** Une un padre y un nombre. "" + "x" -> "x"; "docs" + "x" -> "docs/x". */
    public static function join(string $parentPath, string $name): string
    {
        return $parentPath === '' ? $name : $parentPath . '/' . $name;
    }

    /** Extensión en minúsculas (sin punto) o null. */
    public static function extension(string $name): string
    {
        return strtolower(pathinfo($name, PATHINFO_EXTENSION));
    }

    /**
     * Genera un nombre único evitando colisiones, estilo "archivo (1).ext".
     *
     * @param callable(string):bool $exists Devuelve true si el nombre ya existe.
     */
    public static function uniqueName(string $name, callable $exists): string
    {
        if (!$exists($name)) {
            return $name;
        }
        $ext = pathinfo($name, PATHINFO_EXTENSION);
        $base = $ext !== '' ? substr($name, 0, -(strlen($ext) + 1)) : $name;
        $suffix = $ext !== '' ? '.' . $ext : '';
        for ($i = 1; $i < 1000; $i++) {
            $candidate = "$base ($i)$suffix";
            if (!$exists($candidate)) {
                return $candidate;
            }
        }
        return "$base (" . bin2hex(random_bytes(3)) . ")$suffix";
    }
}
