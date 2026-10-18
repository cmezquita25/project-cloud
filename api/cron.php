<?php

declare(strict_types=1);

/**
 * Cron del servidor. Se programa cada minuto en el panel del hosting:
 *
 *   Plesk  → Tareas programadas → «Ejecutar un script PHP» → httpdocs/api/cron.php
 *   cPanel → Trabajos de Cron   → php /home/<usuario>/public_html/api/cron.php
 *   VPS    → crontab -e         → * * * * * php /ruta/api/cron.php >/dev/null 2>&1
 *
 * Por HTTP (servicios externos) se usa /api/v1/system/cron?token=… — esta ruta
 * normalmente no es accesible por web (el .htaccess raíz manda /api/* al router),
 * pero si el servidor la sirviera, se exige el mismo token.
 */

$isConfigured = require __DIR__ . '/bootstrap.php';

use ProjectCloud\Services\CronService;

$isCli = PHP_SAPI === 'cli';

if (!$isConfigured) {
    if ($isCli) {
        fwrite(STDERR, "[CRON] La plataforma aún no está instalada.\n");
        exit(1);
    }
    http_response_code(503);
    exit;
}

try {
    $cron = new CronService();

    if (!$isCli) {
        $token = (string) ($_GET['token'] ?? ($_SERVER['HTTP_X_CRON_TOKEN'] ?? ''));
        if (!$cron->isValidSecret($token)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Acceso denegado: token de cron inválido']);
            exit;
        }
    }

    $result = $cron->run($isCli ? 'cli' : 'http');

    if ($isCli) {
        $ran = implode(', ', array_keys($result['tasks']));
        $summary = isset($result['skipped']) ? 'omitido: ' . $result['skipped'] : ($ran !== '' ? $ran : 'sin tareas pendientes');
        echo '[CRON ' . ($result['ok'] ? 'OK' : 'CON ERRORES') . '] ' . gmdate('Y-m-d H:i:s') . " UTC - {$summary}\n";
        exit($result['ok'] ? 0 : 1);
    }

    header('Content-Type: application/json');
    echo json_encode($result);
} catch (\Throwable $e) {
    if ($isCli) {
        fwrite(STDERR, '[CRON ERROR] ' . $e->getMessage() . "\n");
        exit(1);
    }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Error interno del cron']);
    error_log('[ProjectCloud][cron] ' . $e->getMessage());
}
