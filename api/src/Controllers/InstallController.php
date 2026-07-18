<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Validator;
use ProjectCloud\Installer\Installer;

/**
 * Endpoints del instalador web (Fase 2). Se auto-bloquean una vez creado
 * install.lock: cualquier acción distinta de `status` responde 403.
 */
final class InstallController
{
    private function installer(): Installer
    {
        $apiRoot = dirname(__DIR__, 2); // .../api
        $configPath = $apiRoot . '/config/config.php';
        $lockPath = $apiRoot . '/config/install.lock';
        $storageDir = dirname($apiRoot) . '/storage';

        return new Installer(
            $apiRoot,
            $configPath,
            $lockPath,
            $this->resolveSchemaPath($apiRoot),
            $storageDir,
        );
    }

    /** El esquema viaja empaquetado en api/database/ (también acepta ubicaciones antiguas). */
    private function resolveSchemaPath(string $apiRoot): string
    {
        $candidates = [
            $apiRoot . '/database/schema.sql',       // empaquetado con la API (recomendado)
            dirname($apiRoot) . '/database/schema.sql', // carpeta database/ en la raíz (legado)
            $apiRoot . '/schema.sql',
        ];
        foreach ($candidates as $path) {
            if (is_file($path)) {
                return $path;
            }
        }
        return $candidates[0]; // el instalador reportará el error si no existe
    }

    /** GET /install/status — estado de instalación (público). */
    public function status(Request $request): Response
    {
        // No devolvemos datos de configuración previos: el asistente siempre
        // parte de campos vacíos (portable a cualquier hosting).
        return Response::success([
            'installed'  => $this->installer()->isInstalled(),
            'configured' => Config::isLoaded(),
        ]);
    }

    /** GET /install/check — verificación de requisitos del servidor. */
    public function check(Request $request): Response
    {
        $installer = $this->installer();
        $installer->assertNotInstalled();
        return Response::success($installer->checkRequirements());
    }

    /** POST /install/database — prueba conexión, crea BD/tablas y escribe config. */
    public function database(Request $request): Response
    {
        $installer = $this->installer();
        $installer->assertNotInstalled();

        $data = (new Validator($request->json()))
            ->required('host')
            ->required('name')
            ->required('user')
            ->validate();

        $installer->setupDatabase(
            [
                'host' => (string) $data['host'],
                'port' => (int) ($data['port'] ?? 3306),
                'name' => (string) $data['name'],
                'user' => (string) $data['user'],
                'pass' => (string) ($data['pass'] ?? ''),
            ],
            $this->publicStorageUrl(),
        );

        return Response::success(['ok' => true]);
    }

    /** POST /install/admin — crea el primer administrador y bloquea el instalador. */
    public function admin(Request $request): Response
    {
        $installer = $this->installer();
        $installer->assertNotInstalled();

        // Requiere que la BD ya esté configurada (paso previo).
        if (!Config::isLoaded()) {
            throw HttpException::badRequest('Configura la base de datos antes de crear el administrador.', 'DB_NOT_CONFIGURED');
        }

        $data = (new Validator($request->json()))
            ->required('username')->minLength('username', 3)->maxLength('username', 64)
            ->matches('username', '/^[A-Za-z0-9._-]+$/', 'Solo letras, números, punto, guion y guion bajo')
            ->required('email')->email('email')
            ->required('display_name')->maxLength('display_name', 120)
            ->required('password')->minLength('password', 8)
            ->validate();

        $result = $installer->createAdmin([
            'username'     => (string) $data['username'],
            'email'        => (string) $data['email'],
            'display_name' => (string) $data['display_name'],
            'password'     => (string) $data['password'],
        ]);

        return Response::created(['ok' => true, 'username' => $result['username']]);
    }

    /** Deriva la URL pública de /storage desde el host actual (siempre HTTPS). */
    private function publicStorageUrl(): string
    {
        $host = (string) ($_SERVER['HTTP_HOST'] ?? 'drive.techmaleon.mx');
        $host = preg_replace('/:\d+$/', '', $host) ?? $host; // quita puerto
        return "https://$host/storage";
    }
}
