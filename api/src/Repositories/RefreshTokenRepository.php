<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Acceso a datos de refresh tokens. Los tokens se guardan HASHEADOS (SHA-256);
 * nunca en claro. Soporta rotación por familia y detección de reuso.
 */
class RefreshTokenRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function create(
        int $userId,
        string $tokenHash,
        string $familyId,
        string $expiresAt,
        ?string $userAgent,
        ?string $ip,
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $tokenHash, $familyId, $expiresAt, $userAgent, $ip]);
    }

    public function findByHash(string $tokenHash): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1');
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function revokeById(int $id): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL'
        );
        $stmt->execute([$id]);
    }

    /** Revoca TODA la familia (usado ante reuso o logout). */
    public function revokeFamily(string $familyId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE family_id = ? AND revoked_at IS NULL'
        );
        $stmt->execute([$familyId]);
    }

    /** Revoca TODAS las sesiones de un usuario (p. ej. tras restablecer contraseña). */
    public function revokeAllForUser(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL'
        );
        $stmt->execute([$userId]);
    }

    /** Limpieza oportunista de tokens expirados. */
    public function deleteExpired(): void
    {
        $this->pdo->query('DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP()');
    }
}
