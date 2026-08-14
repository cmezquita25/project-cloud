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

        // 2. Invitados directos para el objetivo
        if ($targetType === 'unit') {
            $stmtShares = $this->pdo->prepare("
                SELECT sa.id as share_id, sa.permission_level, u.id, u.display_name, u.email
                FROM shared_access sa
                JOIN users u ON u.id = sa.invited_user_id
                WHERE sa.owner_id = :owner_id AND sa.target_type = 'unit'
            ");
            $stmtShares->execute(['owner_id' => $ownerId]);
        } else {
            $stmtShares = $this->pdo->prepare("
                SELECT sa.id as share_id, sa.permission_level, u.id, u.display_name, u.email
                FROM shared_access sa
                JOIN users u ON u.id = sa.invited_user_id
                WHERE sa.owner_id = :owner_id AND sa.target_type = :target_type AND sa.target_id = :target_id
            ");
            $stmtShares->execute([
                'owner_id' => $ownerId,
                'target_type' => $targetType,
                'target_id' => $targetId
            ]);
        }

        while ($row = $stmtShares->fetch(PDO::FETCH_ASSOC)) {
            $collaborators[] = [
                'share_id' => (int) $row['share_id'],
                'id' => (int) $row['id'],
                'display_name' => (string) $row['display_name'],
                'email' => (string) $row['email'],
                'role' => 'invited',
                'permission_level' => (string) $row['permission_level'],
                'avatar_url' => AvatarService::urlFor((int) $row['id']),
            ];
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
