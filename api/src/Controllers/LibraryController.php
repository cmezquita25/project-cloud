<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Services\ItemPresenter;

/**
 * Listados derivados de la unidad del usuario (Fase 7): recientes, destacados y
 * búsqueda global. Solo lectura; reutilizan el mismo contrato de ItemPresenter.
 */
final class LibraryController
{
    /** GET /recent?limit=30 — archivos modificados recientemente. */
    public function recent(Request $request): Response
    {
        $userId = (int) $request->userId();
        $username = (string) $request->user()['username'];
        $limit = (int) $request->input('limit', 30);

        $files = (new FileRepository())->recent($userId, $limit);

        return Response::success([
            'files' => ItemPresenter::files($files, $username),
        ]);
    }

    /** GET /starred — carpetas y archivos destacados. */
    public function starred(Request $request): Response
    {
        $userId = (int) $request->userId();
        $username = (string) $request->user()['username'];

        return Response::success([
            'folders' => ItemPresenter::folders((new FolderRepository())->starred($userId)),
            'files'   => ItemPresenter::files((new FileRepository())->starred($userId), $username),
        ]);
    }

    /** GET /search?q=texto — busca por nombre en carpetas y archivos vivos. */
    public function search(Request $request): Response
    {
        $userId = (int) $request->userId();
        $username = (string) $request->user()['username'];
        $query = trim((string) $request->input('q', ''));

        if (mb_strlen($query) < 1) {
            return Response::success([
                'query'   => '',
                'folders' => [],
                'files'   => [],
            ]);
        }

        return Response::success([
            'query'   => $query,
            'folders' => ItemPresenter::folders((new FolderRepository())->search($userId, $query)),
            'files'   => ItemPresenter::files((new FileRepository())->search($userId, $query), $username),
        ]);
    }
}
