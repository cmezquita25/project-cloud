<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Cron;

use ProjectCloud\Repositories\ShareLinkRepository;
use ProjectCloud\Services\ShareLinks\LinkSettings;

/**
 * Borra el detalle de visitas de los enlaces compartidos con más de 90 días.
 * Los contadores (visitas, descargas, último acceso) de cada enlace se
 * conservan: solo se va el registro individual.
 */
final class LinkHitsCleanupTask implements ScheduledTask
{
    public function key(): string
    {
        return 'link_hits_cleanup';
    }

    public function label(): string
    {
        return 'Limpieza de visitas de enlaces';
    }

    public function description(): string
    {
        return 'Borra el detalle de visitas de los enlaces compartidos con más de ' . LinkSettings::HIT_RETENTION_DAYS . ' días (los contadores se conservan).';
    }

    public function intervalSeconds(): int
    {
        return 24 * 3600;
    }

    public function run(): array
    {
        return ['hits_deleted' => (new ShareLinkRepository())->pruneHits(LinkSettings::HIT_RETENTION_DAYS)];
    }
}
