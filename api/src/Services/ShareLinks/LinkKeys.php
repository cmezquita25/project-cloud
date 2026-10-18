<?php

declare(strict_types=1);

namespace ProjectCloud\Services\ShareLinks;

use ProjectCloud\Core\Config;

/**
 * Secretos de los enlaces compartidos:
 *
 * - token(): 22 caracteres base62 (~131 bits) de random_bytes(). No guarda
 *   relación con el archivo: la URL no revela nombre, carpeta ni usuario.
 * - accessKey(): «llave de paso» que se entrega al visitante tras superar la
 *   contraseña o el inicio de sesión. Va en las URL del contenido porque
 *   <img>/<video> no pueden mandar cabeceras. Caduca (12–13 h) y deja de valer
 *   si cambian la contraseña o el tipo de acceso del enlace.
 * - ipHash(): la IP del visitante nunca se guarda en claro.
 */
final class LinkKeys
{
    private const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    private const TOKEN_LENGTH = 22;
    private const KEY_WINDOW = 3600;
    private const KEY_HOURS = 12;

    public static function token(): string
    {
        $out = '';
        while (strlen($out) < self::TOKEN_LENGTH) {
            foreach (str_split(random_bytes(32)) as $byte) {
                $n = ord($byte);
                // 248 = 62 × 4: se descartan los bytes que sesgarían el reparto.
                if ($n < 248) {
                    $out .= self::ALPHABET[$n % 62];
                    if (strlen($out) === self::TOKEN_LENGTH) {
                        break;
                    }
                }
            }
        }
        return $out;
    }

    public static function isToken(string $value): bool
    {
        return preg_match('/^[0-9A-Za-z]{22}$/', $value) === 1;
    }

    /** @param array<string,mixed> $link */
    public static function accessKey(array $link): string
    {
        // Redondeada a la hora: la misma llave durante una hora (caché de imágenes).
        $exp = (intdiv(time(), self::KEY_WINDOW) + self::KEY_HOURS + 1) * self::KEY_WINDOW;
        return $exp . '.' . self::sign($link, $exp);
    }

    /** @param array<string,mixed> $link */
    public static function verifyKey(array $link, mixed $key): bool
    {
        if (!is_string($key) || preg_match('/^(\d{1,12})\.([A-Za-z0-9_-]{20,64})$/', $key, $m) !== 1) {
            return false;
        }
        $exp = (int) $m[1];
        return $exp >= time() && hash_equals(self::sign($link, $exp), $m[2]);
    }

    public static function ipHash(string $ip): string
    {
        return hash_hmac('sha256', $ip, self::secret('hits'));
    }

    /** @param array<string,mixed> $link */
    private static function sign(array $link, int $exp): string
    {
        $material = implode('|', [(int) $link['id'], (string) $link['token'], (string) $link['access'], (string) ($link['password_hash'] ?? ''), $exp]);
        return rtrim(strtr(base64_encode(hash_hmac('sha256', $material, self::secret('access'), true)), '+/', '-_'), '=');
    }

    /** Claves derivadas del secreto JWT: no sirven para firmar sesiones. */
    private static function secret(string $purpose): string
    {
        return hash_hmac('sha256', 'project-cloud:share-link:' . $purpose . ':v1', (string) Config::get('jwt.secret', ''), true);
    }
}
