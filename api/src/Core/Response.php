<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Respuesta JSON uniforme:
 *   { "success": bool, "data": mixed|null, "error": {code,message,details?}|null }
 *
 * Es un objeto-valor: el front controller llama a send() una sola vez al final.
 */
final class Response
{
    /**
     * @param array<string,mixed> $headers
     */
    private function __construct(
        private readonly int $status,
        private readonly bool $success,
        private readonly mixed $data,
        private readonly ?array $error,
        private array $headers = [],
    ) {
    }

    public static function success(mixed $data = null, int $status = 200): self
    {
        return new self($status, true, $data, null);
    }

    public static function created(mixed $data = null): self
    {
        return new self(201, true, $data, null);
    }

    public static function noContent(): self
    {
        return new self(204, true, null, null);
    }

    public static function error(string $code, string $message, int $status = 400, mixed $details = null): self
    {
        $error = ['code' => $code, 'message' => $message];
        if ($details !== null) {
            $error['details'] = $details;
        }
        return new self($status, false, null, $error);
    }

    public static function fromException(HttpException $e): self
    {
        return self::error($e->errorCode, $e->getMessage(), $e->status, $e->details);
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function send(): void
    {
        if ($this->status === 204) {
            http_response_code($this->status);
            if (!headers_sent()) {
                foreach ($this->headers as $name => $value) {
                    header("$name: $value");
                }
            }
            return;
        }

        $json = json_encode([
            'success' => $this->success,
            'data'    => $this->data,
            'error'   => $this->error,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // Auto-ETag para respuestas GET exitosas
        if ($this->status === 200 && isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'GET') {
            $etag = '"' . md5($json) . '"';
            $this->headers['ETag'] = $etag;
            
            if (!isset($this->headers['Cache-Control'])) {
                $this->headers['Cache-Control'] = 'private, must-revalidate';
            }

            $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? null;
            if ($ifNoneMatch !== null && trim($ifNoneMatch) === $etag) {
                http_response_code(304);
                if (!headers_sent()) {
                    foreach ($this->headers as $name => $value) {
                        header("$name: $value");
                    }
                }
                return;
            }
        }

        http_response_code($this->status);

        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            foreach ($this->headers as $name => $value) {
                header("$name: $value");
            }
        }

        echo $json;
    }
}
