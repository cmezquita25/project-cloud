<?php

declare(strict_types=1);

namespace ProjectCloud\Middleware;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Jwt;
use ProjectCloud\Core\Middleware;
use ProjectCloud\Core\Request;

/**
 * Exige un access token JWT válido en `Authorization: Bearer`.
 * Adjunta el usuario (derivado de los claims) a la Request.
 *
 * El access token es stateless; la verificación contra BD (status, revocación)
 * se refuerza en la Fase 3 con el UserRepository.
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

        $request->setUser([
            'id'           => $userId,
            'role'         => (string) ($claims['role'] ?? 'user'),
            'username'     => (string) ($claims['username'] ?? ''),
            'email'        => (string) ($claims['email'] ?? ''),
            'display_name' => (string) ($claims['display_name'] ?? ''),
        ]);
    }
}
