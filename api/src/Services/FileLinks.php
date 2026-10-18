<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\SignedUrl;

/**
 * Enlaces de un archivo para la API, según su visibilidad:
 *
 *   público → url y public_url = URL directa de /storage (la de siempre)
 *   privado → url = enlace firmado temporal (vista previa y descarga);
 *             public_url = null (no tiene URL directa)
 */
final class FileLinks
{
    /**
     * @param array<string,mixed> $file
     * @return array{url:string, public_url:?string, thumbnail_url:?string, visibility:string}
     */
    public static function for(array $file, string $ownerUsername): array
    {
        if (($file['visibility'] ?? 'public') === 'private') {
            $id = (int) $file['id'];
            return [
                'url'           => SignedUrl::file($id, 'content'),
                'public_url'    => null,
                'thumbnail_url' => SignedUrl::file($id, 'thumb', ['s' => 400]),
                'visibility'    => 'private',
            ];
        }

        $public = FileService::publicUrl($ownerUsername, (string) $file['path']);
        return ['url' => $public, 'public_url' => $public, 'thumbnail_url' => null, 'visibility' => 'public'];
    }
}
