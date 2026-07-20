<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Endpoint público para obtener la configuración visual y servir los logos.
 */
final class SettingsController
{
    private const LOGO_KEYS = ['logo_favicon', 'logo_white', 'logo_dark', 'logo_mobile'];
    
    /** GET /v1/settings/public */
    public function publicConfig(Request $request): Response
    {
        $settings = new SettingsRepository();
        $config = [];
        foreach (self::LOGO_KEYS as $key) {
            $config[$key] = $settings->get($key) ? true : false;
        }
        $config['organization_name'] = $settings->get('organization_name');
        $config['organization_slogan'] = $settings->get('organization_slogan');
        $config['support_email'] = $settings->get('support_email');
        return Response::success($config);
    }

    /** GET /v1/settings/logo/{type} */
    public function serveLogo(Request $request): void
    {
        $type = $request->param('type');
        $key = "logo_{$type}";
        
        if (!in_array($key, self::LOGO_KEYS, true)) {
            throw HttpException::notFound('Logo type not valid');
        }

        $settings = new SettingsRepository();
        $filename = $settings->get($key);
        
        if (!$filename) {
            throw HttpException::notFound('Logo not set');
        }

        $path = __DIR__ . '/../../../storage/platform/' . $filename;
        if (!file_exists($path)) {
            throw HttpException::notFound('Logo file missing');
        }

        $mime = mime_content_type($path);
        if (!$mime) {
            $mime = 'application/octet-stream';
        }

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: public, max-age=86400'); // Cache 1 día
        
        readfile($path);
        exit;
    }
}
