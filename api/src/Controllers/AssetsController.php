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
        $allowed = $this->service()->canAccess((int) $request->userId(), $role);
        return Response::success([
            'allowed'   => $allowed,
            'is_admin'  => $role === 'admin',
            'can_write' => $allowed, // acceso = ver + interactuar
        ]);
    }

    /** GET /assets?path=... — contenido de una carpeta de assets. */
    public function index(Request $request): Response
    {
        $service = $this->guard($request);
        $path = (string) $request->input('path', '');
        return Response::success($service->list($path));
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
        $data = (new Validator($request->json()))
            ->required('name')->maxLength('name', 255)
            ->validate();
        $folder = $service->createFolder(
            (string) ($request->json()['path'] ?? ''),
            (string) $data['name'],
        );
        ActivityLogger::log($request, 'assets.folder_create', 'asset', null, ['path' => $folder['path']]);
        return Response::created($folder);
    }

    /** POST /assets/upload — sube un archivo (multipart) a una carpeta. */
    public function upload(Request $request): Response
    {
        $service = $this->guard($request);
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
        ]);
        ActivityLogger::log($request, 'assets.upload', 'asset', null, ['path' => $stored['path']]);
        return Response::created($stored);
    }

    /** POST /assets/move — mueve un elemento a otra carpeta de assets. */
    public function move(Request $request): Response
    {
        $service = $this->guard($request);
        $body = $request->json();
        $moved = $service->move((string) ($body['path'] ?? ''), (string) ($body['target'] ?? ''));
        ActivityLogger::log($request, 'assets.move', 'asset', null, ['path' => $moved['path']]);
        return Response::success($moved);
    }

    /** DELETE /assets?path=... — elimina un archivo o carpeta. */
    public function delete(Request $request): Response
    {
        $service = $this->guard($request);
        $path = (string) $request->input('path', '');
        $service->delete($path);
        ActivityLogger::log($request, 'assets.delete', 'asset', null, ['path' => $path]);
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
