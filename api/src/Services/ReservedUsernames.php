<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

/**
 * Nombres que no pueden usarse como usuario.
 *
 * Cada usuario tiene su carpeta en storage/{username}, y la raíz de storage
 * también aloja carpetas del sistema (logos, temporales, copias antiguas…).
 * Un usuario llamado igual que una de ellas mezclaría sus archivos con los del
 * sistema o los expondría por URL. Los nombres que empiezan por punto quedan
 * reservados para carpetas internas (.trash, .uploads, .private…).
 */
final class ReservedUsernames
{
    private const NAMES = [
        'backups',  // copias antiguas (storage/backups)
        'platform', // logos de la plataforma (storage/platform)
        'private',  // archivos privados (reservado para enlaces compartidos)
        'system',
        'tmp',
        'var',
    ];

    public static function isReserved(string $username): bool
    {
        $username = strtolower(trim($username));
        return str_starts_with($username, '.') || in_array($username, self::NAMES, true);
    }
}
