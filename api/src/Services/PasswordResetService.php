<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Repositories\PasswordResetRepository;

/**
 * Emisión y validación de tokens de restablecimiento de contraseña.
 * El token en claro se devuelve solo al emitir (para el enlace del correo);
 * en BD vive únicamente su hash.
 */
final class PasswordResetService
{
    /** Vigencia del enlace en minutos. */
    public const TTL_MINUTES = 60;

    private PasswordResetRepository $repo;

    public function __construct(?PasswordResetRepository $repo = null)
    {
        $this->repo = $repo ?? new PasswordResetRepository();
    }

    /**
     * Crea un token de un solo uso e invalida los anteriores del usuario.
     * Devuelve la cadena en claro para construir el enlace.
     */
    public function issue(int $userId, ?string $ip): string
    {
        $this->repo->invalidateForUser($userId);
        $raw = bin2hex(random_bytes(32));
        $expiresAt = gmdate('Y-m-d H:i:s', time() + self::TTL_MINUTES * 60);
        $this->repo->create($userId, hash('sha256', $raw), $expiresAt, $ip);
        return $raw;
    }

    /** Devuelve el registro válido para un token en claro, o null. */
    public function validate(string $rawToken): ?array
    {
        if ($rawToken === '') {
            return null;
        }
        return $this->repo->findValidByHash(hash('sha256', $rawToken));
    }

    public function consume(int $id): void
    {
        $this->repo->markUsed($id);
    }
}
