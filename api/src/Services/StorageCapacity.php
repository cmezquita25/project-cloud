<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Config;
use ProjectCloud\Core\Paths;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Espacio libre real para la plataforma.
 *
 * En un hosting compartido o una suscripción de Plesk, disk_free_space() mide
 * el disco físico del servidor (cientos de GB) y no la cuota de la suscripción,
 * que PHP no puede leer. La referencia es la capacidad asignada a la plataforma
 * (definida en la instalación y editable en «Límites del Servidor»):
 *
 *   libre = capacidad − (unidades + unidad compartida + copias de seguridad)
 *
 * y nunca más de lo que de verdad queda en el disco. Sin capacidad configurada,
 * se usa el disco.
 */
final class StorageCapacity
{
    /** @return array{free:?int, capacity:int, used:int, backups:int, disk_free:?int, source:string} */
    public static function status(): array
    {
        $capacity = (new SettingsRepository())->getInt('server_capacity_bytes', 0);
        $used = (int) (new UserRepository())->stats()['used'] + (int) ((new AssetsService())->getStorageStats()['total_bytes'] ?? 0);
        $backups = 0;
        foreach (glob(Paths::var('backups') . DIRECTORY_SEPARATOR . '*.zip') ?: [] as $zip) {
            $backups += (int) @filesize($zip);
        }

        $disk = @disk_free_space(rtrim((string) Config::get('storage.path', ''), '/\\') ?: Paths::apiRoot());
        $disk = $disk === false ? null : (int) $disk;

        if ($capacity > 0) {
            $free = max(0, $capacity - $used - $backups);
            if ($disk !== null) {
                $free = min($free, $disk);
            }
            return ['free' => $free, 'capacity' => $capacity, 'used' => $used, 'backups' => $backups, 'disk_free' => $disk, 'source' => 'capacity'];
        }

        return ['free' => $disk, 'capacity' => 0, 'used' => $used, 'backups' => $backups, 'disk_free' => $disk, 'source' => 'disk'];
    }

    /** Bytes libres (null si no se pudo medir). */
    public static function free(): ?int
    {
        return self::status()['free'];
    }
}
