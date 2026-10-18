<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Backup;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\MaintenanceMode;
use ProjectCloud\Core\Paths;
use ProjectCloud\Services\DatabaseManagerService;
use ProjectCloud\Services\MigrationRunner;
use ProjectCloud\Services\SessionRevoker;
use ProjectCloud\Updater\FileOps;
use ZipArchive;

/**
 * Restaura una copia con el mismo proceso que una actualización:
 * diagnóstico → mantenimiento y cierre de sesiones → copia de seguridad del
 * estado actual → base de datos → migraciones → archivos → cuarentena de
 * huérfanos → cierre de sesiones de nuevo → fin del mantenimiento.
 *
 * - Lee la copia directamente del ZIP (sin extraerla a una carpeta temporal).
 * - Si falla la base de datos, se vuelve a cargar la copia del estado actual.
 * - La configuración del servidor (config.php) se conserva salvo que se pida.
 * - El avance se consulta con un token propio: tras restaurar la base de datos
 *   la sesión del admin deja de valer (los usuarios y sesiones son los de la copia).
 */
final class RestoreRunner
{
    private const PHASES = [
        'safety_copy' => [0, 15, 'Copia de seguridad del estado actual'],
        'database'    => [15, 45, 'Restaurando la base de datos'],
        'migrate'     => [45, 50, 'Actualizando la estructura de la base de datos'],
        'files'       => [50, 92, 'Restaurando archivos'],
        'quarantine'  => [92, 97, 'Apartando archivos posteriores a la copia'],
        'finalize'    => [97, 100, 'Finalizando'],
    ];

    private string $dir;
    /** @var resource|null */
    private $lock = null;

    public function __construct()
    {
        $this->dir = Paths::var('restore');
    }

    private function statePath(): string
    {
        return $this->dir . DIRECTORY_SEPARATOR . 'state.json';
    }

    /** @return array<string,mixed>|null */
    private function load(): ?array
    {
        $job = json_decode((string) @file_get_contents($this->statePath()), true);
        return is_array($job) ? $job : null;
    }

