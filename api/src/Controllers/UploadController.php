<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Validator;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\FileService;
use ProjectCloud\Services\FileSystemService;
use ProjectCloud\Services\UploadService;

/**
 * Subida de archivos por chunks.
 */
final class UploadController
{
    /** POST /uploads/init */
    public function init(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('name')->maxLength('name', 255)
            ->required('size')->integer('size')
            ->validate();

        $result = $this->service()->init(
            (int) $request->userId(),
            $this->resolveId(isset($data['folder_id']) ? (string) $data['folder_id'] : null),
            (string) $data['name'],
            (int) $data['size'],
            isset($data['mime']) ? (string) $data['mime'] : null,
        );

        return Response::success($result);
    }

    /** POST /uploads/{id}/chunk?offset=N — cuerpo = bytes crudos del trozo. */
    public function chunk(Request $request): Response
    {
        $offset = (int) ($request->query['offset'] ?? 0);
        $data = (string) file_get_contents('php://input');

        $result = $this->service()->chunk(
            (int) $request->userId(),
            (string) $request->param('id'),
            $offset,
            $data,
        );

        return Response::success($result);
    }

    /** POST /uploads/{id}/complete */
    public function complete(Request $request): Response
    {
        $username = (string) $request->user()['username'];
        $file = $this->service()->complete(
            (int) $request->userId(),
            $username,
            (string) $request->param('id'),
        );
        return Response::created($this->filePublic($file, $username));
    }

    /** DELETE /uploads/{id} — cancela una subida. */
    public function cancel(Request $request): Response
    {
        $this->service()->cancel((int) $request->userId(), (string) $request->param('id'));
        return Response::success(['ok' => true]);
    }

    // --- Helpers ---

    private function service(): UploadService
    {
        return new UploadService(
            new FileRepository(),
            new FolderRepository(),
            new UserRepository(),
            new FileSystemService(),
        );
    }

    private function resolveId(?string $raw): ?int
    {
        if ($raw === null || $raw === '' || $raw === 'root' || $raw === '0') {
            return null;
        }
        return (int) $raw;
    }

    /** @param array<string,mixed> $f */
    private function filePublic(array $f, string $username): array
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
            'created_at' => $f['created_at'] ?? null,
            'updated_at' => $f['updated_at'] ?? null,
        ];
    }
}
