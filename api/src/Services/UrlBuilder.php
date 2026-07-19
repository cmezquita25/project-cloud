<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Construye URLs públicas de la app (enlaces de correo). Prioridad de la base:
 * setting 'app_url' → storage.public_url (config del instalador) → cabeceras del
 * request. Nada queda fijado a un dominio concreto.
 */
final class UrlBuilder
{
    public static function base(): string
    {
        $url = trim((string) ((new SettingsRepository())->get('app_url') ?: Config::get('storage.public_url', '')));

        if ($url === '') {
            $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
            if ($host !== '') {
                $https = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? 'off') !== 'off';
                $url = ($https ? 'https' : 'http') . '://' . $host;
            }
        }

        return rtrim($url, '/');
    }

    public static function resetLink(string $token): string
    {
        return self::base() . '/reset-password?token=' . rawurlencode($token);
    }

    public static function loginUrl(): string
    {
        return self::base() . '/login';
    }
}
