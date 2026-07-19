<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Password;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Validator;
use ProjectCloud\Repositories\ActivityRepository;
use ProjectCloud\Repositories\RefreshTokenRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\AuthService;
use ProjectCloud\Services\AvatarService;

/**
 * Endpoints de autenticación: login, refresh, logout, me.
 */
final class AuthController
{
    private function service(): AuthService
    {
        return new AuthService(new UserRepository(), new RefreshTokenRepository());
    }

    /** POST /auth/login */
    public function login(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('login')
            ->required('password')
            ->validate();

        $result = $this->service()->login(
            (string) $data['login'],
            (string) $data['password'],
            $request->userAgent(),
            $request->ip(),
        );

        try {
            (new ActivityRepository())->log(
                (int) $result['user']['id'],
                'login',
                null,
                null,
                null,
                $request->ip(),
            );
        } catch (\Throwable) {
            // la auditoría no debe romper el login
        }

        return Response::success($result);
    }

    /** POST /auth/refresh */
    public function refresh(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('refresh_token')
            ->validate();

        $result = $this->service()->refresh(
            (string) $data['refresh_token'],
            $request->userAgent(),
            $request->ip(),
        );

        return Response::success($result);
    }

    /** POST /auth/logout */
    public function logout(Request $request): Response
    {
        $token = $request->input('refresh_token');
        if (is_string($token) && $token !== '') {
            $this->service()->logout($token);
        }
        return Response::success(['ok' => true]);
    }

    /** GET /auth/me (requiere AuthMiddleware) */
    public function me(Request $request): Response
    {
        $userId = $request->userId();
        if ($userId === null) {
            throw HttpException::unauthorized();
        }
        $user = (new UserRepository())->findById($userId);
        if ($user === null) {
            throw HttpException::unauthorized('Usuario no encontrado');
        }
        return Response::success(AuthService::publicUser($user));
    }

    /** PATCH /auth/me — actualiza el perfil propio (nombre visible y correo). */
    public function updateProfile(Request $request): Response
    {
        $userId = $request->userId();
        if ($userId === null) {
            throw HttpException::unauthorized();
        }

        $body = $request->json();
        $repo = new UserRepository();
        $current = $repo->findById($userId);
        if ($current === null) {
            throw HttpException::unauthorized('Usuario no encontrado');
        }

        $fields = [];
        if (array_key_exists('display_name', $body)) {
            $name = trim((string) $body['display_name']);
            if ($name === '') {
                throw HttpException::badRequest('El nombre no puede estar vacío.');
            }
            $fields['display_name'] = mb_substr($name, 0, 120);
        }
        if (array_key_exists('email', $body)) {
            $email = trim((string) $body['email']);
            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                throw new HttpException(422, 'INVALID_EMAIL', 'El correo no es válido.');
            }
            if ($repo->existsByUsernameOrEmail((string) $current['username'], $email, $userId)) {
                throw new HttpException(409, 'EMAIL_EXISTS', 'Ese correo ya está en uso.');
            }
            $fields['email'] = $email;
        }

        if ($fields === []) {
            throw HttpException::badRequest('Nada que actualizar.');
        }

        $repo->update($userId, $fields);
        return Response::success(AuthService::publicUser($repo->findById($userId) ?? $current));
    }

    /** POST /auth/me/avatar — sube o reemplaza la foto de perfil. */
    public function uploadAvatar(Request $request): Response
    {
        $userId = $request->userId();
        if ($userId === null) {
            throw HttpException::unauthorized();
        }
        (new AvatarService())->store($userId, $request->file('avatar') ?? []);
        $user = (new UserRepository())->findById($userId);
        if ($user === null) {
            throw HttpException::unauthorized('Usuario no encontrado');
        }
        return Response::success(AuthService::publicUser($user));
    }

    /** DELETE /auth/me/avatar — elimina la foto (vuelve a las iniciales). */
    public function deleteAvatar(Request $request): Response
    {
        $userId = $request->userId();
        if ($userId === null) {
            throw HttpException::unauthorized();
        }
        (new AvatarService())->delete($userId);
        $user = (new UserRepository())->findById($userId);
        if ($user === null) {
            throw HttpException::unauthorized('Usuario no encontrado');
        }
        return Response::success(AuthService::publicUser($user));
    }

    /** GET /auth/avatar/{id} — sirve la imagen del avatar (pública, como los logos). */
    public function serveAvatar(Request $request): void
    {
        $id = (int) $request->param('id');
        $path = (new AvatarService())->pathFor($id);
        if ($path === null) {
            throw HttpException::notFound('Sin avatar');
        }
        $mime = mime_content_type($path) ?: 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string) filesize($path));
        header('Cache-Control: public, max-age=300');
        readfile($path);
        exit;
    }

    /** POST /auth/me/password — cambia la contraseña propia (verifica la actual). */
    public function changePassword(Request $request): Response
    {
        $userId = $request->userId();
        if ($userId === null) {
            throw HttpException::unauthorized();
        }

        $data = (new Validator($request->json()))
            ->required('current_password')
            ->required('new_password')
            ->validate();

        $repo = new UserRepository();
        $user = $repo->findById($userId);
        if ($user === null) {
            throw HttpException::unauthorized('Usuario no encontrado');
        }

        if (!Password::verify((string) $data['current_password'], (string) $user['password_hash'])) {
            throw new HttpException(422, 'BAD_PASSWORD', 'La contraseña actual no es correcta.');
        }

        $new = (string) $data['new_password'];
        if (strlen($new) < 8) {
            throw new HttpException(422, 'WEAK_PASSWORD', 'La nueva contraseña debe tener al menos 8 caracteres.');
        }

        $repo->updatePassword($userId, Password::hash($new));

        try {
            (new ActivityRepository())->log($userId, 'password_change', 'user', $userId, null, $request->ip());
        } catch (\Throwable) {
            // la auditoría no debe romper la operación
        }

        return Response::success(['ok' => true]);
    }
}
