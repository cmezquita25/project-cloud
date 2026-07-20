<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Validator;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\FileService;
use ProjectCloud\Services\FileSystemService;
use ProjectCloud\Services\FolderService;

/**
 * Listado de carpetas y operaciones sobre carpetas.
 */
final class FolderController
{
    /** GET /folders/{id}/children — contenido de una carpeta + migas de pan. */
    public function children(Request $request): Response
    {
        $userId = (int) $request->userId();
        $username = (string) $request->user()['username'];
        $folderId = $this->resolveId($request->param('id'));

        $folders = new FolderRepository();
        $files = new FileRepository();

        $current = null;
        $breadcrumbs = [];
        if ($folderId !== null) {
            $current = $folders->find($folderId, $userId);
            if ($current === null) {
                throw HttpException::notFound('Carpeta no encontrada');
            }
            $breadcrumbs = $folders->breadcrumbs($userId, $folderId);
        }

        $limit = (int) $request->input('limit', 0);
        $offset = (int) $request->input('offset', 0);
        $sort = (string) $request->input('sort', 'name');
        $order = (string) $request->input('order', 'asc');
        $type = (string) $request->input('type', '');
        $date = (string) $request->input('date', '');

        $foldersList = [];
        $filesList = [];
        $hasMore = false;

        if ($limit > 0) {
            $totalFolders = $folders->countChildren($userId, $folderId, $type, $date);
            $totalFiles = $files->countInFolder($userId, $folderId, $type, $date);
            
            $remainingLimit = $limit;
            
            if ($offset < $totalFolders) {
                $foldersList = $folders->children($userId, $folderId, $sort, $order, $remainingLimit, $offset, $type, $date);
                $remainingLimit -= count($foldersList);
                $filesOffset = 0;
            } else {
                $filesOffset = $offset - $totalFolders;
            }
            
            if ($remainingLimit > 0 && $filesOffset < $totalFiles) {
                $filesList = $files->inFolder($userId, $folderId, $sort, $order, $remainingLimit, $filesOffset, $type, $date);
            }
            
            $hasMore = ($offset + $limit) < ($totalFolders + $totalFiles);
        } else {
            $foldersList = $folders->children($userId, $folderId, $sort, $order, null, 0, $type, $date);
            $filesList = $files->inFolder($userId, $folderId, $sort, $order, null, 0, $type, $date);
        }

        $subfolders = array_map(
            fn (array $f) => $this->folderPublic($f),
            $foldersList
        );
        $folderFiles = array_map(
            fn (array $f) => $this->filePublic($f, $username),
            $filesList
        );

        return Response::success([
            'folder'      => $current !== null ? $this->folderPublic($current) : null,
            'breadcrumbs' => $breadcrumbs,
            'folders'     => $subfolders,
            'files'       => $folderFiles,
            'has_more'    => $hasMore,
        ]);
    }

    /** POST /folders — crea una carpeta. */
    public function create(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('name')->maxLength('name', 255)
            ->validate();

        $folder = $this->service()->create(
            (int) $request->userId(),
            (string) $request->user()['username'],
            $this->resolveId(isset($data['parent_id']) ? (string) $data['parent_id'] : null),
            (string) $data['name'],
        );

        return Response::created($this->folderPublic($folder));
    }

    /** PATCH /folders/{id} — renombrar, mover o destacar. */
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
        if (array_key_exists('parent_id', $body)) {
            $result = $service->move($userId, $username, $id, $this->resolveId((string) $body['parent_id']));
        }
        if (array_key_exists('is_starred', $body)) {
            $result = $service->setStarred($userId, $id, (bool) $body['is_starred']);
        }
        if ($result === null) {
            throw HttpException::badRequest('Nada que actualizar.');
        }

        return Response::success($this->folderPublic($result));
    }

    /** POST /folders/{id}/copy — copia recursiva a otra carpeta. */
    public function copy(Request $request): Response
    {
        $folder = $this->service()->copy(
            (int) $request->userId(),
            (string) $request->user()['username'],
            (int) $request->param('id'),
            $this->resolveId((string) $request->input('target_parent_id', 'root')),
        );
        return Response::created($this->folderPublic($folder));
    }

    /** DELETE /folders/{id} — mueve a la papelera. */
    public function delete(Request $request): Response
    {
        $id = (int) $request->param('id');
        $this->service()->delete(
            (int) $request->userId(),
            (string) $request->user()['username'],
            $id,
        );
        ActivityLogger::log($request, 'delete', 'folder', $id);
        return Response::success(['ok' => true]);
    }

    // --- Helpers ---

    private function service(): FolderService
    {
        return new FolderService(new FolderRepository(), new FileRepository(), new FileSystemService());
    }

    /** 'root'/'0'/'' -> null (raíz); numérico -> int. */
    private function resolveId(?string $raw): ?int
    {
        if ($raw === null || $raw === '' || $raw === 'root' || $raw === '0') {
            return null;
        }
        return (int) $raw;
    }

    /** @param array<string,mixed> $f */
    private function folderPublic(array $f): array
    {
        return [
            'type'       => 'folder',
            'id'         => (int) $f['id'],
            'parent_id'  => $f['parent_id'] !== null ? (int) $f['parent_id'] : null,
            'name'       => (string) $f['name'],
            'path'       => (string) $f['path'],
            'is_starred' => (bool) $f['is_starred'],
            'created_at' => $f['created_at'] ?? null,
            'updated_at' => $f['updated_at'] ?? null,
        ];
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
