<?php

declare(strict_types=1);

namespace ProjectCloud\Installer;

use PDO;
use PDOException;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Password;
use ProjectCloud\Services\FileSystemService;

/**
 * Lógica del instalador (Fase 2): chequeo de requisitos, prueba de conexión,
 * generación de config.php, ejecución del esquema y creación del primer admin.
 */
final class Installer
{
    public function __construct(
        private readonly string $apiRoot,       // .../api
        private readonly string $configPath,    // .../api/config/config.php
        private readonly string $lockPath,      // .../api/config/install.lock
        private readonly string $schemaPath,    // .../database/schema.sql
        private readonly string $storageDir,    // .../storage
    ) {
    }

    public function isInstalled(): bool
    {
        return is_file($this->lockPath);
    }

    /** Impide operar el instalador si ya se completó. */
    public function assertNotInstalled(): void
    {
        if ($this->isInstalled()) {
            throw new HttpException(403, 'ALREADY_INSTALLED', 'La aplicación ya está instalada.');
        }
    }

    // --- Paso 1: requisitos ---

    /**
     * @return array{requirements:list<array{key:string,label:string,current:string,ok:bool,critical:bool}>,can_proceed:bool}
     */
    public function checkRequirements(): array
    {
        $reqs = [];

        $phpOk = version_compare(PHP_VERSION, '8.1.0', '>=');
        $reqs[] = $this->req('php', 'PHP ≥ 8.1', PHP_VERSION, $phpOk, true);

        foreach (['pdo_mysql', 'fileinfo', 'mbstring', 'json', 'openssl'] as $ext) {
            $loaded = extension_loaded($ext);
            $reqs[] = $this->req("ext_$ext", "Extensión $ext", $loaded ? 'activa' : 'ausente', $loaded, true);
        }

        $configDir = dirname($this->configPath);
        $configWritable = is_dir($configDir) && is_writable($configDir);
        $reqs[] = $this->req('config_writable', 'Carpeta config/ escribible', $configWritable ? 'sí' : 'no', $configWritable, true);

        $storageWritable = $this->isStorageWritable();
        $reqs[] = $this->req('storage_writable', 'Carpeta storage/ escribible', $storageWritable ? 'sí' : 'no', $storageWritable, true);

        $canProceed = true;
        foreach ($reqs as $r) {
            if ($r['critical'] && !$r['ok']) {
                $canProceed = false;
            }
        }

        return ['requirements' => $reqs, 'can_proceed' => $canProceed];
    }

    private function isStorageWritable(): bool
    {
        if (is_dir($this->storageDir)) {
            return is_writable($this->storageDir);
        }
        // Si no existe, comprobamos que el directorio padre permita crearla.
        $parent = dirname($this->storageDir);
        return is_dir($parent) && is_writable($parent);
    }

    /** @return array{key:string,label:string,current:string,ok:bool,critical:bool} */
    private function req(string $key, string $label, string $current, bool $ok, bool $critical): array
    {
        return compact('key', 'label', 'current', 'ok', 'critical');
    }

    // --- Paso 2: base de datos ---

    /**
     * Prueba la conexión, ejecuta el esquema y escribe config.php.
     *
     * @param array{host:string,port:int,name:string,user:string,pass:string} $db
     */
    public function setupDatabase(array $db, string $publicUrl): void
    {
        $this->assertNotInstalled();

        $dbName = $db['name'];
        if (!preg_match('/^[A-Za-z0-9_]+$/', $dbName)) {
            throw new HttpException(422, 'DB_INVALID_NAME', 'Nombre de base de datos inválido.');
        }

        // Conecta a la base (compatible con Plesk: la base ya existe y el usuario
        // solo tiene permisos sobre ella). Como respaldo, intenta crearla si no
        // existe y el usuario tiene privilegios (típico en VPS).
        $pdo = $this->connectOrCreate($db, $dbName);

        // Ejecuta el esquema (idempotente).
        $this->runMigrations($pdo);

        // Genera y escribe config.php con un secreto JWT nuevo.
        $secret = bin2hex(random_bytes(64));
        $this->writeConfig($db, $secret, $publicUrl);

        // Provisiona carpeta storage/ y su hardening.
        $this->provisionStorage();
    }

    /**
     * @param array{host:string,port:int,name:string,user:string,pass:string} $db
     */
    private function connectOrCreate(array $db, string $dbName): PDO
    {
        // 1) Intento directo a la base indicada.
        try {
            return Database::connect($db['host'], $db['port'], $dbName, $db['user'], $db['pass']);
        } catch (PDOException $e) {
            $msg = $e->getMessage();
            $unknownDb = str_contains($msg, '1049') || stripos($msg, 'Unknown database') !== false;
            if (!$unknownDb) {
                // 1045 (auth) u otro: credenciales/host incorrectos o base inaccesible.
                throw new HttpException(
                    422,
                    'DB_CONNECTION_FAILED',
                    'No se pudo conectar: ' . $this->cleanPdoMessage($e)
                    . ' — Revisa usuario y contraseña, y crea la base "' . $dbName
                    . '" en tu panel (Plesk → Bases de datos) con un usuario asociado.'
                );
            }
        }

        // 2) La base no existe: conectar sin base e intentar crearla (VPS).
        try {
            $pdo = Database::connect($db['host'], $db['port'], '', $db['user'], $db['pass']);
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("USE `$dbName`");
            return $pdo;
        } catch (PDOException $e) {
            throw new HttpException(
                422,
                'DB_CREATE_FAILED',
                'La base "' . $dbName . '" no existe y el usuario no puede crearla. '
                . 'Créala en tu panel (Plesk → Bases de datos) y reintenta. Detalle: '
                . $this->cleanPdoMessage($e)
            );
        }
    }

