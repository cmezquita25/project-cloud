<?php

declare(strict_types=1);

namespace ProjectCloud\Updater;

use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\MaintenanceMode;
use ProjectCloud\Core\Paths;
use ProjectCloud\Repositories\NotificationRepository;
use ProjectCloud\Services\DatabaseManagerService;
use ProjectCloud\Services\MigrationRunner;
use ProjectCloud\Services\SessionRevoker;
use RuntimeException;
use ZipArchive;

/**
 * Aplica una actualización por pasos cortos (una petición por paso), para no
 * chocar con los límites de tiempo del hosting. El estado vive en
 * api/var/update/state.json: si el navegador se cierra, se retoma donde quedó.
 *
 * Orden pensado para que la plataforma esté caída el menor tiempo posible:
 *   preflight → download → verify → extract      (sitio funcionando)
 *   maintenance → backup → install → migrate → post_check → finalize
 *
 * Seguridad ante fallos:
 *   - Antes de `install` nada del sitio cambió: un error solo cancela.
 *   - `install` guarda primero en old-files/ cada archivo que va a cambiar y
 *     luego reemplaza. Un error desde ahí revierte los archivos solo.
 *   - Los archivos obsoletos se borran en `finalize`, cuando todo se comprobó.
 *
 * Contrato entre versiones: los pasos posteriores a `install` los ejecuta el
 * código NUEVO, que debe entender el state.json (state_version) y el
 * old-files/meta.json que escribió el código anterior.
 */
final class UpdateRunner
{
    public const STATE_VERSION = 1;
    public const HTACCESS_BEGIN = '# BEGIN Project Cloud';
    public const HTACCESS_END = '# END Project Cloud';

    /** paso => [inicio %, fin %, etiqueta] */
    public const STEPS = [
        'preflight'   => [0, 4, 'Comprobando requisitos'],
        'download'    => [4, 40, 'Descargando la actualización'],
        'verify'      => [40, 46, 'Verificando firma e integridad'],
        'extract'     => [46, 54, 'Preparando los archivos'],
        'maintenance' => [54, 56, 'Activando el modo mantenimiento'],
        'backup'      => [56, 68, 'Creando copia del sistema'],
        'install'     => [68, 84, 'Instalando los archivos nuevos'],
        'migrate'     => [84, 92, 'Actualizando la base de datos'],
        'post_check'  => [92, 97, 'Comprobando la instalación'],
        'finalize'    => [97, 100, 'Finalizando'],
    ];

    /** Archivos de api/ que el paquete jamás puede tocar. */
    private const PROTECTED = ['#^api/config/(config\.php|install\.lock|maintenance\.json)$#', '#^api/var/#'];

    private const DOWNLOAD_CHUNK = 16 * 1024 * 1024;
    private const STEP_BUDGET_SECONDS = 20;
    private const HISTORY_LIMIT = 20;

    private string $apiRoot;
    private string $docRoot;
    private string $dir;

    public function __construct()
    {
        $this->apiRoot = Paths::apiRoot();
        $this->docRoot = dirname($this->apiRoot);
        $this->dir = Paths::var('update');
    }

    // ── Rutas ────────────────────────────────────────────────────────────────

    private function statePath(): string { return $this->dir . '/state.json'; }
    private function packagePath(): string { return $this->dir . '/package.zip'; }
    private function stagingDir(): string { return $this->dir . '/staging'; }
    private function newReleasePath(): string { return $this->dir . '/new-release.json'; }
    private function historyPath(): string { return $this->dir . '/history.json'; }
    public function oldFilesDir(): string { return $this->apiRoot . '/var/old-files'; }
    private function installedReleasePath(): string { return $this->apiRoot . '/var/release.json'; }

    /** Ruta real de un archivo del paquete ("public/x" → raíz del sitio, "api/x" → api/). */
    private function target(string $name): string
    {
        if (str_starts_with($name, 'public/')) {
            return $this->docRoot . '/' . substr($name, 7);
        }
        if (str_starts_with($name, 'api/')) {
            return $this->apiRoot . '/' . substr($name, 4);
        }
        throw new RuntimeException("Ruta de paquete no válida: {$name}");
    }

