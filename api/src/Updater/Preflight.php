<?php

declare(strict_types=1);

namespace ProjectCloud\Updater;

use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\Paths;
use ProjectCloud\Services\AssetsService;

/**
 * Requisitos para instalar una versión. Se muestran al admin antes de
 * actualizar y se vuelven a comprobar como primer paso del proceso.
 */
final class Preflight
{
    /** Carpetas de la raíz del sitio que trae el paquete (public/). */
    public const PACKAGE_PUBLIC_DIRS = ['app-assets'];

    /** Espacio libre extra mínimo además del estimado (50 MB). */
    private const DISK_MARGIN = 50 * 1024 * 1024;

    /**
     * @param array<string,mixed> $manifest
     * @return list<array{key:string,label:string,ok:bool,critical:bool,detail:string}>
     */
    public static function run(array $manifest): array
    {
        $apiRoot = Paths::apiRoot();
        $docRoot = dirname($apiRoot);
        $checks = [];

        $minPhp = (string) ($manifest['requirements']['php'] ?? '8.1');
        $checks[] = self::check('php', "PHP {$minPhp} o superior", version_compare(PHP_VERSION, $minPhp, '>='), true, 'Instalado: PHP ' . PHP_VERSION);

        $extensions = array_unique(array_merge(['zip', 'curl', 'sodium'], (array) ($manifest['requirements']['extensions'] ?? [])));
        $missing = array_values(array_filter($extensions, static fn(string $e): bool => !extension_loaded($e)));
        $checks[] = self::check('extensions', 'Extensiones de PHP', $missing === [], true,
            $missing === [] ? implode(', ', $extensions) : 'Faltan: ' . implode(', ', $missing) . '. Actívalas en el panel del hosting (Configuración de PHP).');

        $min = (string) ($manifest['min_from_version'] ?? '0.0.0');
        $checks[] = self::check('from_version', "Actualizable desde v{$min}", version_compare(AppVersion::current(), $min, '>='), true,
            'Versión instalada: v' . AppVersion::current());

        $layoutOk = is_file($docRoot . '/index.html') && is_file($apiRoot . '/index.php');
        $checks[] = self::check('layout', 'Estructura de carpetas reconocida', $layoutOk, true,
            $layoutOk ? 'index.html y api/ en la raíz del sitio' : 'No se encontró index.html junto a la carpeta api/.');

        $unwritable = [];
        foreach ([$docRoot, $apiRoot, $apiRoot . '/src', Paths::var()] as $dir) {
            if (!FileOps::canWrite($dir)) {
                $unwritable[] = $dir === $docRoot ? 'raíz del sitio' : str_replace($docRoot . DIRECTORY_SEPARATOR, '', $dir);
            }
        }
        $checks[] = self::check('writable', 'Permisos de escritura', $unwritable === [], true,
            $unwritable === [] ? 'PHP puede reemplazar los archivos de la plataforma' : 'Sin permiso en: ' . implode(', ', $unwritable));

        $size = (int) ($manifest['package']['size_bytes'] ?? 0);
        $needed = $size * 4 + self::DISK_MARGIN; // paquete + archivos extraídos + respaldo
        $free = @disk_free_space($apiRoot);
        $checks[] = self::check('disk', 'Espacio libre en disco', $free === false || $free >= $needed, true,
            $free === false ? 'No se pudo medir (se continuará)' : self::human((int) $free) . ' libres, se necesitan ~' . self::human($needed));

        $sharedFolder = basename((new AssetsService())->rootPath());
        $collides = in_array(strtolower($sharedFolder), self::PACKAGE_PUBLIC_DIRS, true);
        $checks[] = self::check('shared_unit', 'Carpeta de la unidad compartida', !$collides, true,
            $collides
                ? "La unidad compartida usa la carpeta «{$sharedFolder}», que pertenece a la plataforma. Cámbiala en Configuración → Espacio de trabajo (y mueve sus archivos) antes de actualizar."
                : "«{$sharedFolder}» no se toca durante la actualización");

        $htaccess = @file_get_contents($docRoot . '/.htaccess');
        $hasMarkers = is_string($htaccess) && str_contains($htaccess, UpdateRunner::HTACCESS_BEGIN) && str_contains($htaccess, UpdateRunner::HTACCESS_END);
        $checks[] = self::check('htaccess', '.htaccess con marcadores', $hasMarkers, false,
            $hasMarkers ? 'Se actualizará solo el bloque de Project Cloud' : 'Sin marcadores: no se modificará; la versión nueva se guardará como .htaccess.new para que la revises.');

        return $checks;
    }

    /** @param list<array{ok:bool,critical:bool}> $checks */
    public static function blocking(array $checks): array
    {
        return array_values(array_filter($checks, static fn(array $c): bool => $c['critical'] && !$c['ok']));
    }

    private static function check(string $key, string $label, bool $ok, bool $critical, string $detail): array
    {
        return compact('key', 'label', 'ok', 'critical', 'detail');
    }

    private static function human(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = $bytes > 0 ? min((int) floor(log($bytes, 1024)), 4) : 0;
        return round($bytes / (1024 ** $i), 1) . ' ' . $units[$i];
    }
}
