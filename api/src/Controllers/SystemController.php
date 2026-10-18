<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\MaintenanceMode;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\AuthService;
use ProjectCloud\Services\CronService;
use ProjectCloud\Services\SessionRevoker;
use ProjectCloud\Repositories\RefreshTokenRepository;

/** Estado del sistema, cron por HTTP y modo mantenimiento. */
final class SystemController
{
    /** Duraciones permitidas para el mantenimiento manual (minutos; 0 = sin límite). */
    private const MAINTENANCE_DURATIONS = [0, 30, 60, 240];

    /** GET /system/status (público) — lo consulta la pantalla de mantenimiento. */
    public function status(Request $request): Response
    {
        return Response::success([
            'maintenance' => MaintenanceMode::publicStatus(),
            'app_version' => AppVersion::current(),
        ])->withHeader('Cache-Control', 'no-store');
    }

    /** GET /system/cron?token=… — cron por HTTP para servicios externos. */
    public function cron(Request $request): Response
    {
        $cron = new CronService();
        $token = (string) ($request->input('token') ?? $request->header('X-Cron-Token') ?? '');
        if (!$cron->isValidSecret($token)) {
            throw HttpException::forbidden('Token de cron inválido.', 'CRON_TOKEN_INVALID');
        }
        return Response::success($cron->run('http'))->withHeader('Cache-Control', 'no-store');
    }

    /**
     * POST /admin/maintenance — activa o desactiva el modo mantenimiento.
     * Body: { active: bool, message?: string, duration_minutes?: 0|30|60|240, logout_all?: bool }
     *
     * Al activarlo devuelve el token de paso del admin. Si se pide cerrar todas
     * las sesiones, también devuelve una sesión nueva para el admin que lo activó.
     */
    public function setMaintenance(Request $request): Response
    {
        $body = $request->json();
        $userId = (int) $request->userId();

        if (empty($body['active'])) {
            MaintenanceMode::disable();
            ActivityLogger::log($request, 'maintenance.disabled', 'system', null, []);
            return Response::success(['maintenance' => MaintenanceMode::publicStatus()]);
        }

        $minutes = (int) ($body['duration_minutes'] ?? 60);
        if (!in_array($minutes, self::MAINTENANCE_DURATIONS, true)) {
            throw HttpException::validation(['duration_minutes' => ['Duración no válida.']]);
        }
        $message = isset($body['message']) ? (string) $body['message'] : null;

        $bypass = MaintenanceMode::enable('manual', $userId, $message, $minutes > 0 ? $minutes * 60 : null);

        $tokens = null;
        if (!empty($body['logout_all'])) {
            (new SessionRevoker())->revokeAll();
            $user = (new UserRepository())->findById($userId);
            if ($user !== null) {
                $tokens = (new AuthService(new UserRepository(), new RefreshTokenRepository()))
                    ->issueFor($user, $request->userAgent(), $request->ip());
            }
        }

        ActivityLogger::log($request, 'maintenance.enabled', 'system', null, [
            'duration_minutes' => $minutes,
            'logout_all' => $tokens !== null,
        ]);

        return Response::success([
            'maintenance'  => MaintenanceMode::publicStatus(),
            'bypass_token' => $bypass,
            'session'      => $tokens,
        ]);
    }
}
