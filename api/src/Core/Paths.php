<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

use RuntimeException;

/**
 * Rutas internas de la API.
 *
 * `api/var/` guarda todo lo que NUNCA debe ser público: copias de seguridad,
 * temporales, locks y (más adelante) el estado del actualizador. Es seguro
 * porque el .htaccess raíz envía cualquier petición /api/* a index.php (ningún
 * archivo de aquí se sirve tal cual) y, como defensa extra, la carpeta lleva
 * su propio .htaccess que deniega todo acceso web.
 */
final class Paths
{
    private const DENY_HTACCESS = <<<'HTACCESS'
# Carpeta privada del sistema (backups, temporales, estado del actualizador).
# Nunca se sirve por web.
Require all denied
<IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
</IfModule>

HTACCESS;

    public static function apiRoot(): string
    {
        return dirname(__DIR__, 2);
    }

    /** Ruta dentro de api/var/ (la crea si no existe). */
    public static function var(string $sub = ''): string
    {
        $base = self::apiRoot() . DIRECTORY_SEPARATOR . 'var';
        self::ensureDir($base);
        if (!is_file($base . DIRECTORY_SEPARATOR . '.htaccess')) {
            @file_put_contents($base . DIRECTORY_SEPARATOR . '.htaccess', self::DENY_HTACCESS);
        }

        if ($sub === '') {
            return $base;
        }
        $path = $base . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, trim($sub, '/\\'));
        self::ensureDir($path);
        return $path;
    }

    private static function ensureDir(string $dir): void
    {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('No se pudo crear la carpeta interna: ' . basename($dir));
        }
    }
}
