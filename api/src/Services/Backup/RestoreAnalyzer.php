<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Backup;

use PDO;
use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\Paths;
use ProjectCloud\Services\AssetsService;
use ProjectCloud\Services\DatabaseManagerService;
use ZipArchive;

/**
 * Diagnóstico previo a restaurar una copia. No modifica nada: revisa la copia
 * y la compara con el estado actual para avisar al admin, antes de empezar, de
 * todo lo que va a pasar.
 *
 * Resultado: ok (todo en orden) · warning (se puede continuar con confirmación)
 * · blocked (no se puede restaurar).
 */
final class RestoreAnalyzer
{
    /** Carpetas de la raíz del sitio que una restauración nunca puede escribir. */
    public const SYSTEM_DIRS = ['api', 'app-assets', 'var', 'old-files', 'thumbs'];
    /** Prohibidas incluso si la copia dice que son su unidad compartida. */
    private const ALWAYS_BLOCKED = ['api', 'var', 'old-files'];

    private const DUMP = 'database_dump.sql';
    private const MANIFEST = 'backup.json';

    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    /**
     * ¿Es una ruta que una copia puede contener? Protege contra rutas que salgan
     * de la raíz del sitio (zip-slip) o que pisen carpetas de la plataforma.
     */
    public static function isSafeEntry(string $name, ?string $sharedFolder = null): bool
    {
        if ($name === '' || str_contains($name, "\0") || str_contains($name, '\\')
            || str_starts_with($name, '/') || preg_match('#^[A-Za-z]:#', $name) === 1) {
            return false;
        }
        $segments = explode('/', rtrim($name, '/'));
        foreach ($segments as $segment) {
            if ($segment === '..' || $segment === '.' || $segment === '') {
                return false;
            }
        }
        $top = $segments[0];
        // Instalaciones antiguas con la unidad compartida en una carpeta de sistema
        // (p. ej. app-assets): se permite solo esa, nunca api/ ni var/.
        $isShared = $sharedFolder !== null && $top === $sharedFolder && !in_array(strtolower($top), self::ALWAYS_BLOCKED, true);
        if ($isShared) {
            return true;
        }
        if (count($segments) === 1) {
            return in_array($name, [self::DUMP, self::MANIFEST, 'config/', 'storage/', 'avatars/'], true)
                || (preg_match('#^[A-Za-z0-9_-]+/$#', $name) === 1 && !in_array(strtolower($top), self::SYSTEM_DIRS, true));
        }
        if ($top === 'config') {
            return in_array($name, ['config/config.php', 'config/install.lock'], true);
        }
        return $top === 'storage' || $top === 'avatars'
            || (preg_match('/^[A-Za-z0-9_-]+$/', $top) === 1 && !in_array(strtolower($top), self::SYSTEM_DIRS, true));
    }

