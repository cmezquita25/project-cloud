<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Password;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Validator;
use ProjectCloud\Repositories\ActivityRepository;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\FileSystemService;

/**
 * Panel de administración: usuarios, cuotas, estadísticas y actividad.
 * Todas las rutas requieren AuthMiddleware + AdminOnly.
 */
final class AdminController
{
    private const ROLES = ['admin', 'user'];

    /** GET /admin/users */
    public function users(Request $request): Response
    {
        $users = new UserRepository();
        $list = array_map(fn (array $u) => $this->userPublic($u), $users->all());
        return Response::success(['users' => $list]);
    }

    /** POST /admin/users */
    public function createUser(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('username')->minLength('username', 3)->maxLength('username', 64)
            ->matches('username', '/^[A-Za-z0-9._-]+$/', 'Solo letras, números, punto, guion y guion bajo')
            ->required('email')->email('email')
            ->required('display_name')->maxLength('display_name', 120)
            ->required('password')->minLength('password', 8)
            ->validate();

        $users = new UserRepository();
        $username = strtolower((string) $data['username']);
        if ($users->existsByUsernameOrEmail($username, (string) $data['email'])) {
            throw new HttpException(409, 'USER_EXISTS', 'Ya existe un usuario con ese nombre o correo.');
        }

        $role = in_array($data['role'] ?? 'user', self::ROLES, true) ? (string) $data['role'] : 'user';
        $quota = (int) ($data['quota_bytes'] ?? 5 * 1024 ** 3);
        $maxUpload = (int) ($data['max_upload_bytes'] ?? 2 * 1024 ** 3);

        $id = $users->create(
            $username,
            (string) $data['email'],
            Password::hash((string) $data['password']),
            (string) $data['display_name'],
            $role,
            $quota,
            $maxUpload,
        );

        // Provisiona su carpeta de almacenamiento.
        (new FileSystemService())->provisionUser($username);

        ActivityLogger::log($request, 'user.create', 'user', $id, ['username' => $username]);

        $user = $users->findById($id);
        return Response::created($this->userPublic($user ?? []));
    }

    /** PATCH /admin/users/{id} */
    public function updateUser(Request $request): Response
    {
        $users = new UserRepository();
        $id = (int) $request->param('id');
        $target = $users->findById($id);
        if ($target === null) {
            throw HttpException::notFound('Usuario no encontrado');
        }

        $body = $request->json();
        $fields = [];
        if (array_key_exists('email', $body)) {
            $email = (string) $body['email'];
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw HttpException::validation(['email' => ['Correo inválido']]);
            }
            $fields['email'] = $email;
        }
        if (array_key_exists('display_name', $body)) {
            $fields['display_name'] = (string) $body['display_name'];
        }
        if (array_key_exists('quota_bytes', $body)) {
            $fields['quota_bytes'] = max(0, (int) $body['quota_bytes']);
        }
        if (array_key_exists('max_upload_bytes', $body)) {
            $fields['max_upload_bytes'] = max(0, (int) $body['max_upload_bytes']);
        }
        if (array_key_exists('role', $body) && in_array($body['role'], self::ROLES, true)) {
            // Evita quitarte a ti mismo el rol admin.
            if ($id === $request->userId() && $body['role'] !== 'admin') {
                throw new HttpException(422, 'CANNOT_DEMOTE_SELF', 'No puedes quitarte tu propio rol de administrador.');
            }
            $fields['role'] = (string) $body['role'];
        }
        if (array_key_exists('status', $body) && in_array($body['status'], ['active', 'suspended'], true)) {
            if ($id === $request->userId() && $body['status'] !== 'active') {
                throw new HttpException(422, 'CANNOT_SUSPEND_SELF', 'No puedes suspender tu propia cuenta.');
            }
            $fields['status'] = (string) $body['status'];
        }

        if ($fields === []) {
            throw HttpException::badRequest('Nada que actualizar.');
        }
        $users->update($id, $fields);
        ActivityLogger::log($request, 'user.update', 'user', $id, array_keys($fields));

