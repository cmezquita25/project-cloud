<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Cron;

use PDO;
use ProjectCloud\Core\Paths;
use ProjectCloud\Services\DatabaseManagerService;

/**
 * Higiene diaria del sistema: sesiones y enlaces de restablecimiento caducados,
 * temporales internos viejos y traslado de copias desde la ubicación antigua.
 */
final class SystemCleanupTask implements ScheduledTask
{
    private const TMP_MAX_AGE_SECONDS = 86400;

    public function __construct(private readonly PDO $pdo)
    {
    }

    public function key(): string
    {
        return 'system_cleanup';
    }

    public function label(): string
    {
        return 'Mantenimiento del sistema';
    }

    public function description(): string
    {
        return 'Borra sesiones y enlaces de restablecimiento caducados, limpia temporales internos y protege las copias de seguridad.';
    }

    public function intervalSeconds(): int
    {
        return 24 * 3600;
    }

    public function run(): array
    {
        $sessions = $this->pdo->exec('DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP()');
        $resets = $this->pdo->exec('DELETE FROM password_reset_tokens WHERE expires_at < UTC_TIMESTAMP()');

        $tmpCleaned = 0;
        $now = time();
        foreach (glob(Paths::var('tmp') . DIRECTORY_SEPARATOR . '*') ?: [] as $entry) {
            if (($now - (int) filemtime($entry)) <= self::TMP_MAX_AGE_SECONDS) {
                continue;
            }
            if (is_file($entry)) {
                @unlink($entry);
                $tmpCleaned++;
            } elseif (is_dir($entry)) {
                self::deleteTree($entry);
                $tmpCleaned++;
            }
        }

        // El constructor mueve las copias de storage/backups (pública) a
        // api/var/backups y bloquea la ruta antigua. Idempotente.
        new DatabaseManagerService();
        // Y que /storage/.private quede bloqueada para la web (instalaciones previas).
        (new \ProjectCloud\Services\PrivateFileStore())->ensureWebBlock();

        return [
            'sesiones_caducadas' => (int) $sessions,
            'enlaces_reset_caducados' => (int) $resets,
            'temporales_eliminados' => $tmpCleaned,
        ];
    }

    private static function deleteTree(string $dir): void
    {
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            is_dir($path) ? self::deleteTree($path) : @unlink($path);
        }
        @rmdir($dir);
    }
}
