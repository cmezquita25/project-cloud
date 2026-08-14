<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\EmailTemplateService;
use ProjectCloud\Services\MailService;
use ProjectCloud\Services\SharePermissionService;

final class ShareController
{
    private PDO $pdo;
    private SharePermissionService $permissionService;

    public function __construct()
    {
        $this->pdo = Database::pdo();
        $this->permissionService = new SharePermissionService($this->pdo);
    }

    /**
     * POST /v1/shares
     * Body: { "target_type": "unit"|"folder"|"file", "target_id": int|null, "email": string, "permission_level": "read"|"full" }
     */
    public function create(Request $request): Response
    {
        $user = $request->user();
        if (!$user) {
            throw HttpException::unauthorized();
        }
        $currentUserId = (int) $user['id'];

        $input = $request->json();
        $targetType = (string) ($input['target_type'] ?? '');
        $targetId = isset($input['target_id']) && $input['target_id'] !== null ? (int) $input['target_id'] : null;
        $email = trim((string) ($input['email'] ?? ''));
        $permissionLevel = (string) ($input['permission_level'] ?? 'read');

        if (!in_array($targetType, ['unit', 'folder', 'file'], true)) {
            throw HttpException::badRequest('Tipo de objetivo no válido.', 'INVALID_TARGET_TYPE');
        }
        if (!in_array($permissionLevel, ['read', 'full'], true)) {
            throw HttpException::badRequest('Nivel de permiso no válido.', 'INVALID_PERMISSION_LEVEL');
        }
        if ($email === '') {
            throw HttpException::badRequest('Debe ingresar un correo electrónico.', 'EMAIL_REQUIRED');
        }

        // Buscar al usuario por correo
        $stmtUser = $this->pdo->prepare("SELECT id, display_name, email FROM users WHERE email = :email");
        $stmtUser->execute(['email' => $email]);
        $targetUser = $stmtUser->fetch(PDO::FETCH_ASSOC);

        if (!$targetUser) {
            throw new HttpException(404, 'USER_NOT_FOUND', 'No se encontró ningún usuario con ese correo electrónico en la organización.');
        }

        $invitedUserId = (int) $targetUser['id'];
        if ($invitedUserId === $currentUserId) {
            throw HttpException::badRequest('No puedes compartir un recurso contigo mismo.', 'CANNOT_SHARE_SELF');
        }

        // Determinar ownerId y validar propiedad / control sobre el objetivo
        $ownerId = $currentUserId;
        $itemName = 'Mi Unidad';

        if ($targetType === 'folder') {
            if ($targetId === null) {
                throw HttpException::badRequest('ID de carpeta requerido.');
            }
            $stmtF = $this->pdo->prepare("SELECT user_id, name FROM folders WHERE id = :id AND deleted_at IS NULL");
            $stmtF->execute(['id' => $targetId]);
            $folder = $stmtF->fetch(PDO::FETCH_ASSOC);
            if (!$folder) {
                throw HttpException::notFound('La carpeta no existe o fue eliminada.');
            }
            $ownerId = (int) $folder['user_id'];
            $itemName = (string) $folder['name'];
            if (!$this->permissionService->canAccessFolder($currentUserId, $targetId, 'full')) {
                throw HttpException::forbidden('No tienes permisos para compartir esta carpeta.');
            }
        } elseif ($targetType === 'file') {
            if ($targetId === null) {
                throw HttpException::badRequest('ID de archivo requerido.');
            }
            $stmtFile = $this->pdo->prepare("SELECT user_id, name FROM files WHERE id = :id AND deleted_at IS NULL");
            $stmtFile->execute(['id' => $targetId]);
            $file = $stmtFile->fetch(PDO::FETCH_ASSOC);
            if (!$file) {
                throw HttpException::notFound('El archivo no existe o fue eliminado.');
            }
            $ownerId = (int) $file['user_id'];
            $itemName = (string) $file['name'];
            if (!$this->permissionService->canAccessFile($currentUserId, $targetId, 'full')) {
                throw HttpException::forbidden('No tienes permisos para compartir este archivo.');
            }
        } elseif ($targetType === 'unit') {
            $itemName = 'Unidad completa de ' . $user['display_name'];
        }

        // Insertar o actualizar permiso
        $stmtUpsert = $this->pdo->prepare("
            INSERT INTO shared_access (owner_id, invited_user_id, target_type, target_id, permission_level)
            VALUES (:owner_id, :invited_user_id, :target_type, :target_id, :permission_level)
            ON DUPLICATE KEY UPDATE permission_level = VALUES(permission_level), updated_at = CURRENT_TIMESTAMP
        ");
        $stmtUpsert->execute([
            'owner_id' => $ownerId,
            'invited_user_id' => $invitedUserId,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'permission_level' => $permissionLevel,
        ]);

        $shareId = (int) $this->pdo->lastInsertId();
        if ($shareId === 0) {
            // Si fue un UPDATE, obtener el ID existente
            $stmtGet = $this->pdo->prepare("
                SELECT id FROM shared_access
                WHERE owner_id = :owner_id AND invited_user_id = :invited_user_id AND target_type = :target_type
                AND (target_id = :target_id OR (target_id IS NULL AND :target_id_null IS NULL))
            ");
            $stmtGet->execute([
                'owner_id' => $ownerId,
                'invited_user_id' => $invitedUserId,
                'target_type' => $targetType,
                'target_id' => $targetId,
                'target_id_null' => $targetId,
            ]);
            $shareId = (int) $stmtGet->fetchColumn();
        }

        // Intentar enviar notificación por correo electrónico
        try {
            $mailService = new MailService();
            $emailTplService = new EmailTemplateService($this->pdo);

            $targetLabel = match ($targetType) {
                'unit' => 'la unidad completa',
                'folder' => 'la carpeta',
                'file' => 'el archivo',
                default => 'un recurso',
            };
            $permLabel = $permissionLevel === 'full' ? 'Control total' : 'Solo lectura';

            $rendered = $emailTplService->render(EmailTemplateService::ITEM_SHARED, [
                'invited_name' => (string) $targetUser['display_name'],
                'owner_name' => (string) $user['display_name'],
                'item_name' => $itemName,
                'target_label' => $targetLabel,
                'permission_label' => $permLabel,
                'org_name' => 'Project Cloud',
            ]);

            $mailService->send((string) $targetUser['email'], (string) $targetUser['display_name'], $rendered['subject'], $rendered['html']);
        } catch (\Throwable $e) {
            // Silenciosamente ignorar fallo de mail en entorno dev/local si SMTP no está configurado
        }

        ActivityLogger::log($request, 'share_create', $targetType, $targetId ?? 0, [
            'invited_user_id' => $invitedUserId,
            'invited_email' => $email,
            'permission_level' => $permissionLevel,
        ]);

        return Response::success([
            'ok' => true,
            'collaborator' => [
                'share_id' => $shareId,
                'id' => $invitedUserId,
                'display_name' => (string) $targetUser['display_name'],
                'email' => (string) $targetUser['email'],
                'role' => 'invited',
                'permission_level' => $permissionLevel,
                'avatar_url' => \ProjectCloud\Services\AvatarService::urlFor($invitedUserId),
            ],
        ]);
    }

    /**
     * GET /v1/shares?target_type=...&target_id=...
     */
    public function listByTarget(Request $request): Response
    {
        $user = $request->user();
        if (!$user) {
            throw HttpException::unauthorized();
        }
        $currentUserId = (int) $user['id'];

        $targetType = (string) ($request->input('target_type') ?? 'unit');
        $targetIdParam = $request->input('target_id');
        $targetId = $targetIdParam !== null && $targetIdParam !== '' ? (int) $targetIdParam : null;

        $ownerId = $currentUserId;
        if ($targetType === 'folder' && $targetId !== null) {
            $stmt = $this->pdo->prepare("SELECT user_id FROM folders WHERE id = :id AND deleted_at IS NULL");
            $stmt->execute(['id' => $targetId]);
            $ownerId = (int) ($stmt->fetchColumn() ?: $currentUserId);
        } elseif ($targetType === 'file' && $targetId !== null) {
            $stmt = $this->pdo->prepare("SELECT user_id FROM files WHERE id = :id AND deleted_at IS NULL");
            $stmt->execute(['id' => $targetId]);
            $ownerId = (int) ($stmt->fetchColumn() ?: $currentUserId);
        }

        $collaborators = $this->permissionService->getCollaborators($targetType, $targetId, $ownerId);

        return Response::success([
            'target_type' => $targetType,
            'target_id' => $targetId,
            'collaborators' => $collaborators,
        ]);
    }

    /**
     * GET /v1/shares/shared-with-me
     */
    public function listSharedWithMe(Request $request): Response
    {
        $user = $request->user();
        if (!$user) {
            throw HttpException::unauthorized();
        }
        $currentUserId = (int) $user['id'];

        // 1. Unidades compartidas
        $stmtUnits = $this->pdo->prepare("
            SELECT sa.id as share_id, sa.permission_level, u.id as owner_id, u.display_name as owner_name, u.email as owner_email
            FROM shared_access sa
            JOIN users u ON u.id = sa.owner_id
            WHERE sa.invited_user_id = :user_id AND sa.target_type = 'unit'
        ");
        $stmtUnits->execute(['user_id' => $currentUserId]);
        $units = [];
        while ($row = $stmtUnits->fetch(PDO::FETCH_ASSOC)) {
            $units[] = [
                'share_id' => (int) $row['share_id'],
                'owner_id' => (int) $row['owner_id'],
                'owner_name' => (string) $row['owner_name'],
                'owner_email' => (string) $row['owner_email'],
                'permission_level' => (string) $row['permission_level'],
                'name' => 'Unidad de ' . $row['owner_name'],
            ];
        }

        // 2. Carpetas compartidas
        $stmtFolders = $this->pdo->prepare("
            SELECT sa.id as share_id, sa.permission_level, f.id, f.name, f.parent_id, f.created_at, f.updated_at,
                   u.id as owner_id, u.display_name as owner_name, u.email as owner_email
            FROM shared_access sa
            JOIN folders f ON f.id = sa.target_id
            JOIN users u ON u.id = sa.owner_id
            WHERE sa.invited_user_id = :user_id AND sa.target_type = 'folder' AND f.deleted_at IS NULL
        ");
        $stmtFolders->execute(['user_id' => $currentUserId]);
        $folders = [];
        while ($row = $stmtFolders->fetch(PDO::FETCH_ASSOC)) {
            $folderId = (int) $row['id'];
            $ownerId = (int) $row['owner_id'];
            $collaborators = $this->permissionService->getCollaborators('folder', $folderId, $ownerId);

            $folders[] = [
                'id' => $folderId,
                'name' => (string) $row['name'],
                'parent_id' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
                'owner_id' => $ownerId,
                'owner_name' => (string) $row['owner_name'],
                'permission_level' => (string) $row['permission_level'],
                'collaborators' => $collaborators,
                'created_at' => (string) $row['created_at'],
                'updated_at' => (string) $row['updated_at'],
            ];
        }

        // 3. Archivos compartidos
        $stmtFiles = $this->pdo->prepare("
            SELECT sa.id as share_id, sa.permission_level, fi.id, fi.name, fi.folder_id, fi.size_bytes, fi.mime_type, fi.extension, fi.created_at, fi.updated_at,
                   u.id as owner_id, u.display_name as owner_name, u.email as owner_email,
                   fo.name as parent_folder_name
            FROM shared_access sa
            JOIN files fi ON fi.id = sa.target_id
            JOIN users u ON u.id = sa.owner_id
            LEFT JOIN folders fo ON fo.id = fi.folder_id
            WHERE sa.invited_user_id = :user_id AND sa.target_type = 'file' AND fi.deleted_at IS NULL
        ");
        $stmtFiles->execute(['user_id' => $currentUserId]);
        $files = [];
        while ($row = $stmtFiles->fetch(PDO::FETCH_ASSOC)) {
            $fileId = (int) $row['id'];
            $ownerId = (int) $row['owner_id'];
            $collaborators = $this->permissionService->getCollaborators('file', $fileId, $ownerId);

            $files[] = [
                'id' => $fileId,
                'name' => (string) $row['name'],
                'folder_id' => $row['folder_id'] !== null ? (int) $row['folder_id'] : null,
                'parent_folder_name' => $row['parent_folder_name'] !== null ? (string) $row['parent_folder_name'] : null,
                'size_bytes' => (int) $row['size_bytes'],
                'mime_type' => (string) $row['mime_type'],
                'extension' => (string) $row['extension'],
                'owner_id' => $ownerId,
                'owner_name' => (string) $row['owner_name'],
                'permission_level' => (string) $row['permission_level'],
                'collaborators' => $collaborators,
                'created_at' => (string) $row['created_at'],
                'updated_at' => (string) $row['updated_at'],
            ];
        }

        return Response::success([
            'units' => $units,
            'folders' => $folders,
            'files' => $files,
        ]);
    }

    /**
     * GET /v1/shares/my-shares
     * Lista todos los recursos compartidos otorgados por el usuario actual.
     */
    public function listMyShares(Request $request): Response
    {
        $user = $request->user();
        if (!$user) {
            throw HttpException::unauthorized();
        }
        $currentUserId = (int) $user['id'];

        $stmt = $this->pdo->prepare("
            SELECT 
                sa.id as share_id,
                sa.target_type,
                sa.target_id,
                sa.permission_level,
                sa.created_at,
                u.id as invited_id,
                u.display_name as invited_name,
                u.email as invited_email,
                f.name as folder_name,
                fi.name as file_name
            FROM shared_access sa
            JOIN users u ON u.id = sa.invited_user_id
            LEFT JOIN folders f ON sa.target_type = 'folder' AND f.id = sa.target_id
            LEFT JOIN files fi ON sa.target_type = 'file' AND fi.id = sa.target_id
            WHERE sa.owner_id = :user_id
            ORDER BY sa.created_at DESC
        ");
        $stmt->execute(['user_id' => $currentUserId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $items = array_map(static fn($r) => [
            'share_id' => (int) $r['share_id'],
            'target_type' => (string) $r['target_type'],
            'target_id' => $r['target_id'] !== null ? (int) $r['target_id'] : null,
            'item_name' => match ($r['target_type']) {
                'unit' => 'Unidad Completa (Mi Unidad)',
                'folder' => (string) ($r['folder_name'] ?? 'Carpeta'),
                'file' => (string) ($r['file_name'] ?? 'Archivo'),
                default => 'Recurso',
            },
            'permission_level' => (string) $r['permission_level'],
            'invited_user' => [
                'id' => (int) $r['invited_id'],
                'display_name' => (string) $r['invited_name'],
                'email' => (string) $r['invited_email'],
                'avatar_url' => \ProjectCloud\Services\AvatarService::urlFor((int) $r['invited_id']),
            ],
            'created_at' => (string) $r['created_at'],
        ], $rows);

        return Response::success(['items' => $items]);
    }

    /**
     * PATCH /v1/shares/{id}
     * Body: { "permission_level": "read"|"full" }
     */
    public function update(Request $request): Response
    {
        $user = $request->user();
        if (!$user) {
            throw HttpException::unauthorized();
        }
        $currentUserId = (int) $user['id'];
        $shareId = (int) $request->param('id');

        $input = $request->json();
        $permissionLevel = (string) ($input['permission_level'] ?? 'read');
        if (!in_array($permissionLevel, ['read', 'full'], true)) {
            throw HttpException::badRequest('Nivel de permiso no válido.');
        }

        $stmt = $this->pdo->prepare("SELECT id, owner_id FROM shared_access WHERE id = :id");
        $stmt->execute(['id' => $shareId]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            throw HttpException::notFound('El permiso compartido no existe.');
        }
        if ((int) $share['owner_id'] !== $currentUserId && (string) ($user['role'] ?? '') !== 'admin') {
            throw HttpException::forbidden('Solo el propietario puede modificar los permisos.');
        }

        $stmtUp = $this->pdo->prepare("UPDATE shared_access SET permission_level = :permission_level WHERE id = :id");
        $stmtUp->execute(['permission_level' => $permissionLevel, 'id' => $shareId]);

        ActivityLogger::log($request, 'share_update', 'shared_access', $shareId, [
            'permission_level' => $permissionLevel,
        ]);

        return Response::success(['ok' => true]);
    }

    /**
     * DELETE /v1/shares/{id}
     */
    public function delete(Request $request): Response
    {
        $user = $request->user();
        if (!$user) {
            throw HttpException::unauthorized();
        }
        $currentUserId = (int) $user['id'];
        $shareId = (int) $request->param('id');

        $stmt = $this->pdo->prepare("SELECT id, owner_id, invited_user_id FROM shared_access WHERE id = :id");
        $stmt->execute(['id' => $shareId]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            throw HttpException::notFound('El permiso compartido no existe.');
        }

        $ownerId = (int) $share['owner_id'];
        $invitedUserId = (int) $share['invited_user_id'];

        if ($currentUserId !== $ownerId && $currentUserId !== $invitedUserId && (string) ($user['role'] ?? '') !== 'admin') {
            throw HttpException::forbidden('No tienes permiso para desvincular este acceso.');
        }

        $stmtDel = $this->pdo->prepare("DELETE FROM shared_access WHERE id = :id");
        $stmtDel->execute(['id' => $shareId]);

        ActivityLogger::log($request, 'share_delete', 'shared_access', $shareId, []);

        return Response::success(['ok' => true]);
    }

    /**
     * GET /v1/users/search?q=...
     * Busca miembros activos de la organización para el autocompletado de compartir.
     */
    public function searchUsers(Request $request): Response
    {
        $user = $request->user();
        if (!$user) {
            throw HttpException::unauthorized();
        }
        $currentUserId = (int) $user['id'];
        $q = trim((string) ($request->input('q') ?? ''));

        if (mb_strlen($q) < 1) {
            return Response::success(['users' => []]);
        }

        $stmt = $this->pdo->prepare("
            SELECT id, display_name, email, username
            FROM users
            WHERE status = 'active' AND id != :current_id
            AND (display_name LIKE :q OR email LIKE :q OR username LIKE :q)
            ORDER BY display_name ASC LIMIT 10
        ");
        $like = '%' . addcslashes($q, '%_\\') . '%';
        $stmt->execute(['current_id' => $currentUserId, 'q' => $like]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $users = array_map(static fn($r) => [
            'id' => (int) $r['id'],
            'display_name' => (string) $r['display_name'],
            'email' => (string) $r['email'],
            'username' => (string) $r['username'],
            'avatar_url' => AvatarService::urlFor((int) $r['id']),
        ], $rows);

        return Response::success(['users' => $users]);
    }
}