    /** @param array<string,mixed> $job */
    private function save(array $job): void
    {
        $job['updated_at'] = gmdate('c');
        FileOps::atomicWrite($this->statePath(), (string) json_encode($job, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /** Estado para la pantalla de progreso (solo con el token del trabajo). */
    public function progress(string $token): ?array
    {
        $job = $this->load();
        if ($job === null || $token === '' || !hash_equals((string) $job['token_hash'], hash('sha256', $token))) {
            return null;
        }
        if ($job['status'] === 'running' && !$this->isLocked()) {
            $job['status'] = 'failed';
            $job['error'] = 'La restauración se interrumpió (el servidor cortó el proceso).';
        }
        return self::publicView($job);
    }

    /**
     * Comprueba la copia, activa el mantenimiento y deja el trabajo listo.
     *
     * @param array{restore_config?:bool, quarantine?:bool, safety_copy?:bool} $options
     * @return array{job:array<string,mixed>, bypass:string, token:string}
     */
    public function prepare(string $filename, array $options, int $userId): array
    {
        $handle = fopen($this->dir . DIRECTORY_SEPARATOR . '.lock', 'c');
        if ($handle === false || !flock($handle, LOCK_EX | LOCK_NB)) {
            throw new HttpException(409, 'RESTORE_RUNNING', 'Ya hay una restauración en curso.');
        }
        $this->lock = $handle;

        $analysis = (new RestoreAnalyzer())->analyze($filename);
        if ($analysis['status'] === 'blocked') {
            $this->release();
            throw new HttpException(422, 'RESTORE_BLOCKED', 'El diagnóstico encontró problemas que impiden restaurar esta copia.', $analysis['checks']);
        }

        $token = bin2hex(random_bytes(24));
        $job = [
            'id'          => bin2hex(random_bytes(6)),
            'status'      => 'running',
            'phase'       => 'safety_copy',
            'progress'    => 0,
            'filename'    => basename($filename),
            'options'     => [
                'restore_config' => !empty($options['restore_config']),
                'quarantine'     => !array_key_exists('quarantine', $options) || !empty($options['quarantine']),
                'safety_copy'    => !array_key_exists('safety_copy', $options) || !empty($options['safety_copy']),
            ],
            'by_user_id'  => $userId,
            'started_at'  => gmdate('c'),
            'finished_at' => null,
            'prev_epoch'  => SessionRevoker::currentEpoch(),
            'token_hash'  => hash('sha256', $token),
            'safety_file' => null,
            'statements'  => 0,
            'files'       => 0,
            'files_total' => 0,
            'quarantined' => 0,
            'quarantine_dir' => null,
            'log'         => [],
            'error'       => null,
        ];
        $this->save($job);

        $bypass = MaintenanceMode::enable('restore', $userId, 'Estamos restaurando la plataforma desde una copia de seguridad.', null);
        (new SessionRevoker())->revokeAll();

        return ['job' => self::publicView($job), 'bypass' => $bypass, 'token' => $token];
    }

    /** Ejecuta la restauración (requiere prepare()). @return array<string,mixed> */
    public function execute(): array
    {
        if ($this->lock === null) {
            throw new \LogicException('RestoreRunner::execute() requiere prepare().');
        }
        @set_time_limit(0);
        ignore_user_abort(true);

        $job = $this->load();
        $service = new DatabaseManagerService();
        $zipPath = $service->getBackupPath($job['filename']);
        $zip = new ZipArchive();

        try {
            if ($zip->open($zipPath) !== true) {
                throw new \RuntimeException('No se pudo abrir la copia.');
            }

            // 1. Copia del estado actual (sistema) para poder volver atrás.
            $this->phase($job, 'safety_copy');
            if ($job['options']['safety_copy']) {
                $job['safety_file'] = $service->createBackup('system', 'pre-restore');
                $service->pruneLabeled('pre-restore', 1, $job['safety_file']);
                self::log($job, "Copia del estado actual: {$job['safety_file']}");
            }

            // Huérfanos: se calculan con la BD ACTUAL, antes de sustituirla.
            $manifest = json_decode((string) $zip->getFromName('backup.json'), true);
            $createdAt = is_array($manifest) && isset($manifest['created_at']) ? $manifest['created_at'] : gmdate('c', (int) filemtime($zipPath));
            $analyzer = new RestoreAnalyzer();
            $orphans = $job['options']['quarantine']
                ? $analyzer->orphans(
                    $zip,
                    $analyzer->toDbTime((int) strtotime($createdAt)),
                    is_array($manifest) && is_string($manifest['shared_unit_folder'] ?? null) ? $manifest['shared_unit_folder'] : null
                )['list']
                : [];

            // 2. Base de datos (en streaming desde el ZIP).
            $this->phase($job, 'database');
            $stream = $zip->getStream('database_dump.sql');
            if ($stream === false) {
                throw new \RuntimeException('La copia no contiene el volcado de la base de datos.');
            }
            try {
                $job['statements'] = $service->runDump($stream);
            } finally {
                fclose($stream);
            }
            self::log($job, "Base de datos restaurada ({$job['statements']} sentencias).");

            // 3. Migraciones: lleva una copia antigua al schema actual.
            $this->phase($job, 'migrate');
            $migration = (new MigrationRunner())->run();
            self::log($job, "Estructura al día (schema {$migration['to']}).");

            // 4. Archivos.
            $this->phase($job, 'files');
            $this->restoreFiles($zip, $job);

            // 5. Cuarentena.
            $this->phase($job, 'quarantine');
            if ($orphans !== []) {
                $this->quarantine($orphans, $job);
            }

            // 6. Final: las sesiones restauradas (las de la copia) tampoco valen.
            $this->phase($job, 'finalize');
            (new SessionRevoker())->revokeAll((int) $job['prev_epoch']);
            $job['status'] = 'completed';
            $job['progress'] = 100;
            self::log($job, 'Restauración completada. Todos los usuarios deben iniciar sesión de nuevo.');
            MaintenanceMode::disable();
        } catch (\Throwable $e) {
            $job['error'] = $e->getMessage();
            self::log($job, 'Error: ' . $e->getMessage(), 'error');
            error_log('[ProjectCloud][restore] ' . $e->getMessage());
            $this->handleFailure($job, $service);
        } finally {
            $zip->close();
            $job['finished_at'] = gmdate('c');
            $this->save($job);
            $this->release();
        }

        return self::publicView($job);
    }

    /** @param array<string,mixed> $job */
    private function handleFailure(array &$job, DatabaseManagerService $service): void
    {
        // Una migración fallida deja la BD de la copia con un esquema que el código
        // actual no entiende: se trata igual que un fallo de la base de datos.
        $failedInDatabase = in_array($job['phase'], ['database', 'migrate'], true);

        if ($job['phase'] === 'safety_copy') {
            // No se tocó nada.
            $job['status'] = 'failed';
            MaintenanceMode::disable();
            return;
        }

        if ($failedInDatabase && $job['safety_file'] !== null) {
            try {
                $safety = new ZipArchive();
                if ($safety->open($service->getBackupPath($job['safety_file'])) === true) {
                    $stream = $safety->getStream('database_dump.sql');
                    $service->runDump($stream);
                    fclose($stream);
                    $safety->close();
                    (new SessionRevoker())->revokeAll((int) $job['prev_epoch']);
                    $job['status'] = 'rolled_back';
                    self::log($job, 'Se volvió a cargar la base de datos que había antes de restaurar. La plataforma queda como estaba.', 'warning');
                    MaintenanceMode::disable();
                    return;
                }
            } catch (\Throwable $rollback) {
                $job['error'] .= ' — Tampoco se pudo volver al estado anterior: ' . $rollback->getMessage();
            }
        }

        if ($failedInDatabase) {
            // La base de datos puede estar a medias: mejor un aviso que un sitio roto.
            $job['status'] = 'error';
            self::log($job, 'La base de datos puede haber quedado incompleta. El modo mantenimiento sigue activo: restaura la copia «pre-restore» o la misma copia de nuevo.', 'error');
            return;
        }

        // Falló con la base de datos ya restaurada (archivos o cuarentena): la plataforma funciona.
        $job['status'] = 'failed';
        (new SessionRevoker())->revokeAll((int) $job['prev_epoch']);
        MaintenanceMode::disable();
    }

    /** @param array<string,mixed> $job */
    private function restoreFiles(ZipArchive $zip, array &$job): void
    {
        $storage = rtrim((string) Config::get('storage.path', ''), '/\\');
        $siteRoot = dirname($storage);
        $apiConfig = Paths::apiRoot() . DIRECTORY_SEPARATOR . 'config';

        $manifest = json_decode((string) $zip->getFromName('backup.json'), true);
        $sharedFolder = is_array($manifest) && is_string($manifest['shared_unit_folder'] ?? null) ? $manifest['shared_unit_folder'] : null;

        $targets = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);
            if ($name === 'database_dump.sql' || $name === 'backup.json' || str_ends_with($name, '/')) {
                continue;
            }
            if (!RestoreAnalyzer::isSafeEntry($name, $sharedFolder)) {
                throw new \RuntimeException("Ruta no permitida en la copia: {$name}");
            }
            if (str_starts_with($name, 'config/')) {
                if ($job['options']['restore_config']) {
                    $targets[$i] = $apiConfig . DIRECTORY_SEPARATOR . substr($name, 7);
                }
                continue;
            }
            $targets[$i] = str_starts_with($name, 'storage/')
                ? $storage . DIRECTORY_SEPARATOR . substr($name, 8)
                : $siteRoot . DIRECTORY_SEPARATOR . $name; // unidad compartida y avatares
        }

        $job['files_total'] = count($targets);
        [$from, $to] = [self::PHASES['files'][0], self::PHASES['files'][1]];
        $lastSave = time();

        foreach ($targets as $index => $target) {
            $stream = $zip->getStream((string) $zip->getNameIndex($index));
            if ($stream === false) {
                throw new \RuntimeException('No se pudo leer ' . $zip->getNameIndex($index));
            }
            FileOps::ensureDir(dirname($target));
            $tmp = $target . '.pc-restore';
            $out = fopen($tmp, 'wb');
            if ($out === false) {
                fclose($stream);
                throw new \RuntimeException("No se pudo escribir {$target}");
            }
            stream_copy_to_stream($stream, $out);
            fclose($out);
            fclose($stream);
            if (!@rename($tmp, $target)) {
                @unlink($tmp);
                throw new \RuntimeException("No se pudo reemplazar {$target}");
            }

            $job['files']++;
            if (time() - $lastSave >= 2) {
                $job['progress'] = $from + (int) floor(($to - $from) * $job['files'] / max(1, $job['files_total']));
                $this->save($job);
                $lastSave = time();
            }
        }
        self::log($job, "Archivos restaurados: {$job['files']}." . ($job['options']['restore_config'] ? ' Incluye la configuración del servidor.' : ''));
    }

    /**
     * @param list<array{abs:string, rel:string}> $orphans
     * @param array<string,mixed> $job
     */
    private function quarantine(array $orphans, array &$job): void
    {
        $dir = Paths::var('restore-orphans') . DIRECTORY_SEPARATOR . gmdate('Y-m-d_H-i-s');
        foreach ($orphans as $o) {
            if (!is_file($o['abs'])) {
                continue;
            }
            $dest = $dir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $o['rel']);
            FileOps::ensureDir(dirname($dest));
            if (@rename($o['abs'], $dest)) {
                $job['quarantined']++;
            }
        }
        $job['quarantine_dir'] = 'api/var/restore-orphans/' . basename($dir);
        self::log($job, "{$job['quarantined']} archivos posteriores a la copia apartados en {$job['quarantine_dir']}.");
    }

