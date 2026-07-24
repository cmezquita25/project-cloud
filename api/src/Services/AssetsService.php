<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Unidad compartida "assets" (Fase 8, punto 6).
 *
 * Es la carpeta pública que ya vive en el hosting (hermana de /storage, servida
 * en https://host/assets). NO está en la BD: se navega directamente del sistema
 * de archivos. Solo el admin y los usuarios autorizados pueden verla e
 * interactuar con ella. Nada queda fijado a un dominio: la ruta y la URL se
 * derivan de la configuración de /storage, así que es portable.
 */
final class AssetsService
{
    private const ALLOWED_KEY = 'assets_allowed_users';

    private readonly string $root;
    private readonly string $publicBase;
    private readonly FileSystemService $fs;
    private readonly SettingsRepository $settings;
    private readonly \PDO $pdo;

    public function __construct(
        ?string $root = null,
        ?string $publicBase = null,
        ?FileSystemService $fs = null,
        ?SettingsRepository $settings = null,
        ?\PDO $pdo = null
    ) {
        $this->fs = $fs ?? new FileSystemService();
        $this->settings = $settings ?? new SettingsRepository();
        $this->pdo = $pdo ?? Database::pdo();
        
        $storage = rtrim((string) Config::get('storage.path', ''), "/\\");
        $folderName = $this->settings->get('assets_folder_name', 'assets');
        if (empty($folderName)) $folderName = 'assets';
        
        $this->root = rtrim($root ?? (dirname($storage) . DIRECTORY_SEPARATOR . $folderName), "/\\");
        $this->publicBase = rtrim($publicBase ?? $this->derivePublicBase($folderName), '/');
    }

    /** URL pública de /assets derivada de la de /storage (sin hardcodear el dominio). */
    private function derivePublicBase(string $folderName): string
    {
        $url = rtrim((string) Config::get('storage.public_url', ''), '/');
        if ($url === '') {
            return '/' . $folderName;
        }
        if (preg_match('#/storage/?$#', $url) === 1) {
            return (string) preg_replace('#/storage/?$#', '/' . $folderName, $url);
        }
        return $url . '/../' . $folderName;
    }

    public function getFolderName(): string
    {
        $name = $this->settings->get('assets_folder_name', 'assets');
        return empty($name) ? 'assets' : $name;
    }

    public function isActive(): bool
    {
        return is_dir($this->root);
    }

    public function createRoot(): void
    {
        if (!$this->isActive()) {
            if (!@mkdir($this->root, 0775, true) && !is_dir($this->root)) {
                throw new HttpException(500, 'DIR_FAILED', 'No se pudo crear la unidad compartida.');
            }
        }
    }

    // --- Permisos ---

    /** @return array<int,int> IDs de usuario con acceso concedido. */
    public function allowedUserIds(): array
    {
        $raw = $this->settings->get(self::ALLOWED_KEY, '[]') ?? '[]';
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? array_values(array_map('intval', $decoded)) : [];
    }

    public function setAllowedUserIds(array $ids): void
    {
        $clean = array_values(array_unique(array_map('intval', $ids)));
        $this->settings->set(self::ALLOWED_KEY, (string) json_encode($clean));
    }

    /** El admin siempre puede; el resto, solo si está en la lista de permitidos. */
    public function canAccess(int $userId, string $role): bool
    {
        return $role === 'admin' || in_array($userId, $this->allowedUserIds(), true);
    }

    public function assertAccess(int $userId, string $role): void
    {
        if (!$this->canAccess($userId, $role)) {
            throw HttpException::forbidden('No tienes acceso a la carpeta compartida.', 'ASSETS_FORBIDDEN');
        }
    }

    // --- Navegación ---

    /** Ruta absoluta segura dentro de la raíz de assets (anti path traversal). */
    private function safe(string $relative): string
    {
        $this->assertActive();
        return $this->fs->safeJoin($this->root, $relative);
    }
    
    private function assertActive(): void
    {
        if (!$this->isActive()) {
            throw HttpException::notFound('La unidad compartida no está activada o la carpeta no existe.');
        }
    }

    private function getBlockedActions(string $relative): array
    {
        $stmt = $this->pdo->prepare("SELECT blocked_actions FROM assets_metadata WHERE path = ?");
        $stmt->execute([$relative]);
        $val = (string) $stmt->fetchColumn();
        return $val !== '' ? array_map('trim', explode(',', strtolower($val))) : [];
    }

    private function assertActionAllowed(string $relative, string $action, string $role): void
    {
        if ($role === 'admin') {
            return; // Admins are exempt
        }
        $blocked = $this->getBlockedActions($relative);
        if (in_array(strtolower($action), $blocked, true)) {
            throw HttpException::forbidden("La acción '$action' está bloqueada para este elemento.");
        }
    }

    public function publicUrl(string $relative): string
    {
        $encoded = implode('/', array_map('rawurlencode', explode('/', $relative)));
        return $this->publicBase . '/' . $encoded;
    }

    /**
     * Lista el contenido de una carpeta de assets.
     *
     * @return array{path:string,breadcrumbs:list<array{name:string,path:string}>,folders:list<array<string,mixed>>,files:list<array<string,mixed>>}
     */
    /** Ruta absoluta (validada contra traversal) de un archivo de assets. */
    public function absoluteFile(string $relative): string
    {
        $abs = $this->safe($relative);
        if (!is_file($abs)) {
            throw HttpException::notFound('Archivo no encontrado en assets.');
        }
        return $abs;
    }

    private function matchType(string $type, bool $isDir, string $ext, string $mime): bool {
        if ($type === '') return true;
        if ($type === 'folder') return $isDir;
        if ($isDir) return false;
        if ($type === 'document') return in_array($ext, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv']);
        if ($type === 'image') return str_starts_with($mime, 'image/');
        if ($type === 'video') return str_starts_with($mime, 'video/');
        if ($type === 'audio') return str_starts_with($mime, 'audio/');
        if ($type === 'archive') return in_array($ext, ['zip', 'rar', '7z', 'tar', 'gz']);
        return true;
    }
    
    private function matchDate(string $date, int $mtime): bool {
        if ($date === '') return true;
        $now = time();
        if ($date === 'today') return $mtime >= strtotime('today');
        if ($date === '7days') return $mtime >= ($now - 7 * 86400);
        if ($date === '30days') return $mtime >= ($now - 30 * 86400);
        return true;
    }

    public function list(string $relative, string $role = 'user', string $sort = 'name', string $order = 'asc', int $limit = 0, int $offset = 0, ?string $query = null, string $type = '', string $date = ''): array
    {
        $abs = $this->safe($relative);
        if (!is_dir($abs)) {
            throw HttpException::notFound('Carpeta no encontrada en assets.');
        }

        $allFolders = [];
        $allFiles = [];

        if ((is_string($query) && $query !== '') || $type !== '' || $date !== '') {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($abs, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );
            $q = mb_strtolower((string) $query);
            foreach ($iterator as $file) {
                $name = $file->getFilename();
                if ($name[0] === '.') {
                    if ($name === '.trash' && $role === 'admin') {
                        // permitimos que el indexador entre a la papelera para buscar
                    } else {
                        continue;
                    }
                }
                
                if ($q !== '' && !str_contains(mb_strtolower($name), $q)) continue;
                
                $isDir = $file->isDir();
                $ext = strtolower($file->getExtension());
                $path = $file->getPathname();
                
                if ($type !== '' || $date !== '') {
                    $mime = '';
                    if (!$isDir && in_array($type, ['image', 'video', 'audio'])) {
                        $mime = @mime_content_type($path) ?: '';
                    }
                    if (!$this->matchType($type, $isDir, $ext, $mime)) continue;
                    if (!$this->matchDate($date, $file->getMTime())) continue;
                }

                $subPath = $iterator->getSubPathname();
                $childRel = ltrim($relative . '/' . str_replace('\\', '/', $subPath), '/');
                if ($isDir) {
                    $allFolders[] = ['type' => 'folder', 'name' => $name, 'path' => $childRel, 'abs' => $path];
                } else {
                    $allFiles[] = ['type' => 'file', 'name' => $name, 'path' => $childRel, 'abs' => $path, 'extension' => $ext !== '' ? $ext : null];
                }
            }
        } else {
            foreach (scandir($abs) ?: [] as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue; 
                }
                if ($entry[0] === '.') {
                    // Ocultar todas las carpetas que empiecen con . EXCEPTO .trash si es admin
                    if ($entry === '.trash' && $relative === '' && $role === 'admin') {
                        // Dejamos pasar .trash en la raíz para admins
                    } else {
                        continue;
                    }
                }
                $childRel = ltrim($relative . '/' . $entry, '/');
                $path = $abs . DIRECTORY_SEPARATOR . $entry;
                if (is_dir($path)) {
                    $allFolders[] = ['type' => 'folder', 'name' => $entry, 'path' => $childRel, 'abs' => $path];
                } else {
                    $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
                    $allFiles[] = ['type' => 'file', 'name' => $entry, 'path' => $childRel, 'abs' => $path, 'extension' => $ext !== '' ? $ext : null];
                }
            }
        }

        $cmp = static function ($a, $b) use ($sort, $order) {
            $r = 0;
            switch ($sort) {
                case 'updated_at':
                case 'created_at':
                    $r = filemtime($a['abs']) - filemtime($b['abs']);
                    break;
                case 'size_bytes':
                    $sA = isset($a['extension']) ? filesize($a['abs']) : 0;
                    $sB = isset($b['extension']) ? filesize($b['abs']) : 0;
                    $r = $sA - $sB;
                    break;
                case 'name':
                case 'owner':
                default:
                    $r = strcasecmp((string)$a['name'], (string)$b['name']);
                    break;
            }
            if ($r === 0) {
                $r = strcasecmp((string)$a['name'], (string)$b['name']);
            }
            return strtolower($order) === 'desc' ? -$r : $r;
        };

        usort($allFolders, $cmp);
        usort($allFiles, $cmp);

        $totalFolders = count($allFolders);
        $totalFiles = count($allFiles);
        $hasMore = false;
        
        $folders = [];
        $files = [];

        if ($limit > 0) {
            $remainingLimit = $limit;
            if ($offset < $totalFolders) {
                $folders = array_slice($allFolders, $offset, $remainingLimit);
                $remainingLimit -= count($folders);
                $filesOffset = 0;
            } else {
                $filesOffset = $offset - $totalFolders;
            }
            
            if ($remainingLimit > 0 && $filesOffset < $totalFiles) {
                $files = array_slice($allFiles, $filesOffset, $remainingLimit);
            }
            
            $hasMore = ($offset + $limit) < ($totalFolders + $totalFiles);
        } else {
            $folders = $allFolders;
            $files = $allFiles;
        }

        // Obtener dueños desde la base de datos
        $paths = [];
        foreach ($folders as $f) $paths[] = $f['path'];
        foreach ($files as $f) $paths[] = $f['path'];
        
        $owners = [];
        if (!empty($paths)) {
            $in = str_repeat('?,', count($paths) - 1) . '?';
            $stmt = $this->pdo->prepare("
                SELECT m.path, m.blocked_actions, u.id as user_id, u.username, u.display_name 
                FROM assets_metadata m 
                LEFT JOIN users u ON m.user_id = u.id 
                WHERE m.path IN ($in)
            ");
            $stmt->execute($paths);
            foreach ($stmt->fetchAll() as $row) {
                if ($row['user_id']) {
                    $owners[$row['path']] = [
                        'username' => $row['username'],
                        'display_name' => $row['display_name'],
                        'avatar_url' => \ProjectCloud\Services\AvatarService::urlFor((int) $row['user_id']),
                    ];
                }
                $blocked[$row['path']] = $row['blocked_actions'] !== null ? array_map('trim', explode(',', strtolower($row['blocked_actions']))) : [];
            }
        }
        
        // --- Obtener participantes para carpetas ---
        $folderParticipants = [];
        $folderPaths = array_column($folders, 'path');
        if (!empty($folderPaths)) {
            $likes = [];
            $params = [];
            foreach ($folderPaths as $p) {
                $likes[] = "m.path LIKE ?";
                $params[] = $p . '/%';
                $folderParticipants[$p] = []; // initialize
            }
            $whereLikes = implode(' OR ', $likes);
            $stmt = $this->pdo->prepare("
                SELECT m.path, u.id as user_id, u.username, u.display_name 
                FROM assets_metadata m 
                JOIN users u ON m.user_id = u.id 
                WHERE ($whereLikes)
            ");
            $stmt->execute($params);
            
            // Map paths back to their parent folder to group users
            foreach ($stmt->fetchAll() as $row) {
                foreach ($folderPaths as $folderPath) {
                    if (str_starts_with($row['path'], $folderPath . '/')) {
                        // Use user_id as key to ensure uniqueness
                        $folderParticipants[$folderPath][$row['user_id']] = [
                            'username' => $row['username'],
                            'display_name' => $row['display_name'],
                            'avatar_url' => \ProjectCloud\Services\AvatarService::urlFor((int) $row['user_id']),
                        ];
                        break; // A path only matches one direct folder in this level
                    }
                }
            }
        }

        $enrichedFiles = [];
        foreach ($files as $f) {
            $enrichedFiles[] = [
                'type'       => 'file',
                'name'       => $f['name'],
                'path'       => $f['path'],
                'size_bytes' => (int) @filesize($f['abs']),
                'mime_type'  => $this->detectMime($f['abs']),
                'extension'  => $f['extension'],
                'url'        => $this->publicUrl($f['path']),
                'owners'     => isset($owners[$f['path']]) ? [$owners[$f['path']]] : [[
                    'username' => 'system',
                    'display_name' => 'Sistema',
                    'avatar_url' => null,
                ]],
                'blocked_actions' => $blocked[$f['path']] ?? [],
            ];
        }
        
        $enrichedFolders = [];
        foreach ($folders as $f) {
             $fOwners = [];
             // Agregar el creador original si existe
             if (isset($owners[$f['path']])) {
                 $fOwners[$owners[$f['path']]['username']] = $owners[$f['path']];
             } else {
                 $fOwners['system'] = [
                     'username' => 'system',
                     'display_name' => 'Sistema',
                     'avatar_url' => null,
                 ];
             }
             // Agregar participantes
             if (isset($folderParticipants[$f['path']])) {
                 foreach ($folderParticipants[$f['path']] as $participant) {
                     $fOwners[$participant['username']] = $participant;
                 }
             }
             
             $enrichedFolders[] = [
                 'type' => 'folder',
                 'name' => $f['name'],
                 'path' => $f['path'],
                 'owners' => array_values($fOwners),
                 'blocked_actions' => $blocked[$f['path']] ?? [],
             ];
        }

        return [
            'path'        => $relative,
            'breadcrumbs' => $this->breadcrumbs($relative),
            'folders'     => $enrichedFolders,
            'files'       => $enrichedFiles,
            'has_more'    => $hasMore,
        ];
    }

    /** @return list<array{name:string,path:string}> */
    private function breadcrumbs(string $relative): array
    {
        $crumbs = [];
        $acc = '';
        foreach (array_filter(explode('/', $relative), static fn ($s) => $s !== '') as $segment) {
            $acc = ltrim($acc . '/' . $segment, '/');
            $crumbs[] = ['name' => $segment, 'path' => $acc];
        }
        return $crumbs;
    }

    // --- Interacción (usuarios autorizados) ---

    public function createFolder(string $parentRelative, string $rawName, int $userId, string $role): array
    {
        if ($parentRelative !== '') {
            $this->assertActionAllowed($parentRelative, 'add', $role);
        }
        $name = $this->fs->sanitizeName($rawName);
        $rel = ltrim($parentRelative . '/' . $name, '/');
        $abs = $this->safe($rel);
        if (file_exists($abs)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un elemento con ese nombre.');
        }
        $this->fs->ensureDir($abs);
        
        $stmt = $this->pdo->prepare("INSERT INTO assets_metadata (path, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)");
        $stmt->execute([$rel, $userId]);

        return ['type' => 'folder', 'name' => $name, 'path' => $rel];
    }

    /**
     * Guarda un archivo subido (multipart) en una carpeta de assets.
     *
     * @param array{name:string,tmp_name:string,size:int,error:int} $file
     */
    public function storeUpload(string $parentRelative, array $file, int $userId, string $role): array
    {
        if ($parentRelative !== '') {
            $this->assertActionAllowed($parentRelative, 'add', $role);
        }
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw HttpException::badRequest('No se recibió el archivo o hubo un error.', 'UPLOAD_ERROR');
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            throw HttpException::badRequest('El archivo está vacío.', 'INVALID_SIZE');
        }

        // Validate Shared Drive Quota
        $settings = new \ProjectCloud\Repositories\SettingsRepository();
        $quota = (int) $settings->get('assets_quota_bytes');
        if ($quota > 0) {
            $stats = $this->getStorageStats();
            if ($stats['total_bytes'] + $size > $quota) {
                throw new HttpException(413, 'QUOTA_EXCEEDED', 'La unidad compartida no tiene espacio suficiente.', [
                    'quota_bytes' => $quota,
                    'used_bytes' => $stats['total_bytes']
                ]);
            }
        }

        $name = $this->fs->sanitizeName((string) ($file['name'] ?? ''));
        if ($this->fs->isBlockedExtension($name)) {
            throw new HttpException(422, 'BLOCKED_EXTENSION', 'Ese tipo de archivo no está permitido.');
        }
        $rel = ltrim($parentRelative . '/' . $name, '/');
        $abs = $this->safe($rel);
        if (file_exists($abs)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un archivo con ese nombre.');
        }
        $this->fs->ensureDir(dirname($abs));
        
        if (file_exists($abs)) {
            $this->assertActionAllowed($rel, 'modify', $role);
        }

        $tmp = (string) $file['tmp_name'];
        $moved = is_uploaded_file($tmp) ? @move_uploaded_file($tmp, $abs) : @rename($tmp, $abs);
        if (!$moved) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo guardar el archivo.');
        }
        @chmod($abs, 0644);

        $stmt = $this->pdo->prepare("INSERT INTO assets_metadata (path, user_id, size_bytes) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), size_bytes = VALUES(size_bytes)");
        $stmt->execute([$rel, $userId, $size]);

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        return [
            'type'       => 'file',
            'name'       => $name,
            'path'       => $rel,
            'size_bytes' => (int) @filesize($abs),
            'mime_type'  => $this->detectMime($abs),
            'extension'  => $ext !== '' ? $ext : null,
            'url'        => $this->publicUrl($rel),
        ];
    }

    /**
     * Mueve un archivo o carpeta de assets a otra carpeta (dentro de assets).
     * $targetFolder = '' es la raíz de assets.
     */
    public function move(string $relative, string $targetFolder, string $role): array
    {
        $src = trim($relative, '/');
        if ($src === '') {
            throw HttpException::badRequest('No se puede mover la raíz de assets.', 'INVALID_TARGET');
        }
        $this->assertActionAllowed($src, 'move', $role);
        $srcAbs = $this->safe($relative);
        if (!file_exists($srcAbs)) {
            throw HttpException::notFound('Elemento no encontrado en assets.');
        }

        $targetRel = trim($targetFolder, '/');
        if ($targetRel !== '') {
            $targetAbs = $this->safe($targetRel);
            if (!is_dir($targetAbs)) {
                throw new HttpException(422, 'INVALID_FOLDER', 'La carpeta destino no existe.');
            }
        }

        // No mover una carpeta dentro de sí misma o de un descendiente.
        if (is_dir($srcAbs) && ($targetRel === $src || str_starts_with($targetRel, $src . '/'))) {
            throw new HttpException(422, 'INVALID_MOVE', 'No puedes mover una carpeta dentro de sí misma.');
        }

        $name = basename($src);
        $destRel = ltrim($targetRel . '/' . $name, '/');
        if ($destRel === $src) {
            return ['type' => is_dir($srcAbs) ? 'folder' : 'file', 'name' => $name, 'path' => $src];
        }
        $destAbs = $this->safe($destRel);
        if (file_exists($destAbs)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un elemento con ese nombre en el destino.');
        }
        $this->fs->ensureDir(dirname($destAbs));
        if (!@rename($srcAbs, $destAbs)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo mover el elemento.');
        }

        // Actualizar metadatos (si es carpeta, habría que hacer LIKE 'path/%' pero el scope de assets_metadata aquí es simplificado)
        $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = ? WHERE path = ?");
        $stmt->execute([$destRel, $src]);
        
        if (is_dir($destAbs)) {
            // Actualizar paths de los hijos
            $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = CONCAT(?, SUBSTRING(path, ?)) WHERE path LIKE ?");
            $stmt->execute([$destRel, strlen($src) + 1, $src . '/%']);
        }

        return ['type' => is_dir($destAbs) ? 'folder' : 'file', 'name' => $name, 'path' => $destRel];
    }

    /** Renombra un archivo o carpeta en assets. */
    public function rename(string $relative, string $newName, string $role): array
    {
        $src = trim($relative, '/');
        if ($src === '') {
            throw HttpException::badRequest('No se puede renombrar la raíz de assets.', 'INVALID_TARGET');
        }
        $this->assertActionAllowed($src, 'modify', $role);
        
        $srcAbs = $this->safe($src);
        if (!file_exists($srcAbs)) {
            throw HttpException::notFound('Elemento no encontrado en assets.');
        }

        $newName = $this->fs->sanitizeName($newName);
        if ($newName === '') {
            throw HttpException::badRequest('El nombre no puede estar vacío.');
        }

        $dirRel = dirname($src);
        if ($dirRel === '.') $dirRel = '';
        
        $destRel = ltrim($dirRel . '/' . $newName, '/');
        if ($destRel === $src) {
            return ['type' => is_dir($srcAbs) ? 'folder' : 'file', 'name' => $newName, 'path' => $src];
        }

        $destAbs = $this->safe($destRel);
        if (file_exists($destAbs)) {
            throw new HttpException(409, 'NAME_EXISTS', 'Ya existe un elemento con ese nombre.');
        }

        if (!@rename($srcAbs, $destAbs)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo renombrar el elemento.');
        }

        $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = ? WHERE path = ?");
        $stmt->execute([$destRel, $src]);
        
        if (is_dir($destAbs)) {
            $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = CONCAT(?, SUBSTRING(path, ?)) WHERE path LIKE ?");
            $stmt->execute([$destRel, strlen($src) + 1, $src . '/%']);
        }

        return ['type' => is_dir($destAbs) ? 'folder' : 'file', 'name' => $newName, 'path' => $destRel];
    }

    /** Elimina un archivo o carpeta de assets. Lo mueve a .trash si no está ahí, o lo elimina definitivamente si ya está en .trash. */
    public function delete(string $relative, string $role, string $username = 'unknown'): void
    {
        $relative = trim($relative, '/');
        if ($relative === '' || $relative === '.trash') {
            throw HttpException::badRequest('No se puede eliminar este directorio.', 'INVALID_TARGET');
        }
        $this->assertActionAllowed($relative, 'delete', $role);
        $abs = $this->safe($relative);
        if (!file_exists($abs)) {
            throw HttpException::notFound('Elemento no encontrado en assets.');
        }

        // Si ya está en .trash, borrado definitivo (solo admins)
        if (str_starts_with($relative, '.trash/')) {
            if ($role !== 'admin') {
                throw HttpException::forbidden('Solo los administradores pueden purgar la papelera.');
            }
            $this->fs->delete($abs);
            $stmt = $this->pdo->prepare("DELETE FROM assets_metadata WHERE path = ? OR path LIKE ?");
            $stmt->execute([$relative, $relative . '/%']);
            return;
        }

        // Mover a .trash
        $trashRoot = $this->root . DIRECTORY_SEPARATOR . '.trash';
        $this->fs->ensureDir($trashRoot);
        
        $name = basename($relative);
        $originalPathDir = dirname($relative);
        if ($originalPathDir === '.') $originalPathDir = '';
        
        // Estructura: .trash/username/path/original/name
        $trashTargetDirRel = '.trash/' . $username;
        if ($originalPathDir !== '') {
            $trashTargetDirRel .= '/' . $originalPathDir;
        }
        $trashTargetDirAbs = $this->safe($trashTargetDirRel);
        $this->fs->ensureDir($trashTargetDirAbs);

        $trashTargetRel = $trashTargetDirRel . '/' . $name;
        $trashTargetAbs = $trashTargetDirAbs . DIRECTORY_SEPARATOR . $name;
        
        // Evitar colisiones en la papelera
        if (file_exists($trashTargetAbs)) {
            $ext = pathinfo($name, PATHINFO_EXTENSION);
            $base = pathinfo($name, PATHINFO_FILENAME);
            $i = 1;
            do {
                $newName = $base . " ($i)" . ($ext ? ".$ext" : '');
                $trashTargetRel = $trashTargetDirRel . '/' . $newName;
                $trashTargetAbs = $trashTargetDirAbs . DIRECTORY_SEPARATOR . $newName;
                $i++;
            } while (file_exists($trashTargetAbs));
        }

        if (!@rename($abs, $trashTargetAbs)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo mover el elemento a la papelera.');
        }

        // Actualizar metadatos
        $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = ? WHERE path = ?");
        $stmt->execute([$trashTargetRel, $relative]);
        if (is_dir($trashTargetAbs)) {
            $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = CONCAT(?, SUBSTRING(path, ?)) WHERE path LIKE ?");
            $stmt->execute([$trashTargetRel, strlen($relative) + 1, $relative . '/%']);
        }
    }

    public function restore(string $relative, string $role): void
    {
        if ($role !== 'admin') {
            throw HttpException::forbidden('Solo los administradores pueden restaurar elementos.');
        }
        $relative = trim($relative, '/');
        if (!str_starts_with($relative, '.trash/')) {
            throw HttpException::badRequest('El elemento no está en la papelera.');
        }

        $abs = $this->safe($relative);
        if (!file_exists($abs)) {
            throw HttpException::notFound('Elemento no encontrado en la papelera.');
        }

        // Determinar ruta original
        // .trash/{username}/{original_path}
        $parts = explode('/', $relative);
        if (count($parts) < 3) {
            throw HttpException::badRequest('Ruta de papelera inválida.');
        }
        
        // Remover .trash y username
        array_shift($parts); // .trash
        array_shift($parts); // username
        $originalRel = implode('/', $parts);
        $originalDirRel = dirname($originalRel);
        if ($originalDirRel === '.') $originalDirRel = '';

        $name = basename($originalRel);
        // Si el nombre original tiene el (1) que le pusimos en la papelera, podríamos quitárselo, pero es complejo.
        // Lo dejaremos tal cual, o si hay conflicto en el destino, agregamos (1).

        // Verificar si la carpeta destino existe
        $targetDirRel = '';
        if ($originalDirRel !== '') {
            $originalDirAbs = $this->safe($originalDirRel);
            if (is_dir($originalDirAbs)) {
                $targetDirRel = $originalDirRel;
            } else {
                // Si la carpeta original no existe, va a la raíz
                $targetDirRel = '';
            }
        }

        $targetRel = ltrim($targetDirRel . '/' . $name, '/');
        $targetAbs = $this->safe($targetRel);

        // Evitar colisiones en el destino
        if (file_exists($targetAbs)) {
            $ext = pathinfo($name, PATHINFO_EXTENSION);
            $base = pathinfo($name, PATHINFO_FILENAME);
            // Quitar el patrón " (1)" del final si lo tiene para no hacer "nombre (1) (1)"
            $base = preg_replace('/ \(\d+\)$/', '', $base);
            $i = 1;
            do {
                $newName = $base . " ($i)" . ($ext ? ".$ext" : '');
                $targetRel = ltrim($targetDirRel . '/' . $newName, '/');
                $targetAbs = $this->safe($targetRel);
                $i++;
            } while (file_exists($targetAbs));
        }

        if (!@rename($abs, $targetAbs)) {
            throw new HttpException(500, 'FS_ERROR', 'No se pudo restaurar el elemento.');
        }

        // Actualizar metadatos
        $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = ? WHERE path = ?");
        $stmt->execute([$targetRel, $relative]);
        if (is_dir($targetAbs)) {
            $stmt = $this->pdo->prepare("UPDATE assets_metadata SET path = CONCAT(?, SUBSTRING(path, ?)) WHERE path LIKE ?");
            $stmt->execute([$targetRel, strlen($relative) + 1, $relative . '/%']);
        }
    }

    public function updatePermissions(string $relative, string $actions, string $role): void
    {
        if ($role !== 'admin') {
            throw HttpException::forbidden('Solo los administradores pueden cambiar permisos.');
        }
        
        $actions = trim($actions);
        if ($actions === '') {
            $stmt = $this->pdo->prepare("UPDATE assets_metadata SET blocked_actions = NULL WHERE path = ?");
        } else {
            $stmt = $this->pdo->prepare("UPDATE assets_metadata SET blocked_actions = ? WHERE path = ?");
        }
        
        // Ensure record exists or upsert it
        $check = $this->pdo->prepare("SELECT user_id FROM assets_metadata WHERE path = ?");
        $check->execute([$relative]);
        if ($check->fetchColumn() === false) {
             // We need a dummy user_id if creating from scratch but usually it exists.
             // Best to just upsert. We'll assign to admin user 1 or current user. 
             // We assume it exists for now since files uploaded have metadata.
        }

        if ($actions === '') {
            $stmt->execute([$relative]);
        } else {
            $stmt->execute([$actions, $relative]);
        }
    }

    private function detectMime(string $absPath): ?string
    {
        if (!function_exists('finfo_open')) {
            return null;
        }
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false) {
            return null;
        }
        $mime = @finfo_file($finfo, $absPath);
        finfo_close($finfo);
        return is_string($mime) && $mime !== '' ? $mime : null;
    }

    public function getStorageStats(): array
    {
        $stmt = $this->pdo->query("SELECT SUM(size_bytes) as total FROM assets_metadata");
        return ['total_bytes' => (int) $stmt->fetchColumn()];
    }

    public function getWorkspaceStats(string $period = '30d', ?int $userId = null): array
    {
        if (!$this->isActive()) {
            return [
                'total_bytes' => 0,
                'by_type' => [],
                'by_user' => [],
                'by_user_history' => [],
                'history' => []
            ];
        }

        $cutoffDate = match($period) {
            'today' => date('Y-m-d'),
            '7d' => date('Y-m-d', strtotime('-7 days')),
            default => date('Y-m-01'), // First day of the month for 30d
        };

        $whereUser = $userId ? " WHERE m.user_id = " . (int)$userId : "";
        
        // 1. By Type & Total History
        $stmt = $this->pdo->query("SELECT m.path, m.size_bytes, m.created_at, m.user_id, u.username, u.display_name FROM assets_metadata m LEFT JOIN users u ON m.user_id = u.id" . $whereUser);
        $files = $stmt->fetchAll();

        $totalBytes = 0;
        $byType = [];
        $filesForHistory = [];
        $byUser = [];
        $byUserDaily = [];
        $userInfos = [];

        foreach ($files as $f) {
            $size = (int) $f['size_bytes'];
            $uid = (int) $f['user_id'];
            $date = substr($f['created_at'], 0, 10);
            
            $totalBytes += $size;

            if (!isset($filesForHistory[$date])) {
                $filesForHistory[$date] = 0;
            }
            $filesForHistory[$date] += $size;

            // Track user info
            if ($uid > 0 && !isset($userInfos[$uid])) {
                $userInfos[$uid] = [
                    'username' => $f['username'],
                    'display_name' => $f['display_name']
                ];
            }
            
            $name = $f['display_name'] ?: ($f['username'] ?: 'system');
            
            if (!isset($byUserDaily[$name])) $byUserDaily[$name] = [];
            if (!isset($byUserDaily[$name][$date])) $byUserDaily[$name][$date] = 0;
            $byUserDaily[$name][$date] += $size;

            if (!isset($byUser[$uid])) {
                $byUser[$uid] = 0;
            }
            $byUser[$uid] += $size;

            if ($date >= $cutoffDate) {
                // By Type
                $ext = strtolower(pathinfo($f['path'], PATHINFO_EXTENSION));
                $type = 'other';
                if (in_array($ext, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'])) $type = 'document';
                elseif (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'])) $type = 'image';
                elseif (in_array($ext, ['mp4', 'webm', 'mov', 'avi'])) $type = 'video';
                elseif (in_array($ext, ['mp3', 'wav', 'ogg'])) $type = 'audio';
                elseif (in_array($ext, ['zip', 'rar', '7z', 'tar', 'gz'])) $type = 'archive';

                if (!isset($byType[$type])) {
                    $byType[$type] = 0;
                }
                $byType[$type] += $size;
            }
        }

        // Build User list
        $userStats = [];
        if (!empty($byUser)) {
            foreach ($byUser as $uid => $total) {
                if ($uid > 0 && isset($userInfos[$uid])) {
                    $userStats[] = [
                        'username' => $userInfos[$uid]['username'],
                        'display_name' => $userInfos[$uid]['display_name'],
                        'total_bytes' => $total
                    ];
                }
            }
            usort($userStats, fn($a, $b) => $b['total_bytes'] <=> $a['total_bytes']);
        }

        // Format by_type
        $typeStats = [];
        foreach ($byType as $type => $bytes) {
            $typeStats[] = ['type' => $type, 'total_bytes' => $bytes];
        }
        usort($typeStats, fn($a, $b) => $b['total_bytes'] <=> $a['total_bytes']);

        // Format history
        $history = [];
        $byUserHistory = [];
        $currentDate = new \DateTime($cutoffDate);
        $endDateStr = match($period) {
            'today' => date('Y-m-d'),
            '7d' => date('Y-m-d'),
            default => date('Y-m-t') // Last day of the month
        };
        $endDate = new \DateTime($endDateStr);
        
        // Collect all unique user names from $userInfos to ensure all users are present in daily data
        $uniqueUserNames = [];
        foreach ($userInfos as $info) {
            $name = $info['display_name'] ?: $info['username'];
            $uniqueUserNames[$name] = true;
        }

        while ($currentDate <= $endDate) {
            $dStr = $currentDate->format('Y-m-d');
            $history[] = [
                'date' => $dStr,
                'total_bytes' => $filesForHistory[$dStr] ?? 0
            ];
            
            $dayData = ['date' => $dStr];
            foreach ($uniqueUserNames as $name => $_) {
                $dayData[$name] = $byUserDaily[$name][$dStr] ?? 0;
            }
            $byUserHistory[] = $dayData;

            $currentDate->modify('+1 day');
        }

        return [
            'total_bytes' => $totalBytes,
            'by_type' => $typeStats,
            'by_user' => $userStats,
            'by_user_history' => $byUserHistory,
            'history' => $history
        ];
    }
}
