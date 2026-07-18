<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;

/**
 * Diagnóstico del backend. Verifica versión de PHP, extensiones requeridas,
 * escritura en /storage y conectividad con la base de datos.
 */
final class HealthController
{
    private const REQUIRED_EXTENSIONS = ['pdo_mysql', 'fileinfo', 'mbstring', 'json'];

    public function index(Request $request): Response
    {
        $extensions = [];
        foreach (self::REQUIRED_EXTENSIONS as $ext) {
            $extensions[$ext] = extension_loaded($ext);
        }

        $configured = Config::isLoaded();
        $storagePath = (string) Config::get('storage.path', '');
        $storageWritable = $storagePath !== '' && is_dir($storagePath) && is_writable($storagePath);

        $dbReachable = $configured ? Database::isReachable() : false;

        $phpOk = version_compare(PHP_VERSION, '8.1.0', '>=');
        $extOk = !in_array(false, $extensions, true);

        return Response::success([
            'status'     => ($phpOk && $extOk) ? 'ok' : 'degraded',
            'app'        => 'Project Cloud API',
            'phase'      => 1,
            'configured' => $configured,
            'php'        => [
                'version' => PHP_VERSION,
                'ok'      => $phpOk,
            ],
            'extensions' => $extensions,
            'storage'    => [
                'writable' => $storageWritable,
            ],
            'database'   => [
                'reachable' => $dbReachable,
            ],
        ]);
    }
}
