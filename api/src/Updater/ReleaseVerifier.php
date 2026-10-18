<?php

declare(strict_types=1);

namespace ProjectCloud\Updater;

use ProjectCloud\Core\HttpException;
use ZipArchive;

/**
 * Verifica los releases antes de instalarlos. Nada del paquete se toca hasta
 * que pasan TODAS las comprobaciones:
 *
 *   1. El manifiesto tiene la forma esperada y es de este producto.
 *   2. Su firma Ed25519 valida con la llave pública incluida en el código
 *      (ReleaseKey). Sin la llave privada nadie puede publicar una versión,
 *      aunque controle el servidor de actualizaciones.
 *   3. El ZIP descargado coincide en tamaño y sha256 con el manifiesto firmado.
 *   4. Cada archivo del ZIP coincide con su sha256 en release.json, no hay
 *      archivos de más y ninguna ruta escapa de public/ o api/ (zip-slip).
 */
final class ReleaseVerifier
{
    public const PRODUCT = 'project-cloud';

    /** Prefijos que un paquete puede contener. */
    private const ALLOWED_PREFIXES = ['public/', 'api/'];

    /**
     * Mensaje firmado. Debe coincidir byte a byte con signedMessage() de
     * scripts/release/lib.mjs.
     *
     * @param array<string,mixed> $manifest
     */
    public static function signedMessage(array $manifest): string
    {
        return implode("\n", [
            (string) $manifest['product'],
            (string) $manifest['version'],
            (string) $manifest['schema'],
            (string) $manifest['min_from_version'],
            (string) $manifest['package']['sha256'],
            (string) $manifest['package']['size_bytes'],
            !empty($manifest['migrations']['reversible']) ? '1' : '0',
        ]);
    }

    /**
     * Valida la estructura y la firma del manifiesto.
     *
     * @param array<string,mixed> $manifest
     */
    public static function verifyManifest(array $manifest): void
    {
        $valid = ($manifest['product'] ?? null) === self::PRODUCT
            && is_string($manifest['version'] ?? null) && preg_match('/^\d+\.\d+\.\d+$/', $manifest['version']) === 1
            && is_int($manifest['schema'] ?? null)
            && is_string($manifest['min_from_version'] ?? null)
            && is_array($manifest['package'] ?? null)
            && is_string($manifest['package']['url'] ?? null)
            && is_int($manifest['package']['size_bytes'] ?? null)
            && is_string($manifest['package']['sha256'] ?? null) && preg_match('/^[0-9a-f]{64}$/', $manifest['package']['sha256']) === 1
            && is_array($manifest['migrations'] ?? null)
            && is_array($manifest['signature'] ?? null);
        if (!$valid) {
            throw new HttpException(502, 'UPDATE_MANIFEST_INVALID', 'El manifiesto de la actualización no tiene un formato válido.');
        }

        if (!function_exists('sodium_crypto_sign_verify_detached')) {
            throw new HttpException(500, 'SODIUM_MISSING', 'La extensión sodium de PHP no está habilitada: no se puede verificar la firma de la actualización.');
        }

        $signature = $manifest['signature'];
        if (($signature['alg'] ?? null) !== ReleaseKey::ALGORITHM || ($signature['key_id'] ?? null) !== ReleaseKey::KEY_ID) {
            throw new HttpException(502, 'UPDATE_SIGNATURE_INVALID', 'La actualización está firmada con una llave desconocida.');
        }

        $sig = base64_decode((string) ($signature['value'] ?? ''), true);
        $key = base64_decode(ReleaseKey::PUBLIC_KEY, true);
        if ($sig === false || $key === false
            || strlen($sig) !== SODIUM_CRYPTO_SIGN_BYTES
            || strlen($key) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || !sodium_crypto_sign_verify_detached($sig, self::signedMessage($manifest), $key)) {
            throw new HttpException(502, 'UPDATE_SIGNATURE_INVALID', 'La firma de la actualización no es válida. El paquete no se instalará.');
        }
    }

    /**
     * Comprueba el ZIP descargado contra el manifiesto (ya verificado).
     *
     * @param array<string,mixed> $manifest
     */
    public static function verifyPackage(string $zipPath, array $manifest): void
    {
        $size = @filesize($zipPath);
        if ($size === false || $size !== $manifest['package']['size_bytes']) {
            throw new HttpException(502, 'UPDATE_PACKAGE_CORRUPT', 'El paquete descargado no tiene el tamaño esperado.');
        }
        if (!hash_equals((string) $manifest['package']['sha256'], (string) hash_file('sha256', $zipPath))) {
            throw new HttpException(502, 'UPDATE_PACKAGE_CORRUPT', 'El paquete descargado está dañado o fue alterado (sha256 no coincide).');
        }
    }

    /**
     * Comprueba el contenido del ZIP contra su release.json y devuelve ese
     * release.json (lista de archivos con su hash).
     *
     * @param array<string,mixed> $manifest
     * @return array<string,mixed>
     */
    public static function verifyContents(string $zipPath, array $manifest): array
    {
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CHECKCONS) !== true) {
            throw new HttpException(502, 'UPDATE_PACKAGE_CORRUPT', 'El paquete no es un ZIP válido.');
        }

        try {
            $release = json_decode((string) $zip->getFromName('release.json'), true);
            if (!is_array($release) || ($release['version'] ?? null) !== $manifest['version'] || !is_array($release['files'] ?? null)) {
                throw new HttpException(502, 'UPDATE_PACKAGE_CORRUPT', 'El paquete no contiene un release.json válido para esta versión.');
            }

            $expected = $release['files'];
            if ($zip->numFiles !== count($expected) + 1) {
                throw new HttpException(502, 'UPDATE_PACKAGE_CORRUPT', 'El paquete contiene archivos no declarados.');
            }

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = (string) $zip->getNameIndex($i);
                if ($name === 'release.json') {
                    continue;
                }
                if (!self::isSafePath($name) || !isset($expected[$name])) {
                    throw new HttpException(502, 'UPDATE_PACKAGE_UNSAFE', "El paquete contiene una ruta no permitida: {$name}");
                }
                $hash = hash_init('sha256');
                $stream = $zip->getStream($name);
                if ($stream === false) {
                    throw new HttpException(502, 'UPDATE_PACKAGE_CORRUPT', "No se pudo leer {$name} del paquete.");
                }
                hash_update_stream($hash, $stream);
                fclose($stream);
                if (!hash_equals((string) $expected[$name]['sha256'], hash_final($hash))) {
                    throw new HttpException(502, 'UPDATE_PACKAGE_CORRUPT', "El archivo {$name} del paquete está dañado.");
                }
            }

            return $release;
        } finally {
            $zip->close();
        }
    }

    /** Ruta relativa, sin "..", sin raíz ni unidad, dentro de public/ o api/. */
    public static function isSafePath(string $name): bool
    {
        if ($name === '' || str_contains($name, "\0") || str_contains($name, '\\')
            || str_starts_with($name, '/') || preg_match('#^[A-Za-z]:#', $name) === 1) {
            return false;
        }
        foreach (explode('/', $name) as $segment) {
            if ($segment === '..' || $segment === '.') {
                return false;
            }
        }
        foreach (self::ALLOWED_PREFIXES as $prefix) {
            if (str_starts_with($name, $prefix) && strlen($name) > strlen($prefix)) {
                return true;
            }
        }
        return false;
    }
}
