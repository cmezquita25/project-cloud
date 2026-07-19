<?php

declare(strict_types=1);

namespace ProjectCloud\Repositories;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Tokens de restablecimiento de contraseña. Igual que refresh_tokens, se guardan
 * HASHEADOS (SHA-256); el token en claro solo viaja en el enlace del correo.
 * Son de un solo uso (used_at) y caducan (expires_at).
 */
class PasswordResetRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function create(int $userId, string $tokenHash, string $expiresAt, ?string $ip): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $tokenHash, $expiresAt, $ip]);
    }

    /** Devuelve el token si existe, no está usado y no ha caducado. */
    public function findValidByHash(string $tokenHash): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM password_reset_tokens
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
             LIMIT 1'
        );
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function markUsed(int $id): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL'
        );
        $stmt->execute([$id]);
    }

    /** Invalida tokens previos aún válidos de un usuario (al emitir uno nuevo). */
    public function invalidateForUser(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP()
             WHERE user_id = ? AND used_at IS NULL'
        );
        $stmt->execute([$userId]);
    }

    /** Limpieza oportunista de tokens caducados. */
    public function deleteExpired(): void
    {
        $this->pdo->query('DELETE FROM password_reset_tokens WHERE expires_at < UTC_TIMESTAMP()');
    }
}
