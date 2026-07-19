<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;

/**
 * Genera y sirve miniaturas reducidas de imágenes (punto 6).
 *
 * Usa GD (disponible en el hosting). Cachea en disco en una carpeta hermana de
 * /storage (`/thumbs`), con clave por ruta+mtime+tamaño. Si GD no está o el
 * archivo no es una imagen rasterizable, sirve el original como fallback
 * (comportamiento seguro y portable). El binario reducido se emite y termina.
 */
final class ThumbnailService
{
    private readonly string $cacheDir;

    public function __construct(?string $cacheDir = null)
    {
        $storage = rtrim((string) Config::get('storage.path', ''), "/\\");
        $this->cacheDir = rtrim($cacheDir ?? (dirname($storage) . DIRECTORY_SEPARATOR . 'thumbs'), "/\\");
    }

    /** Emite (streaming) una miniatura JPEG del archivo, o el original si no aplica. */
    public function stream(string $absSource, int $max = 400): void
    {
        if (!is_file($absSource)) {
            throw HttpException::notFound('Archivo no encontrado');
        }

        $info = @getimagesize($absSource);
        // No es imagen o falta GD → sirve el original.
        if ($info === false || !function_exists('imagecreatetruecolor')) {
            $mime = is_array($info) && isset($info['mime'])
                ? (string) $info['mime']
                : (mime_content_type($absSource) ?: 'application/octet-stream');
            $this->emit($absSource, $mime);
            return;
        }

        $mtime = (int) (@filemtime($absSource) ?: 0);
        $key = md5($absSource . '|' . $mtime . '|' . $max) . '.jpg';
        $cached = $this->cacheDir . DIRECTORY_SEPARATOR . $key;

        if (!is_file($cached)) {
            $ok = $this->generate($absSource, $cached, $info, $max);
            if (!$ok) {
                // Falló la generación → sirve el original.
                $this->emit($absSource, (string) ($info['mime'] ?? 'image/jpeg'));
                return;
            }
        }
        $this->emit($cached, 'image/jpeg');
    }

    /** @param array<int|string,mixed> $info Resultado de getimagesize(). */
    private function generate(string $src, string $dest, array $info, int $max): bool
    {
        $w = (int) ($info[0] ?? 0);
        $h = (int) ($info[1] ?? 0);
        $type = (int) ($info[2] ?? 0);
        if ($w < 1 || $h < 1) {
            return false;
        }

        $srcImg = match ($type) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($src),
            IMAGETYPE_PNG  => @imagecreatefrompng($src),
            IMAGETYPE_GIF  => @imagecreatefromgif($src),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false,
            IMAGETYPE_BMP  => function_exists('imagecreatefrombmp') ? @imagecreatefrombmp($src) : false,
            default        => false,
        };
        if (!$srcImg) {
            return false;
        }

        $scale = min(1.0, $max / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));

        $dst = imagecreatetruecolor($nw, $nh);
        // Fondo blanco: la salida es JPEG (sin alfa), evita fondos negros en PNG.
        $white = imagecolorallocate($dst, 255, 255, 255);
        if ($white !== false) {
            imagefilledrectangle($dst, 0, 0, $nw, $nh, $white);
        }
        imagecopyresampled($dst, $srcImg, 0, 0, 0, 0, $nw, $nh, $w, $h);

        if (!is_dir($this->cacheDir) && !@mkdir($this->cacheDir, 0775, true) && !is_dir($this->cacheDir)) {
            imagedestroy($srcImg);
            imagedestroy($dst);
            return false;
        }

        $ok = @imagejpeg($dst, $dest, 72);
        imagedestroy($srcImg);
        imagedestroy($dst);
        return $ok;
    }

    private function emit(string $path, string $mime): void
    {
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string) filesize($path));
        header('Cache-Control: public, max-age=86400');
        readfile($path);
        exit;
    }
}
