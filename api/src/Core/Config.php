<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Acceso a la configuración cargada desde config/config.php.
 * Soporta notación con puntos: Config::get('db.host').
 */
final class Config
{
    /** @var array<string,mixed> */
    private static array $data = [];

    private static bool $loaded = false;

    /** Carga el arreglo de configuración desde un archivo que hace `return [...]`. */
    public static function load(string $path): void
    {
        /** @var array<string,mixed> $data */
        $data = require $path;
        self::$data = $data;
        self::$loaded = true;
    }

    public static function isLoaded(): bool
    {
        return self::$loaded;
    }

    /** Devuelve un valor por clave con notación de puntos. */
    public static function get(string $key, mixed $default = null): mixed
    {
        $value = self::$data;
        foreach (explode('.', $key) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }
        return $value;
    }

    /** @return array<string,mixed> */
    public static function all(): array
    {
        return self::$data;
    }
}
