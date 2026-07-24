<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Validator;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\AssetsService;
use ProjectCloud\Services\ThumbnailService;

/**
 * Unidad compartida "assets" (Fase 8, punto 6): navegación e interacción para
 * el admin y los usuarios autorizados, y gestión de permisos (solo admin).
 */
final class AssetsController
{
    /** GET /assets/access — ¿el usuario actual puede ver/interactuar? */
    public function access(Request $request): Response
    {
        $role = (string) ($request->user()['role'] ?? 'user');
        $svc = $this->service();
        $allowed = $svc->canAccess((int) $request->userId(), $role);
        $res = Response::success([
            'allowed'   => $allowed,
            'is_admin'  => $role === 'admin',
            'can_write' => $allowed, // acceso = ver + interactuar
            'active'    => $svc->isActive(),
            'folder_name' => $svc->getFolderName(),
        ]);
        // Evita el uso de caché agresivo del ETag en esta petición, pues queremos siempre
        // el estado real de la carpeta.
        return $res->withHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    /** GET /assets?path=... — contenido de una carpeta de assets. */
    public function index(Request $request): Response
    {
        $service = $this->guard($request);
        $path = (string) $request->input('path', '');
        
        $limit = (int) $request->input('limit', 0);
        $offset = (int) $request->input('offset', 0);
        $sort = (string) $request->input('sort', 'name');
        $order = (string) $request->input('order', 'asc');
        $q = (string) $request->input('q', '');
        $type = (string) $request->input('type', '');
        $date = (string) $request->input('date', '');
        $role = (string) ($request->user()['role'] ?? 'user');
        
        return Response::success($service->list($path, $role, $sort, $order, $limit, $offset, $q, $type, $date));
    }

    /** GET /assets/thumb?path=... — miniatura de una imagen de assets (pública). */
    public function thumb(Request $request): void
    {
        $abs = $this->service()->absoluteFile((string) $request->input('path', ''));
        (new ThumbnailService())->stream($abs, max(64, min(1024, (int) $request->input('s', 400))));
    }

    /** POST /assets/folder — crea una carpeta. */
    public function createFolder(Request $request): Response
    {
        $service = $this->guard($request);
        $role = (string) ($request->user()['role'] ?? 'user');
        $data = (new Validator($request->json()))
            ->required('name')->maxLength('name', 255)
            ->validate();
        $folder = $service->createFolder(
            (string) ($request->json()['path'] ?? ''),
            (string) $data['name'],
            (int) $request->userId(),
            $role
        );
        ActivityLogger::log($request, 'assets.folder_create', 'asset', null, ['path' => $folder['path']]);
        return Response::created($folder);
    }

    /** POST /assets/upload — sube un archivo (multipart) a una carpeta. */
    public function upload(Request $request): Response
    {
        $service = $this->guard($request);
        $role = (string) ($request->user()['role'] ?? 'user');
        $file = $_FILES['file'] ?? null;
        if (!is_array($file)) {
            throw HttpException::badRequest('No se recibió ningún archivo.', 'NO_FILE');
        }
        $path = (string) ($_POST['path'] ?? '');
        $stored = $service->storeUpload($path, [
            'name'     => (string) ($file['name'] ?? ''),
            'tmp_name' => (string) ($file['tmp_name'] ?? ''),
            'size'     => (int) ($file['size'] ?? 0),
            'error'    => (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE),
        ], (int) $request->userId(), $role);
        ActivityLogger::log($request, 'assets.upload', 'asset', null, ['path' => $stored['path']]);
        return Response::created($stored);
    }

    /** POST /assets/move — mueve un elemento a otra carpeta de assets. */
    public function move(Request $request): Response
    {
        $service = $this->guard($request);
        $role = (string) ($request->user()['role'] ?? 'user');
        $body = $request->json();
        $moved = $service->move((string) ($body['path'] ?? ''), (string) ($body['target'] ?? ''), $role);
        ActivityLogger::log($request, 'assets.move', 'asset', null, ['path' => $moved['path']]);
        return Response::success($moved);
    }

    /** POST /assets/rename — renombra un elemento en assets. */
    public function rename(Request $request): Response
    {
        $service = $this->guard($request);
        $role = (string) ($request->user()['role'] ?? 'user');
        $body = $request->json();
        $renamed = $service->rename((string) ($body['path'] ?? ''), (string) ($body['name'] ?? ''), $role);
        ActivityLogger::log($request, 'assets.rename', 'asset', null, ['path' => $renamed['path']]);
        return Response::success($renamed);
    }

    /** DELETE /assets?path=... — elimina un archivo o carpeta. */
    public function delete(Request $request): Response
    {
        $service = $this->guard($request);
        $role = (string) ($request->user()['role'] ?? 'user');
        $username = (string) ($request->user()['username'] ?? 'unknown');
        $path = (string) $request->input('path', '');
        $service->delete($path, $role, $username);
        ActivityLogger::log($request, 'assets.delete', 'asset', null, ['path' => $path]);
        return Response::success(['ok' => true]);
    }

    /** POST /assets/restore — restaura un archivo/carpeta de la papelera (.trash). */
    public function restore(Request $request): Response
    {
        $service = $this->guard($request);
        $role = (string) ($request->user()['role'] ?? 'user');
        $body = $request->json();
        $path = (string) ($body['path'] ?? '');
        $service->restore($path, $role);
        ActivityLogger::log($request, 'assets.restore', 'asset', null, ['path' => $path]);
        return Response::success(['ok' => true]);
    }

    // --- Permisos (solo admin, ya filtrado por AdminOnly en la ruta) ---

    /** GET /admin/assets/permissions — usuarios y su acceso a assets. */
    public function permissions(Request $request): Response
    {
        $allowed = $this->service()->allowedUserIds();
        $users = array_map(static function (array $u) use ($allowed): array {
            $id = (int) $u['id'];
            return [
                'id'           => $id,
                'username'     => (string) $u['username'],
                'display_name' => (string) $u['display_name'],
                'role'         => (string) $u['role'],
                'allowed'      => $u['role'] === 'admin' || in_array($id, $allowed, true),
            ];
        }, (new UserRepository())->all());

        return Response::success(['users' => $users]);
    }

    /** PUT /admin/assets/permissions — fija los usuarios con acceso. */
    public function setPermissions(Request $request): Response
    {
        $body = $request->json();
        $ids = is_array($body['user_ids'] ?? null) ? $body['user_ids'] : [];
        $this->service()->setAllowedUserIds($ids);
        ActivityLogger::log($request, 'assets.permissions', 'setting', null, ['count' => count($ids)]);
        return Response::success(['user_ids' => $this->service()->allowedUserIds()]);
    }

    /** PUT /admin/assets/block-actions — bloquea acciones para un archivo/carpeta. */
    public function setBlockedActions(Request $request): Response
    {
        $role = (string) ($request->user()['role'] ?? 'user');
        $body = $request->json();
        $path = (string) ($body['path'] ?? '');
        $actions = (string) ($body['blocked_actions'] ?? '');
        $this->service()->updatePermissions($path, $actions, $role);
        ActivityLogger::log($request, 'assets.block_actions', 'asset', null, ['path' => $path, 'actions' => $actions]);
        return Response::success(['ok' => true]);
    }

    /** POST /admin/assets/activate — crea la carpeta física de assets. */
    public function activate(Request $request): Response
    {
        $this->service()->createRoot();
        ActivityLogger::log($request, 'assets.activate', 'setting', null, []);
        return Response::success(['ok' => true]);
    }

    /** PUT /admin/assets/folder-name — cambia el nombre esperado de la raíz de assets. */
    public function setFolderName(Request $request): Response
    {
        $body = $request->json();
        $name = (string) ($body['folder_name'] ?? '');
        if ($name === '' || preg_match('/[^a-zA-Z0-9_-]/', $name)) {
            throw HttpException::badRequest('Nombre de carpeta inválido.');
        }
        $settings = new \ProjectCloud\Repositories\SettingsRepository();
        $settings->set('assets_folder_name', $name);
        
        // Ensure the physical folder is created immediately if it doesn't exist
        (new AssetsService())->createRoot();
        
        ActivityLogger::log($request, 'assets.folder_name', 'setting', null, ['folder_name' => $name]);
        return Response::success(['folder_name' => $name]);
    }

    // --- Helpers ---

    private function service(): AssetsService
    {
        return new AssetsService();
    }

    /** Verifica acceso y devuelve el servicio listo. */
    private function guard(Request $request): AssetsService
    {
        $service = $this->service();
        $service->assertAccess((int) $request->userId(), (string) ($request->user()['role'] ?? 'user'));
        return $service;
    }
}
