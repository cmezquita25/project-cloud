<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Cron;

use ProjectCloud\Core\Config;

/** Borra fragmentos de subidas por chunks abandonadas hace más de 24 h. */
final class StaleUploadsTask implements ScheduledTask
{
    private const MAX_AGE_SECONDS = 86400;

    public function key(): string
    {
        return 'stale_uploads';
    }

    public function label(): string
    {
        return 'Limpieza de subidas incompletas';
    }

    public function description(): string
    {
        return 'Elimina fragmentos de subidas por partes que quedaron abandonadas hace más de 24 horas.';
    }

    public function intervalSeconds(): int
    {
        return 6 * 3600;
    }

    public function run(): array
    {
        $cleaned = 0;
        $uploadsDir = rtrim((string) Config::get('storage.path', ''), '/\\') . '/.uploads';

        if (is_dir($uploadsDir)) {
            $now = time();
            foreach (glob($uploadsDir . '/*/*') ?: [] as $file) {
                if (is_file($file) && ($now - (int) filemtime($file)) > self::MAX_AGE_SECONDS) {
                    @unlink($file);
                    $cleaned++;
                }
            }
            // Carpetas de sesión abandonadas que quedaron vacías (nunca una
            // reciente: puede ser una subida recién iniciada).
            foreach (glob($uploadsDir . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
                if (($now - (int) filemtime($dir)) > self::MAX_AGE_SECONDS) {
                    @rmdir($dir); // solo se borra si está vacía
                }
            }
        }

        return ['fragmentos_eliminados' => $cleaned];
    }
}
