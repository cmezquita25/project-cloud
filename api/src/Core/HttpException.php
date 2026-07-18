<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

use RuntimeException;
use Throwable;

/**
 * Excepción que se traduce en una respuesta de error JSON con código HTTP.
 * Los controladores/servicios la lanzan; el front controller la captura.
 */
final class HttpException extends RuntimeException
{
    /**
     * @param int         $status    Código HTTP (400, 401, 403, 404, 422, 429...)
     * @param string      $errorCode Código de error estable para el cliente (p.ej. NOT_FOUND)
     * @param string      $message   Mensaje legible
     * @param mixed       $details   Detalles opcionales (p.ej. errores de validación)
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly mixed $details = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    // --- Fábricas de conveniencia ---

    public static function badRequest(string $message, string $code = 'BAD_REQUEST'): self
    {
        return new self(400, $code, $message);
    }

    public static function unauthorized(string $message = 'No autenticado', string $code = 'UNAUTHORIZED'): self
    {
        return new self(401, $code, $message);
    }

    public static function forbidden(string $message = 'Acceso denegado', string $code = 'FORBIDDEN'): self
    {
        return new self(403, $code, $message);
    }

    public static function notFound(string $message = 'Recurso no encontrado', string $code = 'NOT_FOUND'): self
    {
        return new self(404, $code, $message);
    }

    public static function validation(mixed $errors, string $message = 'Datos inválidos'): self
    {
        return new self(422, 'VALIDATION_ERROR', $message, $errors);
    }

    public static function tooManyRequests(string $message = 'Demasiadas solicitudes'): self
    {
        return new self(429, 'RATE_LIMITED', $message);
    }
}
