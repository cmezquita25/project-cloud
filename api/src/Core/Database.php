<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

use PDO;
use PDOException;

/**
 * Conexión PDO única (singleton) a MariaDB/MySQL.
 * Todas las consultas del proyecto usan prepared statements a través de esta clase.
 */
final class Database
{
    private static ?PDO $pdo = null;

    /** Devuelve la conexión PDO compartida (la crea en el primer uso). */
    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            /** @var array<string,mixed> $db */
            $db = Config::get('db', []);
            self::$pdo = self::connect(
                (string) ($db['host'] ?? 'localhost'),
                (int) ($db['port'] ?? 3306),
                (string) ($db['name'] ?? ''),
                (string) ($db['user'] ?? ''),
                (string) ($db['pass'] ?? ''),
                (string) ($db['charset'] ?? 'utf8mb4'),
            );
        }
        return self::$pdo;
    }

    /**
     * Crea una conexión PDO con credenciales explícitas.
     * Lo usa el instalador (Fase 2) para probar credenciales antes de guardarlas.
     */
    public static function connect(
        string $host,
        int $port,
        string $name,
        string $user,
        string $pass,
        string $charset = 'utf8mb4',
    ): PDO {
        $dsn = sprintf('mysql:host=%s;port=%d;charset=%s', $host, $port, $charset);
        if ($name !== '') {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);
        }

        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false, // prepared statements reales
            PDO::ATTR_STRINGIFY_FETCHES  => false,
            PDO::ATTR_TIMEOUT            => 5,     // evita que /health se cuelgue si la BD no responde
        ]);
    }

    /** Comprueba la conectividad sin lanzar excepción (para /health). */
    public static function isReachable(): bool
    {
        // Atrapamos \Throwable (no solo PDOException): si falta la extensión
        // pdo_mysql, `new PDO` lanza un Error "class PDO not found".
        try {
            self::pdo()->query('SELECT 1');
            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    /** Reinicia la conexión (útil en tests). */
    public static function reset(): void
    {
        self::$pdo = null;
    }
}
