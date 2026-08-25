<?php

declare(strict_types=1);

/**
 * Bootstrap de la API — autoloader (sin Composer), carga de configuración
 * y ajustes base del entorno. Lo incluye el front controller (public/index.php).
 */

// --- Autoloader PSR-4 minimalista: ProjectCloud\Sub\Clase -> src/Sub/Clase.php ---
spl_autoload_register(static function (string $class): void {
    $prefix = 'ProjectCloud\\';
    $len = strlen($prefix);
    if (strncmp($class, $prefix, $len) !== 0) {
        return;
    }
    $relative = substr($class, $len);
    $file = __DIR__ . '/src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

use ProjectCloud\Core\Config;

// --- Carga de configuración (si el sitio ya está configurado) ---
$configFile = __DIR__ . '/config/config.php';
$isConfigured = is_file($configFile);
if ($isConfigured) {
    Config::load($configFile);
}

// --- Ajustes de entorno y ejecutor PHP ---
date_default_timezone_set('UTC');

if (Config::isLoaded()) {
    $phpMem = Config::get('php.memory_limit');
    if ($phpMem) {
        @ini_set('memory_limit', (string) $phpMem);
    }
    $phpExec = Config::get('php.max_execution_time');
    if ($phpExec !== null) {
        @set_time_limit((int) $phpExec);
        @ini_set('max_execution_time', (string) $phpExec);
    }
    $phpInput = Config::get('php.max_input_time');
    if ($phpInput !== null) {
        @ini_set('max_input_time', (string) $phpInput);
    }
}

$isDev = Config::get('env', 'production') === 'development';

// En producción no mostramos errores al cliente (se registran, no se imprimen).
error_reporting(E_ALL);
ini_set('display_errors', $isDev ? '1' : '0');
ini_set('log_errors', '1');

// Deja disponible el flag de "configurado" para el front controller.
return $isConfigured;
