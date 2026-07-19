<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\MailService;

/**
 * Configuración de correo saliente (SMTP). Requiere AuthMiddleware + AdminOnly.
 * La contraseña nunca se devuelve en claro: se enmascara al leer y solo se
 * reescribe cuando el formulario envía un valor distinto de la máscara.
 */
final class SmtpController
{
    private const ENCRYPTIONS = ['tls', 'ssl', 'none'];

    /** GET /admin/smtp */
    public function get(Request $request): Response
    {
        $s = new SettingsRepository();
        $hasPassword = trim((string) $s->get('smtp_pass', '')) !== '';

        return Response::success([
            'enabled'      => $s->get('smtp_enabled', '0') === '1',
            'host'         => (string) $s->get('smtp_host', ''),
            'port'         => $s->getInt('smtp_port', 587),
            'user'         => (string) $s->get('smtp_user', ''),
            'encryption'   => (string) ($s->get('smtp_encryption', 'tls') ?: 'tls'),
            'from_email'   => (string) $s->get('smtp_from_email', ''),
            'from_name'    => (string) $s->get('smtp_from_name', ''),
            'has_password' => $hasPassword,
            'password'     => $hasPassword ? MailService::PASSWORD_MASK : '',
        ]);
    }

    /** PATCH /admin/smtp */
    public function update(Request $request): Response
    {
        $body = $request->json();
        $s = new SettingsRepository();

        $enabled = !empty($body['enabled']);
        $host = trim((string) ($body['host'] ?? ''));
        $port = (int) ($body['port'] ?? 587);
        $encryption = strtolower((string) ($body['encryption'] ?? 'tls'));
        if (!in_array($encryption, self::ENCRYPTIONS, true)) {
            $encryption = 'tls';
        }
        $fromEmail = trim((string) ($body['from_email'] ?? ''));
        if ($enabled && $host === '') {
            throw HttpException::validation(['host' => ['El host SMTP es obligatorio.']]);
        }
        if ($fromEmail !== '' && filter_var($fromEmail, FILTER_VALIDATE_EMAIL) === false) {
            throw HttpException::validation(['from_email' => ['El correo remitente no es válido.']]);
        }

        $s->set('smtp_enabled', $enabled ? '1' : '0');
        $s->set('smtp_host', $host);
        $s->set('smtp_port', (string) ($port > 0 ? $port : 587));
        $s->set('smtp_user', trim((string) ($body['user'] ?? '')));
        $s->set('smtp_encryption', $encryption);
        $s->set('smtp_from_email', $fromEmail);
        $s->set('smtp_from_name', trim((string) ($body['from_name'] ?? '')));

        // La contraseña solo se actualiza si llegó un valor real (no la máscara).
        if (array_key_exists('password', $body)) {
            $pass = (string) $body['password'];
            if ($pass !== MailService::PASSWORD_MASK) {
                $s->set('smtp_pass', $pass);
            }
        }

        ActivityLogger::log($request, 'settings.update', 'setting', null, ['smtp' => $enabled ? 'enabled' : 'disabled']);

        return $this->get($request);
    }

    /**
     * POST /admin/smtp/test — prueba la conexión y, si se indica destino, envía
     * un correo de prueba. Acepta la configuración del formulario aún sin guardar.
     */
    public function test(Request $request): Response
    {
        $body = $request->json();
        $override = $this->overrideFromBody($body);
        $to = trim((string) ($body['to'] ?? ''));

        $mail = new MailService();
        try {
            if ($to !== '') {
                if (filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
                    throw HttpException::validation(['to' => ['El correo de destino no es válido.']]);
                }
                $mail->sendTest($to, $override);
                return Response::success(['ok' => true, 'sent' => true, 'message' => 'Correo de prueba enviado a ' . $to]);
            }
            $mail->verify($override);
            return Response::success(['ok' => true, 'sent' => false, 'message' => 'Conexión SMTP correcta.']);
        } catch (HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw new HttpException(422, 'SMTP_TEST_FAILED', $e->getMessage());
        }
    }

    /**
     * Traduce el cuerpo del formulario a overrides con prefijo smtp_* para
     * MailService. Solo incluye claves presentes (así se combinan con lo guardado).
     *
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function overrideFromBody(array $body): array
    {
        $map = [
            'host'       => 'smtp_host',
            'port'       => 'smtp_port',
            'user'       => 'smtp_user',
            'password'   => 'smtp_pass',
            'encryption' => 'smtp_encryption',
            'from_email' => 'smtp_from_email',
            'from_name'  => 'smtp_from_name',
        ];
        $override = [];
        foreach ($map as $in => $out) {
            if (array_key_exists($in, $body) && $body[$in] !== null && $body[$in] !== '') {
                $override[$out] = $body[$in];
            }
        }
        return $override;
    }
}
