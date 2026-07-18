<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\FileSystemService;
use ProjectCloud\Services\ItemPresenter;
use ProjectCloud\Services\TrashService;

/**
 * Papelera (Fase 7): listar raíces borradas, restaurar, borrar definitivamente
 * y vaciar. La auto-purga (retención) se ejecuta de forma perezosa al listar.
 */
final class TrashController
{
    /** GET /trash — elementos en la papelera (solo raíces del borrado). */
    public function index(Request $request): Response
    {
        $userId = (int) $request->userId();
        $username = (string) $request->user()['username'];

        $this->service()->collectGarbage($userId, $username);

        $folders = new FolderRepository();
        $files = new FileRepository();

        return Response::success([
            'folders'        => ItemPresenter::folders($folders->trashedRoots($userId)),
            'files'          => ItemPresenter::files($files->trashedRoots($userId), $username),
            'retention_days' => TrashService::RETENTION_DAYS,
        ]);
    }

    /** POST /trash/files/{id}/restore */
    public function restoreFile(Request $request): Response
    {
        $username = (string) $request->user()['username'];
        $file = $this->service()->restoreFile((int) $request->userId(), $username, (int) $request->param('id'));
        return Response::success(ItemPresenter::file($file, $username));
    }

    /** POST /trash/folders/{id}/restore */
    public function restoreFolder(Request $request): Response
    {
        $folder = $this->service()->restoreFolder(
            (int) $request->userId(),
            (string) $request->user()['username'],
            (int) $request->param('id'),
        );
        return Response::success(ItemPresenter::folder($folder));
    }

    /** DELETE /trash/files/{id} — borrado definitivo. */
    public function purgeFile(Request $request): Response
    {
        $id = (int) $request->param('id');
        $this->service()->purgeFile((int) $request->userId(), (string) $request->user()['username'], $id);
        ActivityLogger::log($request, 'purge', 'file', $id);
        return Response::success(['ok' => true]);
    }

    /** DELETE /trash/folders/{id} — borrado definitivo. */
    public function purgeFolder(Request $request): Response
    {
        $id = (int) $request->param('id');
        $this->service()->purgeFolder((int) $request->userId(), (string) $request->user()['username'], $id);
        ActivityLogger::log($request, 'purge', 'folder', $id);
        return Response::success(['ok' => true]);
    }

    /** DELETE /trash — vacía toda la papelera. */
    public function empty(Request $request): Response
    {
        $purged = $this->service()->empty((int) $request->userId(), (string) $request->user()['username']);
        ActivityLogger::log($request, 'empty_trash', null, null, ['count' => $purged]);
        return Response::success(['ok' => true, 'purged' => $purged]);
    }

    private function service(): TrashService
    {
        return new TrashService(
            new FolderRepository(),
            new FileRepository(),
            new FileSystemService(),
            new UserRepository(),
        );
    }
}
