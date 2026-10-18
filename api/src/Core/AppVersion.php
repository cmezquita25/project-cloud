<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Versión de la plataforma instalada, leída de `api/version.php` (generado
 * desde `version.json` por scripts/sync-version.mjs). El backend y el frontend
 * comparten así la misma fuente de verdad.
 */
final class AppVersion
{
    /** @var array{version:string,schema:int,released_at:?string}|null */
    private static ?array $info = null;

    /** @return array{version:string,schema:int,released_at:?string} */
    public static function info(): array
    {
        if (self::$info === null) {
            $file = Paths::apiRoot() . '/version.php';
            $data = is_file($file) ? require $file : [];
            $data = is_array($data) ? $data : [];
            self::$info = [
                'version'     => (string) ($data['version'] ?? '0.0.0'),
                'schema'      => (int) ($data['schema'] ?? 0),
                'released_at' => isset($data['released_at']) ? (string) $data['released_at'] : null,
            ];
        }
        return self::$info;
    }

    public static function current(): string
    {
        return self::info()['version'];
    }
}
