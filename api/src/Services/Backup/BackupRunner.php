<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Backup;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Paths;
use ProjectCloud\Repositories\NotificationRepository;
use ProjectCloud\Services\DatabaseManagerService;

/**
 * Crea copias en segundo plano (manuales y programadas) y aplica la rotación.
 *
 * - Solo una copia a la vez (candado de archivo; si el proceso muere, se libera solo).
 * - El estado vive en api/var/backups/.job.json para que la pantalla muestre el avance.
 * - Rotación FIFO: la copia más antigua se borra DESPUÉS de que la nueva quedó
 *   bien. Mientras se crea hay, durante unos minutos, «máximo + 1» copias.
 * - Las copias pre-actualización tienen su propia cola de 1 y no cuentan aquí.
 */
final class BackupRunner
{
    /** Margen de espacio libre sobre el tamaño estimado. */
    private const DISK_MARGIN = 1.1;

    private BackupSettings $settings;
    private string $dir;

    /** @var resource|null */
    private $lock = null;

    public function __construct(?BackupSettings $settings = null)
    {
        $this->settings = $settings ?? new BackupSettings();
        $this->dir = Paths::var('backups');
    }

    private function jobPath(): string
    {
        return $this->dir . DIRECTORY_SEPARATOR . '.job.json';
    }

    /** @return array<string,mixed>|null */
    public function job(): ?array
    {
        $job = json_decode((string) @file_get_contents($this->jobPath()), true);
        if (!is_array($job)) {
            return null;
        }
        // Un trabajo «en curso» sin candado es uno que murió (timeout del hosting, reinicio…).
        if ($job['status'] === 'running' && !$this->isLocked()) {
            $job['status'] = 'failed';
            $job['error'] = 'La copia se interrumpió (el servidor cortó el proceso). Vuelve a intentarlo; si se repite, configura el cron como script PHP.';
        }
        return $job;
    }

