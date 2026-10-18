<?php

declare(strict_types=1);

namespace ProjectCloud\Services\ShareLinks;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Middleware\AuthMiddleware;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\ShareLinkRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\AssetsService;
use ProjectCloud\Services\FileStreamer;
use ProjectCloud\Services\PrivateFileStore;
use ProjectCloud\Services\ThumbnailService;

/**
 * Lo que ve quien abre un enlace /s/{token}: solo lectura, sin sesión (salvo
 * «Solo miembros»).
 *
 * Todo lo que llega del visitante (subcarpeta, archivo) se interpreta RELATIVO
 * al destino del enlace y se comprueba que de verdad esté dentro: por id en Mi
 * unidad (subiendo por los padres) y por ruta en la unidad compartida (sin «..»
 * ni carpetas ocultas). Lo que esté fuera responde 404, como si no existiera.
 * No hay ninguna operación de escritura.
 */
final class PublicLinkService
{
    private const PAGE_MAX = 200;

    private ShareLinkRepository $links;

    public function __construct(?ShareLinkRepository $links = null)
    {
        $this->links = $links ?? new ShareLinkRepository();
    }

    /**
     * GET /public/links/{token} — abre el enlace: comprueba su estado, el
     * acceso, cuenta la visita y devuelve lo necesario para pintar la página.
     *
     * @return array<string,mixed>
     */
    public function open(string $token, Request $request): array
    {
        $ctx = $this->load($token);
        $user = $this->gate($ctx, $request);
        $key = $this->keyFor($ctx, $request, $user);

        $link = $ctx['link'];
        $this->links->recordHit((int) $link['id'], 'view', LinkKeys::ipHash($request->ip()), $user['id'] ?? null, $request->userAgent());

        $data = [
            'key'  => $key,
            'link' => [
                'target_type'    => (string) $link['target_type'],
                'access'         => (string) $link['access'],
                'allow_download' => (bool) $link['allow_download'],
                'expires_in'     => $link['expires_at'] !== null ? (int) $link['expires_in'] : null,
            ],
            'name' => $ctx['name'],
        ];
        if ($link['target_type'] === 'file') {
            $data['file'] = $this->presentFile($ctx, $this->resolveFile($ctx, null), null, $key);
        }
        return $data;
    }

    /**
     * POST /public/links/{token}/unlock — contraseña del enlace. Devuelve la
     * llave de paso para las siguientes peticiones.
     */
    public function unlock(string $token, Request $request): string
    {
        $ctx = $this->load($token);
        $link = $ctx['link'];
        $user = $this->optionalUser($request);
        if ($link['access'] === 'members' && $user === null) {
            throw new HttpException(403, 'LINK_LOGIN_REQUIRED', 'Este enlace es solo para miembros de la organización. Inicia sesión para abrirlo.');
        }
        if ($link['password_hash'] !== null
            && !password_verify((string) ($request->json()['password'] ?? ''), (string) $link['password_hash'])) {
            throw new HttpException(403, 'LINK_PASSWORD_INVALID', 'La contraseña no es correcta.');
        }
        return LinkKeys::accessKey($link);
    }

    /**
     * GET /public/links/{token}/items?folder=&sort=&order=&offset=&limit= —
     * contenido de la carpeta compartida o de una subcarpeta suya.
     *
     * @return array<string,mixed>
     */
    public function items(string $token, Request $request): array
    {
        $ctx = $this->load($token);
        if ($ctx['link']['target_type'] !== 'folder') {
            throw HttpException::notFound('Este enlace no es de una carpeta.');
        }
        $user = $this->gate($ctx, $request);
        $key = $this->keyFor($ctx, $request, $user);

        $ref = trim((string) $request->input('folder', ''));
        $sort = (string) $request->input('sort', 'name');
        $order = strtolower((string) $request->input('order', 'asc')) === 'desc' ? 'desc' : 'asc';
        $limit = max(1, min(self::PAGE_MAX, (int) $request->input('limit', 100)));
        $offset = max(0, (int) $request->input('offset', 0));

        return $ctx['link']['scope'] === 'org'
            ? $this->orgItems($ctx, $ref, $sort, $order, $limit, $offset, $key)
            : $this->driveItems($ctx, $ref, $sort, $order, $limit, $offset, $key);
    }