    private function runMigrations(PDO $pdo): void
    {
        $sql = file_get_contents($this->schemaPath);
        if ($sql === false) {
            throw new HttpException(500, 'SCHEMA_MISSING', 'No se encontró el esquema de la base de datos.');
        }
        // Normaliza saltos de línea.
        $sql = str_replace(["\r\n", "\r"], "\n", $sql);
        // Elimina TODOS los comentarios "--" (completos e inline), hasta el fin
        // de línea. Es imprescindible antes de dividir por ';', porque un ';'
        // dentro de un comentario cortaría la sentencia (bug 1064 "near ''").
        $sql = preg_replace('/--[^\n]*/', '', $sql) ?? $sql;
        foreach (explode(';', $sql) as $statement) {
            $statement = trim($statement);
            if ($statement !== '') {
                $pdo->exec($statement);
            }
        }
    }

    /**
     * @param array{host:string,port:int,name:string,user:string,pass:string} $db
     */
    private function writeConfig(array $db, string $jwtSecret, string $publicUrl): void
    {
        $host = var_export($db['host'], true);
        $port = (int) $db['port'];
        $name = var_export($db['name'], true);
        $user = var_export($db['user'], true);
        $pass = var_export($db['pass'], true);
        $secret = var_export($jwtSecret, true);
        $url = var_export($publicUrl, true);

        $content = <<<PHP
        <?php

        declare(strict_types=1);

        /**
         * Configuración de Project Cloud — generada por el instalador.
         * Contiene credenciales y el secreto JWT. NO versionar (está en .gitignore).
         */

        return [
            'db' => [
                'host'    => $host,
                'port'    => $port,
                'name'    => $name,
                'user'    => $user,
                'pass'    => $pass,
                'charset' => 'utf8mb4',
            ],
            'jwt' => [
                'secret'      => $secret,
                'access_ttl'  => 900,
                'refresh_ttl' => 2592000,
                'issuer'      => 'project-cloud',
            ],
            'storage' => [
                'path'       => __DIR__ . '/../../storage',
                'public_url' => $url,
                'chunk_size' => 4 * 1024 * 1024,
            ],
            'env' => 'production',
        ];

        PHP;

        // Alinea el heredoc indentado a columna 0.
        $content = implode("\n", array_map(static fn (string $l): string => ltrim($l, ' '), explode("\n", $content)));

        if (file_put_contents($this->configPath, $content, LOCK_EX) === false) {
            throw new HttpException(500, 'CONFIG_WRITE_FAILED', 'No se pudo escribir config.php');
        }
        @chmod($this->configPath, 0640);
    }

    private function provisionStorage(): void
    {
        if (!is_dir($this->storageDir) && !@mkdir($this->storageDir, 0775, true) && !is_dir($this->storageDir)) {
            throw new HttpException(500, 'STORAGE_FAILED', 'No se pudo crear la carpeta storage/.');
        }
        // Copia la plantilla de hardening (.htaccess que desactiva PHP en /storage).
        $template = $this->apiRoot . '/storage.htaccess.dist';
        $target = $this->storageDir . '/.htaccess';
        if (is_file($template) && !is_file($target)) {
            @copy($template, $target);
        }
    }

    // --- Paso 3: primer administrador ---

    /**
     * Crea la cuenta admin, provisiona su carpeta y bloquea el instalador.
     *
     * @param array{username:string,email:string,display_name:string,password:string} $data
     * @return array{id:int,username:string}
     */
    public function createAdmin(array $data): array
    {
        $this->assertNotInstalled();

        $pdo = Database::pdo(); // usa el config.php recién escrito
        $username = $this->slugify($data['username']);
        if ($username === '') {
            throw new HttpException(422, 'INVALID_USERNAME', 'El nombre de usuario no es válido.');
        }

        // Evita duplicados.
        $exists = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username = ? OR email = ?');
        $exists->execute([$username, $data['email']]);
        if ((int) $exists->fetchColumn() > 0) {
            throw new HttpException(409, 'USER_EXISTS', 'Ya existe un usuario con ese nombre o correo.');
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users (username, email, password_hash, display_name, role, quota_bytes, max_upload_bytes)
             VALUES (?, ?, ?, ?, "admin", ?, ?)'
        );
        $stmt->execute([
            $username,
            $data['email'],
            Password::hash($data['password']),
            $data['display_name'],
            100 * 1024 ** 3, // 100 GB para el admin
            10 * 1024 ** 3,  // 10 GB por archivo
        ]);
        $id = (int) $pdo->lastInsertId();

        // Provisiona la carpeta de almacenamiento del admin.
        (new FileSystemService($this->storageDir))->provisionUser($username);

        // Bloquea el instalador.
        $this->lock($username);

        return ['id' => $id, 'username' => $username];
    }

    private function lock(string $adminUsername): void
    {
        $payload = json_encode([
            'installed_at' => gmdate('c'),
            'admin'        => $adminUsername,
            'version'      => 1,
        ], JSON_PRETTY_PRINT);
        file_put_contents($this->lockPath, $payload, LOCK_EX);
    }

    /** Convierte un nombre a slug apto para /storage/{username}. */
    private function slugify(string $value): string
    {
        $value = strtolower(trim($value));
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        return trim($value, '-');
    }

    private function cleanPdoMessage(PDOException $e): string
    {
        // Evita filtrar rutas/credenciales; deja solo un mensaje breve.
        $msg = $e->getMessage();
        return mb_substr(preg_replace('/\s+/', ' ', $msg) ?? 'error', 0, 160);
    }
}
