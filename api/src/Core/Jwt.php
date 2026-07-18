<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Implementación mínima y segura de JWT con HS256 (sin dependencias).
 * Verifica firma con hash_equals (tiempo constante) y valida exp/nbf/iss.
 */
final class Jwt
{
    /**
     * Firma un conjunto de claims. Añade iat/exp/iss automáticamente.
     *
     * @param array<string,mixed> $claims
     */
    public static function encode(array $claims, int $ttlSeconds, ?int $now = null): string
    {
        $now ??= time();
        $secret = self::secret();

        $payload = array_merge($claims, [
            'iss' => (string) Config::get('jwt.issuer', 'project-cloud'),
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $ttlSeconds,
        ]);

        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $segments = [
            self::base64UrlEncode(self::jsonEncode($header)),
            self::base64UrlEncode(self::jsonEncode($payload)),
        ];
        $signingInput = implode('.', $segments);
        $signature = hash_hmac('sha256', $signingInput, $secret, true);
        $segments[] = self::base64UrlEncode($signature);

        return implode('.', $segments);
    }

    /**
     * Verifica y decodifica un token. Lanza HttpException(401) si es inválido/expirado.
     *
     * @return array<string,mixed> Claims
     */
    public static function decode(string $token, ?int $now = null): array
    {
        $now ??= time();
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw HttpException::unauthorized('Token malformado', 'TOKEN_INVALID');
        }
        [$headerB64, $payloadB64, $signatureB64] = $parts;

        // Verifica algoritmo declarado.
        $header = json_decode(self::base64UrlDecode($headerB64), true);
        if (!is_array($header) || ($header['alg'] ?? null) !== 'HS256') {
            throw HttpException::unauthorized('Algoritmo de token no soportado', 'TOKEN_INVALID');
        }

        // Verifica firma en tiempo constante.
        $expected = hash_hmac('sha256', "$headerB64.$payloadB64", self::secret(), true);
        $provided = self::base64UrlDecode($signatureB64);
        if (!hash_equals($expected, $provided)) {
            throw HttpException::unauthorized('Firma de token inválida', 'TOKEN_INVALID');
        }

        $payload = json_decode(self::base64UrlDecode($payloadB64), true);
        if (!is_array($payload)) {
            throw HttpException::unauthorized('Token malformado', 'TOKEN_INVALID');
        }

        // Validaciones temporales (con 60s de margen de reloj).
        $leeway = 60;
        if (isset($payload['nbf']) && $now + $leeway < (int) $payload['nbf']) {
            throw HttpException::unauthorized('Token aún no válido', 'TOKEN_INVALID');
        }
        if (isset($payload['exp']) && $now - $leeway >= (int) $payload['exp']) {
            throw HttpException::unauthorized('Token expirado', 'TOKEN_EXPIRED');
        }

        return $payload;
    }

    private static function secret(): string
    {
        $secret = (string) Config::get('jwt.secret', '');
        if ($secret === '' || $secret === 'CHANGE_ME') {
            throw new HttpException(500, 'CONFIG_ERROR', 'Secreto JWT no configurado');
        }
        return $secret;
    }

    private static function jsonEncode(mixed $value): string
    {
        return (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder !== 0) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}
