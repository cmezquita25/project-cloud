<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;

/**
 * Fotos de perfil de los usuarios (Fase posterior, punto 10).
 *
 * Se guardan en una carpeta SEPARADA hermana de /storage (`/avatars`), fuera de
 * la unidad de archivos del usuario, para no consumir su cuota ni mezclarse con
 * su contenido. No requiere columna en BD: la existencia del archivo
 * `avatars/{userId}.{ext}` indica que el usuario tiene foto.
 */
final class AvatarService
{
    private const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    private const ALLOWED = [
        'image/png'  => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    private readonly string $root;

    public function __construct(?string $root = null)
    {
        $storage = rtrim((string) Config::get('storage.path', ''), "/\\");
        $this->root = rtrim($root ?? (dirname($storage) . DIRECTORY_SEPARATOR . 'avatars'), "/\\");
    }

    /** Ruta absoluta del avatar del usuario, o null si no tiene. */
    public function pathFor(int $userId): ?string
    {
        foreach (self::ALLOWED as $ext) {
            $p = $this->root . DIRECTORY_SEPARATOR . $userId . '.' . $ext;
            if (is_file($p)) {
                return $p;
            }
        }
        return null;
    }

    public function exists(int $userId): bool
    {
        return $this->pathFor($userId) !== null;
    }

    /** URL pública del avatar (con cache-bust por mtime) o null. */
    public static function urlFor(int $userId): ?string
    {
        $svc = new self();
        $path = $svc->pathFor($userId);
        if ($path === null) {
            return null;
        }
        return '/api/v1/auth/avatar/' . $userId . '?v=' . (string) (@filemtime($path) ?: 0);
    }

    /**
     * Guarda (o reemplaza) el avatar. $file = entrada de $_FILES.
     *
     * @param array{name?:string,tmp_name?:string,size?:int,error?:int} $file
     */
    public function store(int $userId, array $file): void
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || empty($file['tmp_name'])) {
            throw HttpException::badRequest('No se recibió la imagen o hubo un error al subirla.');
        }
        if (($file['size'] ?? 0) > self::MAX_BYTES) {
            throw HttpException::badRequest('La imagen no debe superar los 5 MB.');
        }

        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!isset(self::ALLOWED[$mime])) {
            throw HttpException::badRequest('Formato no permitido. Usa PNG, JPG, WEBP o GIF.');
        }
        // Verifica que sea una imagen real.
        if (@getimagesize($file['tmp_name']) === false) {
            throw HttpException::badRequest('El archivo no es una imagen válida.');
        }

        if (!is_dir($this->root) && !@mkdir($this->root, 0775, true) && !is_dir($this->root)) {
            throw new HttpException(500, 'AVATAR_DIR', 'No se pudo preparar el almacenamiento de avatares.');
        }

        // Elimina cualquier avatar previo (posible extensión distinta).
        $this->delete($userId);

        $dest = $this->root . DIRECTORY_SEPARATOR . $userId . '.' . self::ALLOWED[$mime];
        if (!@move_uploaded_file($file['tmp_name'], $dest)) {
            // Fallback para entornos de prueba (no es una subida HTTP real).
            if (!@rename($file['tmp_name'], $dest) && !@copy($file['tmp_name'], $dest)) {
                throw new HttpException(500, 'AVATAR_SAVE', 'No se pudo guardar la imagen.');
            }
        }
        @chmod($dest, 0644);
        $this->resizeAvatar($dest, 250);
    }

    /** Redimensiona la imagen a un tamaño máximo manteniendo proporciones. */
    private function resizeAvatar(string $path, int $max = 250): void
    {
        if (!function_exists('imagecreatetruecolor') || !is_file($path)) {
            return;
        }

        $info = @getimagesize($path);
        if ($info === false) {
            return;
        }

        $w = (int) ($info[0] ?? 0);
        $h = (int) ($info[1] ?? 0);
        $type = (int) ($info[2] ?? 0);
        if ($w <= $max && $h <= $max) {
            return;
        }

        $srcImg = match ($type) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_PNG  => @imagecreatefrompng($path),
            IMAGETYPE_GIF  => @imagecreatefromgif($path),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            default        => false,
        };
        if (!$srcImg) {
            return;
        }

        $scale = min(1.0, $max / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));

        $dst = imagecreatetruecolor($nw, $nh);

        if ($type === IMAGETYPE_PNG || $type === IMAGETYPE_WEBP) {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
            if ($transparent !== false) {
                imagefilledrectangle($dst, 0, 0, $nw, $nh, $transparent);
            }
        }

        imagecopyresampled($dst, $srcImg, 0, 0, 0, 0, $nw, $nh, $w, $h);

        match ($type) {
            IMAGETYPE_JPEG => @imagejpeg($dst, $path, 85),
            IMAGETYPE_PNG  => @imagepng($dst, $path, 6),
            IMAGETYPE_GIF  => @imagegif($dst, $path),
            IMAGETYPE_WEBP => function_exists('imagewebp') ? @imagewebp($dst, $path, 85) : @imagejpeg($dst, $path, 85),
            default        => null,
        };

        imagedestroy($srcImg);
        imagedestroy($dst);
    }

    /** Elimina el avatar del usuario (vuelve a iniciales). */
    public function delete(int $userId): void
    {
        foreach (self::ALLOWED as $ext) {
            $p = $this->root . DIRECTORY_SEPARATOR . $userId . '.' . $ext;
            if (is_file($p)) {
                @unlink($p);
            }
        }
    }
}
