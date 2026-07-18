<?php

declare(strict_types=1);

namespace ProjectCloud\Middleware;

use ProjectCloud\Core\Config;

/**
 * Manejo de CORS para desarrollo. En producción el front y la API comparten
 * dominio (drive.techmaleon.mx), por lo que CORS no es necesario; solo se
 * activa para orígenes de desarrollo explícitamente permitidos.
 *
 * Se aplica a nivel de front controller (emite cabeceras y responde OPTIONS).
 */
final class Cors
{
    /** Orígenes permitidos en desarrollo. */
    private const DEV_ORIGINS = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ];

    /** Emite cabeceras CORS si el origen está permitido. Devuelve true si era preflight. */
    public static function handle(): bool
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $isDev = Config::get('env', 'production') === 'development';

        if ($isDev && in_array($origin, self::DEV_ORIGINS, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With');
            header('Access-Control-Max-Age: 86400');
        }

        // Responde el preflight sin cuerpo.
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            http_response_code(204);
            return true;
        }
        return false;
    }
}
