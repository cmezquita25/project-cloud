<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;

final class SharePermissionService
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    /**
     * Comprueba si el usuario tiene acceso a toda la unidad del propietario target.
     */
    public function canAccessUnit(int $userId, int $ownerId, string $requiredPermission = 'read'): bool
    {
        if ($userId === $ownerId) {
            return true;
        }

        $stmt = $this->pdo->prepare("
            SELECT permission_level FROM shared_access
            WHERE owner_id = :owner_id AND invited_user_id = :user_id AND target_type = 'unit'
        ");
        $stmt->execute(['owner_id' => $ownerId, 'user_id' => $userId]);
        $perm = $stmt->fetchColumn();

        return $this->satisfiesPermission($perm !== false ? (string)$perm : null, $requiredPermission);
    }

    /**
     * Comprueba si el usuario tiene acceso a una carpeta específica.
     */
    public function canAccessFolder(int $userId, int $folderId, string $requiredPermission = 'read'): bool
    {
        // 1. Obtener la carpeta
        $stmt = $this->pdo->prepare("SELECT user_id, parent_id FROM folders WHERE id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $folderId]);
        $folder = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$folder) {
            return false;
        }

        $ownerId = (int) $folder['user_id'];
        if ($userId === $ownerId) {
            return true;
        }

        // 2. Verificar si la unidad completa está compartida
        if ($this->canAccessUnit($userId, $ownerId, $requiredPermission)) {
            return true;
        }

        // 3. Verificar compartición directa sobre esta carpeta o carpetas ascendentes
        $currentFolderId = $folderId;
        while ($currentFolderId !== null) {
            $stmt = $this->pdo->prepare("
                SELECT permission_level FROM shared_access
                WHERE owner_id = :owner_id AND invited_user_id = :user_id AND target_type = 'folder' AND target_id = :target_id
            ");
            $stmt->execute([
                'owner_id' => $ownerId,
                'user_id' => $userId,
                'target_id' => $currentFolderId
            ]);
            $perm = $stmt->fetchColumn();

            if ($perm !== false && $this->satisfiesPermission((string)$perm, $requiredPermission)) {
                return true;
            }

            // Obtener carpeta padre
            $stmtParent = $this->pdo->prepare("SELECT parent_id FROM folders WHERE id = :id AND deleted_at IS NULL");
            $stmtParent->execute(['id' => $currentFolderId]);
            $parent = $stmtParent->fetch(PDO::FETCH_ASSOC);
            $currentFolderId = $parent && $parent['parent_id'] !== null ? (int)$parent['parent_id'] : null;
        }

        return false;
    }

    /**
     * Comprueba si el usuario tiene acceso a un archivo específico.
     */
    public function canAccessFile(int $userId, int $fileId, string $requiredPermission = 'read'): bool
    {
        $stmt = $this->pdo->prepare("SELECT user_id, folder_id FROM files WHERE id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $fileId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            return false;
        }

        $ownerId = (int) $file['user_id'];
        if ($userId === $ownerId) {
            return true;
        }

        // 1. Verificar compartición directa sobre el archivo
        $stmtShare = $this->pdo->prepare("
            SELECT permission_level FROM shared_access
            WHERE owner_id = :owner_id AND invited_user_id = :user_id AND target_type = 'file' AND target_id = :target_id
        ");
        $stmtShare->execute([
            'owner_id' => $ownerId,
            'user_id' => $userId,
            'target_id' => $fileId
        ]);
        $perm = $stmtShare->fetchColumn();

        if ($perm !== false && $this->satisfiesPermission((string)$perm, $requiredPermission)) {
            return true;
        }

        // 2. Si el archivo está dentro de una carpeta, hereda permisos de la carpeta
        if ($file['folder_id'] !== null) {
            return $this->canAccessFolder($userId, (int)$file['folder_id'], $requiredPermission);
        }

        // 3. De lo contrario, verifica si la unidad completa está compartida
        return $this->canAccessUnit($userId, $ownerId, $requiredPermission);
    }

    /**
     * Obtiene los colaboradores (Propietario + Invitados) de un objetivo.
     */
    public function getCollaborators(string $targetType, ?int $targetId, int $ownerId): array
    {
        $collaborators = [];

        // 1. Propietario
        $stmtOwner = $this->pdo->prepare("SELECT id, display_name, email, role FROM users WHERE id = :id");
        $stmtOwner->execute(['id' => $ownerId]);
        $owner = $stmtOwner->fetch(PDO::FETCH_ASSOC);
        if ($owner) {
            $collaborators[] = [
                'id' => (int) $owner['id'],
                'display_name' => (string) $owner['display_name'],
                'email' => (string) $owner['email'],
                'role' => 'owner',
                'permission_level' => 'full',
                'avatar_url' => AvatarService::urlFor((int) $owner['id']),
            ];
        }

        // 2. Si el objetivo es una carpeta o archivo, buscar carpetas ascendentes para incluir comparticiones heredadas
        $folderIds = [];
        if ($targetType === 'folder' && $targetId !== null) {
            $currId = $targetId;
            while ($currId !== null && $currId > 0) {
                $folderIds[] = $currId;
                $stmtP = $this->pdo->prepare("SELECT parent_id FROM folders WHERE id = :id AND deleted_at IS NULL");
                $stmtP->execute(['id' => $currId]);
                $p = $stmtP->fetch(PDO::FETCH_ASSOC);
                $currId = $p && $p['parent_id'] !== null ? (int)$p['parent_id'] : null;
            }
        } elseif ($targetType === 'file' && $targetId !== null) {
            $stmtF = $this->pdo->prepare("SELECT folder_id FROM files WHERE id = :id AND deleted_at IS NULL");
            $stmtF->execute(['id' => $targetId]);
            $file = $stmtF->fetch(PDO::FETCH_ASSOC);
            $currId = $file && $file['folder_id'] !== null ? (int)$file['folder_id'] : null;
            while ($currId !== null && $currId > 0) {
                $folderIds[] = $currId;
                $stmtP = $this->pdo->prepare("SELECT parent_id FROM folders WHERE id = :id AND deleted_at IS NULL");
                $stmtP->execute(['id' => $currId]);
                $p = $stmtP->fetch(PDO::FETCH_ASSOC);
                $currId = $p && $p['parent_id'] !== null ? (int)$p['parent_id'] : null;
            }
        }

        // 3. Consultar shared_access por unidad completa, directos y ascendentes
        $addedUserIds = [$ownerId => true];

        if ($targetType === 'unit' || (empty($folderIds) && $targetType !== 'file')) {
            $stmtShares = $this->pdo->prepare("
                SELECT sa.id as share_id, sa.permission_level, u.id, u.display_name, u.email
                FROM shared_access sa
                JOIN users u ON u.id = sa.invited_user_id
                WHERE sa.owner_id = :owner_id AND sa.target_type = 'unit'
            ");
            $stmtShares->execute(['owner_id' => $ownerId]);
            while ($row = $stmtShares->fetch(PDO::FETCH_ASSOC)) {
                $uid = (int) $row['id'];
                if (!isset($addedUserIds[$uid])) {
                    $addedUserIds[$uid] = true;
                    $collaborators[] = [
                        'share_id' => (int) $row['share_id'],
                        'id' => $uid,
                        'display_name' => (string) $row['display_name'],
                        'email' => (string) $row['email'],
                        'role' => 'invited',
                        'permission_level' => (string) $row['permission_level'],
                        'avatar_url' => AvatarService::urlFor($uid),
                    ];
                }
            }
        } else {
            $conditions = ["sa.target_type = 'unit'"];
            $params = ['owner_id' => $ownerId];

            if ($targetType === 'file') {
                $conditions[] = "(sa.target_type = 'file' AND sa.target_id = :file_id)";
                $params['file_id'] = $targetId;
            }

            if (!empty($folderIds)) {
                $inClause = implode(',', array_map('intval', $folderIds));
                $conditions[] = "(sa.target_type = 'folder' AND sa.target_id IN ({$inClause}))";
            }

            $sql = "
                SELECT sa.id as share_id, sa.permission_level, u.id, u.display_name, u.email
                FROM shared_access sa
                JOIN users u ON u.id = sa.invited_user_id
                WHERE sa.owner_id = :owner_id AND (" . implode(' OR ', $conditions) . ")
                ORDER BY sa.id ASC
            ";
            $stmtShares = $this->pdo->prepare($sql);
            $stmtShares->execute($params);

            while ($row = $stmtShares->fetch(PDO::FETCH_ASSOC)) {
                $uid = (int) $row['id'];
                if (!isset($addedUserIds[$uid])) {
                    $addedUserIds[$uid] = true;
                    $collaborators[] = [
                        'share_id' => (int) $row['share_id'],
                        'id' => $uid,
                        'display_name' => (string) $row['display_name'],
                        'email' => (string) $row['email'],
                        'role' => 'invited',
                        'permission_level' => (string) $row['permission_level'],
                        'avatar_url' => AvatarService::urlFor($uid),
                    ];
                }
            }
        }

        return $collaborators;
    }

    private function satisfiesPermission(?string $actual, string $required): bool
    {
        if ($actual === null) {
            return false;
        }
        if ($required === 'read') {
            return $actual === 'read' || $actual === 'full';
        }
        if ($required === 'full') {
            return $actual === 'full';
        }
        return false;
    }
}
