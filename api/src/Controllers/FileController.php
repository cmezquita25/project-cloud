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
        $username = (string) $request->user()['username'];
        $file = $this->service()->duplicate((int) $request->userId(), $username, (int) $request->param('id'));
        return Response::created($this->filePublic($file, $username));
    }

    /** POST /files/{id}/copy — copia a otra carpeta. */
    public function copy(Request $request): Response
    {
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
        $username = (string) $request->user()['username'];
        $file = (new FileRepository())->find((int) $request->param('id'), $userId);
        if ($file === null) {
            throw HttpException::notFound('Archivo no encontrado');
        }
        return Response::success([
            'url'  => FileService::publicUrl($username, (string) $file['path']),
            'name' => (string) $file['name'],
        ]);
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
        $abs = (new FileSystemService())->userRoot((string) $user['username'])
            . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string) $file['path']);

        $size = (int) $request->input('s', 400);
        (new ThumbnailService())->stream($abs, max(64, min(1024, $size)));
    }

    // --- Helpers ---

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
            'url'        => FileService::publicUrl($username, (string) $f['path']),
            'created_at' => $f['created_at'] ?? null,
            'updated_at' => $f['updated_at'] ?? null,
        ];
    }
}
