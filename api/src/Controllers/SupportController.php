<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Services\MailService;
use ProjectCloud\Services\EmailTemplateService;

final class SupportController
{
    /** POST /support/report */
    public function report(Request $request): Response
    {
        $settings = new SettingsRepository();
        $supportEmail = $settings->get('support_email', '');

        if ($supportEmail === '') {
            throw HttpException::badRequest('El correo de soporte no está configurado en la plataforma.');
        }

        $userId = $request->userId();
        $user = $request->user();
        
        $subjectParam = $_POST['subject'] ?? 'Reporte de Error';
        $message = trim($_POST['message'] ?? '');

        if ($message === '') {
            throw HttpException::badRequest('El mensaje no puede estar vacío.');
        }

        $senderNameVal = $user ? $user['display_name'] : 'Usuario Anónimo';
        $senderEmailVal = $user ? $user['email'] : 'No registrado';
        $orgName = $settings->get('organization_name', 'Project Cloud');

        $tpl = clone (new EmailTemplateService());
        $rendered = $tpl->render(EmailTemplateService::SUPPORT_REPORT, [
            'sender_name' => htmlspecialchars($senderNameVal),
            'sender_email' => htmlspecialchars($senderEmailVal),
            'report_type' => htmlspecialchars($subjectParam),
            'report_message' => htmlspecialchars($message),
            'org_name' => htmlspecialchars($orgName)
        ]);

        $subject = $rendered['subject'];
        $html = $rendered['html'];

        $mail = clone (new MailService());
        
        $attachments = [];
        if (isset($_FILES['attachments'])) {
            $files = $_FILES['attachments'];
            if (is_array($files['name'])) {
                for ($i = 0; $i < count($files['name']); $i++) {
                    if ($files['error'][$i] === UPLOAD_ERR_OK) {
                        $attachments[] = [
                            'path' => $files['tmp_name'][$i],
                            'name' => $files['name'][$i],
                            'mime' => $files['type'][$i]
                        ];
                    }
                }
            }
        }

        // Send mail with attachments
        $success = $mail->sendWithAttachments($supportEmail, 'Soporte Project Cloud', $subject, $html, $attachments);

        if (!$success) {
            throw new HttpException(500, 'MAIL_ERROR', 'No se pudo enviar el reporte. Inténtalo más tarde.');
        }

        return Response::success(['ok' => true]);
    }
}