    /** @param array<string,mixed> $job */
    private function save(array $job): void
    {
        $job['updated_at'] = gmdate('c');
        @file_put_contents($this->jobPath(), (string) json_encode($job, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    }

    private function isLocked(): bool
    {
        $handle = @fopen($this->dir . DIRECTORY_SEPARATOR . '.lock', 'c');
        if ($handle === false) {
            return false;
        }
        $free = flock($handle, LOCK_EX | LOCK_NB);
        if ($free) {
            flock($handle, LOCK_UN);
        }
        fclose($handle);
        return !$free;
    }

    /**
     * Toma el candado y deja el trabajo listo. Lanza 409 si ya hay una copia en curso
     * y 507 si no hay espacio suficiente.
     *
     * @return array<string,mixed>
     */
    public function prepare(string $trigger, ?int $userId): array
    {
        $handle = fopen($this->dir . DIRECTORY_SEPARATOR . '.lock', 'c');
        if ($handle === false || !flock($handle, LOCK_EX | LOCK_NB)) {
            throw new HttpException(409, 'BACKUP_RUNNING', 'Ya se está creando una copia de seguridad.');
        }
        $this->lock = $handle;

        $config = $this->settings->get();
        $estimate = $this->settings->estimate($config);
        $free = @disk_free_space($this->dir);
        if ($free !== false && $free < $estimate['total'] * self::DISK_MARGIN) {
            $this->release();
            throw new HttpException(507, 'BACKUP_NO_SPACE', sprintf(
                'No hay espacio suficiente: la copia ocupará ~%s y quedan %s libres. Reduce el contenido de la copia o el número de copias a conservar.',
                self::human((int) ($estimate['total'] * self::DISK_MARGIN)),
                self::human((int) $free)
            ));
        }

        $job = [
            'id'          => bin2hex(random_bytes(6)),
            'status'      => 'running',
            'trigger'     => $trigger,      // manual | scheduled
            'scope'       => $config['scope'],
            'by_user_id'  => $userId,
            'started_at'  => gmdate('c'),
            'finished_at' => null,
            'phase'       => 'database',
            'files'       => 0,
            'bytes'       => 0,
            'estimate'    => $estimate['total'],
            'filename'    => null,
            'removed'     => [],
            'error'       => null,
        ];
        $this->save($job);
        return $job;
    }

    /**
     * Crea la copia (requiere prepare()). Pensado para correr tras responder
     * al navegador o desde el cron, sin límite de tiempo.
     *
     * @return array<string,mixed>
     */
    public function execute(): array
    {
        if ($this->lock === null) {
            throw new \LogicException('BackupRunner::execute() requiere prepare().');
        }
        @set_time_limit(0);
        ignore_user_abort(true);

        $job = json_decode((string) file_get_contents($this->jobPath()), true);
        $config = $this->settings->get();
        $service = new DatabaseManagerService();

        try {
            $job['phase'] = 'files';
            $this->save($job);
            $last = 0;
            $filename = $service->createBackup($config['scope'], null, $config['content'], function (int $files, int $bytes) use (&$job, &$last): void {
                $job['files'] = $files;
                $job['bytes'] = $bytes;
                $job['phase'] = 'files';
                if (time() - $last >= 2) { // no escribir el estado en cada archivo
                    $this->save($job);
                    $last = time();
                }
            });

            $job['filename'] = $filename;
            $job['phase'] = 'rotation';
            $job['removed'] = $this->rotate($service, (int) $config['max_copies'], $filename);
            $job['status'] = 'completed';
            $job['phase'] = 'done';
        } catch (\Throwable $e) {
            $job['status'] = 'failed';
            $job['error'] = $e->getMessage();
            error_log('[ProjectCloud][backup] ' . $e->getMessage());
            if ($job['trigger'] === 'scheduled') {
                $this->notifyAdmins('La copia de seguridad programada falló', $e->getMessage());
            }
        } finally {
            $job['finished_at'] = gmdate('c');
            $this->save($job);
            $this->release();
        }

        return $job;
    }

    /**
     * Borra las copias más antiguas (manuales y programadas) hasta dejar $max.
     * Nunca toca la recién creada ni las pre-actualización.
     *
     * @return list<string> Copias eliminadas
     */
    public function rotate(DatabaseManagerService $service, int $max, ?string $keep = null): array
    {
        $regular = array_values(array_filter(
            $service->listBackups(),
            static fn(array $b): bool => $b['kind'] !== 'pre-update'
        ));
        // listBackups() ya viene de la más reciente a la más antigua.
        if ($keep !== null) {
            usort($regular, static fn(array $a, array $b): int => ($b['filename'] === $keep) <=> ($a['filename'] === $keep));
        }
        $removed = [];
        foreach (array_slice($regular, max(1, $max)) as $old) {
            $service->deleteBackup($old['filename']);
            $removed[] = $old['filename'];
        }
        return $removed;
    }

    /** Ejecuta la copia programada si ya toca (lo llama el cron). */
    public function runScheduledIfDue(): ?array
    {
        if (!$this->settings->isDue()) {
            return null;
        }
        // Se marca antes de empezar: si la copia falla, no se reintenta en bucle cada pasada.
        $this->settings->markScheduledRun(time());
        try {
            $this->prepare('scheduled', null);
        } catch (HttpException $e) {
            // Sin espacio u otra copia en curso: se avisa y se espera al siguiente turno.
            $this->notifyAdmins('La copia de seguridad programada no se pudo crear', $e->getMessage());
            throw $e;
        }
        return $this->execute();
    }

    private function release(): void
    {
        if ($this->lock !== null) {
            flock($this->lock, LOCK_UN);
            fclose($this->lock);
            $this->lock = null;
        }
    }

    private function notifyAdmins(string $title, string $message): void
    {
        try {
            $pdo = Database::pdo();
            $repo = new NotificationRepository($pdo);
            foreach ($pdo->query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN) as $id) {
                $repo->create((int) $id, null, 'system.backup_failed', $title, mb_substr($message, 0, 400), '/admin/settings/database');
            }
        } catch (\Throwable) {
        }
    }

    private static function human(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = $bytes > 0 ? min((int) floor(log($bytes, 1024)), 4) : 0;
        return round($bytes / (1024 ** $i), 1) . ' ' . $units[$i];
    }
}
