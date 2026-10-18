<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\HttpException;

/**
 * Envía un archivo al navegador desde PHP (archivos privados), con soporte de
 * rangos para que los vídeos y audios se puedan adelantar.
 *
 * Los tipos que el navegador podría ejecutar como página (HTML, SVG, XML, JS)
 * se fuerzan a descarga, y el texto y lo desconocido van con CSP «sandbox»: el
 * contenido se sirve desde el mismo dominio que la app y no debe poder ejecutar
 * código en ella.
 */
final class FileStreamer
{
    private const ACTIVE_TYPES = '#^(text/html|application/xhtml\+xml|image/svg\+xml|text/xml|application/xml|text/javascript|application/javascript)#i';

    public static function send(string $path, string $name, ?string $mime, bool $download = false): void
    {
        if (!is_file($path)) {
            throw HttpException::notFound('Archivo no encontrado');
        }

        $size = (int) filesize($path);
        $mime = $mime ?: (mime_content_type($path) ?: 'application/octet-stream');
        $attachment = $download || preg_match(self::ACTIVE_TYPES, $mime) === 1;
        $safeName = str_replace(['"', "\r", "\n"], '', $name);

        $start = 0;
        $end = $size - 1;
        $range = $_SERVER['HTTP_RANGE'] ?? '';
        if ($size > 0 && preg_match('/^bytes=(\d*)-(\d*)$/', $range, $m) === 1) {
            if ($m[1] === '' && $m[2] !== '') {
                $start = max(0, $size - (int) $m[2]); // últimos N bytes
            } else {
                $start = (int) $m[1];
                $end = $m[2] !== '' ? min((int) $m[2], $size - 1) : $size - 1;
            }
            if ($start > $end || $start >= $size) {
                http_response_code(416);
                header("Content-Range: bytes */{$size}");
                exit;
            }
            http_response_code(206);
            header("Content-Range: bytes {$start}-{$end}/{$size}");
        }

        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . ($end - $start + 1));
        header('Accept-Ranges: bytes');
        header(sprintf('Content-Disposition: %s; filename="%s"; filename*=UTF-8\'\'%s', $attachment ? 'attachment' : 'inline', $safeName, rawurlencode($name)));
        header('X-Content-Type-Options: nosniff');
        // Chrome no muestra PDFs con CSP «sandbox»; imágenes y medios no ejecutan código.
        if (preg_match('#^(image/|video/|audio/|application/pdf)#i', $mime) !== 1) {
            header('Content-Security-Policy: sandbox; default-src \'none\'; style-src \'unsafe-inline\'');
        }
        header('Cache-Control: private, max-age=3600');
        header('Referrer-Policy: no-referrer');
        header('X-Robots-Tag: noindex, nofollow');

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo leer el archivo.');
        }
        fseek($handle, $start);
        $remaining = $end - $start + 1;
        while ($remaining > 0 && !feof($handle) && connection_status() === CONNECTION_NORMAL) {
            $chunk = fread($handle, (int) min(1 << 20, $remaining));
            if ($chunk === false) {
                break;
            }
            echo $chunk;
            flush();
            $remaining -= strlen($chunk);
        }
        fclose($handle);
        exit;
    }
}
