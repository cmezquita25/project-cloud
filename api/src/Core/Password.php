<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Hashing de contraseñas. Prefiere Argon2id; si el build de PHP no lo soporta,
 * cae automáticamente a bcrypt (PASSWORD_DEFAULT). Verificación transparente.
 */
final class Password
{
    public static function hash(string $plain): string
    {
        if (defined('PASSWORD_ARGON2ID')) {
            try {
                return password_hash($plain, PASSWORD_ARGON2ID);
            } catch (\Throwable) {
                // libargon no disponible en tiempo de ejecución -> fallback.
            }
        }
        return password_hash($plain, PASSWORD_DEFAULT);
    }

    public static function verify(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    /** Indica si conviene rehashear (p.ej. tras cambiar de algoritmo). */
    public static function needsRehash(string $hash): bool
    {
        $algo = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
        return password_needs_rehash($hash, $algo);
    }
}
