<?php

declare(strict_types=1);

namespace ProjectCloud\Updater;

use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\HttpException;

/**
 * Cliente HTTP mínimo del actualizador (cURL). Exige HTTPS con certificado
 * válido; solo permite HTTP contra localhost, para pruebas locales.
 */
final class HttpClient
{
    public static function assertAllowedUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $isLocal = in_array($host, ['localhost', '127.0.0.1', '::1'], true);
        if ($scheme !== 'https' && !($scheme === 'http' && $isLocal)) {
            throw new HttpException(400, 'UPDATE_URL_INSECURE', 'El servidor de actualizaciones debe usar HTTPS.');
        }
    }

    /** Resuelve una URL relativa al manifiesto (p. ej. "releases/x.zip"). */
    public static function resolve(string $base, string $relative): string
    {
        if (preg_match('#^https?://#i', $relative) === 1) {
            return $relative;
        }
        $dir = substr($base, 0, (int) strrpos($base, '/') + 1);
        return $dir . ltrim($relative, '/');
    }

    /** GET de un recurso pequeño (manifiesto). */
    public static function get(string $url, int $timeout, int $maxBytes): string
    {
        self::assertAllowedUrl($url);
        $ch = self::init($url, $timeout);
        $buffer = '';
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, static function ($ch, string $chunk) use (&$buffer, $maxBytes): int {
            $buffer .= $chunk;
            return strlen($buffer) > $maxBytes ? 0 : strlen($chunk); // 0 = abortar
        });
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);

        if ($error !== '' || $status !== 200) {
            throw new HttpException(502, 'UPDATE_SERVER_UNREACHABLE', 'No se pudo consultar el servidor de actualizaciones' . ($error !== '' ? ": {$error}" : " (HTTP {$status})."));
        }
        return $buffer;
    }

    /**
     * Descarga un tramo [$from, $to] y lo añade al archivo. Devuelve los bytes
     * escritos y si el servidor respetó el rango (206) o mandó todo (200).
     *
     * @return array{bytes:int, partial:bool}
     */
    public static function downloadRange(string $url, string $file, int $from, int $to, int $timeout): array
    {
        self::assertAllowedUrl($url);
        $handle = fopen($file, $from === 0 ? 'wb' : 'ab');
        if ($handle === false) {
            throw new HttpException(500, 'UPDATE_DOWNLOAD_FAILED', 'No se pudo escribir el paquete descargado.');
        }

        $ch = self::init($url, $timeout);
        curl_setopt($ch, CURLOPT_RANGE, "{$from}-{$to}");
        curl_setopt($ch, CURLOPT_FILE, $handle);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $bytes = (int) curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);
        $error = curl_error($ch);
        fclose($handle);

        if ($error !== '' || ($status !== 206 && $status !== 200)) {
            throw new HttpException(502, 'UPDATE_DOWNLOAD_FAILED', 'Falló la descarga del paquete' . ($error !== '' ? ": {$error}" : " (HTTP {$status})."));
        }
        return ['bytes' => $bytes, 'partial' => $status === 206];
    }

    /** @return \CurlHandle */
    private static function init(string $url, int $timeout)
    {
        if (!function_exists('curl_init')) {
            throw new HttpException(500, 'CURL_MISSING', 'La extensión cURL de PHP no está habilitada.');
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS | CURLPROTO_HTTP,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT      => 'ProjectCloud-Updater/' . AppVersion::current(),
            CURLOPT_HTTPHEADER     => ['Cache-Control: no-cache'],
        ]);
        return $ch;
    }
}
