<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Services\ActivityLogger;

/**
 * Apariencia de los códigos QR de los enlaces compartidos (Configuración →
 * Apariencia). El QR se dibuja en el navegador; aquí solo se decide qué va al
 * centro:
 *
 *   none      QR normal, sin logo (por defecto)
 *   platform  el favicon de la plataforma
 *   custom    una imagen propia, reducida por la plataforma a 256 px como máximo
 */
final class QrSettingsController
{
    public const MODES = ['none', 'platform', 'custom'];
    public const MAX_PX = 256;
    private const MAX_UPLOAD = 5 * 1024 * 1024;

    /**
     * Lo que el navegador necesita para dibujar el QR. Un modo sin imagen
     * disponible (sin favicon, imagen borrada) se publica como «none».
     *
     * @return array{qr_logo_mode:string,qr_logo_url:?string}
     */
    public static function publicConfig(SettingsRepository $settings): array
    {
        $mode = (string) $settings->get('qr_logo_mode', 'none');
        if ($mode === 'platform' && $settings->get('logo_favicon')) {
            return ['qr_logo_mode' => 'platform', 'qr_logo_url' => '/api/v1/settings/logo/favicon'];
        }
        $custom = (string) $settings->get('qr_logo_custom', '');
        if ($mode === 'custom' && $custom !== '' && is_file(self::dir() . '/' . $custom)) {
            // El nombre cambia con cada subida: sirve de versión para la caché.
            return ['qr_logo_mode' => 'custom', 'qr_logo_url' => '/api/v1/settings/qr-logo?v=' . rawurlencode($custom)];
        }
        return ['qr_logo_mode' => 'none', 'qr_logo_url' => null];
    }

    /** GET /admin/settings/qr — configuración guardada (aunque falte la imagen). */
    public function show(Request $request): Response
    {
        return Response::success($this->state());
    }

    /** @return array<string,mixed> */
    private function state(): array
    {
        $settings = new SettingsRepository();
        $custom = (string) $settings->get('qr_logo_custom', '');
        return [
            'mode'             => in_array($settings->get('qr_logo_mode', 'none'), self::MODES, true) ? $settings->get('qr_logo_mode', 'none') : 'none',
            'has_custom'       => $custom !== '' && is_file(self::dir() . '/' . $custom),
            'has_platform'     => (bool) $settings->get('logo_favicon'),
            'max_px'           => self::MAX_PX,
            ...self::publicConfig($settings),
        ];
    }

    /** PUT /admin/settings/qr { mode } */
    public function update(Request $request): Response
    {
        $mode = (string) ($request->json()['mode'] ?? '');
        if (!in_array($mode, self::MODES, true)) {
            throw HttpException::badRequest('Opción de QR no válida.');
        }
        $settings = new SettingsRepository();
        if ($mode === 'custom' && (string) $settings->get('qr_logo_custom', '') === '') {
            throw HttpException::badRequest('Primero sube la imagen personalizada.', 'QR_LOGO_MISSING');
        }
        if ($mode === 'platform' && !$settings->get('logo_favicon')) {
            throw HttpException::badRequest('La plataforma no tiene favicon: súbelo en «Logos» o elige otra opción.', 'QR_LOGO_MISSING');
        }
        $settings->set('qr_logo_mode', $mode);
        ActivityLogger::log($request, 'settings.update', 'config', null, ['qr_logo_mode' => $mode]);
        return $this->show($request);
    }

