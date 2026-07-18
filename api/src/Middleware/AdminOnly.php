<?php

declare(strict_types=1);

namespace ProjectCloud\Middleware;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Middleware;
use ProjectCloud\Core\Request;

/**
 * Restringe la ruta a administradores. Debe ejecutarse DESPUÉS de AuthMiddleware.
 */
final class AdminOnly implements Middleware
{
    public function handle(Request $request): void
    {
        $user = $request->user();
        if ($user === null) {
            throw HttpException::unauthorized('No autenticado');
        }
        if (($user['role'] ?? 'user') !== 'admin') {
            throw HttpException::forbidden('Se requieren permisos de administrador');
        }
    }
}