    /** GET /public/links/{token}/content?f=&download=1 — vista previa o descarga. */
    public function content(string $token, Request $request): void
    {
        $ctx = $this->load($token);
        $this->gate($ctx, $request);
        $file = $this->resolveFile($ctx, $request->input('f'));
        $link = $ctx['link'];

        $download = (bool) $request->input('download');
        $mime = $file['mime'] ?: 'application/octet-stream';
        // Sin descarga permitida tampoco se sirven los tipos que solo pueden ir como descarga.
        if (!(bool) $link['allow_download'] && ($download || FileStreamer::isActiveType($mime))) {
            throw new HttpException(403, 'LINK_NO_DOWNLOAD', 'Este enlace no permite descargar archivos.');
        }
        // Una descarga se cuenta una vez: las peticiones por rangos que la continúan no.
        $range = (string) ($_SERVER['HTTP_RANGE'] ?? '');
        if ($download && ($range === '' || str_starts_with($range, 'bytes=0-'))) {
            $user = $this->optionalUser($request);
            $this->links->recordHit((int) $link['id'], 'download', LinkKeys::ipHash($request->ip()), $user['id'] ?? null, $request->userAgent());
        }
        FileStreamer::send($file['abs'], $file['name'], $mime, $download);
    }

    /** GET /public/links/{token}/thumb?f=&s= — miniatura de una imagen. */
    public function thumb(string $token, Request $request): void
    {
        $ctx = $this->load($token);
        $this->gate($ctx, $request);
        $file = $this->resolveFile($ctx, $request->input('f'));
        if (!str_starts_with((string) $file['mime'], 'image/')) {
            throw HttpException::notFound('Sin miniatura');
        }
        (new ThumbnailService())->stream($file['abs'], max(64, min(1024, (int) $request->input('s', 400))), true);
    }

    // --- Estado y acceso ---

    /**
     * Carga el enlace y su destino. Los motivos por los que no se puede abrir
     * se distinguen (la página muestra un mensaje distinto para cada uno).
     *
     * @return array{link:array<string,mixed>,name:string,owner:?array<string,mixed>,row:?array<string,mixed>,root:?string}
     */
    private function load(string $token): array
    {
        $link = LinkKeys::isToken($token) ? $this->links->findByToken($token) : null;
        if ($link === null) {
            throw HttpException::notFound('Revisa que la dirección esté completa o pide el enlace de nuevo.', 'LINK_NOT_FOUND');
        }
        if ($link['revoked_at'] !== null) {
            throw new HttpException(410, 'LINK_REVOKED', 'Quien lo compartió lo desactivó. Pídele un enlace nuevo si aún lo necesitas.');
        }
        if ((int) $link['is_expired'] === 1) {
            throw new HttpException(410, 'LINK_EXPIRED', 'Pasó la fecha de caducidad que puso quien lo compartió.');
        }

        $users = new UserRepository();
        $creator = $users->findById((int) $link['created_by']);
        if ($creator === null || ($creator['status'] ?? 'active') !== 'active') {
            throw self::unavailable();
        }

        if ($link['scope'] === 'org') {
            $assets = new AssetsService();
            if (!$assets->isActive()) {
                throw self::unavailable();
            }
            $path = (string) $link['target_path'];
            $abs = $assets->resolve($path);
            if (($link['target_type'] === 'folder' && !is_dir($abs)) || ($link['target_type'] === 'file' && !is_file($abs))) {
                throw self::unavailable();
            }
            return ['link' => $link, 'name' => basename($path), 'owner' => null, 'row' => null, 'root' => $path];
        }

        // Mi unidad: el archivo o la carpeta no puede estar en la papelera
        // (findAnyById solo trae elementos vivos) y su dueño debe estar activo.
        $row = $link['target_type'] === 'file'
            ? (new FileRepository())->findAnyById((int) $link['target_id'])
            : (new FolderRepository())->findAnyById((int) $link['target_id']);
        $owner = $row !== null ? $users->findById((int) $row['user_id']) : null;
        if ($row === null || $owner === null || ($owner['status'] ?? 'active') !== 'active') {
            throw self::unavailable();
        }
        return ['link' => $link, 'name' => (string) $row['name'], 'owner' => $owner, 'row' => $row, 'root' => null];
    }

