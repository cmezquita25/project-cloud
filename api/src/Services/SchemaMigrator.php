<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;

/**
 * Ejecuta el esquema SQL de forma idempotente (CREATE TABLE IF NOT EXISTS).
 *
 * Es la única fuente de verdad para crear/actualizar tablas y la comparte el
 * instalador (Fase 2) y el endpoint admin "Aplicar migraciones" (para instancias
 * ya instaladas donde el instalador está bloqueado). Reutiliza el mismo parseo
 * que usaba el instalador: normaliza saltos, elimina comentarios "--" y divide
 * por ';'.
 */
final class SchemaMigrator
{
    private string $schemaPath;

    public function __construct(?string $schemaPath = null)
    {
        // api/src/Services -> api/database/schema.sql
        $this->schemaPath = $schemaPath ?? __DIR__ . '/../../database/schema.sql';
    }

    /**
     * Ejecuta todas las sentencias del esquema sobre el PDO dado (o el global).
     * Devuelve el número de sentencias ejecutadas.
     */
    public function run(?PDO $pdo = null): int
    {
        $pdo = $pdo ?? Database::pdo();

        $sql = @file_get_contents($this->schemaPath);
        if ($sql === false) {
            throw new HttpException(500, 'SCHEMA_MISSING', 'No se encontró el esquema de la base de datos.');
        }

        // Normaliza saltos de línea.
        $sql = str_replace(["\r\n", "\r"], "\n", $sql);
        // Elimina comentarios "--" (completos e inline) antes de dividir por ';',
        // porque un ';' dentro de un comentario cortaría la sentencia.
        $sql = preg_replace('/--[^\n]*/', '', $sql) ?? $sql;

        $count = 0;
        foreach (explode(';', $sql) as $statement) {
            $statement = trim($statement);
            if ($statement !== '') {
                $pdo->exec($statement);
                $count++;
            }
        }

        return $count;
    }
}
