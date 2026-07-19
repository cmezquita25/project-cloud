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

    /**
     * Genera una contraseña aleatoria (por defecto 10) con al menos una minúscula,
     * una mayúscula, un dígito y un símbolo. Se excluyen caracteres ambiguos
     * (0/O, 1/l/I) para que sea fácil de teclear desde el correo.
     */
    public static function generate(int $length = 10): string
    {
        $length = max(8, min(64, $length));

        $lower   = 'abcdefghijkmnpqrstuvwxyz';
        $upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $digits  = '23456789';
        $symbols = '!@#$%*-_?';
        $all     = $lower . $upper . $digits . $symbols;

        // Garantiza al menos uno de cada clase.
        $chars = [
            $lower[random_int(0, strlen($lower) - 1)],
            $upper[random_int(0, strlen($upper) - 1)],
            $digits[random_int(0, strlen($digits) - 1)],
            $symbols[random_int(0, strlen($symbols) - 1)],
        ];
        for ($i = count($chars); $i < $length; $i++) {
            $chars[] = $all[random_int(0, strlen($all) - 1)];
        }

        // Baraja (Fisher–Yates) para no fijar las posiciones de cada clase.
        for ($i = count($chars) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
        }

        return implode('', $chars);
    }
}
