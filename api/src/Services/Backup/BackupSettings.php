<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Backup;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Configuración de las copias de seguridad: programación, cuántas conservar y
 * qué incluyen. También estima el tamaño de una copia con los datos de la BD
 * (sin recorrer el disco, que en un storage grande tardaría minutos).
 */
final class BackupSettings
{
    public const SCHEDULES = ['off' => 0, 'daily' => 1, 'weekly' => 7, 'biweekly' => 15, 'monthly' => 30];
    public const MAX_COPIES = 3;

    private const KEY = 'backup_settings';
    private const DEFAULTS = [
        'schedule'   => 'weekly',
        'hour_utc'   => 9,       // 03:00 en México (UTC-6)
        'max_copies' => 3,
        'scope'      => 'full',  // full | system
        'content'    => [
            'users'      => true,
            'shared'     => true,
            'trash'      => true,
            'avatars'    => true,
            'ext_mode'   => 'all', // all | only | except
            'extensions' => [],
        ],
    ];

    private SettingsRepository $settings;
    private PDO $pdo;

    public function __construct(?SettingsRepository $settings = null, ?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
        $this->settings = $settings ?? new SettingsRepository($this->pdo);
    }

    /** @return array<string,mixed> */
    public function get(): array
    {
        $raw = $this->settings->get(self::KEY);
        $saved = $raw !== null ? json_decode($raw, true) : null;
        $saved = is_array($saved) ? $saved : [];
        $merged = array_replace(self::DEFAULTS, $saved);
        $merged['content'] = array_replace(self::DEFAULTS['content'], is_array($saved['content'] ?? null) ? $saved['content'] : []);
        return $merged;
    }

    /**
     * Valida y guarda. Devuelve la configuración resultante.
     *
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function save(array $input): array
    {
        $data = $this->normalize($input);
        $this->settings->set(self::KEY, (string) json_encode($data, JSON_UNESCAPED_UNICODE));
        return $data;
    }

    /**
     * Valida una configuración (completando con la guardada) sin persistirla.
     *
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function normalize(array $input): array
    {
        $current = $this->get();
        $errors = [];

        $schedule = (string) ($input['schedule'] ?? $current['schedule']);
        if (!array_key_exists($schedule, self::SCHEDULES)) {
            $errors['schedule'][] = 'Frecuencia no válida.';
        }
        $hour = (int) ($input['hour_utc'] ?? $current['hour_utc']);
        if ($hour < 0 || $hour > 23) {
            $errors['hour_utc'][] = 'La hora debe estar entre 0 y 23.';
        }
        $max = (int) ($input['max_copies'] ?? $current['max_copies']);
        if ($max < 1 || $max > self::MAX_COPIES) {
            $errors['max_copies'][] = 'Se pueden conservar entre 1 y ' . self::MAX_COPIES . ' copias.';
        }
        $scope = (string) ($input['scope'] ?? $current['scope']);
        if (!in_array($scope, ['full', 'system'], true)) {
            $errors['scope'][] = 'Tipo de copia no válido.';
        }

        $content = array_replace($current['content'], is_array($input['content'] ?? null) ? $input['content'] : []);
        foreach (['users', 'shared', 'trash', 'avatars'] as $flag) {
            $content[$flag] = (bool) $content[$flag];
        }
        if (!in_array($content['ext_mode'], ['all', 'only', 'except'], true)) {
            $errors['content.ext_mode'][] = 'Modo de filtro no válido.';
        }
        $extensions = [];
        foreach ((array) $content['extensions'] as $ext) {
            $ext = strtolower(ltrim(trim((string) $ext), '.'));
            if ($ext !== '' && preg_match('/^[a-z0-9]{1,16}$/', $ext) === 1) {
                $extensions[$ext] = true;
            }
        }
        $content['extensions'] = array_keys($extensions);
        if ($content['ext_mode'] !== 'all' && $content['extensions'] === []) {
            $errors['content.extensions'][] = 'Elige al menos una extensión o usa «Todas».';
        }

        if ($errors !== []) {
            throw HttpException::validation($errors);
        }

        return ['schedule' => $schedule, 'hour_utc' => $hour, 'max_copies' => $max, 'scope' => $scope, 'content' => $content];
    }

    // ── Programación ─────────────────────────────────────────────────────────

    public function lastScheduledRun(): ?int
    {
        $last = $this->settings->get('backup_last_scheduled_at');
        return $last !== null && strtotime($last) !== false ? (int) strtotime($last) : null;
    }

    public function markScheduledRun(int $timestamp): void
    {
        $this->settings->set('backup_last_scheduled_at', gmdate('c', $timestamp));
    }

    /**
     * Próxima copia programada (UTC). Si la anterior ya venció, es «ahora»:
     * la tomará la siguiente pasada del cron.
     */
    public function nextRun(?int $now = null): ?int
    {
        $now ??= time();
        $config = $this->get();
        $days = self::SCHEDULES[$config['schedule']] ?? 0;
        if ($days === 0) {
            return null;
        }
        $last = $this->lastScheduledRun();
        $baseDay = $last !== null ? strtotime(gmdate('Y-m-d', $last) . " +{$days} days") : strtotime(gmdate('Y-m-d', $now));
        $candidate = (int) $baseDay + $config['hour_utc'] * 3600;
        // Sin copias previas y con la hora de hoy ya pasada: mañana a esa hora.
        if ($last === null && $candidate < $now) {
            $candidate += 86400;
        }
        return $candidate;
    }

