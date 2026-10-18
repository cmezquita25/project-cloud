<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\SignedUrl;

/**
 * Enlaces de un archivo para la API, según su visibilidad:
 *
 *   público → url y public_url = URL directa de /storage (la de siempre)
 *   privado → url = enlace firmado temporal (vista previa);
 *             public_url = null (no tiene URL directa)
 *
 * download_url: descarga, o null si quien mira tiene la descarga bloqueada
 * por su invitación. En los privados lleva una firma propia: la del enlace de
 * vista previa no sirve para descargar.
 */
final class FileLinks
{
    /**
     * @param array<string,mixed> $file
     * @return array{url:string, public_url:?string, download_url:?string, thumbnail_url:?string, visibility:string}
     */
    public static function for(array $file, string $ownerUsername, bool $canDownload = true): array
    {
        if (($file['visibility'] ?? 'public') === 'private') {
            $id = (int) $file['id'];
            return [
                'url'           => SignedUrl::file($id, 'content'),
                'public_url'    => null,
                'download_url'  => $canDownload ? SignedUrl::file($id, 'download', ['download' => 1]) : null,
                'thumbnail_url' => SignedUrl::file($id, 'thumb', ['s' => 400]),
                'visibility'    => 'private',
            ];
        }

        $public = FileService::publicUrl($ownerUsername, (string) $file['path']);
        return [
            'url'           => $public,
            // Con la descarga bloqueada tampoco se ofrece la URL directa (aunque
            // un archivo público siga siendo accesible por ella).
            'public_url'    => $canDownload ? $public : null,
            'download_url'  => $canDownload ? $public : null,
            'thumbnail_url' => null,
            'visibility'    => 'public',
        ];
    }
}
