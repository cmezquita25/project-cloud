<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PHPMailer\PHPMailer\PHPMailer;
use ProjectCloud\Core\Config;
use ProjectCloud\Repositories\SettingsRepository;
use RuntimeException;

/**
 * Servicio de correo transaccional. Lee la configuración SMTP de `settings`,
 * construye el mensaje MIME (HTML con logo de marca embebido) y lo envía a
 * través de {@see SmtpMailer}.
 *
 * Regla de marca (punto 5): logo subido en la plataforma → si no, nombre de la
 * organización como texto → si no, "Project Cloud".
 */
final class MailService
{
    /** Marcador que el panel muestra en lugar de la contraseña SMTP guardada. */
    public const PASSWORD_MASK = '••••••••';

    private SettingsRepository $settings;

    public function __construct(?SettingsRepository $settings = null)
    {
        $this->settings = $settings ?? new SettingsRepository();
    }

    /** ¿Está el SMTP habilitado y con host configurado? */
    public function isEnabled(): bool
    {
        return $this->settings->get('smtp_enabled', '0') === '1'
            && trim((string) $this->settings->get('smtp_host', '')) !== '';
    }

    /** Nombre de la organización para plantillas (logo → nombre → "Project Cloud"). */
    public function organizationName(): string
    {
        return $this->orgName();
    }

    /**
     * Envía un correo HTML usando la configuración guardada. No rompe la
     * operación llamante: si el SMTP no está listo o falla, registra y devuelve
     * false (salvo $throw = true).
     */
    public function send(string $toEmail, string $toName, string $subject, string $bodyHtml, bool $throw = false): bool
    {
        if (!$this->isEnabled()) {
            if ($throw) {
                throw new RuntimeException('El correo SMTP no está configurado o está deshabilitado.');
            }
            return false;
        }
        try {
            $this->deliver($this->resolveConfig([]), $toEmail, $toName, $subject, $bodyHtml);
            return true;
        } catch (\Throwable $e) {
            error_log('[MailService] envío fallido: ' . $e->getMessage());
            if ($throw) {
                throw $e;
            }
            return false;
        }
    }

    /**
     * Envía un correo HTML usando la configuración guardada, con archivos adjuntos.
     * @param array{path:string, name:string, mime:string}[] $attachments
     */
    public function sendWithAttachments(string $toEmail, string $toName, string $subject, string $bodyHtml, array $attachments, bool $throw = false): bool
    {
        if (!$this->isEnabled()) {
            if ($throw) throw new RuntimeException('El correo SMTP no está configurado o está deshabilitado.');
            return false;
        }
        try {
            $this->deliver($this->resolveConfig([]), $toEmail, $toName, $subject, $bodyHtml, $attachments);
            return true;
        } catch (\Throwable $e) {
            error_log('[MailService] envío fallido: ' . $e->getMessage());
            if ($throw) throw $e;
            return false;
        }
    }

    /**
     * Prueba la conexión SMTP (punto 6). Acepta un override para validar valores
     * aún no guardados desde el formulario. Lanza RuntimeException si falla.
     *
     * @param array<string,mixed> $override
     */
    public function verify(array $override = []): void
    {
        $cfg = $this->resolveConfig($override);
        if ($cfg['host'] === '') {
            throw new RuntimeException('Falta el host SMTP.');
        }

        if (self::phpMailerAvailable()) {
            $mail = $this->makePhpMailer($cfg);
            if (!$mail->smtpConnect($mail->SMTPOptions)) {
                throw new RuntimeException('No se pudo conectar al servidor SMTP.');
            }
            $mail->smtpClose();
            return;
        }

        // Fallback: transporte propio.
        $mailer = new SmtpMailer($cfg['host'], $cfg['port'], $cfg['user'], $cfg['pass'], $cfg['encryption']);
        $mailer->connect();
        $mailer->close();
    }

