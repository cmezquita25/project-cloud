<?php

declare(strict_types=1);

namespace ProjectCloud\Middleware;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Jwt;
use ProjectCloud\Core\Middleware;
use ProjectCloud\Core\Request;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\SessionRevoker;

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

        // Cierre global de sesiones: los tokens de una época anterior ya no valen
        // (los emitidos antes de existir el claim cuentan como época 0).
        if ((int) ($claims['ep'] ?? 0) < SessionRevoker::currentEpoch()) {
            throw HttpException::unauthorized('Tu sesión se cerró. Inicia sesión de nuevo.', 'SESSION_REVOKED');
        }

        // Verificación de estado activo en BD
        $user = (new UserRepository())->findById($userId);
        if ($user === null || ($user['status'] ?? 'active') !== 'active') {
            throw HttpException::unauthorized('Tu cuenta ha sido suspendida. Ponte en contacto con el administrador.', 'ACCOUNT_SUSPENDED');
        }

        try {
            (new UserRepository())->touchLastSeen($userId);
        } catch (\Throwable) {
            // Nunca bloquea la petición (p. ej. durante una actualización, antes de migrar).
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