    /**
     * Comprueba el acceso. Pasa con la llave de paso, o sin ella si el enlace
     * es para cualquiera sin contraseña, o si es solo para miembros (sin
     * contraseña) y hay sesión iniciada.
     *
     * @return ?array<string,mixed> el usuario con sesión, si la hay
     */
    private function gate(array $ctx, Request $request): ?array
    {
        $link = $ctx['link'];
        $user = $this->optionalUser($request);
        if (LinkKeys::verifyKey($link, $request->input('k'))) {
            return $user;
        }
        $needsPassword = $link['password_hash'] !== null;
        $members = $link['access'] === 'members';
        if (!$needsPassword && (!$members || $user !== null)) {
            return $user;
        }
        if ($members && $user === null) {
            throw new HttpException(403, 'LINK_LOGIN_REQUIRED', 'Este enlace es solo para miembros de la organización. Inicia sesión para abrirlo.', ['has_password' => $needsPassword]);
        }
        throw new HttpException(403, 'LINK_PASSWORD_REQUIRED', 'Este enlace está protegido con contraseña.');
    }

    /**
     * Llave que acompaña a las URL del contenido (las <img> y <video> no
     * mandan cabeceras). Solo hace falta si el enlace tiene contraseña o es
     * para miembros.
     */
    private function keyFor(array $ctx, Request $request, ?array $user): ?string
    {
        $link = $ctx['link'];
        if ($link['password_hash'] === null && $link['access'] === 'anyone') {
            return null;
        }
        $current = $request->input('k');
        return LinkKeys::verifyKey($link, $current) ? (string) $current : LinkKeys::accessKey($link);
    }

    /** Usuario con sesión válida, o null (un token caducado no es un error aquí). */
    private function optionalUser(Request $request): ?array
    {
        if ($request->bearerToken() === null) {
            return null;
        }
        try {
            (new AuthMiddleware())->handle($request);
            return $request->user();
        } catch (HttpException) {
            return null;
        }
    }

    private static function unavailable(): HttpException
    {
        return HttpException::notFound('El archivo o la carpeta de este enlace ya no está disponible.', 'LINK_UNAVAILABLE');
    }

    // --- Mi unidad ---

    /** @return array<string,mixed> */
    private function driveItems(array $ctx, string $ref, string $sort, string $order, int $limit, int $offset, ?string $key): array
    {
        $root = $ctx['row'];
        $ownerId = (int) $root['user_id'];
        $rootId = (int) $root['id'];
        $folderId = $ref === '' ? $rootId : (int) $ref;
        if ($folderId !== $rootId && !$this->isWithinDrive($ownerId, $rootId, $folderId)) {
            throw HttpException::notFound('Carpeta no encontrada.');
        }

        $folders = new FolderRepository();
        $files = new FileRepository();
        $sortFolders = in_array($sort, ['name', 'updated_at', 'created_at'], true) ? $sort : 'name';
        $sortFiles = in_array($sort, ['name', 'updated_at', 'created_at', 'size_bytes'], true) ? $sort : 'name';

        $totalFolders = $folders->countChildren($ownerId, $folderId);
        $totalFiles = $files->countInFolder($ownerId, $folderId);
        $folderRows = [];
        $fileRows = [];
        $remaining = $limit;
        $filesOffset = max(0, $offset - $totalFolders);
        if ($offset < $totalFolders) {
            $folderRows = $folders->children($ownerId, $folderId, $sortFolders, $order, $remaining, $offset);
            $remaining -= count($folderRows);
            $filesOffset = 0;
        }
        if ($remaining > 0) {
            $fileRows = $files->inFolder($ownerId, $folderId, $sortFiles, $order, $remaining, $filesOffset);
        }

        // Migas desde la carpeta compartida (que hace de raíz), nunca más arriba.
        $crumbs = [];
        $current = $folderId;
        while ($current !== $rootId) {
            $f = $folders->find($current, $ownerId);
            if ($f === null) {
                break;
            }
            array_unshift($crumbs, ['id' => (string) $f['id'], 'name' => (string) $f['name']]);
            $current = (int) $f['parent_id'];
        }

        return [
            'name'        => $ctx['name'],
            'breadcrumbs' => $crumbs,
            'folders'     => array_map(static fn (array $f) => [
                'type'       => 'folder',
                'id'         => (string) $f['id'],
                'name'       => (string) $f['name'],
                'created_at' => $f['created_at'],
                'updated_at' => $f['updated_at'],
            ], $folderRows),
            'files'       => array_map(fn (array $f) => $this->presentFile($ctx, [
                'name'       => (string) $f['name'],
                'mime'       => $f['mime_type'] !== null ? (string) $f['mime_type'] : null,
                'size'       => (int) $f['size_bytes'],
                'extension'  => $f['extension'] !== null ? (string) $f['extension'] : null,
                'created_at' => $f['created_at'],
                'updated_at' => $f['updated_at'],
            ], (string) $f['id'], $key), $fileRows),
            'has_more'    => ($offset + $limit) < ($totalFolders + $totalFiles),
        ];
    }

