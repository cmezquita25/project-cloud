<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\Database;
use ProjectCloud\Repositories\SettingsRepository;
use RuntimeException;

/**
 * Migraciones versionadas de la base de datos.
 *
 * Cada archivo `api/database/migrations/NNNN_descripcion.php` devuelve una
 * función `function (PDO $pdo): void` y lleva al esquema a la versión NNNN.
 * Se aplican en orden las que superan `settings.schema_version`.
 *
 * Reglas (para que revertir el código sin restaurar la BD sea seguro):
 *   - Solo AÑADIR: tablas, columnas con default, índices. Nada de borrar o renombrar.
 *   - Idempotentes: comprobar si el cambio ya existe antes de aplicarlo.
 *   - Si una versión necesita algo destructivo, se marca en sus notas de
 *     release con "migrations": { "reversible": false }.
 */
final class MigrationRunner
{
    private PDO $pdo;
    private SettingsRepository $settings;
    private string $dir;

    public function __construct(?PDO $pdo = null, ?string $dir = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
        $this->settings = new SettingsRepository($this->pdo);
        $this->dir = $dir ?? dirname(__DIR__, 2) . '/database/migrations';
    }

    /**
     * Aplica el esquema base (idempotente) y las migraciones pendientes.
     *
     * @return array{from:int, to:int, applied:list<string>}
     */
    public function run(): array
    {
        (new SchemaMigrator())->run($this->pdo);

        $from = $this->settings->getInt('schema_version', 0);
        $current = $from;
        $applied = [];

        foreach ($this->pending($from) as $number => $file) {
            $migration = require $file;
            if (!is_callable($migration)) {
                throw new RuntimeException('La migración ' . basename($file) . ' no devuelve una función.');
            }
            $migration($this->pdo);
            $current = $number;
            $this->settings->set('schema_version', (string) $current);
            $applied[] = basename($file);
        }

        // El esquema base puede ir por delante de las migraciones (instalaciones nuevas).
        $target = max($current, AppVersion::info()['schema']);
        if ($target !== $current) {
            $this->settings->set('schema_version', (string) $target);
        }

        return ['from' => $from, 'to' => $target, 'applied' => $applied];
    }

    /** @return array<int,string> número => ruta, en orden */
    private function pending(int $from): array
    {
        $files = [];
        foreach (glob($this->dir . '/*.php') ?: [] as $file) {
            if (preg_match('/^(\d{4})_[a-z0-9_]+\.php$/', basename($file), $m) === 1 && (int) $m[1] > $from) {
                $files[(int) $m[1]] = $file;
            }
        }
        ksort($files);
        return $files;
    }
}
