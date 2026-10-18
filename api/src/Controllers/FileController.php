<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\FileService;
use ProjectCloud\Services\FileSystemService;
use ProjectCloud\Services\ThumbnailService;

/**
 * Operaciones sobre archivos.
 */
final class FileController
{
    /** PATCH /files/{id} — renombrar, mover o destacar. */
    public function update(Request $request): Response
    {
        $userId = (int) $request->userId();
        $username = (string) $request->user()['username'];
        $id = (int) $request->param('id');
        $body = $request->json();
        $service = $this->service();

        $result = null;
        if (array_key_exists('name', $body)) {
            $result = $service->rename($userId, $username, $id, (string) $body['name']);
        }
        if (array_key_exists('folder_id', $body)) {
            $result = $service->move($userId, $username, $id, $this->resolveId((string) $body['folder_id']));
        }
        if (array_key_exists('is_starred', $body)) {
            $result = $service->setStarred($userId, $id, (bool) $body['is_starred']);
        }
        if ($result === null) {
            throw HttpException::badRequest('Nada que actualizar.');
        }

        return Response::success($this->filePublic($result, $username));
    }

    /** POST /files/{id}/duplicate — duplica en la misma carpeta. */
    public function duplicate(Request $request): Response
    {
        self::assertCanCopy((int) $request->userId(), 'file', (int) $request->param('id'));
        $username = (string) $request->user()['username'];
        $file = $this->service()->duplicate((int) $request->userId(), $username, (int) $request->param('id'));
        return Response::created($this->filePublic($file, $username));
    }

    /** POST /files/{id}/copy — copia a otra carpeta. */
    public function copy(Request $request): Response
    {
        self::assertCanCopy((int) $request->userId(), 'file', (int) $request->param('id'));
        $username = (string) $request->user()['username'];
        $file = $this->service()->copy(
            (int) $request->userId(),
            $username,
            (int) $request->param('id'),
            $this->resolveId((string) $request->input('target_folder_id', 'root')),
        );
        return Response::created($this->filePublic($file, $username));
    }

    /** DELETE /files/{id} — mueve a la papelera. */
    public function delete(Request $request): Response
    {
        $id = (int) $request->param('id');
        $this->service()->delete(
            (int) $request->userId(),
            (string) $request->user()['username'],
            $id,
        );
        ActivityLogger::log($request, 'delete', 'file', $id);
        return Response::success(['ok' => true]);
    }

    /** GET /files/{id}/url — URL pública directa. */
    public function url(Request $request): Response
    {
        $userId = (int) $request->userId();
        $fileId = (int) $request->param('id');
        $file = (new FileRepository())->findAnyById($fileId);

        if ($file === null) {
            throw HttpException::notFound('Archivo no encontrado');
        }

        $permService = new \ProjectCloud\Services\SharePermissionService();
        if (!$permService->canAccessFile($userId, $fileId, 'read')) {
            throw HttpException::forbidden('No tienes acceso a este archivo.');
        }

        $owner = (new UserRepository())->findById((int) $file['user_id']);
        $ownerUsername = (string) ($owner['username'] ?? '');

        $rights = $permService->rights($userId, 'file', $fileId);
        $links = \ProjectCloud\Services\FileLinks::for($file, $ownerUsername, (bool) ($rights['download'] ?? true));
        return Response::success([
            'url'        => $links['url'],         // privado: enlace firmado temporal
            'public_url' => $links['public_url'],  // privado: null (no tiene URL directa)
            'visibility' => $links['visibility'],
            'name'       => (string) $file['name'],
        ]);
    }

    /** PATCH /files/{id}/visibility — { visibility: public|private } (solo el propietario). */
    public function setVisibility(Request $request): Response
    {
        $visibility = (string) ($request->json()['visibility'] ?? '');
        $file = (new \ProjectCloud\Services\VisibilityService())->setFile((int) $request->userId(), (int) $request->param('id'), $visibility);
        \ProjectCloud\Services\ActivityLogger::log($request, 'file.visibility', 'file', (int) $file['id'], ['visibility' => $visibility]);
        return Response::success($this->filePublic($file, (string) ($request->user()['username'] ?? '')));
    }