    public function isDue(?int $now = null): bool
    {
        $now ??= time();
        $next = $this->nextRun($now);
        return $next !== null && $now >= $next;
    }

    // ── Estimación ───────────────────────────────────────────────────────────

    /**
     * Extensiones presentes en las unidades de usuarios (tabla files) y en la
     * unidad compartida (assets_metadata), con número de archivos y tamaño.
     *
     * @return list<array{ext:string,count:int,bytes:int}>
     */
    public function extensions(): array
    {
        $byExt = [];
        $rows = $this->pdo->query("SELECT LOWER(COALESCE(extension, '')) AS ext, COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS b FROM files GROUP BY ext")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $byExt[$r['ext']] = ['count' => (int) $r['n'], 'bytes' => (int) $r['b']];
        }
        try {
            foreach ($this->pdo->query('SELECT path, size_bytes FROM assets_metadata')->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $ext = strtolower(pathinfo((string) $r['path'], PATHINFO_EXTENSION));
                $byExt[$ext]['count'] = ($byExt[$ext]['count'] ?? 0) + 1;
                $byExt[$ext]['bytes'] = ($byExt[$ext]['bytes'] ?? 0) + (int) $r['size_bytes'];
            }
        } catch (\Throwable) {
            // Instalaciones sin unidad compartida.
        }

        $list = [];
        foreach ($byExt as $ext => $v) {
            if ($ext !== '') {
                $list[] = ['ext' => (string) $ext, 'count' => $v['count'], 'bytes' => $v['bytes']];
            }
        }
        usort($list, static fn(array $a, array $b): int => $b['bytes'] <=> $a['bytes']);
        return $list;
    }

    /**
     * Tamaño aproximado de una copia con la configuración dada (por defecto, la guardada).
     *
     * @param array<string,mixed>|null $config
     * @return array{database:int, users:int, trash:int, shared:int, avatars:int, total:int}
     */
    public function estimate(?array $config = null): array
    {
        $config ??= $this->get();
        $content = $config['content'];
        $full = $config['scope'] !== 'system';

        $db = (int) $this->pdo->query('SELECT COALESCE(SUM(data_length + index_length), 0) FROM information_schema.TABLES WHERE table_schema = DATABASE()')->fetchColumn();

        [$filterSql, $params] = $this->extensionFilterSql($content);
        $sum = function (string $where) use ($filterSql, $params): int {
            $stmt = $this->pdo->prepare("SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE {$where}{$filterSql}");
            $stmt->execute($params);
            return (int) $stmt->fetchColumn();
        };

        $users = $full && $content['users'] ? $sum('deleted_at IS NULL') : 0;
        $trash = $full && $content['trash'] ? $sum('deleted_at IS NOT NULL') : 0;

        $shared = 0;
        if ($full && $content['shared']) {
            try {
                foreach ($this->pdo->query('SELECT path, size_bytes FROM assets_metadata')->fetchAll(PDO::FETCH_ASSOC) as $r) {
                    if ($this->extensionAllowed((string) $r['path'], $content)) {
                        $shared += (int) $r['size_bytes'];
                    }
                }
            } catch (\Throwable) {
            }
        }

        $avatars = 0;
        if ($full && $content['avatars']) {
            $dir = dirname(rtrim((string) \ProjectCloud\Core\Config::get('storage.path', ''), '/\\')) . DIRECTORY_SEPARATOR . 'avatars';
            foreach (glob($dir . DIRECTORY_SEPARATOR . '*') ?: [] as $f) {
                $avatars += is_file($f) ? (int) filesize($f) : 0;
            }
        }

        return [
            'database' => $db,
            'users'    => $users,
            'trash'    => $trash,
            'shared'   => $shared,
            'avatars'  => $avatars,
            'total'    => $db + $users + $trash + $shared + $avatars,
        ];
    }

    /** @return array{0:string,1:list<string>} */
    private function extensionFilterSql(array $content): array
    {
        if ($content['ext_mode'] === 'all' || $content['extensions'] === []) {
            return ['', []];
        }
        $placeholders = implode(',', array_fill(0, count($content['extensions']), '?'));
        return $content['ext_mode'] === 'only'
            ? [" AND LOWER(extension) IN ({$placeholders})", $content['extensions']]
            : [" AND (extension IS NULL OR LOWER(extension) NOT IN ({$placeholders}))", $content['extensions']];
    }

    private function extensionAllowed(string $path, array $content): bool
    {
        if ($content['ext_mode'] === 'all') {
            return true;
        }
        $listed = in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), $content['extensions'], true);
        return $content['ext_mode'] === 'only' ? $listed : !$listed;
    }
}
