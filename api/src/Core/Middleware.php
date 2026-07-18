<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Contrato de middleware. Se ejecuta antes del handler de la ruta.
 * Para cortocircuitar (rechazar), lanza una HttpException.
 * Puede mutar la Request (p.ej. adjuntar el usuario autenticado).
 */
interface Middleware
{
    public function handle(Request $request): void;
}
