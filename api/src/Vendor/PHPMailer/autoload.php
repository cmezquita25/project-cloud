<?php

declare(strict_types=1);

/**
 * Autoloader mínimo para PHPMailer vendorizado (sin Composer).
 * Mapea el namespace PHPMailer\PHPMailer\ a este directorio.
 */
spl_autoload_register(static function (string $class): void {
    $prefix = 'PHPMailer\\PHPMailer\\';
    $len = strlen($prefix);
    if (strncmp($class, $prefix, $len) !== 0) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, $len)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
