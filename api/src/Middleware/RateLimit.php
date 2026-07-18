<?php

declare(strict_types=1);

namespace ProjectCloud\Middleware;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Middleware;
use ProjectCloud\Core\Request;

/**
 * Limitador de tasa por IP con ventana deslizante, persistido en archivos
 * (no requiere BD). Pensado para endpoints sensibles (login, refresh).
 *
 * Ejemplo: new RateLimit('login', maxAttempts: 5, windowSeconds: 300)
 */
final class RateLimit implements Middleware
{
    public function __construct(
        private readonly string $bucket,
        private readonly int $maxAttempts = 60,
        private readonly int $windowSeconds = 60,
    ) {
    }

    public function handle(Request $request): void
    {
        $key = $this->bucket . '_' . preg_replace('/[^a-zA-Z0-9]/', '_', $request->ip());
        $file = $this->storageFile($key);
        $now = time();

        $timestamps = $this->read($file);
        // Conserva solo los intentos dentro de la ventana.
        $timestamps = array_values(array_filter(
            $timestamps,
            static fn (int $ts): bool => $ts > $now - $this->windowSeconds
        ));

        if (count($timestamps) >= $this->maxAttempts) {
            $retryAfter = $this->windowSeconds - ($now - (int) $timestamps[0]);
            throw new HttpException(
                429,
                'RATE_LIMITED',
                "Demasiados intentos. Intenta de nuevo en {$retryAfter}s.",
                ['retry_after' => max(1, $retryAfter)]
            );
        }

        $timestamps[] = $now;
        $this->write($file, $timestamps);
    }

    private function storageFile(string $key): string
    {
        $dir = rtrim((string) Config::get('storage.path', sys_get_temp_dir()), '/\\') . '/.ratelimit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0770, true);
        }
        return $dir . '/' . hash('sha256', $key) . '.json';
    }

    /** @return list<int> */
    private function read(string $file): array
    {
        if (!is_file($file)) {
            return [];
        }
        $data = json_decode((string) file_get_contents($file), true);
        return is_array($data) ? array_map('intval', $data) : [];
    }

    /** @param list<int> $timestamps */
    private function write(string $file, array $timestamps): void
    {
        file_put_contents($file, json_encode($timestamps), LOCK_EX);
    }
}
