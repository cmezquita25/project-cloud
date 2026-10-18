<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Cron;

use ProjectCloud\Updater\UpdateChecker;

/** Consulta el servidor de versiones y avisa a los admins si hay una nueva. */
final class UpdateCheckTask implements ScheduledTask
{
    public function key(): string
    {
        return 'update_check';
    }

    public function label(): string
    {
        return 'Búsqueda de actualizaciones';
    }

    public function description(): string
    {
        return 'Consulta si hay una versión nueva de la plataforma y avisa a los administradores.';
    }

    public function intervalSeconds(): int
    {
        return UpdateChecker::CHECK_INTERVAL_SECONDS;
    }

    public function run(): array
    {
        $status = (new UpdateChecker())->check();
        if ($status['last_error'] !== null) {
            throw new \RuntimeException($status['last_error']);
        }
        return ['version_disponible' => $status['available']['version'] ?? 'ninguna'];
    }
}