    /**
     * Envía un correo de prueba (punto 6). Acepta override de configuración.
     *
     * @param array<string,mixed> $override
     */
    public function sendTest(string $toEmail, array $override = []): void
    {
        $cfg = $this->resolveConfig($override);
        if ($cfg['host'] === '') {
            throw new RuntimeException('Falta el host SMTP.');
        }
        $html = '<h2 style="margin:0 0 12px;font-size:18px;color:#202124;">Correo de prueba</h2>'
            . '<p style="margin:0;color:#5f6368;line-height:1.6;">La configuración SMTP de <strong>'
            . htmlspecialchars($this->orgName(), ENT_QUOTES) . '</strong> funciona correctamente. '
            . 'Ya puedes enviar correos desde la plataforma.</p>';
        $this->deliver($cfg, $toEmail, '', 'Correo de prueba — ' . $this->orgName(), $html);
    }

    /**
     * Renderiza una plantilla para previsualizar en el editor (con la envoltura
     * de marca). Acepta contenido aún sin guardar. El logo se incrusta como
     * data URI para que se vea en el navegador (no cid:).
     *
     * @return array{subject:string,html:string}
     */
    public function previewTemplate(string $key, ?string $subject = null, ?string $bodyHtml = null): array
    {
        $tpl = new EmailTemplateService();
        $vars = EmailTemplateService::sampleVars($key);

        if ($bodyHtml !== null) {
            $inner = $tpl->apply($bodyHtml, $vars);
            $subj = $tpl->apply($subject ?? '', $vars);
        } else {
            $rendered = $tpl->render($key, $vars);
            $inner = $rendered['html'];
            $subj = $rendered['subject'];
        }

        $logo = $this->logoInline();
        $html = $this->wrapLayout($inner, $logo !== null);
        if ($logo !== null) {
            // En el navegador cid: no resuelve; se usa data URI.
            $html = str_replace('cid:brandlogo', 'data:' . $logo['mime'] . ';base64,' . $logo['data'], $html);
        }

        return ['subject' => $subj, 'html' => $html];
    }

    // --- Interno ---

    /**
     * @param array{host:string,port:int,user:string,pass:string,encryption:string,from_email:string,from_name:string} $cfg
     * @param array{path:string, name:string, mime:string}[] $attachments
     */
    private function deliver(array $cfg, string $toEmail, string $toName, string $subject, string $bodyHtml, array $attachments = []): void
    {
        if (self::phpMailerAvailable()) {
            $this->deliverViaPhpMailer($cfg, $toEmail, $toName, $subject, $bodyHtml, $attachments);
            return;
        }
        $this->deliverViaBuiltin($cfg, $toEmail, $toName, $subject, $bodyHtml, $attachments);
    }

    /**
     * Transporte principal: PHPMailer vendorizado.
     *
     * @param array{host:string,port:int,user:string,pass:string,encryption:string,from_email:string,from_name:string} $cfg
     * @param array{path:string, name:string, mime:string}[] $attachments
     */
    private function deliverViaPhpMailer(array $cfg, string $toEmail, string $toName, string $subject, string $bodyHtml, array $attachments = []): void
    {
        $mail = $this->makePhpMailer($cfg);
        $mail->addAddress($toEmail, $toName);
        $mail->Subject = $subject;
        $mail->isHTML(true);

        $logo = $this->logoInline();
        $mail->Body = $this->wrapLayout($bodyHtml, $logo !== null);
        $mail->AltBody = trim(preg_replace('/\s+/', ' ', strip_tags($bodyHtml)) ?? '');
        if ($logo !== null) {
            $mail->addStringEmbeddedImage(
                base64_decode($logo['data']) ?: '',
                $logo['cid'],
                'logo',
                PHPMailer::ENCODING_BASE64,
                $logo['mime']
            );
        }

        foreach ($attachments as $att) {
            $mail->addAttachment($att['path'], $att['name'], PHPMailer::ENCODING_BASE64, $att['mime']);
        }

        $mail->send();
    }

    /**
     * Configura una instancia de PHPMailer a partir de la config resuelta.
     *
     * @param array{host:string,port:int,user:string,pass:string,encryption:string,from_email:string,from_name:string} $cfg
     */
    private function makePhpMailer(array $cfg): PHPMailer
    {
        $mail = new PHPMailer(true); // modo excepciones
        $mail->isSMTP();
        $mail->Host = $cfg['host'];
        $mail->Port = $cfg['port'];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->Timeout = 15;

        if ($cfg['user'] !== '') {
            $mail->SMTPAuth = true;
            $mail->Username = $cfg['user'];
            $mail->Password = $cfg['pass'];
        }

        switch ($cfg['encryption']) {
            case 'ssl':
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                break;
            case 'none':
                $mail->SMTPSecure = '';
                $mail->SMTPAutoTLS = false;
                break;
            default:
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }

        // Tolerante con certificados self-signed (relays auto-hospedados).
        $mail->SMTPOptions = [
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true],
        ];

