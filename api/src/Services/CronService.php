<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\MaintenanceMode;
use ProjectCloud\Core\Paths;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Services\Cron\QuotaCheckTask;
use ProjectCloud\Services\Cron\ScheduledTask;
use ProjectCloud\Services\Cron\StaleUploadsTask;
use ProjectCloud\Services\Cron\SystemCleanupTask;
use ProjectCloud\Services\Cron\UpdateCheckTask;

/**
 * Programador de tareas en segundo plano.
 *
 * El cron del servidor llama a `api/cron.php` cada minuto (CLI) o a
 * `/api/v1/system/cron?token=…` (HTTP). En cada pasada solo se ejecutan las
 * tareas cuyo intervalo ya venció. Un candado de archivo impide que dos
 * pasadas se pisen si una tarda más de un minuto.
 */
final class CronService
{
    /** Modos de invocación: cli/http = cron real del servidor; manual = botón del admin. */
    public const MODES = ['cli', 'http', 'manual'];

    private PDO $pdo;
    private SettingsRepository $settings;

    public function __construct(?PDO $pdo = null, ?SettingsRepository $settings = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
        $this->settings = $settings ?? new SettingsRepository($this->pdo);
    }

    /** @return array<string,ScheduledTask> */
    public function tasks(): array
    {
        $tasks = [
            new QuotaCheckTask($this->pdo, $this->settings),
            new StaleUploadsTask(),
            new SystemCleanupTask($this->pdo),
            new UpdateCheckTask(),
        ];
        $byKey = [];
        foreach ($tasks as $task) {
            $byKey[$task->key()] = $task;
        }
        return $byKey;
    }

    /**
     * Ejecuta una pasada del programador.
     *
     * @param string      $mode  cli | http | manual
     * @param bool        $force Ejecuta aunque el intervalo no haya vencido.
     * @param string|null $only  Ejecuta solo esta tarea.
     * @return array{ok:bool, executed_at:string, mode:string, skipped?:string, tasks:array<string,mixed>}
     */
    public function run(string $mode = 'cli', bool $force = false, ?string $only = null): array
    {
        $now = gmdate('c');
        $result = ['ok' => true, 'executed_at' => $now, 'mode' => $mode, 'tasks' => []];

        $tasks = $this->tasks();
        if ($only !== null) {
            if (!isset($tasks[$only])) {
                throw HttpException::notFound('La tarea no existe.');
            }
            $tasks = [$only => $tasks[$only]];
        }

        // Solo el cron real del servidor cuenta como "el cron funciona".
        if ($mode !== 'manual') {
            $this->settings->set('cron_last_run', $now);
            $this->settings->set('cron_last_mode', $mode);
        }

        // Durante una actualización o restauración no se toca nada.
        if (MaintenanceMode::isActive()) {
            return $result + ['skipped' => 'maintenance'];
        }

        $lock = fopen(Paths::var('locks') . DIRECTORY_SEPARATOR . 'cron.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            return $result + ['skipped' => 'locked'];
        }

        try {
            foreach ($tasks as $key => $task) {
                $state = $this->taskState($key);
                $lastRun = isset($state['last_run']) ? strtotime((string) $state['last_run']) : false;
                $due = $lastRun === false || (time() - $lastRun) >= $task->intervalSeconds();
                if (!$force && !$due) {
                    continue;
                }

                $started = microtime(true);
                try {
                    $metrics = $task->run();
                    $state = ['last_run' => gmdate('c'), 'ok' => true, 'result' => $metrics, 'error' => null];
                } catch (\Throwable $e) {
                    error_log("[ProjectCloud][cron:$key] " . $e->getMessage());
                    $state = ['last_run' => gmdate('c'), 'ok' => false, 'result' => null, 'error' => mb_substr($e->getMessage(), 0, 500)];
                    $result['ok'] = false;
                }
                $state['duration_ms'] = (int) round((microtime(true) - $started) * 1000);
                $state['mode'] = $mode;
                $this->settings->set(self::stateKey($key), (string) json_encode($state, JSON_UNESCAPED_UNICODE));
                $result['tasks'][$key] = $state;
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }

        return $result;
    }

    /**
     * Estado de cada tarea para la pantalla de administración.
     *
     * @return list<array<string,mixed>>
     */
    public function status(): array
    {
        $list = [];
        foreach ($this->tasks() as $key => $task) {
            $state = $this->taskState($key);
            $lastRun = $state['last_run'] ?? null;
            $list[] = [
                'key'              => $key,
                'label'            => $task->label(),
                'description'      => $task->description(),
                'interval_seconds' => $task->intervalSeconds(),
                'last_run'         => $lastRun,
                'next_run'         => $lastRun ? gmdate('c', (int) strtotime((string) $lastRun) + $task->intervalSeconds()) : null,
                'ok'               => $state['ok'] ?? null,
                'result'           => $state['result'] ?? null,
                'error'            => $state['error'] ?? null,
                'duration_ms'      => $state['duration_ms'] ?? null,
                'mode'             => $state['mode'] ?? null,
            ];
        }
        return $list;
    }

    /** Token secreto para el cron por HTTP (se crea la primera vez). */
    public function secret(): string
    {
        $secret = (string) $this->settings->get('cron_secret', '');
        if ($secret === '') {
            $secret = $this->regenerateSecret();
        }
        return $secret;
    }

    public function regenerateSecret(): string
    {
        $secret = bin2hex(random_bytes(16));
        $this->settings->set('cron_secret', $secret);
        return $secret;
    }

    public function isValidSecret(string $token): bool
    {
        $secret = (string) $this->settings->get('cron_secret', '');
        return $secret !== '' && $token !== '' && hash_equals($secret, $token);
    }

    /** @return array<string,mixed> */
    private function taskState(string $key): array
    {
        $raw = $this->settings->get(self::stateKey($key));
        $data = $raw !== null ? json_decode($raw, true) : null;
        return is_array($data) ? $data : [];
    }

    private static function stateKey(string $key): string
    {
        return 'cron_task:' . $key;
    }
}
