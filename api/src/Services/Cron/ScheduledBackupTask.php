<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Cron;

use ProjectCloud\Services\Backup\BackupRunner;

/**
 * Copias de seguridad programadas. Se revisa cada 10 minutos; la copia solo se
 * crea cuando toca según la frecuencia y la hora configuradas.
 */
final class ScheduledBackupTask implements ScheduledTask
{
    public function key(): string
    {
        return 'scheduled_backup';
    }

    public function label(): string
    {
        return 'Copias de seguridad programadas';
    }

    public function description(): string
    {
        return 'Crea la copia automática según la frecuencia elegida en Base de datos y borra las más antiguas.';
    }

    public function intervalSeconds(): int
    {
        return 600;
    }

    public function run(): array
    {
        $job = (new BackupRunner())->runScheduledIfDue();
        if ($job === null) {
            return ['copia' => 'aún no toca'];
        }
        if ($job['status'] !== 'completed') {
            throw new \RuntimeException($job['error'] ?? 'La copia programada falló');
        }
        return ['copia' => $job['filename'], 'eliminadas' => count($job['removed'])];
    }
}