        $mail->setFrom($cfg['from_email'], $cfg['from_name']);
        return $mail;
    }

    /**
     * Transporte de respaldo (cliente propio) por si la carpeta Vendor no se
     * subió al hosting. Mantiene el correo funcionando sin PHPMailer.
     *
     * @param array{host:string,port:int,user:string,pass:string,encryption:string,from_email:string,from_name:string} $cfg
     */
    private function deliverViaBuiltin(array $cfg, string $toEmail, string $toName, string $subject, string $bodyHtml): void
    {
        [$mime, $envelopeFrom] = $this->buildMime(
            $cfg['from_email'],
            $cfg['from_name'],
            $toEmail,
            $toName,
            $subject,
            $bodyHtml,
        );

        $mailer = new SmtpMailer($cfg['host'], $cfg['port'], $cfg['user'], $cfg['pass'], $cfg['encryption']);
        $mailer->connect();
        try {
            $mailer->send($envelopeFrom, $toEmail, $mime);
        } finally {
            $mailer->close();
        }
    }

    /** Carga (una vez) el autoloader del PHPMailer vendorizado y comprueba disponibilidad. */
    private static function phpMailerAvailable(): bool
    {
        if (!class_exists(PHPMailer::class, false)) {
            $autoload = __DIR__ . '/../Vendor/PHPMailer/autoload.php';
            if (is_file($autoload)) {
                require_once $autoload;
            }
        }
        return class_exists(PHPMailer::class);
    }

    /**
     * Combina overrides del formulario con los valores guardados.
     *
     * @param array<string,mixed> $override
     * @return array{host:string,port:int,user:string,pass:string,encryption:string,from_email:string,from_name:string}
     */
    private function resolveConfig(array $override): array
    {
        $get = fn (string $key, string $default = ''): string => array_key_exists($key, $override) && $override[$key] !== null
            ? (string) $override[$key]
            : (string) ($this->settings->get($key) ?? $default);

        $user = $get('smtp_user');
        $encryption = strtolower($get('smtp_encryption', 'tls')) ?: 'tls';
        $port = array_key_exists('smtp_port', $override) && $override['smtp_port'] !== null
            ? (int) $override['smtp_port']
            : $this->settings->getInt('smtp_port', 587);

        // Si el formulario dejó la contraseña enmascarada, se conserva la guardada.
        $pass = $get('smtp_pass');
        if ($pass === self::PASSWORD_MASK) {
            $pass = (string) ($this->settings->get('smtp_pass') ?? '');
        }

        $fromEmail = $get('smtp_from_email');
        if ($fromEmail === '') {
            $fromEmail = $user !== '' ? $user : 'no-reply@localhost';
        }
        $fromName = $get('smtp_from_name');
        if ($fromName === '') {
            $fromName = $this->orgName();
        }

        return [
            'host'       => trim($get('smtp_host')),
            'port'       => $port > 0 ? $port : 587,
            'user'       => $user,
            'pass'       => $pass,
            'encryption' => in_array($encryption, ['tls', 'ssl', 'none'], true) ? $encryption : 'tls',
            'from_email' => $fromEmail,
            'from_name'  => $fromName,
        ];
    }

    /**
     * Construye el mensaje MIME. Si hay logo de marca, usa multipart/related con
     * la imagen inline (cid:brandlogo); si no, HTML simple.
     *
     * @return array{0:string,1:string} [mensaje MIME, envelope-from]
     */
    private function buildMime(
        string $fromEmail,
        string $fromName,
        string $toEmail,
        string $toName,
        string $subject,
        string $innerHtml,
    ): array {
        $logo = $this->logoInline();
        $fullHtml = $this->wrapLayout($innerHtml, $logo !== null);

        $headers = [];
        $headers[] = 'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000';
        $headers[] = 'From: ' . $this->encodeAddress($fromName, $fromEmail);
        $headers[] = 'To: ' . $this->encodeAddress($toName, $toEmail);
        $headers[] = 'Subject: ' . $this->encodeHeader($subject);
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $this->domainOf($fromEmail) . '>';

        if ($logo === null) {
            $headers[] = 'Content-Type: text/html; charset=UTF-8';
            $headers[] = 'Content-Transfer-Encoding: base64';
            $body = chunk_split(base64_encode($fullHtml));
        } else {
            $boundary = 'rel_' . bin2hex(random_bytes(12));
            $headers[] = 'Content-Type: multipart/related; boundary="' . $boundary . '"';

            $body = '--' . $boundary . "\r\n"
                . "Content-Type: text/html; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: base64\r\n\r\n"
                . chunk_split(base64_encode($fullHtml)) . "\r\n"
                . '--' . $boundary . "\r\n"
                . 'Content-Type: ' . $logo['mime'] . "\r\n"
                . "Content-Transfer-Encoding: base64\r\n"
                . 'Content-ID: <' . $logo['cid'] . ">\r\n"
                . "Content-Disposition: inline; filename=\"logo\"\r\n\r\n"
                . chunk_split($logo['data']) . "\r\n"
                . '--' . $boundary . "--\r\n";
        }

        $mime = implode("\r\n", $headers) . "\r\n\r\n" . $body;
        return [$mime, $fromEmail];
    }

    /** Envoltura HTML de marca común a todos los correos. */
    private function wrapLayout(string $inner, bool $hasLogo): string
    {
        $org = htmlspecialchars($this->orgName(), ENT_QUOTES);
        $brand = $hasLogo
            ? '<img src="cid:brandlogo" alt="' . $org . '" style="max-height:48px;max-width:220px;">'
            : '<span style="font-size:20px;font-weight:600;color:#1a73e8;">' . $org . '</span>';

        return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1"></head>'
            . '<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#202124;">'
            . '<div style="max-width:560px;margin:0 auto;padding:24px;">'
            . '<div style="text-align:center;padding:8px 0 20px;">' . $brand . '</div>'
            . '<div style="background:#ffffff;border:1px solid #e6e8eb;border-radius:12px;padding:32px;">' . $inner . '</div>'
            . '<div style="text-align:center;color:#9aa0a6;font-size:12px;padding:16px 0;">'
            . $org . ' · Este es un correo automático, por favor no respondas.</div>'
            . '</div></body></html>';
    }

    /** @return array{cid:string,mime:string,data:string}|null */
    private function logoInline(): ?array
    {
        $base = rtrim((string) Config::get('storage.path', ''), "/\\");
        if ($base === '') {
            return null;
        }
        $dir = $base . '/platform';
        // Preferencia: logo oscuro (buen contraste sobre fondo claro del correo).
        foreach (['logo_dark', 'logo_favicon', 'logo_mobile', 'logo_white'] as $key) {
            $file = $this->settings->get($key);
            if ($file !== null && $file !== '' && is_file($dir . '/' . $file)) {
                $path = $dir . '/' . $file;
                $contents = @file_get_contents($path);
                if ($contents === false) {
                    continue;
                }
                $mime = @mime_content_type($path) ?: 'image/png';
                return ['cid' => 'brandlogo', 'mime' => $mime, 'data' => base64_encode($contents)];
            }
        }
        return null;
    }

    private function orgName(): string
    {
        $name = trim((string) ($this->settings->get('organization_name')
            ?: $this->settings->get('site_name')
            ?: ''));
        return $name !== '' ? $name : 'Project Cloud';
    }

    private function encodeHeader(string $text): string
    {
        if (preg_match('/[^\x20-\x7E]/', $text) === 1) {
            return '=?UTF-8?B?' . base64_encode($text) . '?=';
        }
        return $text;
    }

    private function encodeAddress(string $name, string $email): string
    {
        $name = trim($name);
        if ($name === '') {
            return $email;
        }
        return $this->encodeHeader($name) . ' <' . $email . '>';
    }

    private function domainOf(string $email): string
    {
        $at = strrpos($email, '@');
        return $at !== false ? substr($email, $at + 1) : 'localhost';
    }
}
