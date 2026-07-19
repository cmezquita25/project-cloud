<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\EmailTemplateService;
use ProjectCloud\Services\MailService;

/**
 * Personalización de plantillas de correo. Requiere AuthMiddleware + AdminOnly.
 */
final class EmailTemplateController
{
    /** GET /admin/email-templates */
    public function list(Request $request): Response
    {
        return Response::success(['templates' => (new EmailTemplateService())->catalog()]);
    }

    /** PATCH /admin/email-templates/{key} */
    public function update(Request $request): Response
    {
        $key = $this->assertKey((string) $request->param('key'));
        $data = (new \ProjectCloud\Core\Validator($request->json()))
            ->required('subject')->maxLength('subject', 255)
            ->required('body_html')
            ->validate();

        (new EmailTemplateService())->set($key, (string) $data['subject'], (string) $data['body_html']);
        ActivityLogger::log($request, 'settings.update', 'setting', null, ['email_template' => $key]);

        return Response::success(['ok' => true]);
    }

    /** POST /admin/email-templates/{key}/reset — restaura el default. */
    public function reset(Request $request): Response
    {
        $key = $this->assertKey((string) $request->param('key'));
        (new EmailTemplateService())->reset($key);
        ActivityLogger::log($request, 'settings.update', 'setting', null, ['email_template_reset' => $key]);

        $tpl = (new EmailTemplateService())->get($key);
        return Response::success(['ok' => true, 'subject' => $tpl['subject'], 'body_html' => $tpl['body_html']]);
    }

    /**
     * POST /admin/email-templates/{key}/preview — devuelve el HTML renderizado
     * con marca y valores de ejemplo. Acepta contenido aún sin guardar.
     */
    public function preview(Request $request): Response
    {
        $key = $this->assertKey((string) $request->param('key'));
        $body = $request->json();
        $subject = array_key_exists('subject', $body) ? (string) $body['subject'] : null;
        $html = array_key_exists('body_html', $body) ? (string) $body['body_html'] : null;

        $result = (new MailService())->previewTemplate($key, $subject, $html);
        return Response::success($result);
    }

    private function assertKey(string $key): string
    {
        if (!in_array($key, EmailTemplateService::KEYS, true)) {
            throw HttpException::notFound('Plantilla no encontrada');
        }
        return $key;
    }
}