        return Response::success($this->userPublic($users->findById($id) ?? []));
    }

    /** PATCH /admin/users/{id}/password */
    public function resetPassword(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('password')->minLength('password', 8)
            ->validate();

        $users = new UserRepository();
        $id = (int) $request->param('id');
        if ($users->findById($id) === null) {
            throw HttpException::notFound('Usuario no encontrado');
        }
        $users->updatePassword($id, Password::hash((string) $data['password']));
        ActivityLogger::log($request, 'user.password_reset', 'user', $id);

        return Response::success(['ok' => true]);
    }

    /** DELETE /admin/users/{id} */
    public function deleteUser(Request $request): Response
    {
        $users = new UserRepository();
        $id = (int) $request->param('id');
        $target = $users->findById($id);
        if ($target === null) {
            throw HttpException::notFound('Usuario no encontrado');
        }
        if ($id === $request->userId()) {
            throw new HttpException(422, 'CANNOT_DELETE_SELF', 'No puedes eliminar tu propia cuenta.');
        }
        $stats = $users->stats();
        if (($target['role'] ?? '') === 'admin' && $stats['admins'] <= 1) {
            throw new HttpException(422, 'LAST_ADMIN', 'No puedes eliminar al único administrador.');
        }

        $username = (string) $target['username'];
        $users->delete($id); // CASCADE elimina carpetas/archivos/tokens en BD

        // Elimina físicamente su carpeta de almacenamiento.
        $fs = new FileSystemService();
        $fs->delete($fs->userRoot($username));

        ActivityLogger::log($request, 'user.delete', 'user', $id, ['username' => $username]);
        return Response::success(['ok' => true]);
    }

    /** GET /admin/stats */
    public function stats(Request $request): Response
    {
        $stats = (new UserRepository())->stats();
        // Capacidad real del servidor (definida en la instalación, editable aquí).
        $stats['server_capacity_bytes'] = (new SettingsRepository())->getInt('server_capacity_bytes', 0);
        return Response::success($stats);
    }

    /** PATCH /admin/settings — ajusta la capacidad real del servidor. */
    public function updateSettings(Request $request): Response
    {
        $body = $request->json();
        $settings = new SettingsRepository();
        $users = new UserRepository();
        $adminId = (int) $request->userId();
        $updatedUser = null;

        if (array_key_exists('server_capacity_bytes', $body)) {
            $capacity = max(0, (int) $body['server_capacity_bytes']);
            $settings->set('server_capacity_bytes', (string) $capacity);
            // El admin gestiona todo el conjunto: su cuota sigue a la capacidad,
            // para que la barra de almacenamiento (sidebar/perfil) la refleje.
            $users->update($adminId, ['quota_bytes' => $capacity]);
            $updatedUser = $users->findById($adminId);
            ActivityLogger::log($request, 'settings.update', 'setting', null, ['server_capacity_bytes' => $capacity]);
        }

        if (array_key_exists('organization_name', $body)) {
            $orgName = trim((string) $body['organization_name']);
            if ($orgName === '') {
                $settings->delete('organization_name');
            } else {
                $settings->set('organization_name', $orgName);
            }
            ActivityLogger::log($request, 'settings.update', 'setting', null, ['organization_name' => $orgName]);
        }

        if (array_key_exists('organization_slogan', $body)) {
            // Leyenda opcional (≤150) que se muestra bajo el logo en el login.
            $slogan = trim((string) $body['organization_slogan']);
            if (mb_strlen($slogan) > 150) {
                $slogan = mb_substr($slogan, 0, 150);
            }
            if ($slogan === '') {
                $settings->delete('organization_slogan');
            } else {
                $settings->set('organization_slogan', $slogan);
            }
            ActivityLogger::log($request, 'settings.update', 'setting', null, ['organization_slogan' => $slogan]);
        }

        return Response::success([
            'server_capacity_bytes' => $settings->getInt('server_capacity_bytes', 0),
            'user' => $updatedUser !== null ? \ProjectCloud\Services\AuthService::publicUser($updatedUser) : null,
        ]);
    }

    /** POST /admin/settings/logo — Sube un logo (favicon, white, dark, mobile) */
    public function uploadLogo(Request $request): Response
    {
        $type = $request->post('type');
        $validTypes = ['favicon', 'white', 'dark', 'mobile'];
        if (!in_array($type, $validTypes, true)) {
            throw HttpException::badRequest('Tipo de logo inválido.');
        }

        $file = $request->file('file');
        if ($file === null || $file['error'] !== UPLOAD_ERR_OK) {
            throw HttpException::badRequest('No se recibió el archivo o hubo un error al subirlo.');
        }

        // Validar tamaño máximo 5MB (para que no abusen)
        if ($file['size'] > 5 * 1024 * 1024) {
            throw HttpException::badRequest('El logo no debe superar los 5MB.');
        }

        $mime = mime_content_type($file['tmp_name']);
        $allowedMimes = ['image/png', 'image/jpeg', 'image/x-icon', 'image/vnd.microsoft.icon'];
        if (!in_array($mime, $allowedMimes, true)) {
            throw HttpException::badRequest('Formato no permitido. Solo se aceptan PNG, JPG y ICO.');
        }

        // Si es favicon, validar resolución max 512x512
        if ($type === 'favicon') {
            $info = getimagesize($file['tmp_name']);
            if ($info !== false) {
                if ($info[0] > 512 || $info[1] > 512) {
                    throw HttpException::badRequest('El favicon no puede superar los 512x512 píxeles.');
                }
            }
        }

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (!$ext) {
            // asume extensión por mime si puede
            $map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/svg+xml' => 'svg', 'image/webp' => 'webp', 'image/x-icon' => 'ico'];
            $ext = $map[$mime] ?? 'png';
        }
        
        $filename = "logo_{$type}_" . time() . ".{$ext}";
        $destDir = __DIR__ . '/../../../storage/platform';
        
        if (!is_dir($destDir)) {
            mkdir($destDir, 0777, true);
        }

        $dest = $destDir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new HttpException(500, 'UPLOAD_ERROR', 'No se pudo guardar la imagen.');
        }

        $settings = new SettingsRepository();
        // Obtener el viejo para borrarlo
        $oldFile = $settings->get("logo_{$type}");
        if ($oldFile && file_exists($destDir . '/' . $oldFile)) {
            @unlink($destDir . '/' . $oldFile);
        }

        $settings->set("logo_{$type}", $filename);
        ActivityLogger::log($request, 'settings.update', 'setting', null, ["logo_{$type}" => $filename]);

        return Response::success(['ok' => true, 'filename' => $filename]);
    }

    /** GET /admin/activity */
    public function activity(Request $request): Response
    {
        $limit = min(100, max(1, (int) ($request->query['limit'] ?? 30)));
        $page = max(1, (int) ($request->query['page'] ?? 1));
        $result = (new ActivityRepository())->paginate($limit, ($page - 1) * $limit);

        $items = array_map(static fn (array $r): array => [
            'id'          => (int) $r['id'],
            'action'      => (string) $r['action'],
            'entity_type' => $r['entity_type'] !== null ? (string) $r['entity_type'] : null,
            'entity_id'   => $r['entity_id'] !== null ? (int) $r['entity_id'] : null,
            'details'     => $r['details'] !== null ? json_decode((string) $r['details'], true) : null,
            'ip'          => $r['ip'] !== null ? (string) $r['ip'] : null,
            'actor'       => $r['display_name'] !== null ? (string) $r['display_name'] : ($r['username'] ?? 'Sistema'),
            'created_at'  => (string) $r['created_at'],
        ], $result['items']);

        return Response::success([
            'items' => $items,
            'total' => $result['total'],
            'page'  => $page,
            'limit' => $limit,
        ]);
    }

    // --- Helpers ---

    /** @param array<string,mixed> $u */
    private function userPublic(array $u): array
    {
        return [
            'id'               => (int) ($u['id'] ?? 0),
            'username'         => (string) ($u['username'] ?? ''),
            'email'            => (string) ($u['email'] ?? ''),
            'display_name'     => (string) ($u['display_name'] ?? ''),
            'role'             => (string) ($u['role'] ?? 'user'),
            'status'           => (string) ($u['status'] ?? 'active'),
            'quota_bytes'      => (int) ($u['quota_bytes'] ?? 0),
            'used_bytes'       => (int) ($u['used_bytes'] ?? 0),
            'max_upload_bytes' => (int) ($u['max_upload_bytes'] ?? 0),
            'created_at'       => $u['created_at'] ?? null,
        ];
    }
}
