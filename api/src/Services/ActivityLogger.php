<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Request;
use ProjectCloud\Repositories\ActivityRepository;

/**
 * Ayudante para registrar actividad sin romper la operación principal si falla.
 */
final class ActivityLogger
{
    /** @param array<string,mixed>|null $details */
    public static function log(
        Request $request,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        ?array $details = null,
    ): void {
        try {
            (new ActivityRepository())->log(
                $request->userId(),
                $action,
                $entityType,
                $entityId,
                $details,
                $request->ip(),
            );
        } catch (\Throwable) {
            // La auditoría nunca debe tumbar la petición.
        }
    }
}
