<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Database;
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
        $folderId = $this->resolveId($request->param('id'));
        $permService = new \ProjectCloud\Services\SharePermissionService();

        $folders = new FolderRepository();
        $files = new FileRepository();

        $current = null;
        $breadcrumbs = [];
        $targetUserId = $userId;

        if ($folderId !== null) {
            $current = $folders->findAnyById($folderId);
            if ($current === null) {
                throw HttpException::notFound('Carpeta no encontrada');
            }
            if (!$permService->canAccessFolder($userId, $folderId, 'read')) {
                throw HttpException::forbidden('No tienes acceso a esta carpeta.');
            }
            $targetUserId = (int) $current['user_id'];
            $breadcrumbs = $folders->breadcrumbs($targetUserId, $folderId);
        } else {
            $ownerIdParam = $request->input('owner_id');
            if ($ownerIdParam !== null && $ownerIdParam !== '') {
                $requestedOwnerId = (int) $ownerIdParam;
                if (!$permService->canAccessUnit($userId, $requestedOwnerId, 'read')) {
                    throw HttpException::forbidden('No tienes acceso a esta unidad compartida.');
                }
                $targetUserId = $requestedOwnerId;
            }
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
            $totalFolders = $folders->countChildren($targetUserId, $folderId, $type, $date);
            $totalFiles = $files->countInFolder($targetUserId, $folderId, $type, $date);
            
            $remainingLimit = $limit;
            
            if ($offset < $totalFolders) {
                $foldersList = $folders->children($targetUserId, $folderId, $sort, $order, $remainingLimit, $offset, $type, $date);
                $remainingLimit -= count($foldersList);
                $filesOffset = 0;
            } else {
                $filesOffset = $offset - $totalFolders;
            }
            
            if ($remainingLimit > 0 && $filesOffset < $totalFiles) {
                $filesList = $files->inFolder($targetUserId, $folderId, $sort, $order, $remainingLimit, $filesOffset, $type, $date);
            }
            
            $hasMore = ($offset + $limit) < ($totalFolders + $totalFiles);
        } else {
            $foldersList = $folders->children($targetUserId, $folderId, $sort, $order, null, 0, $type, $date);
            $filesList = $files->inFolder($targetUserId, $folderId, $sort, $order, null, 0, $type, $date);
        }

        $subfolders = array_map(
            fn (array $f) => $this->folderPublic($f, $permService),
            $foldersList
        );
        $folderFiles = array_map(
            fn (array $f) => $this->filePublic($f, $permService),
            $filesList
        );

        return Response::success([
            'folder'      => $current !== null ? $this->folderPublic($current, $permService) : null,
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

        ActivityLogger::log($request, 'create', 'folder', (int) $folder['id'], ['name' => $folder['name']]);

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
    private function folderPublic(array $f, ?\ProjectCloud\Services\SharePermissionService $permService = null): array
    {
        $permService = $permService ?? new \ProjectCloud\Services\SharePermissionService();
        $ownerId = (int) $f['user_id'];
        $collaborators = $permService->getCollaborators('folder', (int)$f['id'], $ownerId);

        $owners = array_map(static fn($c) => [
            'id' => $c['id'],
            'display_name' => $c['display_name'],
            'email' => $c['email'],
            'avatar_url' => $c['avatar_url'],
            'role' => $c['role'] ?? 'invited',
            'permission_level' => $c['permission_level'] ?? 'full',
        ], $collaborators);

        $createdBy = null;
        try {
            $stmtCreator = Database::pdo()->prepare("
                SELECT u.id, u.display_name, u.email
                FROM activity_log al
                JOIN users u ON u.id = al.user_id
                WHERE al.entity_type = 'folder' AND al.entity_id = :id AND al.action IN ('create', 'assets.create')
                ORDER BY al.id ASC LIMIT 1
            ");
            $stmtCreator->execute(['id' => (int)$f['id']]);
            $creatorRow = $stmtCreator->fetch(PDO::FETCH_ASSOC);
            if ($creatorRow) {
                $createdBy = [
                    'id' => (int) $creatorRow['id'],
                    'display_name' => (string) $creatorRow['display_name'],
                    'email' => (string) $creatorRow['email'],
                    'avatar_url' => \ProjectCloud\Services\AvatarService::urlFor((int) $creatorRow['id']),
                ];
            }
        } catch (\Throwable) {}

        if ($createdBy === null && !empty($owners[0])) {
            $createdBy = $owners[0];
        }

        return [
            'type'          => 'folder',
            'id'            => (int) $f['id'],
            'parent_id'     => $f['parent_id'] !== null ? (int) $f['parent_id'] : null,
            'name'          => (string) $f['name'],
            'path'          => (string) $f['path'],
            'is_starred'    => (bool) $f['is_starred'],
            'owner'         => $owners[0]['display_name'] ?? null,
            'created_by'    => $createdBy,
            'created_at'    => $f['created_at'] ?? null,
            'updated_at'    => $f['updated_at'] ?? null,
            'owners'        => $owners,
            'collaborators' => $collaborators,
        ];
    }

    /** @param array<string,mixed> $f */
    private function filePublic(array $f, ?\ProjectCloud\Services\SharePermissionService $permService = null): array
    {
        $permService = $permService ?? new \ProjectCloud\Services\SharePermissionService();
        $ownerId = (int) $f['user_id'];
        $collaborators = $permService->getCollaborators('file', (int)$f['id'], $ownerId);

        $owners = array_map(static fn($c) => [
            'id' => $c['id'],
            'display_name' => $c['display_name'],
            'email' => $c['email'],
            'avatar_url' => $c['avatar_url'],
            'role' => $c['role'] ?? 'invited',
            'permission_level' => $c['permission_level'] ?? 'full',
        ], $collaborators);

        $createdBy = null;
        try {
            $stmtCreator = Database::pdo()->prepare("
                SELECT u.id, u.display_name, u.email
                FROM activity_log al
                JOIN users u ON u.id = al.user_id
                WHERE (
                    (al.entity_type = 'file' AND al.entity_id = :id)
                    OR (al.action IN ('upload', 'assets.upload') AND al.details LIKE :name_pattern)
                )
                ORDER BY al.id ASC LIMIT 1
            ");
            $namePattern = '%"name":"' . addcslashes((string)$f['name'], '%_\\"') . '"%';
            $stmtCreator->execute(['id' => (int)$f['id'], 'name_pattern' => $namePattern]);
            $creatorRow = $stmtCreator->fetch(PDO::FETCH_ASSOC);
            if ($creatorRow) {
                $createdBy = [
                    'id' => (int) $creatorRow['id'],
                    'display_name' => (string) $creatorRow['display_name'],
                    'email' => (string) $creatorRow['email'],
                    'avatar_url' => \ProjectCloud\Services\AvatarService::urlFor((int) $creatorRow['id']),
                ];
            }
        } catch (\Throwable) {}

        if ($createdBy === null && !empty($owners[0])) {
            $createdBy = $owners[0];
        }

        // Obtener el username del dueño para la URL del archivo
        $stmtUser = Database::pdo()->prepare("SELECT username FROM users WHERE id = :id");
        $stmtUser->execute(['id' => $ownerId]);
        $ownerUsername = (string) ($stmtUser->fetchColumn() ?: '');

        return [
            'type'          => 'file',
            'id'            => (int) $f['id'],
            'folder_id'     => $f['folder_id'] !== null ? (int) $f['folder_id'] : null,
            'name'          => (string) $f['name'],
            'path'          => (string) $f['path'],
            'size_bytes'    => (int) $f['size_bytes'],
            'mime_type'     => $f['mime_type'] !== null ? (string) $f['mime_type'] : null,
            'extension'     => $f['extension'] !== null ? (string) $f['extension'] : null,
            'is_starred'    => (bool) $f['is_starred'],
            'owner'         => $owners[0]['display_name'] ?? null,
            'created_by'    => $createdBy,
            'url'           => FileService::publicUrl($ownerUsername, (string) $f['path']),
            'created_at'    => $f['created_at'] ?? null,
            'updated_at'    => $f['updated_at'] ?? null,
            'owners'        => $owners,
            'collaborators' => $collaborators,
        ];
    }
}

