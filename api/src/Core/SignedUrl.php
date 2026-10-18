<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * URLs temporales firmadas (HMAC) para servir archivos privados.
 *
 * Las etiquetas <img>/<video> y las descargas no pueden mandar la cabecera
 * Authorization, así que los archivos privados se sirven con un enlace que
 * caduca. La caducidad se redondea a la hora: el mismo archivo genera la misma
 * URL durante una hora (no rompe la caché ETag de los listados) y vale entre
 * 1 y 2 horas.
 */
final class SignedUrl
{
    private const WINDOW = 3600;

    /**
     * @param string $kind content | thumb | download (la descarga se sirve por
     *                     /content con su propia firma: la de vista previa no vale)
     */
    public static function file(int $fileId, string $kind = 'content', array $extra = []): string
    {
        $exp = (intdiv(time(), self::WINDOW) + 2) * self::WINDOW;
        $query = http_build_query($extra + ['exp' => $exp, 'sig' => self::sign($fileId, $kind, $exp)]);
        $segment = $kind === 'download' ? 'content' : $kind;
        return "/api/v1/files/{$fileId}/{$segment}?{$query}";
    }

    public static function verify(int $fileId, string $kind, mixed $exp, mixed $sig): bool
    {
        if (!is_numeric($exp) || !is_string($sig) || (int) $exp < time()) {
            return false;
        }
        return hash_equals(self::sign($fileId, $kind, (int) $exp), $sig);
    }

    /**
     * Archivo de una carpeta privada de la unidad compartida (se identifica por
     * su ruta). $kind: content | download | thumb.
     */
    public static function asset(string $path, string $kind = 'content', array $extra = []): string
    {
        $exp = (intdiv(time(), self::WINDOW) + 2) * self::WINDOW;
        $segment = $kind === 'thumb' ? 'thumb' : 'content';
        if ($kind === 'download') {
            $extra['download'] = 1;
        }
        $query = http_build_query(['path' => $path] + $extra + ['exp' => $exp, 'sig' => self::signRaw("asset:{$kind}:{$path}:{$exp}")]);
        return "/api/v1/assets/{$segment}?{$query}";
    }

    public static function verifyAsset(string $path, string $kind, mixed $exp, mixed $sig): bool
    {
        if (!is_numeric($exp) || !is_string($sig) || (int) $exp < time()) {
            return false;
        }
        return hash_equals(self::signRaw("asset:{$kind}:{$path}:" . (int) $exp), $sig);
    }

    private static function sign(int $fileId, string $kind, int $exp): string
    {
        return self::signRaw("{$kind}:{$fileId}:{$exp}");
    }

    private static function signRaw(string $material): string
    {
        // Clave derivada del secreto JWT: no sirve para firmar tokens de sesión.
        $key = hash_hmac('sha256', 'project-cloud:signed-url:v1', (string) Config::get('jwt.secret', ''), true);
        return rtrim(strtr(base64_encode(hash_hmac('sha256', $material, $key, true)), '+/', '-_'), '=');
    }
}