    /**
     * GET /files/{id}/content?exp=…&sig=…[&download=1] — sirve un archivo privado
     * con su enlace firmado (las etiquetas <img>/<video> no pueden mandar la
     * sesión). Admite rangos (vídeo y audio).
     */
    public function content(Request $request): void
    {
        $id = (int) $request->param('id');
        // La descarga tiene su propia firma (solo la reciben quienes pueden descargar).
        $download = (bool) $request->input('download');
        if (!\ProjectCloud\Core\SignedUrl::verify($id, $download ? 'download' : 'content', $request->input('exp'), $request->input('sig'))) {
            throw HttpException::forbidden('El enlace caducó o no es válido.', 'LINK_EXPIRED');
        }
        $file = (new FileRepository())->findAnyById($id);
        $owner = $file !== null ? (new UserRepository())->findById((int) $file['user_id']) : null;
        if ($file === null || $owner === null || $file['deleted_at'] !== null) {
            throw HttpException::notFound('Archivo no encontrado');
        }
        $path = (new \ProjectCloud\Services\PrivateFileStore())->physicalPath((string) $owner['username'], $file);
        \ProjectCloud\Services\FileStreamer::send($path, (string) $file['name'], $file['mime_type'], $download);
    }


    /** GET /files/{id}/thumb — miniatura de imagen (pública, como la URL del archivo). */
    public function thumb(Request $request): void
    {
        $file = (new FileRepository())->findAnyById((int) $request->param('id'));
        if ($file === null) {
            throw HttpException::notFound('Archivo no encontrado');
        }
        $user = (new UserRepository())->findById((int) $file['user_id']);
        if ($user === null) {
            throw HttpException::notFound('Archivo no encontrado');
        }
        // Las miniaturas de archivos privados solo con su enlace firmado.
        if (($file['visibility'] ?? 'public') === 'private'
            && !\ProjectCloud\Core\SignedUrl::verify((int) $file['id'], 'thumb', $request->input('exp'), $request->input('sig'))) {
            throw HttpException::notFound('Archivo no encontrado');
        }
        $abs = (new \ProjectCloud\Services\PrivateFileStore())->physicalPath((string) $user['username'], $file);

        $size = (int) $request->input('s', 400);
        (new ThumbnailService())->stream($abs, max(64, min(1024, $size)), ($file['visibility'] ?? 'public') === 'private');
    }

    // --- Helpers ---

    /**
     * Copiar o duplicar es descargar por otra vía: no se permite a un invitado
     * con la descarga bloqueada por su invitación.
     */
    public static function assertCanCopy(int $userId, string $type, int $id): void
    {
        $rights = (new \ProjectCloud\Services\SharePermissionService())->rights($userId, $type, $id);
        if ($rights !== null && !$rights['download']) {
            throw HttpException::forbidden('El propietario no permite descargar ni copiar este elemento.', 'DOWNLOAD_BLOCKED');
        }
    }

    private function service(): FileService
    {
        return new FileService(new FileRepository(), new FolderRepository(), new FileSystemService());
    }

    private function resolveId(?string $raw): ?int
    {
        if ($raw === null || $raw === '' || $raw === 'root' || $raw === '0') {
            return null;
        }
        return (int) $raw;
    }

    /** @param array<string,mixed> $f */
    private function filePublic(array $f, string $username): array
    {
        $ownerId = (int) ($f['user_id'] ?? 0);
        $ownerUsername = $username;
        if ($ownerId > 0) {
            $ownerUser = (new UserRepository())->findById($ownerId);
            if ($ownerUser !== null) {
                $ownerUsername = (string) $ownerUser['username'];
            }
        }

        return [
            'type'       => 'file',
            'id'         => (int) $f['id'],
            'folder_id'  => $f['folder_id'] !== null ? (int) $f['folder_id'] : null,
            'name'       => (string) $f['name'],
            'path'       => (string) $f['path'],
            'size_bytes' => (int) $f['size_bytes'],
            'mime_type'  => $f['mime_type'] !== null ? (string) $f['mime_type'] : null,
            'extension'  => $f['extension'] !== null ? (string) $f['extension'] : null,
            'is_starred' => (bool) $f['is_starred'],
            ...\ProjectCloud\Services\FileLinks::for($f, $ownerUsername),
            'created_at' => $f['created_at'] ?? null,
            'updated_at' => $f['updated_at'] ?? null,
        ];
    }
}