    /** ¿La carpeta está dentro de la carpeta compartida? (sube por los padres) */
    private function isWithinDrive(int $ownerId, int $rootId, int $folderId): bool
    {
        $folders = new FolderRepository();
        for ($i = 0; $i < 100 && $folderId > 0; $i++) {
            if ($folderId === $rootId) {
                return true;
            }
            $f = $folders->find($folderId, $ownerId);
            if ($f === null || $f['parent_id'] === null) {
                return false;
            }
            $folderId = (int) $f['parent_id'];
        }
        return false;
    }

    // --- Unidad compartida ---

    /** @return array<string,mixed> */
    private function orgItems(array $ctx, string $ref, string $sort, string $order, int $limit, int $offset, ?string $key): array
    {
        $root = (string) $ctx['root'];
        $sub = $this->orgRelative($ref);
        $assets = new AssetsService();
        $rel = ltrim($root . '/' . $sub, '/');
        if (!is_dir($assets->resolve($rel))) {
            throw HttpException::notFound('Carpeta no encontrada.');
        }
        $sort = in_array($sort, ['name', 'updated_at', 'size_bytes'], true) ? $sort : 'name';
        $list = $assets->list($rel, 'user', $sort, $order, $limit, $offset);

        $strip = static fn (string $path): string => ltrim(substr($path, strlen($root)), '/');
        $mtime = static fn (string $path): ?string => ($t = @filemtime($assets->resolve($path))) ? date(DATE_ATOM, $t) : null;

        $crumbs = [];
        $acc = '';
        foreach ($sub === '' ? [] : explode('/', $sub) as $segment) {
            $acc = ltrim($acc . '/' . $segment, '/');
            $crumbs[] = ['id' => $acc, 'name' => $segment];
        }

        return [
            'name'        => $ctx['name'],
            'breadcrumbs' => $crumbs,
            'folders'     => array_map(static fn (array $f) => [
                'type'       => 'folder',
                'id'         => $strip((string) $f['path']),
                'name'       => (string) $f['name'],
                'created_at' => null,
                'updated_at' => $mtime((string) $f['path']),
            ], $list['folders']),
            'files'       => array_map(fn (array $f) => $this->presentFile($ctx, [
                'name'       => (string) $f['name'],
                'mime'       => $f['mime_type'] !== null ? (string) $f['mime_type'] : null,
                'size'       => (int) $f['size_bytes'],
                'extension'  => $f['extension'] ?? null,
                'created_at' => null,
                'updated_at' => $mtime((string) $f['path']),
            ], $strip((string) $f['path']), $key), $list['files']),
            'has_more'    => (bool) $list['has_more'],
        ];
    }

    /** Ruta relativa a la carpeta compartida; sin «..» ni segmentos ocultos. */
    private function orgRelative(mixed $ref): string
    {
        $sub = ShareLinkPolicy::normalizeOrgPath((string) ($ref ?? ''));
        if ($sub === null || str_contains('/' . $sub . '/', '/../')) {
            throw HttpException::notFound('Elemento no encontrado.');
        }
        return $sub;
    }

