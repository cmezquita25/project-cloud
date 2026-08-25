<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\NotificationRepository;

/**
 * Endpoints para las notificaciones web del usuario en sesión.
 */
final class NotificationController
{
    private NotificationRepository $repo;

    public function __construct(?NotificationRepository $repo = null)
    {
        $this->repo = $repo ?? new NotificationRepository();
    }

    /** GET /v1/notifications */
    public function list(Request $request): Response
    {
        $userId = (int) $request->userId();
        $page = max(1, (int) ($request->query['page'] ?? 1));
        $limit = min(50, max(1, (int) ($request->query['limit'] ?? 20)));
        $filter = isset($request->query['filter']) ? (string) $request->query['filter'] : null;

        $result = $this->repo->paginateForUser($userId, $page, $limit, $filter);
        return Response::success($result);
    }

    /** GET /v1/notifications/unread-count */
    public function unreadCount(Request $request): Response
    {
        $userId = (int) $request->userId();
        $count = $this->repo->unreadCount($userId);
        return Response::success(['unread_count' => $count]);
    }

    /** PATCH /v1/notifications/{id}/read */
    public function markRead(Request $request): Response
    {
        $userId = (int) $request->userId();
        $id = (int) $request->param('id');
        if ($id <= 0) {
            throw HttpException::badRequest('ID de notificación inválido.');
        }

        $ok = $this->repo->markAsRead($id, $userId);
        if (!$ok) {
            throw HttpException::notFound('Notificación no encontrada.');
        }

        return Response::success(['ok' => true, 'id' => $id]);
    }

    /** POST /v1/notifications/read-all */
    public function markAllRead(Request $request): Response
    {
        $userId = (int) $request->userId();
        $count = $this->repo->markAllAsRead($userId);
        return Response::success(['ok' => true, 'updated' => $count]);
    }

    /** POST /v1/notifications/bulk-read */
    public function bulkRead(Request $request): Response
    {
        $userId = (int) $request->userId();
        $body = $request->json();
        $ids = is_array($body['ids'] ?? null) ? array_map('intval', $body['ids']) : [];
        if (empty($ids)) {
            throw HttpException::badRequest('Lista de IDs vacía.');
        }

        $count = $this->repo->markBulkRead($ids, $userId);
        return Response::success(['ok' => true, 'updated' => $count]);
    }

    /** DELETE /v1/notifications/{id} */
    public function delete(Request $request): Response
    {
        $userId = (int) $request->userId();
        $id = (int) $request->param('id');
        if ($id <= 0) {
            throw HttpException::badRequest('ID de notificación inválido.');
        }

        $ok = $this->repo->delete($id, $userId);
        if (!$ok) {
            throw HttpException::notFound('Notificación no encontrada.');
        }

        return Response::success(['ok' => true, 'id' => $id]);
    }

    /** POST /v1/notifications/bulk-delete */
    public function bulkDelete(Request $request): Response
    {
        $userId = (int) $request->userId();
        $body = $request->json();
        $ids = is_array($body['ids'] ?? null) ? array_map('intval', $body['ids']) : [];
        if (empty($ids)) {
            throw HttpException::badRequest('Lista de IDs vacía.');
        }

        $count = $this->repo->deleteBulk($ids, $userId);
        return Response::success(['ok' => true, 'deleted' => $count]);
    }

    /** DELETE /v1/notifications/all */
    public function deleteAll(Request $request): Response
    {
        $userId = (int) $request->userId();
        $count = $this->repo->deleteAll($userId);
        return Response::success(['ok' => true, 'deleted' => $count]);
    }
}

