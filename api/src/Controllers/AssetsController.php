<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\SignedUrl;
use ProjectCloud\Core\Validator;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\AssetsService;
use ProjectCloud\Services\AssetsPrivacy;
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
        $settingsRepo = new \ProjectCloud\Repositories\SettingsRepository();
        $res = Response::success([
            'allowed'      => $allowed,
            'is_admin'     => $role === 'admin',
            'can_write'    => $allowed, // acceso = ver + interactuar
            'active'       => $svc->isActive(),
            'folder_name'  => $svc->getFolderName(),
            'folder_alias' => $svc->getFolderAlias(),
            'custom_alias' => (string) ($settingsRepo->get('assets_folder_alias', '')),
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

    /**
     * GET /assets/thumb?path=... — miniatura de una imagen de assets. Las de
     * carpetas privadas solo con su enlace firmado.
     */
    public function thumb(Request $request): void
    {
        $path = $this->cleanPath((string) $request->input('path', ''));
        $service = $this->service();
        $private = (new AssetsPrivacy($service))->isPrivatePath($path, false);
        if ($private && !SignedUrl::verifyAsset($path, 'thumb', $request->input('exp'), $request->input('sig'))) {
            throw HttpException::notFound('Archivo no encontrado en assets.');
        }
        $abs = $service->absoluteFile($path);
        (new ThumbnailService())->stream($abs, max(64, min(1024, (int) $request->input('s', 400))), $private);
    }

    /**
     * GET /assets/content?path=&exp=&sig=[&download=1] — archivo de una carpeta
     * privada, con enlace firmado (las etiquetas <img>/<video> no mandan la
     * sesión). La descarga tiene su propia firma.
     */
    public function content(Request $request): void
    {
        $path = $this->cleanPath((string) $request->input('path', ''));
        $download = (bool) $request->input('download');
        if (!SignedUrl::verifyAsset($path, $download ? 'download' : 'content', $request->input('exp'), $request->input('sig'))) {
            throw HttpException::forbidden('El enlace caducó o no es válido.', 'LINK_EXPIRED');
        }
        $abs = $this->service()->absoluteFile($path);
        \ProjectCloud\Services\FileStreamer::send($abs, basename($path), mime_content_type($abs) ?: null, $download);
    }

    /**
     * PATCH /assets/visibility { path, visibility } — carpeta privada o pública
     * (solo admins). Responde cuántos archivos cambian y si el servidor ya
     * bloquea sus URL directas.
     */
    public function setVisibility(Request $request): Response
    {
        if (($request->user()['role'] ?? '') !== 'admin') {
            throw HttpException::forbidden('Solo los administradores cambian la privacidad de la unidad compartida.');
        }
        $body = $request->json();
        $visibility = (string) ($body['visibility'] ?? '');
        if (!in_array($visibility, ['public', 'private'], true)) {
            throw HttpException::badRequest('Visibilidad no válida.');
        }
        $path = $this->cleanPath((string) ($body['path'] ?? ''));
        $result = (new AssetsPrivacy($this->service()))->set($path, $visibility === 'private');
        ActivityLogger::log($request, 'assets.visibility', 'asset', null, ['path' => $path, 'visibility' => $visibility, 'files' => $result['files'], 'check' => $result['check']]);
        return Response::success(['visibility' => $visibility, 'files_changed' => $result['files'], 'check' => $result['check']]);
    }

    /** Ruta relativa limpia: sin «..» ni segmentos ocultos. */
    private function cleanPath(string $path): string
    {
        $clean = \ProjectCloud\Services\ShareLinks\ShareLinkPolicy::normalizeOrgPath($path);
        if ($clean === null || $clean === '') {
            throw HttpException::notFound('Archivo no encontrado en assets.');
        }
        return $clean;
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

    /** PUT /admin/assets/folder-name — cambia la carpeta raíz o el alias de la unidad compartida. */
    public function setFolderName(Request $request): Response
    {
        $body = $request->json();
        $settings = new \ProjectCloud\Repositories\SettingsRepository();

        if (array_key_exists('folder_name', $body)) {
            $name = trim((string) $body['folder_name']);
            if ($name !== '') {
                if (preg_match('/[^a-zA-Z0-9_-]/', $name)) {
                    throw HttpException::badRequest('Nombre de carpeta inválido.');
                }
                // La unidad compartida vive junto a las carpetas del sistema en la
                // raíz del sitio: compartir nombre mezclaría sus archivos con los
                // de la app (y el actualizador los reemplazaría).
                $systemFolders = ['api', 'app-assets', 'storage', 'avatars', 'thumbs', 'old-files', 'var'];
                if (in_array(strtolower($name), $systemFolders, true)) {
                    throw HttpException::badRequest('Ese nombre lo usa una carpeta del sistema. Elige otro.', 'RESERVED_FOLDER_NAME');
                }
                $settings->set('assets_folder_name', $name);
                (new AssetsService())->createRoot();
            }
        }

        if (array_key_exists('folder_alias', $body)) {
            $alias = trim((string) $body['folder_alias']);
            $settings->set('assets_folder_alias', $alias);
        }

        $svc = new AssetsService();
        ActivityLogger::log($request, 'assets.folder_name', 'setting', null, [
            'folder_name'  => $svc->getFolderName(),
            'folder_alias' => $svc->getFolderAlias(),
        ]);

        return Response::success([
            'folder_name'  => $svc->getFolderName(),
            'folder_alias' => $svc->getFolderAlias(),
            'custom_alias' => (string) $settings->get('assets_folder_alias', ''),
        ]);
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