    // --- Archivos ---

    /**
     * Archivo a servir: el del enlace (enlace de archivo) o uno de dentro de la
     * carpeta compartida (enlace de carpeta, con `f`).
     *
     * @return array{abs:string,name:string,mime:?string,size:int,extension:?string,created_at:mixed,updated_at:mixed}
     */
    private function resolveFile(array $ctx, mixed $ref): array
    {
        $link = $ctx['link'];
        $ref = $ref === null ? '' : trim((string) $ref);

        if ($link['scope'] === 'org') {
            $assets = new AssetsService();
            if ($link['target_type'] === 'file') {
                $rel = (string) $ctx['root'];
            } else {
                $sub = $this->orgRelative($ref);
                if ($sub === '') {
                    throw HttpException::notFound('Archivo no encontrado.');
                }
                $rel = $ctx['root'] . '/' . $sub;
            }
            $abs = $assets->resolve($rel);
            if (!is_file($abs)) {
                throw HttpException::notFound('Archivo no encontrado.');
            }
            $mtime = @filemtime($abs);
            return [
                'abs'        => $abs,
                'name'       => basename($rel),
                'mime'       => @mime_content_type($abs) ?: null,
                'size'       => (int) @filesize($abs),
                'extension'  => strtolower(pathinfo($abs, PATHINFO_EXTENSION)) ?: null,
                'created_at' => null,
                'updated_at' => $mtime ? date(DATE_ATOM, $mtime) : null,
            ];
        }

        $owner = $ctx['owner'];
        if ($link['target_type'] === 'file') {
            $file = $ctx['row'];
        } else {
            $file = ctype_digit($ref) ? (new FileRepository())->findAnyById((int) $ref) : null;
            $root = $ctx['row'];
            $inside = $file !== null
                && (int) $file['user_id'] === (int) $root['user_id']
                && $file['folder_id'] !== null
                && $this->isWithinDrive((int) $root['user_id'], (int) $root['id'], (int) $file['folder_id']);
            if (!$inside) {
                throw HttpException::notFound('Archivo no encontrado.');
            }
        }
        return [
            'abs'        => (new PrivateFileStore())->physicalPath((string) $owner['username'], $file),
            'name'       => (string) $file['name'],
            'mime'       => $file['mime_type'] !== null ? (string) $file['mime_type'] : null,
            'size'       => (int) $file['size_bytes'],
            'extension'  => $file['extension'] !== null ? (string) $file['extension'] : null,
            'created_at' => $file['created_at'],
            'updated_at' => $file['updated_at'],
        ];
    }

    /**
     * Archivo con forma de FileItem para el explorador del frontend. No lleva
     * ruta ni dueño: solo el nombre y las URL del enlace.
     *
     * @param array<string,mixed> $f
     * @return array<string,mixed>
     */
    private function presentFile(array $ctx, array $f, ?string $ref, ?string $key): array
    {
        $base = '/api/v1/public/links/' . $ctx['link']['token'];
        $query = static function (array $extra) use ($ref, $key): string {
            $q = http_build_query(array_filter(['f' => $ref, 'k' => $key] + $extra, static fn ($v) => $v !== null && $v !== ''));
            return $q === '' ? '' : '?' . $q;
        };
        $isImage = str_starts_with((string) ($f['mime'] ?? ''), 'image/');
        return [
            'type'          => 'file',
            'id'            => $ref ?? 'file',
            'name'          => $f['name'],
            'size_bytes'    => $f['size'],
            'mime_type'     => $f['mime'],
            'extension'     => $f['extension'],
            'url'           => $base . '/content' . $query([]),
            'download_url'  => (bool) $ctx['link']['allow_download'] ? $base . '/content' . $query(['download' => '1']) : null,
            'thumbnail_url' => $isImage ? $base . '/thumb' . $query(['s' => '400']) : null,
            'created_at'    => $f['created_at'],
            'updated_at'    => $f['updated_at'],
        ];
    }
}