    /**
     * POST /admin/settings/qr-logo (multipart `file`) — imagen propia. Se
     * reduce a 256 px de lado mayor conservando proporciones y transparencia,
     * y queda seleccionada.
     */
    public function upload(Request $request): Response
    {
        $file = $request->file('file');
        if ($file === null || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw HttpException::badRequest('No se recibió la imagen o hubo un error al subirla.');
        }
        if ((int) $file['size'] > self::MAX_UPLOAD) {
            throw HttpException::badRequest('La imagen no debe superar los 5 MB.');
        }
        $info = @getimagesize((string) $file['tmp_name']);
        $type = is_array($info) ? (int) $info[2] : 0;
        if (!in_array($type, [IMAGETYPE_PNG, IMAGETYPE_JPEG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
            throw HttpException::badRequest('Formato no permitido. Usa PNG, JPG, WEBP o GIF.');
        }

        $dir = self::dir();
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new HttpException(500, 'UPLOAD_ERROR', 'No se pudo crear la carpeta de logos.');
        }
        $filename = 'qr_logo_' . time() . '.png';
        $resized = self::fitTo((string) $file['tmp_name'], $info, $dir . '/' . $filename);

        $settings = new SettingsRepository();
        $old = (string) $settings->get('qr_logo_custom', '');
        if ($old !== '' && $old !== $filename && is_file($dir . '/' . $old)) {
            @unlink($dir . '/' . $old);
        }
        $settings->set('qr_logo_custom', $filename);
        $settings->set('qr_logo_mode', 'custom');
        ActivityLogger::log($request, 'settings.update', 'config', null, ['qr_logo' => 'custom', 'resized' => $resized]);

        return Response::success(['resized' => $resized, 'original' => ['width' => (int) $info[0], 'height' => (int) $info[1]]] + $this->state());
    }

    /** DELETE /admin/settings/qr-logo — borra la imagen propia (si estaba en uso, vuelve a «sin logo»). */
    public function delete(Request $request): Response
    {
        $settings = new SettingsRepository();
        $old = (string) $settings->get('qr_logo_custom', '');
        if ($old !== '' && is_file(self::dir() . '/' . $old)) {
            @unlink(self::dir() . '/' . $old);
        }
        $settings->set('qr_logo_custom', '');
        if ($settings->get('qr_logo_mode') === 'custom') {
            $settings->set('qr_logo_mode', 'none');
        }
        return $this->show($request);
    }

    /** GET /settings/qr-logo — la imagen propia (pública, como los logos). */
    public function serve(Request $request): void
    {
        $name = (string) (new SettingsRepository())->get('qr_logo_custom', '');
        $path = self::dir() . '/' . $name;
        if ($name === '' || !is_file($path)) {
            throw HttpException::notFound('Sin imagen para el QR');
        }
        header('Content-Type: image/png');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: public, max-age=31536000, immutable'); // el nombre cambia en cada subida
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }

    // --- Ayudantes ---

    private static function dir(): string
    {
        return dirname(__DIR__, 3) . '/storage/platform';
    }

    /**
     * Guarda la imagen como PNG con el lado mayor ≤ 256 px (sin agrandar las
     * pequeñas). Devuelve true si tuvo que reducirla.
     *
     * @param array<int|string,mixed> $info getimagesize()
     */
    private static function fitTo(string $src, array $info, string $dest): bool
    {
        [$w, $h, $type] = [(int) $info[0], (int) $info[1], (int) $info[2]];
        $scale = min(1.0, self::MAX_PX / max($w, $h, 1));

        if (!function_exists('imagecreatetruecolor')) {
            // Sin GD no se puede convertir ni reducir: solo se acepta un PNG ya del tamaño.
            if ($scale < 1.0 || $type !== IMAGETYPE_PNG) {
                throw HttpException::badRequest('El servidor no puede ajustar imágenes: sube un PNG de máximo 256 × 256 px.');
            }
            if (!@copy($src, $dest)) {
                throw new HttpException(500, 'UPLOAD_ERROR', 'No se pudo guardar la imagen.');
            }
            return false;
        }

        $img = match ($type) {
            IMAGETYPE_PNG  => @imagecreatefrompng($src),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($src),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false,
            IMAGETYPE_GIF  => @imagecreatefromgif($src),
            default        => false,
        };
        if (!$img) {
            throw HttpException::badRequest('No se pudo leer la imagen.');
        }
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $out = imagecreatetruecolor($nw, $nh);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, (int) imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        $ok = imagepng($out, $dest, 9);
        imagedestroy($img);
        imagedestroy($out);
        if (!$ok) {
            throw new HttpException(500, 'UPLOAD_ERROR', 'No se pudo guardar la imagen.');
        }
        return $scale < 1.0;
    }
}
