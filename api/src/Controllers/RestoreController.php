<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\Backup\RestoreAnalyzer;
use ProjectCloud\Services\Backup\RestoreRunner;

/** Restauración de copias con diagnóstico previo. */
final class RestoreController
{
    /** POST /admin/backups/{filename}/analyze — diagnóstico (no modifica nada). */
    public function analyze(Request $request): Response
    {
        $report = (new RestoreAnalyzer())->analyze((string) $request->param('filename'));
        return Response::success($report)->withHeader('Cache-Control', 'no-store');
    }

    /**
     * POST /admin/backups/{filename}/restore
     * Body: { ack: true, restore_config?: bool, quarantine?: bool, safety_copy?: bool }
     *
     * Activa el mantenimiento y responde con el token de paso y el token de
     * progreso; la restauración sigue en segundo plano (PHP-FPM) o termina antes
     * de responder (sin FPM).
     */
    public function start(Request $request): Response
    {
        $body = $request->json();
        if (empty($body['ack'])) {
            throw HttpException::validation(['ack' => ['Confirma que entiendes que se reemplazará el estado actual de la plataforma.']]);
        }

        $filename = (string) $request->param('filename');
        $runner = new RestoreRunner();
        $prepared = $runner->prepare($filename, $body, (int) $request->userId());
        ActivityLogger::log($request, 'backup_restore', 'system', 0, ['filename' => $filename, 'options' => $prepared['job']['options']]);

        $payload = [
            'job'                => $prepared['job'],
            'maintenance_bypass' => $prepared['bypass'],
            'progress_token'     => $prepared['token'],
        ];

        if (function_exists('fastcgi_finish_request')) {
            Response::success($payload, 202)->send();
            fastcgi_finish_request();
            $runner->execute();
            exit;
        }

        $payload['job'] = $runner->execute();
        return Response::success($payload);
    }

    /**
     * GET /system/restore-progress (cabecera X-Restore-Token). Sin sesión: tras
     * restaurar la base de datos, las sesiones son las de la copia.
     */
    public function progress(Request $request): Response
    {
        $job = (new RestoreRunner())->progress((string) $request->header('X-Restore-Token'));
        if ($job === null) {
            throw HttpException::notFound('No hay una restauración con ese token.');
        }
        return Response::success(['job' => $job])->withHeader('Cache-Control', 'no-store');
    }
}