    /** @return array<string,mixed> */
    public function analyze(string $filename): array
    {
        $path = (new DatabaseManagerService())->getBackupPath($filename);
        $checks = [];
        $add = static function (string $key, string $level, string $label, string $detail) use (&$checks): void {
            $checks[] = compact('key', 'level', 'label', 'detail');
        };

        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CHECKCONS) !== true) {
            $add('integrity', 'error', 'Integridad del archivo', 'El ZIP está dañado o incompleto: no se puede restaurar.');
            return $this->result($filename, $path, null, $checks, 0, 0);
        }

        try {
            $manifest = json_decode((string) $zip->getFromName(self::MANIFEST), true);
            $manifest = is_array($manifest) ? $manifest : null;
            $createdAt = $manifest['created_at'] ?? gmdate('c', (int) filemtime($path));
            $createdSql = $this->toDbTime((int) strtotime($createdAt));
            $sharedFolder = is_string($manifest['shared_unit_folder'] ?? null) ? $manifest['shared_unit_folder'] : null;

            // ── Contenido del ZIP ────────────────────────────────────────────
            $unsafe = [];
            $restoreBytes = 0;
            $entries = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                $name = (string) $stat['name'];
                if (!self::isSafeEntry($name, $sharedFolder)) {
                    $unsafe[] = $name;
                    continue;
                }
                if ($name !== self::DUMP && $name !== self::MANIFEST && !str_ends_with($name, '/')) {
                    $restoreBytes += (int) $stat['size'];
                    $entries++;
                }
            }
            $add('integrity', $unsafe === [] ? 'ok' : 'error', 'Integridad del archivo', $unsafe === []
                ? "ZIP válido · {$entries} archivos"
                : 'La copia contiene rutas no permitidas (p. ej. ' . $unsafe[0] . '). No se restaurará.');

            // ── Manifiesto y volcado ─────────────────────────────────────────
            if ($manifest === null) {
                $add('manifest', 'warning', 'Información de la copia', 'Copia anterior a v2.1.0, sin manifiesto: se puede restaurar, pero no se pueden verificar la versión ni el contenido.');
            }

            $dumpStat = $zip->statName(self::DUMP);
            if ($dumpStat === false) {
                $add('dump', 'error', 'Base de datos', 'La copia no contiene el volcado de la base de datos.');
            } else {
                $complete = $this->dumpEndsWithMarker($zip);
                if ($complete) {
                    $add('dump', 'ok', 'Base de datos', 'Volcado completo (' . self::human((int) $dumpStat['size']) . ')');
                } else {
                    $add('dump', $manifest !== null ? 'error' : 'warning', 'Base de datos', $manifest !== null
                        ? 'El volcado está cortado (falta la marca final): la copia quedó incompleta.'
                        : 'Volcado de una versión antigua (sin marca de fin): no se puede confirmar que esté completo.');
                }
            }

            // ── Versión ──────────────────────────────────────────────────────
            if ($manifest !== null) {
                $backupVersion = (string) $manifest['app_version'];
                $current = AppVersion::info();
                if (version_compare($backupVersion, $current['version'], '>')) {
                    $add('version', 'error', 'Versión', "La copia es de v{$backupVersion}, más nueva que la instalada (v{$current['version']}). Actualiza la plataforma antes de restaurarla.");
                } elseif ((int) $manifest['schema'] < $current['schema']) {
                    $add('version', 'info', 'Versión', "Copia de v{$backupVersion} (schema {$manifest['schema']}). Tras restaurar, la base de datos se actualizará sola al schema {$current['schema']}.");
                } else {
                    $add('version', 'ok', 'Versión', "Copia de v{$backupVersion}, compatible con la instalada.");
                }

                if (($manifest['scope'] ?? 'full') === 'system') {
                    $add('scope', 'info', 'Tipo de copia', 'Copia solo de sistema: se restauran la base de datos y la configuración; los archivos actuales no cambian.');
                }

                $excluded = $manifest['excluded_by_filter'] ?? null;
                if (is_array($excluded) && $excluded['count'] > 0) {
                    $filter = $manifest['extension_filter'];
                    $exts = implode(', ', array_map(static fn(string $e): string => ".{$e}", $filter['extensions'] ?? []));
                    $add('filtered', 'warning', 'Archivos fuera de la copia', sprintf(
                        '%d archivo(s) (%s) registrados en la base de datos no están en la copia por el filtro «%s %s». Tras restaurar aparecerán como no disponibles.',
                        $excluded['count'],
                        self::human((int) $excluded['bytes']),
                        ($filter['mode'] ?? '') === 'only' ? 'solo' : 'excepto',
                        $exts
                    ));
                }

                $folder = $manifest['shared_unit_folder'] ?? null;
                $currentFolder = basename((new AssetsService())->rootPath());
                if (is_string($folder) && $folder !== $currentFolder) {
                    $add('shared_folder', 'info', 'Unidad compartida', "La copia usa la carpeta «{$folder}» y ahora se usa «{$currentFolder}». Se restaurará en «{$folder}» y la plataforma volverá a usarla, como estaba configurado entonces. «{$currentFolder}» no se borra: sus archivos quedan en el disco y puedes volver a activarla en Espacio de trabajo.");
                }
            }

            // ── Lo que cambió después de la copia ────────────────────────────
            $orphans = $this->orphans($zip, $createdSql, $sharedFolder);
            if ($orphans['count'] > 0) {
                $add('orphans', 'warning', 'Archivos subidos después de la copia', sprintf(
                    '%d %s (%s) no existían cuando se hizo la copia. La base de datos restaurada no los conocerá: se moverán a una carpeta de cuarentena (api/var/restore-orphans) para que no se pierdan.',
                    $orphans['count'],
                    $orphans['count'] === 1 ? 'archivo' : 'archivos',
                    self::human($orphans['bytes'])
                ));
            } else {
                $add('orphans', 'ok', 'Archivos posteriores a la copia', 'No hay archivos subidos después de la copia.');
            }

            $usersAfter = (int) $this->query('SELECT COUNT(*) FROM users WHERE created_at > ?', [$createdSql]);
            if ($usersAfter > 0) {
                $add('users', 'warning', 'Usuarios', $usersAfter === 1
                    ? '1 usuario se creó después de la copia y dejará de existir.'
                    : "{$usersAfter} usuarios se crearon después de la copia y dejarán de existir.");
            }

            // ── Configuración ────────────────────────────────────────────────
            $backupConfig = $zip->getFromName('config/config.php');
            $currentConfig = @file_get_contents(Paths::apiRoot() . '/config/config.php');
            if (is_string($backupConfig) && is_string($currentConfig) && hash('sha256', $backupConfig) !== hash('sha256', $currentConfig)) {
                $add('config', 'info', 'Configuración del servidor', 'La configuración de la copia (conexión a la base de datos, secreto de sesiones) es distinta de la actual. Por seguridad se conserva la actual, salvo que elijas restaurarla.');
            }

            // ── Espacio ──────────────────────────────────────────────────────
            $free = @disk_free_space(rtrim((string) Config::get('storage.path', ''), '/\\') ?: Paths::apiRoot());
            $needed = (int) ($restoreBytes * 1.1);
            if ($free !== false && $free < $needed) {
                $add('disk', 'error', 'Espacio en disco', 'Se necesitan ~' . self::human($needed) . ' y quedan ' . self::human((int) $free) . ' libres.');
            } else {
                $add('disk', 'ok', 'Espacio en disco', $free === false ? 'No se pudo medir' : self::human((int) $free) . ' libres (se necesitan ~' . self::human($needed) . ')');
            }

            return $this->result($filename, $path, $manifest, $checks, $orphans['count'], $restoreBytes);
        } finally {
            $zip->close();
        }
    }

    /**
     * Archivos (de usuarios y de la unidad compartida) creados después de la
     * copia que la copia no trae: tras restaurar quedarían sin registro.
     *
     * Si la copia es de cuando la unidad compartida usaba OTRA carpeta, los
     * archivos de la carpeta actual no se tocan: esa carpeta simplemente deja de
     * ser la activa (sigue en disco, igual que al cambiarla en Configuración).
     *
     * @return array{count:int, bytes:int, list:list<array{abs:string, rel:string}>}
     */
    public function orphans(ZipArchive $zip, string $createdSql, ?string $backupSharedFolder = null): array
    {
        $storage = rtrim((string) Config::get('storage.path', ''), '/\\');
        $list = [];
        $bytes = 0;

        $stmt = $this->pdo->prepare('SELECT u.username, f.path, f.size_bytes FROM files f JOIN users u ON u.id = f.user_id WHERE f.deleted_at IS NULL AND f.created_at > ?');
        $stmt->execute([$createdSql]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $rel = 'storage/' . $row['username'] . '/' . ltrim((string) $row['path'], '/');
            $abs = $storage . DIRECTORY_SEPARATOR . $row['username'] . DIRECTORY_SEPARATOR . ltrim((string) $row['path'], '/');
            if ($zip->locateName($rel) === false && is_file($abs)) {
                $list[] = ['abs' => $abs, 'rel' => $rel];
                $bytes += (int) $row['size_bytes'];
            }
        }

        try {
            $assetsRoot = (new AssetsService())->rootPath();
            $folder = basename($assetsRoot);
            if ($backupSharedFolder !== null && $backupSharedFolder !== $folder) {
                return ['count' => count($list), 'bytes' => $bytes, 'list' => $list];
            }
            $stmt = $this->pdo->prepare('SELECT path, size_bytes FROM assets_metadata WHERE created_at > ?');
            $stmt->execute([$createdSql]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $relPath = ltrim((string) $row['path'], '/');
                $abs = $assetsRoot . DIRECTORY_SEPARATOR . $relPath;
                if (is_file($abs) && $zip->locateName($folder . '/' . $relPath) === false) {
                    $list[] = ['abs' => $abs, 'rel' => $folder . '/' . $relPath];
                    $bytes += (int) $row['size_bytes'];
                }
            }
        } catch (\Throwable) {
            // Sin unidad compartida.
        }

        return ['count' => count($list), 'bytes' => $bytes, 'list' => $list];
    }

    /**
     * Convierte una fecha UTC a la hora en que la BD guarda sus DATETIME. La
     * conexión no fija zona horaria, así que MySQL usa la del servidor (que
     * puede no ser UTC): las columnas created_at están en esa hora.
     */
    public function toDbTime(int $utcTimestamp): string
    {
        $offset = (int) $this->pdo->query('SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW())')->fetchColumn();
        return gmdate('Y-m-d H:i:s', $utcTimestamp + $offset);
    }

    /** Lee el volcado hasta el final (en streaming) y comprueba la marca de cierre. */
    private function dumpEndsWithMarker(ZipArchive $zip): bool
    {
        $stream = $zip->getStream(self::DUMP);
        if ($stream === false) {
            return false;
        }
        $tail = '';
        while (!feof($stream)) {
            $chunk = fread($stream, 1 << 20);
            if ($chunk === false) {
                break;
            }
            $tail = substr($tail . $chunk, -256);
        }
        fclose($stream);
        return str_contains($tail, DatabaseManagerService::DUMP_END_MARKER);
    }

    private function query(string $sql, array $params): mixed
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    /** @param list<array{level:string}> $checks */
    private function result(string $filename, string $path, ?array $manifest, array $checks, int $orphans, int $restoreBytes): array
    {
        $levels = array_column($checks, 'level');
        $status = in_array('error', $levels, true) ? 'blocked' : (in_array('warning', $levels, true) ? 'warning' : 'ok');
        return [
            'status'  => $status,
            'checks'  => $checks,
            'backup'  => [
                'filename'    => $filename,
                'size_bytes'  => (int) filesize($path),
                'created_at'  => $manifest['created_at'] ?? gmdate('c', (int) filemtime($path)),
                'app_version' => $manifest['app_version'] ?? null,
                'scope'       => $manifest['scope'] ?? 'full',
                'includes'    => $manifest['includes'] ?? null,
                'restore_bytes' => $restoreBytes,
            ],
            'defaults' => [
                'restore_config' => false,
                'quarantine'     => $orphans > 0,
                'safety_copy'    => true,
            ],
        ];
    }

    private static function human(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = $bytes > 0 ? min((int) floor(log($bytes, 1024)), 4) : 0;
        return round($bytes / (1024 ** $i), 1) . ' ' . $units[$i];
    }
}
