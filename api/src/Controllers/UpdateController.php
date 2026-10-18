<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\RefreshTokenRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\AuthService;
use ProjectCloud\Services\DatabaseManagerService;
use ProjectCloud\Updater\Preflight;
use ProjectCloud\Updater\UpdateChecker;
use ProjectCloud\Updater\UpdateRunner;

/** Configuración → Actualizaciones (solo administradores). */
final class UpdateController
{
    /** GET /admin/updates — todo lo que necesita la pantalla. */
    public function status(Request $request): Response
    {
        $checker = new UpdateChecker();
        $runner = new UpdateRunner();
        $cached = $checker->cachedStatus();
        $available = $cached['available'];

        $backups = (new DatabaseManagerService())->listBackups();

        return Response::success([
            'current'     => AppVersion::info(),
            'last_check'  => $cached['last_check'],
            'last_error'  => $cached['last_error'],
            'available'   => $available !== null ? self::summary($available) : null,
            'preflight'   => $available !== null ? Preflight::run($available) : null,
            'job'         => $runner->publicJob(),
            'old_files'   => $runner->oldFilesInfo(),
            'history'     => $runner->history(),
            'last_backup' => $backups[0]['created_at'] ?? null,
        ])->withHeader('Cache-Control', 'no-store');
    }

    /**
     * GET /admin/updates/badge — aviso ligero para el sidebar y el dashboard.
     * Si la última consulta tiene más de 12 h, consulta ahora (por si el cron no corre).
     */
    public function badge(Request $request): Response
    {
        $checker = new UpdateChecker();
        $checker->checkIfStale();
        $available = $checker->cachedStatus()['available'];
        return Response::success([
            'available_version' => $available['version'] ?? null,
            'running'           => (new UpdateRunner())->isRunning(),
        ])->withHeader('Cache-Control', 'no-store');
    }

    /** POST /admin/updates/check — consultar ahora. */
    public function check(Request $request): Response
    {
        $status = (new UpdateChecker())->check();
        if ($status['last_error'] !== null) {
            throw new HttpException(502, 'UPDATE_CHECK_FAILED', $status['last_error']);
        }
        return $this->status($request);
    }

    /** POST /admin/updates/start — { version, backup: "system"|"none", ack: true } */
    public function start(Request $request): Response
    {
        $body = $request->json();
        if (empty($body['ack'])) {
            throw HttpException::validation(['ack' => ['Confirma que entiendes que la plataforma no estará disponible durante la actualización.']]);
        }

        // Se vuelve a descargar y verificar el manifiesto: lo que se instala es
        // exactamente la versión que el admin vio y confirmó.
        $manifest = (new UpdateChecker())->fetchManifest();
        if ((string) $manifest['version'] !== (string) ($body['version'] ?? '')) {
            throw new HttpException(409, 'UPDATE_VERSION_CHANGED', "La versión disponible cambió a v{$manifest['version']}. Revisa los cambios y vuelve a intentarlo.");
        }

        $blocking = Preflight::blocking(Preflight::run($manifest));
        if ($blocking !== []) {
            throw new HttpException(422, 'UPDATE_PREFLIGHT_FAILED', 'No se cumplen los requisitos: ' . implode('; ', array_column($blocking, 'label')), $blocking);
        }

        $backup = ($body['backup'] ?? 'system') === 'none' ? 'none' : 'system';
        $runner = new UpdateRunner();
        $runner->start($manifest, $backup, (int) $request->userId());

        ActivityLogger::log($request, 'update.started', 'system', null, [
            'from' => AppVersion::current(),
            'to' => $manifest['version'],
            'backup' => $backup,
        ]);

        return Response::success(['job' => $runner->publicJob()]);
    }

    /**
     * POST /admin/updates/step — avanza un paso. Cuando el paso activa el
     * mantenimiento devuelve el token de paso y una sesión nueva para el admin
     * (las demás sesiones se cerraron).
     */
    public function step(Request $request): Response
    {
        $result = (new UpdateRunner())->step();
        $handoff = $result['handoff'] ?? null;

        $session = null;
        if (!empty($handoff['sessions_revoked'])) {
            $user = (new UserRepository())->findById((int) $request->userId());
            if ($user !== null) {
                $session = (new AuthService(new UserRepository(), new RefreshTokenRepository()))
                    ->issueFor($user, $request->userAgent(), $request->ip());
            }
        }

        return Response::success([
            'job'                => $result['job'],
            'maintenance_bypass' => $handoff['bypass_token'] ?? null,
            'session'            => $session,
        ])->withHeader('Cache-Control', 'no-store');
    }

    /** POST /admin/updates/cancel — solo antes de que se toque el sitio. */
    public function cancel(Request $request): Response
    {
        $runner = new UpdateRunner();
        $runner->cancel();
        ActivityLogger::log($request, 'update.cancelled', 'system', null, []);
        return Response::success(['job' => $runner->publicJob()]);
    }

    /** POST /admin/updates/revert — volver a la versión guardada en old-files. */
    public function revert(Request $request): Response
    {
        $entry = (new UpdateRunner())->revert((int) $request->userId());
        ActivityLogger::log($request, 'update.reverted', 'system', null, ['from' => $entry['from_version'], 'to' => $entry['to_version']]);
        return Response::success(['reverted_to' => $entry['to_version']]);
    }

    /** DELETE /admin/updates/old-files — eliminar el respaldo de la versión anterior. */
    public function deleteOldFiles(Request $request): Response
    {
        (new UpdateRunner())->deleteOldFiles();
        ActivityLogger::log($request, 'update.old_files_deleted', 'system', null, []);
        return Response::success(['ok' => true]);
    }

    /** @param array<string,mixed> $m */
    private static function summary(array $m): array
    {
        return [
            'version'          => $m['version'],
            'released_at'      => $m['released_at'] ?? null,
            'schema'           => $m['schema'],
            'min_from_version' => $m['min_from_version'],
            'size_bytes'       => $m['package']['size_bytes'],
            'reversible'       => !empty($m['migrations']['reversible']),
            'changelog'        => $m['changelog'] ?? [],
            'requirements'     => $m['requirements'] ?? [],
        ];
    }
}
