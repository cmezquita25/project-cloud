<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Modo mantenimiento de la plataforma.
 *
 * La bandera es un archivo (`api/config/maintenance.json`), no una fila de BD,
 * porque durante una actualización o restauración la base de datos puede estar
 * a medio migrar. Mientras existe, la API responde 503 a todo salvo a unas
 * pocas rutas públicas. Los archivos de /storage los sirve Apache sin PHP, así
 * que las URLs públicas siguen funcionando durante el mantenimiento.
 *
 * Quien lo activa recibe un token de paso (bypass) que viaja en la cabecera
 * `X-Maintenance-Bypass`; solo se guarda su hash.
 *
 * Recuperación manual: borrar `api/config/maintenance.json` desde el
 * Administrador de archivos del hosting reactiva la plataforma.
 */
final class MaintenanceMode
{
    public const BYPASS_HEADER = 'X-Maintenance-Bypass';

    /** Rutas que responden aunque la plataforma esté en mantenimiento. */
    private const ALLOWED_PATHS = [
        '/health',
        '/v1/health',
        '/v1/system/status',
        '/v1/settings/public',
        '/v1/install/status',
    ];

    /** @var array<string,mixed>|null|false false = aún no leído en esta petición */
    private static array|null|false $cache = false;

    private static function file(): string
    {
        return Paths::apiRoot() . '/config/maintenance.json';
    }

    /** @return array<string,mixed>|null Estado completo, o null si no está activo. */
    public static function state(): ?array
    {
        if (self::$cache !== false) {
            return self::$cache;
        }

        $file = self::file();
        if (!is_file($file)) {
            return self::$cache = null;
        }

        $data = json_decode((string) @file_get_contents($file), true);
        if (!is_array($data)) {
            // Archivo corrupto: se trata como mantenimiento activo sin bypass
            // (más seguro que abrir la plataforma a medio actualizar).
            return self::$cache = ['reason' => 'unknown', 'started_at' => null];
        }

        $expires = $data['expires_at'] ?? null;
        if (is_string($expires) && $expires !== '' && strtotime($expires) !== false && strtotime($expires) < time()) {
            @unlink($file);
            return self::$cache = null;
        }

        return self::$cache = $data;
    }

    public static function isActive(): bool
    {
        return self::state() !== null;
    }

    /**
     * Activa el modo mantenimiento y devuelve el token de paso en claro
     * (solo se muestra esta vez).
     *
     * @param string   $reason      manual | update | restore
     * @param int|null $ttlSeconds  null = sin caducidad (hasta desactivarlo)
     */
    public static function enable(string $reason, int $byUserId, ?string $message = null, ?int $ttlSeconds = null): string
    {
        $token = bin2hex(random_bytes(32));
        $data = [
            'reason'      => $reason,
            'message'     => $message !== null && trim($message) !== '' ? mb_substr(trim($message), 0, 300) : null,
            'started_at'  => gmdate('c'),
            'expires_at'  => $ttlSeconds !== null && $ttlSeconds > 0 ? gmdate('c', time() + $ttlSeconds) : null,
            'by_user_id'  => $byUserId,
            'bypass_hash' => hash('sha256', $token),
        ];

        $file = self::file();
        $tmp = $file . '.tmp';
        if (@file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) === false
            || !@rename($tmp, $file)) {
            @unlink($tmp);
            throw new HttpException(500, 'MAINTENANCE_WRITE_FAILED', 'No se pudo activar el modo mantenimiento (sin permisos de escritura en api/config).');
        }

        self::$cache = $data;
        return $token;
    }

    public static function disable(): void
    {
        $file = self::file();
        if (is_file($file) && !@unlink($file)) {
            throw new HttpException(500, 'MAINTENANCE_WRITE_FAILED', 'No se pudo desactivar el modo mantenimiento.');
        }
        self::$cache = null;
    }

    public static function canBypass(Request $request): bool
    {
        $state = self::state();
        $hash = $state['bypass_hash'] ?? null;
        $provided = $request->header(self::BYPASS_HEADER);
        if (!is_string($hash) || $hash === '' || $provided === null || $provided === '') {
            return false;
        }
        return hash_equals($hash, hash('sha256', $provided));
    }

    public static function isAllowedPath(string $path): bool
    {
        return in_array($path, self::ALLOWED_PATHS, true) || str_starts_with($path, '/v1/settings/logo/');
    }

    /** Estado visible para cualquiera (sin datos sensibles). */
    public static function publicStatus(): array
    {
        $state = self::state();
        return [
            'active'     => $state !== null,
            'reason'     => $state['reason'] ?? null,
            'message'    => $state['message'] ?? null,
            'started_at' => $state['started_at'] ?? null,
            'expires_at' => $state['expires_at'] ?? null,
        ];
    }
}
