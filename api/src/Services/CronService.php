<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Servicio encargado de las tareas en segundo plano (Cron).
 * Se ejecuta automáticamente cada 60s vía CLI (cPanel/Plesk) o botón de administrador.
 */
final class CronService
{
    private PDO $pdo;
    private SettingsRepository $settings;

    public function __construct(?PDO $pdo = null, ?SettingsRepository $settings = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
        $this->settings = $settings ?? new SettingsRepository();
    }

    /**
     * Ejecuta el ciclo completo del cron.
     *
     * @return array{ok:true, executed_at:string, tasks:array<string,mixed>}
     */
    public function run(): array
    {
        $now = gmdate('c');
        $tasks = [
            'quotas_checked' => 0,
            'quota_warnings_sent' => 0,
            'stale_uploads_cleaned' => 0,
        ];

        // 1. Revisión masiva de cuotas de almacenamiento para todos los usuarios activos
        $userRepo = new UserRepository($this->pdo);
        $fileRepo = new FileRepository($this->pdo);
        $quotaService = new QuotaService($userRepo, $fileRepo);
        $notifService = new NotificationService();

        $stmt = $this->pdo->query("SELECT id, display_name, email, quota_bytes, used_bytes FROM users WHERE status = 'active'");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($users as $u) {
            $userId = (int) $u['id'];
            $tasks['quotas_checked']++;

            $usage = $quotaService->usage($userId);
            $percent = (float) $usage['percent'];
            $flagKey = 'quota_warned_' . $userId;

            if ($percent >= 90.0) {
                // Notificar si no se le ha advertido en este cruce
                if ($this->settings->get($flagKey) === null) {
                    $usedHuman = self::humanBytes((int) $usage['used_bytes']);
                    $quotaHuman = self::humanBytes((int) $usage['quota_bytes']);

                    // Notificación en plataforma web + correo
                    $notifService->notifyQuotaWarning($userId, $percent, $usedHuman, $quotaHuman);
                    $quotaService->checkQuotaWarning($userId);

                    $this->settings->set($flagKey, $now);
                    $tasks['quota_warnings_sent']++;
                }
            } else {
                // Al bajar de 90%, reiniciar la marca de advertencia
                if ($this->settings->get($flagKey) !== null) {
                    $this->settings->delete($flagKey);
                }
            }
        }

        // 2. Limpieza de archivos temporales de subida por chunks más antiguos de 24h
        $uploadsDir = rtrim((string) Config::get('storage.path', ''), '/\\') . '/.uploads';
        if (is_dir($uploadsDir)) {
            $files = glob($uploadsDir . '/*/*');
            if (is_array($files)) {
                $nowTs = time();
                foreach ($files as $file) {
                    if (is_file($file) && ($nowTs - filemtime($file)) > 86400) {
                        @unlink($file);
                        $tasks['stale_uploads_cleaned']++;
                    }
                }
            }
        }

        // 3. Registrar última ejecución en settings
        $this->settings->set('cron_last_run', $now);

        return [
            'ok'          => true,
            'executed_at' => $now,
            'tasks'       => $tasks,
        ];
    }

    /** Formato de bytes ligero. */
    private static function humanBytes(int $bytes): string
    {
        if ($bytes <= 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));
        $i = max(0, min($i, count($units) - 1));
        $value = $bytes / (1024 ** $i);
        return rtrim(rtrim(number_format($value, 1, '.', ''), '0'), '.') . ' ' . $units[$i];
    }
}