    // ── Estado ───────────────────────────────────────────────────────────────

    /** @return array<string,mixed>|null */
    public function job(): ?array
    {
        $raw = @file_get_contents($this->statePath());
        $job = $raw !== false ? json_decode($raw, true) : null;
        return is_array($job) ? $job : null;
    }

    public function isRunning(): bool
    {
        return ($this->job()['status'] ?? null) === 'running';
    }

    /** @param array<string,mixed> $job */
    private function save(array $job): void
    {
        $job['updated_at'] = gmdate('c');
        FileOps::atomicWrite($this->statePath(), (string) json_encode($job, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /** @param array<string,mixed> $job */
    private static function log(array &$job, string $message, string $level = 'info'): void
    {
        $job['log'][] = ['at' => gmdate('c'), 'level' => $level, 'message' => $message];
        $job['log'] = array_slice($job['log'], -80);
    }

    /** @return array<string,mixed>|null Vista del estado para la UI. */
    public function publicJob(?array $job = null): ?array
    {
        $job ??= $this->job();
        if ($job === null) {
            return null;
        }
        $steps = [];
        foreach (self::STEPS as $key => [, , $label]) {
            $steps[] = ['key' => $key, 'label' => $label];
        }
        return [
            'id'           => $job['id'],
            'status'       => $job['status'],
            'step'         => $job['step'],
            'progress'     => $job['progress'],
            'from_version' => $job['from_version'],
            'to_version'   => $job['to_version'],
            'started_at'   => $job['started_at'],
            'updated_at'   => $job['updated_at'] ?? null,
            'finished_at'  => $job['finished_at'] ?? null,
            'error'        => $job['error'] ?? null,
            'warnings'     => $job['warnings'] ?? [],
            'log'          => $job['log'] ?? [],
            'cancellable'  => $job['status'] === 'running' && $this->stepIndex($job['step']) < $this->stepIndex('maintenance'),
            'steps'        => $steps,
        ];
    }

    private function stepIndex(string $step): int
    {
        $index = array_search($step, array_keys(self::STEPS), true);
        return $index === false ? -1 : (int) $index;
    }

    // ── Inicio ───────────────────────────────────────────────────────────────

    /**
     * Crea el trabajo de actualización (todavía no toca nada).
     *
     * @param array<string,mixed> $manifest Manifiesto ya verificado (UpdateChecker::fetchManifest()).
     * @return array<string,mixed>
     */
    public function start(array $manifest, string $backup, int $userId): array
    {
        if ($this->isRunning()) {
            throw new HttpException(409, 'UPDATE_RUNNING', 'Ya hay una actualización en curso.');
        }
        if (!UpdateChecker::isNewer((string) $manifest['version'], AppVersion::current())) {
            throw new HttpException(409, 'UPDATE_NOT_NEWER', 'La plataforma ya tiene esta versión o una más reciente.');
        }
        if (empty($manifest['migrations']['reversible']) && $backup !== 'system') {
            throw HttpException::validation(['backup' => ['Esta versión tiene cambios irreversibles en la base de datos: la copia previa es obligatoria.']]);
        }

        $this->cleanupWork();
        $job = [
            'state_version' => self::STATE_VERSION,
            'id'            => bin2hex(random_bytes(8)),
            'status'        => 'running',
            'step'          => 'preflight',
            'progress'      => 0,
            'from_version'  => AppVersion::current(),
            'to_version'    => (string) $manifest['version'],
            'manifest'      => $manifest,
            'backup'        => $backup === 'system' ? 'system' : 'none',
            'by_user_id'    => $userId,
            'started_at'    => gmdate('c'),
            'finished_at'   => null,
            'download'      => ['received' => 0, 'total' => (int) $manifest['package']['size_bytes']],
            'maintenance'   => false,
            'install_phase' => null,
            'backup_file'   => null,
            'warnings'      => [],
            'error'         => null,
            'log'           => [],
        ];
        self::log($job, "Actualización de v{$job['from_version']} a v{$job['to_version']} iniciada.");
        $this->save($job);
        return $job;
    }

    /** Cancela un trabajo que aún no tocó el sitio. */
    public function cancel(): void
    {
        $job = $this->job();
        if ($job === null || $job['status'] !== 'running') {
            return;
        }
        if ($this->stepIndex($job['step']) >= $this->stepIndex('maintenance')) {
            throw new HttpException(409, 'UPDATE_NOT_CANCELLABLE', 'La actualización ya está aplicando cambios y no se puede cancelar.');
        }
        $this->cleanupWork();
        $job['status'] = 'cancelled';
        $job['finished_at'] = gmdate('c');
        self::log($job, 'Actualización cancelada por el administrador.');
        $this->save($job);
        $this->appendHistory($job);
    }

    // ── Ejecución ────────────────────────────────────────────────────────────

    /**
     * Avanza un paso. `handoff` trae el token de paso del mantenimiento y avisa
     * de que se cerraron las sesiones (el controlador emite una sesión nueva al admin).
     *
     * @return array{job:?array<string,mixed>, handoff:?array<string,mixed>}
     */
    public function step(): array
    {
        $lock = fopen($this->dir . '/lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            return ['job' => $this->publicJob(), 'handoff' => null]; // otro paso en curso
        }

        try {
            $job = $this->job();
            if ($job === null || $job['status'] !== 'running') {
                return ['job' => $this->publicJob($job), 'handoff' => null];
            }

            @set_time_limit(300);
            ignore_user_abort(true); // un paso a medias nunca se corta porque el navegador se cierre

            $handoff = null;
            try {
                $this->injectFault($job['step']);
                $done = match ($job['step']) {
                    'preflight'   => $this->stepPreflight($job),
                    'download'    => $this->stepDownload($job),
                    'verify'      => $this->stepVerify($job),
                    'extract'     => $this->stepExtract($job),
                    'maintenance' => $this->stepMaintenance($job, $handoff),
                    'backup'      => $this->stepBackup($job),
                    'install'     => $this->stepInstall($job),
                    'migrate'     => $this->stepMigrate($job),
                    'post_check'  => $this->stepPostCheck($job),
                    'finalize'    => $this->stepFinalize($job),
                    default       => throw new RuntimeException('Paso desconocido: ' . $job['step']),
                };
                if ($done && $job['status'] === 'running') {
                    $this->advance($job);
                }
            } catch (\Throwable $e) {
                $this->fail($job, $e);
            }

            if (!$job['maintenance']) {
                unset($job['bypass_token']);
            } elseif ($job['status'] === 'running' && isset($job['bypass_token'])) {
                $handoff = ($handoff ?? []) + ['bypass_token' => $job['bypass_token']];
            }

            $this->save($job);
            if ($job['status'] !== 'running') {
                $this->appendHistory($job);
            }
            return ['job' => $this->publicJob($job), 'handoff' => $handoff];
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** @param array<string,mixed> $job */
    private function advance(array &$job): void
    {
        $keys = array_keys(self::STEPS);
        $next = $keys[$this->stepIndex($job['step']) + 1] ?? null;
        if ($next === null) {
            $job['status'] = 'completed';
            $job['progress'] = 100;
            $job['finished_at'] = gmdate('c');
            return;
        }
        $job['step'] = $next;
        $job['progress'] = self::STEPS[$next][0];
    }

    /** @param array<string,mixed> $job */
    private function fail(array &$job, \Throwable $e): void
    {
        $message = $e->getMessage();
        $job['error'] = $message;
        $job['finished_at'] = gmdate('c');
        self::log($job, "Error en «" . self::STEPS[$job['step']][2] . "»: {$message}", 'error');
        error_log('[ProjectCloud][updater] ' . $message);

        $touchedFiles = $this->stepIndex($job['step']) > $this->stepIndex('install')
            || ($job['step'] === 'install' && in_array($job['install_phase'], ['swapping', 'swapped'], true));

        if (!$touchedFiles) {
            if ($job['step'] === 'install') {
                FileOps::deleteTree($this->oldFilesDir()); // respaldo a medias, sin uso
            }
            $this->cleanupWork();
            if ($job['maintenance']) {
                MaintenanceMode::disable();
                $job['maintenance'] = false;
            }
            $job['status'] = 'failed';
            self::log($job, 'No se modificó ningún archivo de la plataforma.');
            return;
        }

        try {
            $this->restoreFromOldFiles();
            FileOps::deleteTree($this->oldFilesDir());
            $this->cleanupWork();
            MaintenanceMode::disable();
            $job['maintenance'] = false;
            $job['status'] = 'rolled_back';
            self::log($job, "Se restauraron los archivos de v{$job['from_version']}. La plataforma sigue en la versión anterior.", 'warning');
        } catch (\Throwable $rollbackError) {
            // Se deja el mantenimiento activo: mejor un aviso que un sitio roto.
            $job['status'] = 'error';
            $job['error'] = "{$message} — Además falló la reversión automática: {$rollbackError->getMessage()}";
            self::log($job, 'La reversión automática falló. Los archivos originales están en api/var/old-files/files. El modo mantenimiento sigue activo.', 'error');
        }
    }

    /** Fallos simulados para probar la reversión (solo con env = development). */
    private function injectFault(string $step): void
    {
        if (Config::get('env') !== 'development') {
            return;
        }
        $flag = @file_get_contents($this->dir . '/fail-at');
        if ($flag !== false && trim($flag) === $step) {
            throw new RuntimeException("Fallo simulado en el paso «{$step}»");
        }
    }

    // ── Pasos ────────────────────────────────────────────────────────────────

    /** @param array<string,mixed> $job */
    private function stepPreflight(array &$job): bool
    {
        $blocking = Preflight::blocking(Preflight::run($job['manifest']));
        if ($blocking !== []) {
            throw new RuntimeException('Requisitos no cumplidos: ' . implode('; ', array_map(static fn(array $c): string => "{$c['label']} ({$c['detail']})", $blocking)));
        }
        self::log($job, 'Requisitos verificados.');
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepDownload(array &$job): bool
    {
        $part = $this->packagePath() . '.part';
        $total = (int) $job['download']['total'];
        $url = (string) $job['manifest']['package_url'];
        $received = is_file($part) ? (int) filesize($part) : 0;
        $deadline = microtime(true) + self::STEP_BUDGET_SECONDS;

        while ($received < $total && microtime(true) < $deadline) {
            $to = min($received + self::DOWNLOAD_CHUNK, $total) - 1;
            $result = HttpClient::downloadRange($url, $part, $received, $to, 120);
            if (!$result['partial'] && $received > 0) {
                // El servidor ignoró el rango y mandó el archivo completo: se reinicia.
                @unlink($part);
                $received = 0;
                continue;
            }
            clearstatcache(true, $part);
            $received = (int) filesize($part);
        }

        $job['download']['received'] = $received;
        [$from, $to] = self::STEPS['download'];
        $job['progress'] = $from + (int) floor(($to - $from) * min(1, $total > 0 ? $received / $total : 1));

        if ($received < $total) {
            return false; // continúa en la siguiente llamada
        }
        if (!@rename($part, $this->packagePath())) {
            throw new RuntimeException('No se pudo guardar el paquete descargado.');
        }
        self::log($job, 'Paquete descargado (' . round($total / 1048576, 2) . ' MB).');
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepVerify(array &$job): bool
    {
        ReleaseVerifier::verifyManifest($job['manifest']);
        ReleaseVerifier::verifyPackage($this->packagePath(), $job['manifest']);
        $release = ReleaseVerifier::verifyContents($this->packagePath(), $job['manifest']);
        foreach (array_keys($release['files']) as $name) {
            foreach (self::PROTECTED as $pattern) {
                if (preg_match($pattern, $name) === 1) {
                    throw new RuntimeException("El paquete intenta reemplazar un archivo protegido: {$name}");
                }
            }
        }
        FileOps::atomicWrite($this->newReleasePath(), (string) json_encode($release, JSON_UNESCAPED_SLASHES));
        self::log($job, 'Firma y contenido verificados (' . count($release['files']) . ' archivos).');
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepExtract(array &$job): bool
    {
        FileOps::deleteTree($this->stagingDir());
        FileOps::ensureDir($this->stagingDir());
        $zip = new ZipArchive();
        if ($zip->open($this->packagePath()) !== true || !$zip->extractTo($this->stagingDir())) {
            throw new RuntimeException('No se pudo extraer el paquete.');
        }
        $zip->close();
        self::log($job, 'Archivos preparados.');
        return true;
    }

    /**
     * @param array<string,mixed>      $job
     * @param array<string,mixed>|null $handoff
     */
    private function stepMaintenance(array &$job, ?array &$handoff): bool
    {
        // El token de paso se guarda en el estado (api/var, privado) para poder
        // reenviarlo en cada respuesta mientras dure el mantenimiento.
        $job['bypass_token'] = MaintenanceMode::enable('update', (int) $job['by_user_id'], null, null);
        $job['maintenance'] = true;
        (new SessionRevoker())->revokeAll();
        $handoff = ['sessions_revoked' => true];
        self::log($job, 'Modo mantenimiento activado y sesiones cerradas.');
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepBackup(array &$job): bool
    {
        if ($job['backup'] !== 'system') {
            self::log($job, 'Sin copia previa (elegido por el administrador).', 'warning');
            return true;
        }
        $service = new DatabaseManagerService();
        $file = $service->createBackup('system', 'pre-update-' . $job['to_version']);
        $service->pruneLabeled('pre-update-', 1, $file);
        $job['backup_file'] = $file;
        self::log($job, "Copia del sistema creada: {$file}");
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepInstall(array &$job): bool
    {
        if ($job['install_phase'] !== null) {
            throw new RuntimeException('La instalación se interrumpió a medias.');
        }
        $release = $this->readJson($this->newReleasePath());
        $files = $release['files'];
        $staging = $this->stagingDir();
        $previous = is_file($this->installedReleasePath()) ? $this->readJson($this->installedReleasePath()) : null;

        // 1. Respaldo (old-files): todo lo que va a cambiar o desaparecer.
        $job['install_phase'] = 'snapshot';
        $this->save($job);

        $old = $this->oldFilesDir();
        FileOps::deleteTree($old);
        FileOps::ensureDir($old . '/files');

        $plan = []; // nombre => contenido nuevo (ruta de staging o texto del .htaccess fusionado)
        $overwritten = [];
        $added = [];
        foreach ($files as $name => $meta) {
            $target = $this->target($name);
            $source = $staging . '/' . $name;
            if ($name === 'public/.htaccess') {
                [$content, $warning] = $this->mergeHtaccess((string) file_get_contents($source), $target);
                if ($warning !== null) {
                    $job['warnings'][] = $warning;
                }
                if ($content === null || (is_file($target) && hash('sha256', $content) === hash_file('sha256', $target))) {
                    continue;
                }
                $plan[$name] = ['content' => $content];
            } elseif (is_file($target) && hash_file('sha256', $target) === $meta['sha256']) {
                continue; // sin cambios
            } else {
                $plan[$name] = ['source' => $source];
            }

            if (is_file($target)) {
                FileOps::copy($target, $old . '/files/' . $name);
                $overwritten[] = $name;
            } else {
                $added[] = $name;
            }
        }

        $obsolete = [];
        foreach ($this->obsoleteFiles($files, $previous) as $name) {
            FileOps::copy($this->target($name), $old . '/files/' . $name);
            $obsolete[] = $name;
        }

        if ($previous !== null) {
            FileOps::copy($this->installedReleasePath(), $old . '/release.json');
        }
        FileOps::atomicWrite($old . '/meta.json', (string) json_encode([
            'from_version' => $job['from_version'],
            'to_version'   => $job['to_version'],
            'created_at'   => gmdate('c'),
            'reversible'   => !empty($job['manifest']['migrations']['reversible']),
            'overwritten'  => $overwritten,
            'added'        => $added,
            'obsolete'     => $obsolete,
            'had_release'  => $previous !== null,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        // 2. Reemplazo: primero api/, luego los archivos del sitio y al final
        //    .htaccess e index.html (el punto de entrada cambia de último).
        $job['install_phase'] = 'swapping';
        $this->save($job);

        uksort($plan, static fn(string $a, string $b): int => self::installOrder($a) <=> self::installOrder($b) ?: strcmp($a, $b));
        foreach ($plan as $name => $item) {
            $target = $this->target($name);
            isset($item['content']) ? FileOps::atomicWrite($target, $item['content']) : FileOps::atomicCopy($item['source'], $target);
        }

        if (function_exists('opcache_reset')) {
            @opcache_reset();
        }
        $job['install_phase'] = 'swapped';
        self::log($job, sprintf('Archivos instalados: %d actualizados, %d nuevos, %d a retirar al final.', count($overwritten), count($added), count($obsolete)));
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepMigrate(array &$job): bool
    {
        $result = (new MigrationRunner())->run();
        self::log($job, $result['applied'] === []
            ? "Base de datos al día (schema {$result['to']})."
            : 'Migraciones aplicadas: ' . implode(', ', $result['applied']) . " (schema {$result['to']}).");
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepPostCheck(array &$job): bool
    {
        $release = $this->readJson($this->newReleasePath());
        $bad = [];
        foreach ($release['files'] as $name => $meta) {
            if ($name === 'public/.htaccess') {
                continue; // se fusiona, no se copia tal cual
            }
            $target = $this->target($name);
            if (!is_file($target) || hash_file('sha256', $target) !== $meta['sha256']) {
                $bad[] = $name;
            }
        }
        if ($bad !== []) {
            throw new RuntimeException(count($bad) . ' archivos no quedaron bien instalados (p. ej. ' . $bad[0] . ').');
        }
        if (AppVersion::current() !== $job['to_version']) {
            throw new RuntimeException('El servidor sigue ejecutando la versión anterior (caché de PHP). Versión detectada: ' . AppVersion::current());
        }
        self::log($job, 'Instalación comprobada: todos los archivos coinciden.');
        return true;
    }

    /** @param array<string,mixed> $job */
    private function stepFinalize(array &$job): bool
    {
        $meta = $this->readJson($this->oldFilesDir() . '/meta.json');
        foreach ($meta['obsolete'] as $name) {
            $target = $this->target($name);
            if (is_file($target) && !@unlink($target)) {
                $job['warnings'][] = "No se pudo borrar el archivo obsoleto {$name}.";
                continue;
            }
            FileOps::pruneEmptyDirs(dirname($target), str_starts_with($name, 'api/') ? $this->apiRoot : $this->docRoot);
        }

        FileOps::copy($this->newReleasePath(), $this->installedReleasePath());
        $this->cleanupWork();
        MaintenanceMode::disable();
        $job['maintenance'] = false;

        $this->notifyAdmins(
            'system.update_completed',
            "Plataforma actualizada a v{$job['to_version']}",
            "La actualización desde v{$job['from_version']} terminó correctamente."
        );
        self::log($job, "Actualización a v{$job['to_version']} completada.");
        return true;
    }

    // ── Reversión ────────────────────────────────────────────────────────────

    /**
     * Restaura los archivos guardados en old-files: vuelve a poner los que se
     * reemplazaron o retiraron y quita los que se añadieron.
     */
    private function restoreFromOldFiles(): void
    {
        $old = $this->oldFilesDir();
        $meta = $this->readJson($old . '/meta.json');

        foreach (array_merge($meta['overwritten'], $meta['obsolete']) as $name) {
            $saved = $old . '/files/' . $name;
            if (is_file($saved)) {
                FileOps::atomicCopy($saved, $this->target($name));
            }
        }
        foreach ($meta['added'] as $name) {
            $target = $this->target($name);
            @unlink($target);
            FileOps::pruneEmptyDirs(dirname($target), str_starts_with($name, 'api/') ? $this->apiRoot : $this->docRoot);
        }

        if (!empty($meta['had_release']) && is_file($old . '/release.json')) {
            FileOps::copy($old . '/release.json', $this->installedReleasePath());
        } elseif (empty($meta['had_release'])) {
            @unlink($this->installedReleasePath());
        }

        if (function_exists('opcache_reset')) {
            @opcache_reset();
        }
    }

    /** @return array<string,mixed>|null Información del respaldo de la versión anterior. */
    public function oldFilesInfo(): ?array
    {
        $metaPath = $this->oldFilesDir() . '/meta.json';
        if (!is_file($metaPath)) {
            return null;
        }
        $meta = $this->readJson($metaPath);
        return [
            'from_version' => $meta['from_version'],
            'to_version'   => $meta['to_version'],
            'created_at'   => $meta['created_at'],
            'reversible'   => (bool) $meta['reversible'],
            'size_bytes'   => FileOps::treeSize($this->oldFilesDir()),
            // Solo se puede revertir si la versión instalada es la que dejó este respaldo.
            'can_revert'   => (bool) $meta['reversible'] && AppVersion::current() === $meta['to_version'] && !$this->isRunning(),
        ];
    }

    /** «Revertir a la versión anterior» (manual, después de una actualización completada). */
    public function revert(int $userId): array
    {
        $info = $this->oldFilesInfo();
        if ($info === null) {
            throw new HttpException(404, 'NO_OLD_FILES', 'No hay respaldo de la versión anterior.');
        }
        if (!$info['can_revert']) {
            throw new HttpException(409, 'REVERT_NOT_ALLOWED', $info['reversible']
                ? 'El respaldo no corresponde a la versión instalada.'
                : 'Esta actualización cambió la base de datos de forma irreversible: para volver atrás restaura la copia previa.');
        }

        $entry = [
            'id' => bin2hex(random_bytes(8)), 'type' => 'revert', 'status' => 'completed',
            'from_version' => $info['to_version'], 'to_version' => $info['from_version'],
            'started_at' => gmdate('c'), 'finished_at' => null, 'by_user_id' => $userId, 'error' => null,
        ];

        MaintenanceMode::enable('update', $userId, 'Restaurando la versión anterior de la plataforma.', 600);
        try {
            $this->restoreFromOldFiles();
            FileOps::deleteTree($this->oldFilesDir());
        } catch (\Throwable $e) {
            $entry['status'] = 'error';
            $entry['error'] = $e->getMessage();
            throw new HttpException(500, 'REVERT_FAILED', 'No se pudo revertir: ' . $e->getMessage());
        } finally {
            MaintenanceMode::disable();
            $entry['finished_at'] = gmdate('c');
            $this->appendHistory($entry);
        }
        return $entry;
    }

    public function deleteOldFiles(): void
    {
        if ($this->isRunning()) {
            throw new HttpException(409, 'UPDATE_RUNNING', 'Hay una actualización en curso.');
        }
        FileOps::deleteTree($this->oldFilesDir());
    }

    // ── Auxiliares ───────────────────────────────────────────────────────────

    /**
     * Archivos de la versión instalada que la nueva ya no trae. Si no hay
     * registro de la versión instalada (primera actualización tras una
     * instalación manual) solo se retiran los bundles viejos de app-assets/,
     * que pertenecen por completo a la plataforma.
     *
     * @param array<string,mixed>      $newFiles
     * @param array<string,mixed>|null $previous
     * @return list<string>
     */
    private function obsoleteFiles(array $newFiles, ?array $previous): array
    {
        $candidates = [];
        if ($previous !== null) {
            $candidates = array_keys($previous['files'] ?? []);
        } else {
            // Solo bundles con el formato de Vite (nombre-HASH.ext) en la raíz de
            // app-assets/: cualquier otro archivo que alguien haya dejado ahí se respeta.
            foreach (glob($this->docRoot . '/app-assets/*') ?: [] as $file) {
                if (is_file($file) && preg_match('/^[\w.-]+-[A-Za-z0-9_-]{8}\.(js|css|woff2?|ttf|otf|eot|svg|png|jpe?g|webp|avif|gif|ico|map)$/', basename($file)) === 1) {
                    $candidates[] = 'public/app-assets/' . basename($file);
                }
            }
        }

        $obsolete = [];
        foreach ($candidates as $name) {
            if (!isset($newFiles[$name]) && $name !== 'public/.htaccess' && is_file($this->target($name))) {
                foreach (self::PROTECTED as $pattern) {
                    if (preg_match($pattern, $name) === 1) {
                        continue 2;
                    }
                }
                $obsolete[] = $name;
            }
        }
        return $obsolete;
    }

    /**
     * Sustituye solo el bloque de Project Cloud del .htaccess actual.
     *
     * @return array{0:?string, 1:?string} [contenido nuevo o null si no se toca, aviso]
     */
    private function mergeHtaccess(string $packaged, string $target): array
    {
        $begin = strpos($packaged, self::HTACCESS_BEGIN);
        $end = strpos($packaged, self::HTACCESS_END);
        if ($begin === false || $end === false) {
            throw new RuntimeException('El .htaccess del paquete no tiene marcadores.');
        }
        $block = substr($packaged, $begin, $end + strlen(self::HTACCESS_END) - $begin);

        if (!is_file($target)) {
            return [$block . "\n", null];
        }
        $current = (string) file_get_contents($target);
        $cb = strpos($current, self::HTACCESS_BEGIN);
        $ce = strpos($current, self::HTACCESS_END);
        if ($cb === false || $ce === false || $ce < $cb) {
            FileOps::atomicWrite($target . '.new', $block . "\n");
            return [null, 'El .htaccess de la raíz no tiene marcadores: no se modificó. La versión nueva quedó en .htaccess.new para que la revises.'];
        }
        return [substr($current, 0, $cb) . $block . substr($current, $ce + strlen(self::HTACCESS_END)), null];
    }

    private static function installOrder(string $name): int
    {
        return match (true) {
            str_starts_with($name, 'api/')   => 0,
            $name === 'public/.htaccess'     => 2,
            $name === 'public/index.html'    => 3,
            default                          => 1,
        };
    }

    /** Borra los archivos de trabajo (paquete, staging, release nuevo). */
    private function cleanupWork(): void
    {
        @unlink($this->packagePath());
        @unlink($this->packagePath() . '.part');
        @unlink($this->newReleasePath());
        FileOps::deleteTree($this->stagingDir());
    }

    /** @return array<string,mixed> */
    private function readJson(string $path): array
    {
        $data = json_decode((string) @file_get_contents($path), true);
        if (!is_array($data)) {
            throw new RuntimeException('No se pudo leer ' . basename($path));
        }
        return $data;
    }

    /** @return list<array<string,mixed>> */
    public function history(): array
    {
        $data = json_decode((string) @file_get_contents($this->historyPath()), true);
        return is_array($data) ? $data : [];
    }

    /** @param array<string,mixed> $job */
    private function appendHistory(array $job): void
    {
        $history = $this->history();
        $history = array_values(array_filter($history, static fn(array $h): bool => $h['id'] !== $job['id']));
        array_unshift($history, [
            'id'           => $job['id'],
            'type'         => $job['type'] ?? 'update',
            'status'       => $job['status'],
            'from_version' => $job['from_version'],
            'to_version'   => $job['to_version'],
            'started_at'   => $job['started_at'],
            'finished_at'  => $job['finished_at'] ?? null,
            'by_user_id'   => $job['by_user_id'],
            'error'        => $job['error'] ?? null,
        ]);
        try {
            FileOps::atomicWrite($this->historyPath(), (string) json_encode(array_slice($history, 0, self::HISTORY_LIMIT), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        } catch (\Throwable) {
            // El historial es informativo: no debe interrumpir la actualización.
        }
    }

    private function notifyAdmins(string $type, string $title, string $message): void
    {
        try {
            $repo = new NotificationRepository();
            $pdo = \ProjectCloud\Core\Database::pdo();
            foreach ($pdo->query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(\PDO::FETCH_COLUMN) as $id) {
                $repo->create((int) $id, null, $type, $title, $message, '/admin/settings/updates');
            }
        } catch (\Throwable) {
            // Una notificación que falla no debe tumbar la actualización.
        }
    }
}
