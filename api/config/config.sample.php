<?php

declare(strict_types=1);

/**
 * Plantilla de configuración. NO editar a mano en producción:
 * el instalador (Fase 2) genera `config.php` con estos valores y un JWT secret
 * aleatorio, y luego crea `install.lock` para bloquear el asistente.
 */

return [
    // Base de datos (MySQL de Plesk).
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'project_cloud',
        'user' => '',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],

    // JWT — el instalador reemplaza el secret por 64 bytes aleatorios.
    'jwt' => [
        'secret' => 'CHANGE_ME',
        'access_ttl' => 900,       // 15 minutos
        'refresh_ttl' => 2592000,  // 30 días
        'issuer' => 'project-cloud',
    ],

    // Almacenamiento.
    'storage' => [
        // Ruta absoluta a la carpeta pública de archivos (espeja el árbol virtual).
        'path' => __DIR__ . '/../../storage',
        // URL base pública para construir enlaces directos.
        'public_url' => 'https://drive.techmaleon.mx/storage',
        // Tamaño de chunk para subidas grandes (bytes).
        'chunk_size' => 4 * 1024 * 1024, // 4 MB
    ],

    // Entorno: 'production' oculta detalles de error.
    'env' => 'production',
];
