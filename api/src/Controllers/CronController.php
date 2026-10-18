<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\CronService;
use ProjectCloud\Services\UrlBuilder;

/** Pantalla «Tareas Cron»: estado, guía de configuración y ejecución manual. */
final class CronController
{
    /** GET /admin/cron — estado del cron y datos para la guía de configuración. */
    public function status(Request $request): Response
    {
        $cron = new CronService();
        $settings = new SettingsRepository();

        $script = realpath(__DIR__ . '/../../cron.php') ?: (dirname(__DIR__, 2) . '/cron.php');
        $phpCli = self::phpCliBinary();

        return Response::success([
            'cron_last_run'  => $settings->get('cron_last_run'),
            'cron_last_mode' => $settings->get('cron_last_mode'),
            'server_time'    => gmdate('c'),
            'php_version'    => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
            'script_path'    => $script,
            'panel_path'     => self::panelRelativePath($script),
            'php_binary'     => $phpCli,
            'command'        => "{$phpCli} {$script} >/dev/null 2>&1",
            'crontab_line'   => "* * * * * {$phpCli} {$script} >/dev/null 2>&1",
            'cron_url'       => UrlBuilder::fullUrl('/api/v1/system/cron?token=' . $cron->secret()),
            'tasks'          => $cron->status(),
        ]);
    }

    /** POST /admin/cron/run — ejecuta todas las tareas ahora. */
    public function runAll(Request $request): Response
    {
        $result = (new CronService())->run('manual', true);
        ActivityLogger::log($request, 'cron.run', 'system', null, ['tasks' => array_keys($result['tasks'])]);
        return Response::success($result);
    }

    /** POST /admin/cron/tasks/{key}/run — ejecuta una sola tarea ahora. */
    public function runTask(Request $request): Response
    {
        $key = (string) $request->param('key');
        $result = (new CronService())->run('manual', true, $key);
        ActivityLogger::log($request, 'cron.run', 'system', null, ['tasks' => [$key]]);
        return Response::success($result);
    }

    /** POST /admin/cron/secret — invalida la URL del cron por HTTP y genera una nueva. */
    public function regenerateSecret(Request $request): Response
    {
        $secret = (new CronService())->regenerateSecret();
        ActivityLogger::log($request, 'cron.secret_regenerated', 'system', null, []);
        return Response::success(['cron_url' => UrlBuilder::fullUrl('/api/v1/system/cron?token=' . $secret)]);
    }

    /**
     * Binario de PHP para línea de comandos. Bajo PHP-FPM, PHP_BINARY apunta al
     * proceso FPM (p. ej. /opt/plesk/php/8.3/sbin/php-fpm); el CLI vive al lado
     * en bin/php. Si no se puede deducir, se usa `php` del PATH.
     */
    private static function phpCliBinary(): string
    {
        $binary = PHP_BINARY;
        if ($binary === '') {
            return 'php';
        }
        if (PHP_SAPI === 'cli') {
            return $binary;
        }
        if (str_starts_with(basename($binary), 'php-fpm')) {
            $candidate = dirname($binary, 2) . '/bin/php'; // …/sbin/php-fpm → …/bin/php
            if (@is_file($candidate)) {
                return $candidate;
            }
        }
        return 'php';
    }

    /**
     * Ruta del script relativa a la carpeta de la suscripción, tal como la pide
     * Plesk en «Ejecutar un script PHP» (p. ej. `httpdocs/api/cron.php`).
     */
    private static function panelRelativePath(string $script): ?string
    {
        $docRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
        if ($docRoot === '') {
            return null;
        }
        $home = dirname($docRoot);
        $normalized = str_replace('\\', '/', $script);
        $homeNormalized = str_replace('\\', '/', $home) . '/';
        return str_starts_with($normalized, $homeNormalized) ? substr($normalized, strlen($homeNormalized)) : null;
    }
}
