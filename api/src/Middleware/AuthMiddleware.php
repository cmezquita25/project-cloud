<?php

declare(strict_types=1);

namespace ProjectCloud\Middleware;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Jwt;
use ProjectCloud\Core\Middleware;
use ProjectCloud\Core\Request;
use ProjectCloud\Repositories\UserRepository;

/**
 * Exige un access token JWT válido en `Authorization: Bearer`.
 * Adjunta el usuario a la Request y verifica que su cuenta esté activa.
 */
final class AuthMiddleware implements Middleware
{
    public function handle(Request $request): void
    {
        $token = $request->bearerToken();
        if ($token === null) {
            throw HttpException::unauthorized('Falta el token de acceso');
        }

        $claims = Jwt::decode($token);

        // Los access tokens llevan el id del usuario en `sub`.
        $userId = isset($claims['sub']) ? (int) $claims['sub'] : 0;
        if ($userId <= 0) {
            throw HttpException::unauthorized('Token sin sujeto válido', 'TOKEN_INVALID');
        }

        // Verificación de estado activo en BD
        $user = (new UserRepository())->findById($userId);
        if ($user === null || ($user['status'] ?? 'active') !== 'active') {
            throw HttpException::unauthorized('Tu cuenta ha sido suspendida. Ponte en contacto con el administrador.', 'ACCOUNT_SUSPENDED');
        }

        $request->setUser([
            'id'           => $userId,
            'role'         => (string) ($user['role'] ?? 'user'),
            'username'     => (string) ($user['username'] ?? ''),
            'email'        => (string) ($user['email'] ?? ''),
            'display_name' => (string) ($user['display_name'] ?? ''),
        ]);
    }
}
