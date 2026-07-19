<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Jwt;
use ProjectCloud\Core\Password;
use ProjectCloud\Repositories\RefreshTokenRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Lógica de autenticación con JWT + refresh tokens rotatorios.
 *
 * - Access token: JWT HS256 de corta vida (~15 min), stateless.
 * - Refresh token: cadena opaca aleatoria (~30 días), guardada HASHEADA en BD,
 *   agrupada por "familia". En cada uso se ROTA (se revoca y se emite otro).
 *   Si llega un refresh ya revocado => reuso => se revoca toda la familia.
 */
final class AuthService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly RefreshTokenRepository $tokens,
    ) {
    }

    /** @return array<string,mixed> Tokens + usuario público. */
    public function login(string $login, string $password, ?string $userAgent, ?string $ip): array
    {
        $user = $this->users->findByLogin($login);

        // Verificación en tiempo (casi) constante: siempre comparamos contra un
        // hash aunque el usuario no exista, para no filtrar cuáles existen.
        $hash = $user['password_hash'] ?? '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
        $ok = Password::verify($password, $hash);

        if (!$user || !$ok) {
            throw new HttpException(401, 'INVALID_CREDENTIALS', 'Correo/usuario o contraseña incorrectos.');
        }
        if (($user['status'] ?? 'active') !== 'active') {
            throw new HttpException(403, 'ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida.');
        }

        return $this->issueTokens($user, null, $userAgent, $ip);
    }

    /** @return array<string,mixed> */
    public function refresh(string $refreshToken, ?string $userAgent, ?string $ip): array
    {
        $tokenHash = hash('sha256', $refreshToken);
        $record = $this->tokens->findByHash($tokenHash);

        if ($record === null) {
            throw new HttpException(401, 'INVALID_REFRESH', 'Sesión inválida. Inicia sesión de nuevo.');
        }

        // Detección de reuso: si ya estaba revocado, alguien lo reutilizó.
        if (($record['revoked_at'] ?? null) !== null) {
            $this->tokens->revokeFamily((string) $record['family_id']);
            throw new HttpException(401, 'REFRESH_REUSED', 'Sesión comprometida. Inicia sesión de nuevo.');
        }

        if (strtotime((string) $record['expires_at']) < time()) {
            throw new HttpException(401, 'REFRESH_EXPIRED', 'Sesión expirada. Inicia sesión de nuevo.');
        }

        $user = $this->users->findById((int) $record['user_id']);
        if ($user === null || ($user['status'] ?? 'active') !== 'active') {
            throw new HttpException(401, 'INVALID_REFRESH', 'Sesión inválida.');
        }

        // Rotación: revoca el actual y emite uno nuevo en la MISMA familia.
        $this->tokens->revokeById((int) $record['id']);
        return $this->issueTokens($user, (string) $record['family_id'], $userAgent, $ip);
    }

    public function logout(string $refreshToken): void
    {
        $record = $this->tokens->findByHash(hash('sha256', $refreshToken));
        if ($record !== null) {
            $this->tokens->revokeFamily((string) $record['family_id']);
        }
    }

    /**
     * Emite un par de tokens y persiste el refresh (hasheado).
     *
     * @param array<string,mixed> $user
     * @return array<string,mixed>
     */
    private function issueTokens(array $user, ?string $familyId, ?string $userAgent, ?string $ip): array
    {
        $familyId ??= self::uuidV4();

        $refreshRaw = bin2hex(random_bytes(32));
        $refreshTtl = (int) Config::get('jwt.refresh_ttl', 2592000);
        $expiresAt = gmdate('Y-m-d H:i:s', time() + $refreshTtl);

        $this->tokens->create(
            (int) $user['id'],
            hash('sha256', $refreshRaw),
            $familyId,
            $expiresAt,
            $userAgent !== null ? substr($userAgent, 0, 255) : null,
            $ip,
        );

        $accessTtl = (int) Config::get('jwt.access_ttl', 900);
        $accessToken = Jwt::encode([
            'sub'      => (int) $user['id'],
            'role'     => (string) $user['role'],
            'username' => (string) $user['username'],
            'email'    => (string) $user['email'],
            'jti'      => bin2hex(random_bytes(16)), // id único por token
        ], $accessTtl);

        return [
            'access_token'  => $accessToken,
            'refresh_token' => $refreshRaw,
            'token_type'    => 'Bearer',
            'expires_in'    => $accessTtl,
            'user'          => self::publicUser($user),
        ];
    }

    /**
     * Proyección pública del usuario (sin password_hash).
     *
     * @param array<string,mixed> $user
     * @return array<string,mixed>
     */
    public static function publicUser(array $user): array
    {
        return [
            'id'               => (int) $user['id'],
            'username'         => (string) $user['username'],
            'email'            => (string) $user['email'],
            'display_name'     => (string) $user['display_name'],
            'role'             => (string) $user['role'],
            'quota_bytes'      => (int) $user['quota_bytes'],
            'used_bytes'       => (int) $user['used_bytes'],
            'max_upload_bytes' => (int) $user['max_upload_bytes'],
            'avatar_url'       => AvatarService::urlFor((int) $user['id']),
            'created_at'       => $user['created_at'] ?? null,
        ];
    }

    private static function uuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
