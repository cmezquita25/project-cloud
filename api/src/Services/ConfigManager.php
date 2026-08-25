<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;

/**
 * Gestión y actualización dinámica de config/config.php.
 * Permite modificar límites de entorno (memoria, subida, timeouts) desde el panel admin.
 */
final class ConfigManager
{
    public static function configFilePath(): string
    {
        return __DIR__ . '/../../config/config.php';
    }

    /**
     * Asegura que config.php exista y contenga el bloque 'php'. Si no existe,
     * intenta crearlo usando valores por defecto o desde config.sample.php.
     */
    public static function ensureConfigFile(): void
    {
        $file = self::configFilePath();
        $configDir = dirname($file);
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0775, true);
        }

        if (!is_file($file)) {
            $sample = __DIR__ . '/../../config/config.sample.php';
            $data = is_file($sample) ? (require $sample) : [];
            self::writeConfigFile($file, $data);
            return;
        }

        // Si existe pero no tiene el bloque 'php', actualizarlo
        $data = Config::all();
        if (empty($data['php'])) {
            self::updatePhpLimits([]);
        }
    }

    /**
     * Actualiza la sección 'php' en config/config.php.
     *
     * @param array{memory_limit?:string,max_execution_time?:int|string,max_input_time?:int|string,post_max_size?:string,upload_max_filesize?:string} $phpLimits
     */
    public static function updatePhpLimits(array $phpLimits): void
    {
        $file = self::configFilePath();
        $currentConfig = Config::all();
        if (empty($currentConfig)) {
            $sample = __DIR__ . '/../../config/config.sample.php';
            $currentConfig = is_file($sample) ? (require $sample) : [];
        }

        $existingPhp = $currentConfig['php'] ?? [
            'memory_limit'        => self::iniGet('memory_limit', '512M'),
            'max_execution_time'  => (int) self::iniGet('max_execution_time', 300),
            'max_input_time'      => (int) self::iniGet('max_input_time', 300),
            'post_max_size'       => self::iniGet('post_max_size', '2048M'),
            'upload_max_filesize' => self::iniGet('upload_max_filesize', '2048M'),
        ];

        if (isset($phpLimits['memory_limit'])) {
            $existingPhp['memory_limit'] = trim((string) $phpLimits['memory_limit']);
        }
        if (isset($phpLimits['max_execution_time'])) {
            $existingPhp['max_execution_time'] = (int) $phpLimits['max_execution_time'];
        }
        if (isset($phpLimits['max_input_time'])) {
            $existingPhp['max_input_time'] = (int) $phpLimits['max_input_time'];
        }
        if (isset($phpLimits['post_max_size'])) {
            $existingPhp['post_max_size'] = trim((string) $phpLimits['post_max_size']);
        }
        if (isset($phpLimits['upload_max_filesize'])) {
            $existingPhp['upload_max_filesize'] = trim((string) $phpLimits['upload_max_filesize']);
        }

        $currentConfig['php'] = $existingPhp;
        self::writeConfigFile($file, $currentConfig);
    }

    /**
     * Escribe el arreglo de configuración en config/config.php.
     */
    public static function writeConfigFile(string $path, array $config): void
    {
        $dbHost = var_export($config['db']['host'] ?? 'localhost', true);
        $dbPort = (int) ($config['db']['port'] ?? 3306);
        $dbName = var_export($config['db']['name'] ?? 'project_cloud', true);
        $dbUser = var_export($config['db']['user'] ?? '', true);
        $dbPass = var_export($config['db']['pass'] ?? '', true);
        $dbCharset = var_export($config['db']['charset'] ?? 'utf8mb4', true);

        $jwtSecret = var_export($config['jwt']['secret'] ?? 'secret', true);
        $jwtAccessTtl = (int) ($config['jwt']['access_ttl'] ?? 900);
        $jwtRefreshTtl = (int) ($config['jwt']['refresh_ttl'] ?? 2592000);
        $jwtIssuer = var_export($config['jwt']['issuer'] ?? 'project-cloud', true);

        $storagePathExpr = isset($config['storage']['path']) && str_contains((string) $config['storage']['path'], 'storage')
            ? "__DIR__ . '/../../storage'"
            : var_export($config['storage']['path'] ?? '', true);
        $storageUrl = var_export($config['storage']['public_url'] ?? '', true);
        $storageChunkSize = (int) ($config['storage']['chunk_size'] ?? 4194304);

        $phpMem = var_export($config['php']['memory_limit'] ?? '512M', true);
        $phpExec = (int) ($config['php']['max_execution_time'] ?? 300);
        $phpInput = (int) ($config['php']['max_input_time'] ?? 300);
        $phpPost = var_export($config['php']['post_max_size'] ?? '2048M', true);
        $phpUpload = var_export($config['php']['upload_max_filesize'] ?? '2048M', true);

        $env = var_export($config['env'] ?? 'production', true);

        $content = <<<PHP
<?php

declare(strict_types=1);

/**
 * Configuración de Project Cloud — administrable desde el panel.
 */

return [
    'db' => [
        'host'    => {$dbHost},
        'port'    => {$dbPort},
        'name'    => {$dbName},
        'user'    => {$dbUser},
        'pass'    => {$dbPass},
        'charset' => {$dbCharset},
    ],
    'jwt' => [
        'secret'      => {$jwtSecret},
        'access_ttl'  => {$jwtAccessTtl},
        'refresh_ttl' => {$jwtRefreshTtl},
        'issuer'      => {$jwtIssuer},
    ],
    'storage' => [
        'path'       => {$storagePathExpr},
        'public_url' => {$storageUrl},
        'chunk_size' => {$storageChunkSize},
    ],
    'php' => [
        'memory_limit'        => {$phpMem},
        'max_execution_time'  => {$phpExec},
        'max_input_time'      => {$phpInput},
        'post_max_size'       => {$phpPost},
        'upload_max_filesize' => {$phpUpload},
    ],
    'env' => {$env},
];
PHP;

        @file_put_contents($path, $content, LOCK_EX);
        @chmod($path, 0640);
        Config::load($path);
    }

    private static function iniGet(string $key, mixed $default): mixed
    {
        $val = ini_get($key);
        return ($val !== false && $val !== '') ? $val : $default;
    }
}

