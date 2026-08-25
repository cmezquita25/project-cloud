<?php

declare(strict_types=1);

/**
 * Script ejecutable del Cron del Servidor.
 * Puede ser programado en cPanel / Plesk cada 60s:
 * * * * * * php /ruta/absoluta/api/cron.php >/dev/null 2>&1
 */

require_once __DIR__ . '/bootstrap.php';

use ProjectCloud\Services\CronService;
use ProjectCloud\Repositories\SettingsRepository;

// Si se invoca por HTTP web, validar token secreto de cron
if (php_sapi_name() !== 'cli') {
    $settings = new SettingsRepository();
    $cronSecret = $settings->get('cron_secret');
    if (!$cronSecret) {
        $cronSecret = bin2hex(random_bytes(16));
        $settings->set('cron_secret', $cronSecret);
    }

    $token = $_GET['token'] ?? ($_SERVER['HTTP_X_CRON_TOKEN'] ?? '');
    if ($token !== $cronSecret) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Acceso denegado: Token de cron inválido']);
        exit;
    }
}

try {
    $cron = new CronService();
    $result = $cron->run();

    if (php_sapi_name() === 'cli') {
        echo "[CRON OK] " . date('Y-m-d H:i:s') . " - " . json_encode($result['tasks']) . "\n";
    } else {
        header('Content-Type: application/json');
        echo json_encode($result);
    }
} catch (\Throwable $e) {
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "[CRON ERROR] " . $e->getMessage() . "\n");
        exit(1);
    } else {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => $e->getMessage()]);
    }
}

