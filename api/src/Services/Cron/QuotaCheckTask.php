<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Cron;

use PDO;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\NotificationService;
use ProjectCloud\Services\QuotaService;

/** Avisa (web + correo) a los usuarios que cruzan el 90 % de su cuota. */
final class QuotaCheckTask implements ScheduledTask
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly SettingsRepository $settings,
    ) {
    }

    public function key(): string
    {
        return 'quota_check';
    }

    public function label(): string
    {
        return 'Alertas de almacenamiento';
    }

    public function description(): string
    {
        return 'Avisa por correo y en la plataforma a los usuarios que superan el 90 % de su cuota.';
    }

    public function intervalSeconds(): int
    {
        return 15 * 60;
    }

    public function run(): array
    {
        $checked = 0;
        $warned = 0;
        $now = gmdate('c');

        $quotaService = new QuotaService(new UserRepository($this->pdo), new FileRepository($this->pdo));
        $notifService = new NotificationService();

        $users = $this->pdo->query("SELECT id FROM users WHERE status = 'active'")->fetchAll(PDO::FETCH_COLUMN);

        foreach ($users as $id) {
            $userId = (int) $id;
            $checked++;

            $usage = $quotaService->usage($userId);
            $percent = (float) $usage['percent'];
            $flagKey = 'quota_warned_' . $userId;

            if ($percent >= 90.0) {
                // Notificar una sola vez por cada cruce del umbral.
                if ($this->settings->get($flagKey) === null) {
                    $notifService->notifyQuotaWarning(
                        $userId,
                        $percent,
                        self::humanBytes((int) $usage['used_bytes']),
                        self::humanBytes((int) $usage['quota_bytes'])
                    );
                    $quotaService->checkQuotaWarning($userId);
                    $this->settings->set($flagKey, $now);
                    $warned++;
                }
            } elseif ($this->settings->get($flagKey) !== null) {
                // Al bajar del 90 %, se rearma el aviso.
                $this->settings->delete($flagKey);
            }
        }

        return ['usuarios_revisados' => $checked, 'avisos_enviados' => $warned];
    }

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
