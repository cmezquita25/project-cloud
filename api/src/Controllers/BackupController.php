<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Paths;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\Backup\BackupRunner;
use ProjectCloud\Services\Backup\BackupSettings;

/** Configuración → Base de datos: copias automáticas, contenido y copias en segundo plano. */
final class BackupController
{
    /** GET /admin/backups/settings */
    public function settings(Request $request): Response
    {
        return Response::success($this->payload())->withHeader('Cache-Control', 'no-store');
    }

    /** PUT /admin/backups/settings */
    public function saveSettings(Request $request): Response
    {
        $saved = (new BackupSettings())->save($request->json());
        ActivityLogger::log($request, 'backup.settings_updated', 'system', null, $saved);
        return Response::success($this->payload());
    }

    /** POST /admin/backups/estimate — tamaño de la copia con una configuración aún sin guardar. */
    public function estimate(Request $request): Response
    {
        $settings = new BackupSettings();
        return Response::success([
            'estimate'   => $settings->estimate($settings->normalize($request->json())),
            'disk_free'  => self::diskFree(),
        ]);
    }

    /** GET /admin/backups/extensions — extensiones presentes y cuánto ocupan. */
    public function extensions(Request $request): Response
    {
        return Response::success(['extensions' => (new BackupSettings())->extensions()]);
    }

    /** GET /admin/backups/job — avance de la copia en curso (o la última). */
    public function job(Request $request): Response
    {
        return Response::success(['job' => (new BackupRunner())->job()])->withHeader('Cache-Control', 'no-store');
    }

    /**
     * POST /admin/database/backups — crea una copia ahora. Responde enseguida
     * (202) y la copia sigue en segundo plano si el servidor usa PHP-FPM; si no,
     * responde al terminar.
     */
    public function create(Request $request): Response
    {
        $runner = new BackupRunner();
        $job = $runner->prepare('manual', (int) $request->userId());
        ActivityLogger::log($request, 'backup_create', 'system', 0, ['job' => $job['id']]);

        if (function_exists('fastcgi_finish_request')) {
            Response::success(['job' => $job], 202)->send();
            fastcgi_finish_request();
            $runner->execute();
            exit;
        }

        $job = $runner->execute();
        return Response::success(['job' => $job], $job['status'] === 'completed' ? 201 : 500);
    }

    /** @return array<string,mixed> */
    private function payload(): array
    {
        $settings = new BackupSettings();
        $next = $settings->nextRun();
        $last = $settings->lastScheduledRun();
        return [
            'settings'           => $settings->get(),
            'next_run'           => $next !== null ? gmdate('c', $next) : null,
            'last_scheduled_run' => $last !== null ? gmdate('c', $last) : null,
            'estimate'           => $settings->estimate(),
            'disk_free'          => self::diskFree(),
            'job'                => (new BackupRunner())->job(),
        ];
    }

    private static function diskFree(): ?int
    {
        $free = @disk_free_space(Paths::var('backups'));
        return $free === false ? null : (int) $free;
    }
}
