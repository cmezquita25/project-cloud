<?php

declare(strict_types=1);

namespace ProjectCloud\Services\ShareLinks;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Services\AssetsService;
use ProjectCloud\Services\SharePermissionService;

/**
 * Quién puede crear y administrar enlaces (plan §5.1-⑤):
 *
 *   Mi unidad          → el propietario, y los invitados a los que les activó
 *                        «Puede compartir enlaces» (nunca solo por tener «full»).
 *                        Si su invitación bloquea la descarga, sus enlaces
 *                        tampoco permiten descargar.
 *   Unidad compartida  → solo los admins.
 *   Global             → los admins ven y revocan cualquier enlace, pero no
 *                        crean enlaces sobre la unidad de otro usuario.
 */
final class ShareLinkPolicy
{
    /**
     * Resuelve y valida el destino de un enlace nuevo, y comprueba que el
     * usuario pueda compartirlo.
     *
     * @param array{id:int,role:string} $user
     * @return array{scope:string,target_type:string,target_id:?int,target_path:?string,row:?array<string,mixed>,no_download:bool}
     */
    public static function assertCanManageTarget(array $user, string $scope, string $type, mixed $targetId, mixed $targetPath): array
    {
        if (!in_array($type, ['file', 'folder'], true)) {
            throw HttpException::badRequest('Tipo de destino no válido.');
        }

        if ($scope === 'org') {
            if ($user['role'] !== 'admin') {
                throw HttpException::forbidden('Solo los administradores comparten enlaces de la unidad compartida.', 'LINK_FORBIDDEN');
            }
            $path = self::normalizeOrgPath((string) $targetPath);
            if ($path === null || $path === '') {
                throw HttpException::badRequest('Ruta no válida.');
            }
            $assets = new AssetsService();
            $abs = $assets->resolve($path);
            if (($type === 'folder' && !is_dir($abs)) || ($type === 'file' && !is_file($abs))) {
                throw HttpException::notFound('El elemento ya no existe en la unidad compartida.');
            }
            return ['scope' => 'org', 'target_type' => $type, 'target_id' => null, 'target_path' => $path, 'row' => null, 'no_download' => false];
        }

        if ($scope !== 'drive') {
            throw HttpException::badRequest('Unidad no válida.');
        }
        $id = (int) $targetId;
        $row = $type === 'file' ? (new FileRepository())->findAnyById($id) : (new FolderRepository())->findAnyById($id);
        if ($row === null) {
            throw HttpException::notFound('El elemento no existe o está en la papelera.');
        }
        $noDownload = false;
        if ((int) $row['user_id'] !== $user['id']) {
            $rights = (new SharePermissionService())->rights($user['id'], $type, $id);
            if ($rights === null || !$rights['share']) {
                // Mismo mensaje para invitados y admins: solo el propietario (o a quien él autorice).
                throw HttpException::forbidden('Solo el propietario puede crear enlaces de este elemento.', 'LINK_FORBIDDEN');
            }
            $noDownload = !$rights['download'];
        }
        return ['scope' => 'drive', 'target_type' => $type, 'target_id' => $id, 'target_path' => null, 'row' => $row, 'no_download' => $noDownload];
    }

    /**
     * ¿Puede editar o revocar este enlace? El creador, el propietario actual
     * del destino (Mi unidad) y cualquier admin (solo revocar, ver canEdit).
     *
     * @param array{id:int,role:string} $user
     * @param array<string,mixed> $link
     */
    public static function canRevoke(array $user, array $link): bool
    {
        return $user['role'] === 'admin' || self::canEdit($user, $link);
    }

    /**
     * Editar (acceso, caducidad, contraseña…) es cosa de quien lo comparte; un
     * admin sobre la unidad de otro usuario solo puede revocarlo.
     *
     * @param array{id:int,role:string} $user
     * @param array<string,mixed> $link
     */
    public static function canEdit(array $user, array $link): bool
    {
        if ($link['scope'] === 'org') {
            return $user['role'] === 'admin';
        }
        $row = $link['target_type'] === 'file'
            ? (new FileRepository())->findAnyById((int) $link['target_id'])
            : (new FolderRepository())->findAnyById((int) $link['target_id']);
        if ($row !== null && (int) $row['user_id'] === $user['id']) {
            return true; // el propietario edita cualquier enlace de lo suyo
        }
        if ((int) $link['created_by'] !== $user['id'] || $row === null) {
            return false;
        }
        // Un invitado edita los suyos mientras conserve «Puede compartir enlaces».
        $rights = (new SharePermissionService())->rights($user['id'], (string) $link['target_type'], (int) $link['target_id']);
        return $rights !== null && $rights['share'];
    }

    /**
     * Ruta relativa de la unidad compartida, sin «..» ni segmentos ocultos
     * (como .trash). null si no es válida.
     */
    public static function normalizeOrgPath(string $path): ?string
    {
        $segments = [];
        foreach (explode('/', str_replace('\\', '/', $path)) as $segment) {
            if ($segment === '') {
                continue;
            }
            if ($segment[0] === '.' || str_contains($segment, "\0")) {
                return null;
            }
            $segments[] = $segment;
        }
        return implode('/', $segments);
    }
}