    /** @param array<string,mixed> $job */
    private function phase(array &$job, string $phase): void
    {
        $job['phase'] = $phase;
        $job['progress'] = self::PHASES[$phase][0];
        $this->save($job);
    }

    /** @param array<string,mixed> $job */
    private static function log(array &$job, string $message, string $level = 'info'): void
    {
        $job['log'][] = ['at' => gmdate('c'), 'level' => $level, 'message' => $message];
    }

    /** @param array<string,mixed> $job */
    private static function publicView(array $job): array
    {
        $phases = [];
        foreach (self::PHASES as $key => [, , $label]) {
            $phases[] = ['key' => $key, 'label' => $label];
        }
        unset($job['token_hash'], $job['prev_epoch']);
        return $job + ['phases' => $phases];
    }

    private function isLocked(): bool
    {
        $handle = @fopen($this->dir . DIRECTORY_SEPARATOR . '.lock', 'c');
        if ($handle === false) {
            return false;
        }
        $free = flock($handle, LOCK_EX | LOCK_NB);
        if ($free) {
            flock($handle, LOCK_UN);
        }
        fclose($handle);
        return !$free;
    }

    private function release(): void
    {
        if ($this->lock !== null) {
            flock($this->lock, LOCK_UN);
            fclose($this->lock);
            $this->lock = null;
        }
    }
}
