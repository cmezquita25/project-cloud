<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Representa la petición HTTP entrante: método, ruta normalizada, query,
 * cabeceras, cuerpo JSON y parámetros de ruta. El AuthMiddleware adjunta
 * el usuario autenticado.
 */
final class Request
{
    /** @var array<string,string> */
    public array $params = [];

    /** @var array<string,mixed>|null Usuario autenticado (lo pone AuthMiddleware). */
    private ?array $user = null;

    /** @var array<string,mixed>|null Cuerpo JSON parseado (lazy). */
    private ?array $body = null;

    /**
     * @param array<string,mixed> $query
     * @param array<string,string> $headers
     */
    private function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
    ) {
    }

    public static function capture(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // Normaliza: elimina el prefijo /api (y /index.php si viniera) para
        // enrutar contra rutas limpias tipo /v1/health.
        $path = preg_replace('#^/api(/index\.php)?#', '', $uri) ?? $uri;
        $path = '/' . trim(rawurldecode($path), '/');

        return new self($method, $path, $_GET, self::collectHeaders());
    }

    /** @return array<string,string> */
    private static function collectHeaders(): array
    {
        $headers = [];

        // Cabeceras reales del SAPI (Apache/FPM). Suele incluir Authorization
        // aunque $_SERVER no lo exponga.
        if (function_exists('getallheaders')) {
            $all = getallheaders();
            if (is_array($all)) {
                foreach ($all as $name => $value) {
                    $headers[(string) $name] = (string) $value;
                }
            }
        }

        // Complementa desde $_SERVER (sin sobreescribir lo anterior).
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with((string) $key, 'HTTP_')) {
                $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr((string) $key, 5)))));
                $headers[$name] ??= (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['Content-Type'] ??= (string) $_SERVER['CONTENT_TYPE'];
        }

        // Muchos Apache no pasan Authorization a PHP-FPM; puede llegar vía
        // REDIRECT_HTTP_AUTHORIZATION (tras el rewrite del .htaccess).
        $hasAuth = false;
        foreach ($headers as $k => $_) {
            if (strcasecmp($k, 'Authorization') === 0) {
                $hasAuth = true;
                break;
            }
        }
        if (!$hasAuth) {
            $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
            if ($auth !== '') {
                $headers['Authorization'] = (string) $auth;
            }
        }

        return $headers;
    }

    public function header(string $name): ?string
    {
        // Búsqueda case-insensitive.
        foreach ($this->headers as $key => $value) {
            if (strcasecmp($key, $name) === 0) {
                return $value;
            }
        }
        return null;
    }

    /** Extrae el token del header `Authorization: Bearer <token>`. */
    public function bearerToken(): ?string
    {
        $auth = $this->header('Authorization');
        if ($auth !== null && preg_match('/^Bearer\s+(.+)$/i', $auth, $m) === 1) {
            return trim($m[1]);
        }
        return null;
    }

    /** @return array<string,mixed> Cuerpo JSON parseado (vacío si no hay o es inválido). */
    public function json(): array
    {
        if ($this->body === null) {
            $raw = file_get_contents('php://input') ?: '';
            $decoded = $raw !== '' ? json_decode($raw, true) : [];
            $this->body = is_array($decoded) ? $decoded : [];
        }
        return $this->body;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->json()[$key] ?? $this->query[$key] ?? $default;
    }

    public function param(string $key, ?string $default = null): ?string
    {
        return $this->params[$key] ?? $default;
    }

    public function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    public function userAgent(): string
    {
        return substr($this->header('User-Agent') ?? '', 0, 255);
    }

    // --- Usuario autenticado ---

    /** @param array<string,mixed> $user */
    public function setUser(array $user): void
    {
        $this->user = $user;
    }

    /** @return array<string,mixed>|null */
    public function user(): ?array
    {
        return $this->user;
    }

    public function userId(): ?int
    {
        return isset($this->user['id']) ? (int) $this->user['id'] : null;
    }
}
