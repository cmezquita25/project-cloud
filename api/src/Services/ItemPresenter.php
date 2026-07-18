<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

/**
 * Da forma pública y uniforme a carpetas y archivos para las respuestas de la
 * API (explorador, papelera, recientes, destacados, búsqueda). Mantiene un solo
 * contrato de serialización reutilizable por los controladores de la Fase 7.
 */
final class ItemPresenter
{
    /** @param array<string,mixed> $f */
    public static function folder(array $f): array
    {
        return [
            'type'       => 'folder',
            'id'         => (int) $f['id'],
            'parent_id'  => $f['parent_id'] !== null ? (int) $f['parent_id'] : null,
            'name'       => (string) $f['name'],
            'path'       => (string) $f['path'],
            'is_starred' => (bool) $f['is_starred'],
            'deleted_at' => $f['deleted_at'] ?? null,
            'created_at' => $f['created_at'] ?? null,
            'updated_at' => $f['updated_at'] ?? null,
        ];
    }

    /** @param array<string,mixed> $f */
    public static function file(array $f, string $username): array
    {
        return [
            'type'       => 'file',
            'id'         => (int) $f['id'],
            'folder_id'  => $f['folder_id'] !== null ? (int) $f['folder_id'] : null,
            'name'       => (string) $f['name'],
            'path'       => (string) $f['path'],
            'size_bytes' => (int) $f['size_bytes'],
            'mime_type'  => $f['mime_type'] !== null ? (string) $f['mime_type'] : null,
            'extension'  => $f['extension'] !== null ? (string) $f['extension'] : null,
            'is_starred' => (bool) $f['is_starred'],
            'url'        => FileService::publicUrl($username, (string) $f['path']),
            'deleted_at' => $f['deleted_at'] ?? null,
            'created_at' => $f['created_at'] ?? null,
            'updated_at' => $f['updated_at'] ?? null,
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $folders
     * @return array<int,array<string,mixed>>
     */
    public static function folders(array $folders): array
    {
        return array_map(static fn (array $f): array => self::folder($f), $folders);
    }

    /**
     * @param array<int,array<string,mixed>> $files
     * @return array<int,array<string,mixed>>
     */
    public static function files(array $files, string $username): array
    {
        return array_map(static fn (array $f): array => self::file($f, $username), $files);
    }
}
