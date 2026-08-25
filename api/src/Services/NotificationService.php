<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Repositories\NotificationRepository;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Servicio centralizado para generación de notificaciones web y envío de correos asociados.
 */
final class NotificationService
{
    private NotificationRepository $notifRepo;
    private UserRepository $userRepo;
    private SettingsRepository $settingsRepo;

    public function __construct(
        ?NotificationRepository $notifRepo = null,
        ?UserRepository $userRepo = null,
        ?SettingsRepository $settingsRepo = null
    ) {
        $this->notifRepo = $notifRepo ?? new NotificationRepository();
        $this->userRepo = $userRepo ?? new UserRepository();
        $this->settingsRepo = $settingsRepo ?? new SettingsRepository();
    }

    /**
     * Notifica ÚNICAMENTE a los participantes de un recurso compartido en "Mi Unidad"
     * cuando un involucrado sube un archivo a una carpeta o unidad compartida privada.
     */
    public function notifySharedFolderUpload(
        int $actorId,
        string $fileName,
        int $folderId
    ): void {
        $actor = $this->userRepo->findById($actorId);
        if (!$actor) return;
        $actorName = (string) ($actor['display_name'] ?: $actor['username']);

        $pdo = \ProjectCloud\Core\Database::pdo();

        // 1. Obtener la carpeta actual
        $stmtFolder = $pdo->prepare("SELECT id, user_id, name, parent_id FROM folders WHERE id = ? AND deleted_at IS NULL");
        $stmtFolder->execute([$folderId]);
        $folder = $stmtFolder->fetch(\PDO::FETCH_ASSOC);
        if (!$folder) return;

        $ownerId = (int) $folder['user_id'];
        $targetUrl = "/folder/{$folderId}";

        // Construir jerarquía de carpetas ascendentes para herencia de compartición y nombre completo del subdirectorio
        $ancestorFolderIds = [(int) $folder['id']];
        $ancestorNames = [(string) $folder['name']];
        $currParentId = $folder['parent_id'] !== null ? (int) $folder['parent_id'] : null;
        while ($currParentId !== null && $currParentId > 0) {
            $ancestorFolderIds[] = $currParentId;
            $stmtP = $pdo->prepare("SELECT name, parent_id FROM folders WHERE id = ? AND deleted_at IS NULL");
            $stmtP->execute([$currParentId]);
            $parentRow = $stmtP->fetch(\PDO::FETCH_ASSOC);
            if ($parentRow) {
                $ancestorNames[] = (string) $parentRow['name'];
                $currParentId = $parentRow['parent_id'] !== null ? (int) $parentRow['parent_id'] : null;
            } else {
                $currParentId = null;
            }
        }

        // Nombre de la carpeta/subcarpeta con ruta completa (ej. "Carlos / MEI_Agente / Subcarpeta")
        $targetName = implode(' / ', array_reverse($ancestorNames));

        // 2. Buscar accesos compartidos en shared_access para la unidad completa del dueño o las carpetas
        $inPlaceholders = implode(',', array_fill(0, count($ancestorFolderIds), '?'));
        $sqlShares = "
            SELECT DISTINCT u.id, u.username, u.display_name, u.email
            FROM shared_access sa
            JOIN users u ON sa.invited_user_id = u.id
            WHERE sa.owner_id = ?
              AND (
                  sa.target_type = 'unit'
               OR (sa.target_type = 'folder' AND sa.target_id IN ({$inPlaceholders}))
              )
        ";
        $stmtShares = $pdo->prepare($sqlShares);
        $stmtShares->execute(array_merge([$ownerId], $ancestorFolderIds));
        $invitedUsers = $stmtShares->fetchAll(\PDO::FETCH_ASSOC);

        // Si NO está compartida en shared_access, salir silenciosamente
        if (empty($invitedUsers)) {
            return;
        }

        // Construir mapa completo de involucrados: Propietario + Invitados
        $usersMap = [];
        $ownerUser = $this->userRepo->findById($ownerId);
        if ($ownerUser) {
            $usersMap[$ownerId] = $ownerUser;
        }
        foreach ($invitedUsers as $iu) {
            $usersMap[(int)$iu['id']] = $iu;
        }

        $mailService = new MailService($this->settingsRepo);
        $templateService = new EmailTemplateService();

        foreach ($usersMap as $recipient) {
            $recipientId = (int) $recipient['id'];
            if ($recipientId === $actorId) continue; // Excluir al autor de la subida

            $title = "Nuevo archivo subido";
            $msg = "{$actorName} ha subido el archivo \"{$fileName}\" en la carpeta compartida \"{$targetName}\".";

            // 1. Crear notificación en plataforma web
            $this->notifRepo->create(
                $recipientId,
                $actorId,
                'item_new_file',
                $title,
                $msg,
                $targetUrl
            );

            // 2. Disparar correo electrónico si SMTP está activo
            if ($mailService->isEnabled() && !empty($recipient['email'])) {
                try {
                    $rendered = $templateService->render(EmailTemplateService::ITEM_NEW_FILE, [
                        'uploader_name' => $actorName,
                        'file_name'     => $fileName,
                        'target_name'   => $targetName,
                        'target_label'  => 'la carpeta compartida',
                        'item_url'      => UrlBuilder::fullUrl($targetUrl),
                        'org_name'      => $mailService->organizationName(),
                    ]);

                    $mailService->send(
                        (string) $recipient['email'],
                        (string) ($recipient['display_name'] ?: $recipient['username']),
                        $rendered['subject'],
                        $rendered['html']
                    );
                } catch (\Throwable) {
                    // Si falla el envío por correo, no interrumpe el flujo web
                }
            }
        }
    }

    /**
     * Notifica ÚNICAMENTE a un usuario específico cuando está llegando al límite de almacenamiento (≥90%).
     */
    public function notifyQuotaWarning(int $userId, float $percent, string $usedHuman, string $quotaHuman): void
    {
        $user = $this->userRepo->findById($userId);
        if (!$user) return;

        $title = "Límite de almacenamiento asignado";
        $percentFormatted = rtrim(rtrim(number_format($percent, 1, '.', ''), '0'), '.');
        $msg = "Estás llegando al límite de almacenamiento asignado. Has utilizado el {$percentFormatted}% de tu espacio ({$usedHuman} de {$quotaHuman}).";

        // Notificación en plataforma (sin URL de redirección)
        $this->notifRepo->create(
            $userId,
            null,
            'quota_warning',
            $title,
            $msg,
            null
        );
    }
}

