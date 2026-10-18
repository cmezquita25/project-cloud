<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\HttpException;

/**
 * Envía un ZIP al navegador mientras lo arma, sin archivo temporal (no ocupa
 * espacio extra en el hosting). Los archivos van sin comprimir («store»): las
 * fotos, vídeos y PDF ya vienen comprimidos y así no se gasta CPU; a cambio el
 * tamaño final se conoce de antemano (Content-Length → barra de progreso).
 *
 * ZIP clásico (sin ZIP64): hasta 65 535 entradas y menos de 4 GB.
 */
final class ZipStreamer
{
    public const MAX_ENTRIES = 65000;
    public const MAX_BYTES = 4000000000;

    /**
     * @param list<array{name:string,abs:?string,size:int,mtime:int}> $entries
     *        abs = null para carpetas (el nombre termina en «/»)
     */
    public static function send(string $filename, array $entries): void
    {
        if (count($entries) > self::MAX_ENTRIES) {
            throw new HttpException(413, 'ZIP_TOO_LARGE', 'La carpeta tiene demasiados archivos para descargarla en un ZIP. Descarga sus subcarpetas por separado.');
        }
        $total = 22; // fin del directorio central
        $bytes = 0;
        foreach ($entries as $e) {
            $n = strlen($e['name']);
            $total += 30 + $n + 46 + $n + ($e['abs'] !== null ? $e['size'] + 16 : 0);
            $bytes += $e['size'];
        }
        if ($bytes > self::MAX_BYTES || $total > 0xFFFFFFFF) {
            throw new HttpException(413, 'ZIP_TOO_LARGE', 'La carpeta pesa más de 4 GB: descarga sus subcarpetas por separado.');
        }

        @set_time_limit(0);
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        $safe = str_replace(['"', "\r", "\n"], '', $filename);
        header('Content-Type: application/zip');
        header('Content-Length: ' . $total);
        header(sprintf('Content-Disposition: attachment; filename="%s"; filename*=UTF-8\'\'%s', $safe, rawurlencode($filename)));
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store');

        $central = '';
        $offset = 0;
        foreach ($entries as $e) {
            if (connection_status() !== CONNECTION_NORMAL) {
                exit;
            }
            [$time, $date] = self::dosTime($e['mtime']);
            $name = $e['name'];
            $isDir = $e['abs'] === null;
            // bit 3: CRC y tamaños van después de los datos · bit 11: nombre en UTF-8
            $flags = $isDir ? 0x0800 : 0x0808;

            $local = pack('VvvvvvVVVvv', 0x04034b50, 20, $flags, 0, $time, $date, 0, 0, 0, strlen($name), 0) . $name;
            echo $local;
            $crc = 0;
            $size = 0;
            if (!$isDir) {
                [$crc, $size] = self::streamFile((string) $e['abs'], $e['size']);
                echo pack('VVVV', 0x08074b50, $crc, $size, $size);
            }

            $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, $flags, 0, $time, $date, $crc, $size, $size, strlen($name), 0, 0, 0, 0, $isDir ? 0x10 : 0, $offset) . $name;
            $offset += strlen($local) + ($isDir ? 0 : $size + 16);
        }

        $count = count($entries);
        echo $central;
        echo pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, strlen($central), $offset, 0);
        flush();
        exit;
    }

    /**
     * Copia el archivo a la salida calculando su CRC. Se envían exactamente los
     * bytes anunciados (si el archivo cambió mientras tanto, se rellena o se
     * corta) para que el Content-Length y los desplazamientos sigan cuadrando.
     *
     * @return array{0:int,1:int} [crc32, tamaño]
     */
    private static function streamFile(string $path, int $expected): array
    {
        $ctx = hash_init('crc32b');
        $sent = 0;
        $handle = @fopen($path, 'rb');
        if ($handle !== false) {
            while ($sent < $expected && !feof($handle)) {
                $chunk = fread($handle, (int) min(1 << 20, $expected - $sent));
                if ($chunk === false || $chunk === '') {
                    break;
                }
                hash_update($ctx, $chunk);
                echo $chunk;
                $sent += strlen($chunk);
                flush();
            }
            fclose($handle);
        }
        if ($sent < $expected) {
            $pad = str_repeat("\0", $expected - $sent);
            hash_update($ctx, $pad);
            echo $pad;
        }
        return [(int) hexdec(hash_final($ctx)), $expected];
    }

    /** @return array{0:int,1:int} [hora, fecha] en formato MS-DOS */
    private static function dosTime(int $ts): array
    {
        $d = getdate(max($ts, 315532800)); // el formato DOS empieza en 1980
        return [
            ($d['hours'] << 11) | ($d['minutes'] << 5) | intdiv($d['seconds'], 2),
            (($d['year'] - 1980) << 9) | ($d['mon'] << 5) | $d['mday'],
        ];
    }
}
