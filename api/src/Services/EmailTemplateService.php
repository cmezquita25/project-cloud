<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;

/**
 * Plantillas de correo personalizables (asunto + cuerpo HTML) con sustitución
 * de variables `{{var}}`. Si una plantilla no se ha personalizado, se usa el
 * default de código. El cuerpo que producen estas plantillas es el CONTENIDO
 * del correo; la envoltura de marca (logo/cabecera/pie) la añade MailService.
 */
final class EmailTemplateService
{
    public const WELCOME = 'welcome';
    public const PASSWORD_RESET = 'password_reset';
    public const QUOTA_WARNING = 'quota_warning';
    public const SUPPORT_REPORT = 'support_report';

    /** @var list<string> */
    public const KEYS = [self::WELCOME, self::PASSWORD_RESET, self::QUOTA_WARNING, self::SUPPORT_REPORT];

    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    /**
     * Devuelve la plantilla guardada o, si no existe/está vacía, el default.
     *
     * @return array{subject:string,body_html:string}
     */
    public function get(string $key): array
    {
        try {
            $stmt = $this->pdo->prepare('SELECT subject, body_html FROM email_templates WHERE template_key = ? LIMIT 1');
            $stmt->execute([$key]);
            $row = $stmt->fetch();
        } catch (\Throwable) {
            $row = false; // tabla aún no migrada -> usa default
        }

        if (is_array($row) && trim((string) ($row['body_html'] ?? '')) !== '') {
            return [
                'subject'   => (string) $row['subject'],
                'body_html' => (string) $row['body_html'],
            ];
        }

        $default = self::defaults()[$key] ?? ['subject' => '', 'body_html' => ''];
        return ['subject' => $default['subject'], 'body_html' => $default['body_html']];
    }

    public function set(string $key, string $subject, string $bodyHtml): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO email_templates (template_key, subject, body_html) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE subject = VALUES(subject), body_html = VALUES(body_html)'
        );
        $stmt->execute([$key, $subject, $bodyHtml]);
    }

    /** Restaura el default (borra la personalización). */
    public function reset(string $key): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM email_templates WHERE template_key = ?');
        $stmt->execute([$key]);
    }

    /**
     * Renderiza asunto + cuerpo sustituyendo variables `{{var}}`.
     *
     * @param array<string,string> $vars
     * @return array{subject:string,html:string}
     */
    public function render(string $key, array $vars): array
    {
        $tpl = $this->get($key);
        return [
            'subject' => $this->interpolate($tpl['subject'], $vars),
            'html'    => $this->interpolate($tpl['body_html'], $vars),
        ];
    }

    /**
     * Sustituye variables en un texto suelto (para previsualizar contenido aún
     * sin guardar). @param array<string,string> $vars
     */
    public function apply(string $text, array $vars): string
    {
        return $this->interpolate($text, $vars);
    }

    /** @param array<string,string> $vars */
    private function interpolate(string $text, array $vars): string
    {
        return preg_replace_callback('/\{\{\s*(\w+)\s*\}\}/', static function (array $m) use ($vars): string {
            return array_key_exists($m[1], $vars) ? $vars[$m[1]] : $m[0];
        }, $text) ?? $text;
    }

    /**
     * Valores de ejemplo para previsualizar cada plantilla en el editor.
     *
     * @return array<string,string>
     */
    public static function sampleVars(string $key): array
    {
        $common = ['org_name' => 'Tu organización'];
        return match ($key) {
            self::WELCOME => $common + [
                'user_name'     => 'Ana Pérez',
                'username'      => 'ana',
                'temp_password' => 'Xy7#Kp2q',
                'reset_link'    => 'https://tu-dominio/reset-password?token=demo',
                'login_url'     => 'https://tu-dominio/login',
            ],
            self::PASSWORD_RESET => $common + [
                'user_name'       => 'Ana Pérez',
                'reset_link'      => 'https://tu-dominio/reset-password?token=demo',
                'expires_minutes' => '60',
            ],
            self::QUOTA_WARNING => $common + [
                'user_name' => 'Ana Pérez',
                'percent'   => '92',
                'used'      => '4.6 GB',
                'quota'     => '5 GB',
            ],
            self::SUPPORT_REPORT => $common + [
                'sender_name'    => 'Juan Pérez',
                'sender_email'   => 'juan@ejemplo.com',
                'report_type'    => 'Reporte de Error',
                'report_message' => 'El sistema muestra un error 404 al abrir mis archivos.',
            ],
            default => $common,
        };
    }

    /**
     * Catálogo para el editor del panel: etiqueta, variables disponibles y el
     * contenido efectivo (personalizado o default) de cada plantilla.
     *
     * @return list<array{key:string,label:string,description:string,variables:list<string>,subject:string,body_html:string}>
     */
    public function catalog(): array
    {
        $out = [];
        foreach (self::META as $key => $meta) {
            $current = $this->get($key);
            $out[] = [
                'key'         => $key,
                'label'       => $meta['label'],
                'description' => $meta['description'],
                'variables'   => $meta['variables'],
                'subject'     => $current['subject'],
                'body_html'   => $current['body_html'],
            ];
        }
        return $out;
    }

    /** Variables disponibles por plantilla (para validar el editor). */
    public const META = [
        self::WELCOME => [
            'label'       => 'Bienvenida (alta de cuenta)',
            'description' => 'Se envía cuando el administrador crea la cuenta. Incluye la contraseña temporal y el enlace para establecer una definitiva.',
            'variables'   => ['user_name', 'username', 'temp_password', 'reset_link', 'login_url', 'org_name'],
        ],
        self::PASSWORD_RESET => [
            'label'       => 'Restablecer contraseña',
            'description' => 'Se envía cuando el usuario solicita recuperar su contraseña desde el login.',
            'variables'   => ['user_name', 'reset_link', 'expires_minutes', 'org_name'],
        ],
        self::QUOTA_WARNING => [
            'label'       => 'Aviso de cuota (90%)',
            'description' => 'Se envía cuando el almacenamiento del usuario supera el 90% de su cuota.',
            'variables'   => ['user_name', 'percent', 'used', 'quota', 'org_name'],
        ],
        self::SUPPORT_REPORT => [
            'label'       => 'Reporte de Bug o Soporte',
            'description' => 'Se envía al administrador (correo de soporte) cuando un usuario manda un reporte desde el footer.',
            'variables'   => ['sender_name', 'sender_email', 'report_type', 'report_message', 'org_name'],
        ],
    ];

    /** @return array<string,array{subject:string,body_html:string}> */
    public static function defaults(): array
    {
        $btn = static fn (string $href, string $label): string =>
            '<table border="0" cellpadding="0" cellspacing="0"><tr>'
            . '<td align="center" bgcolor="#2563eb" style="border-radius:6px;">'
            . '<a href="' . $href . '" target="_blank" style="display:inline-block;padding:14px 24px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;border:1px solid #2563eb;">'
            . $label . '</a>'
            . '</td></tr></table>';

        return [
            self::WELCOME => [
                'subject'   => 'Tu cuenta en {{org_name}} está lista',
                'body_html' =>
                    '<h2 style="margin:0 0 20px;font-size:22px;color:#1e293b;font-weight:600;font-family:Helvetica,Arial,sans-serif;">¡Hola, {{user_name}}!</h2>'
                    . '<p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Tu cuenta en <strong>{{org_name}}</strong> ha sido creada exitosamente. A continuación, te proporcionamos tus datos de acceso temporales:</p>'
                    . '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;border-radius:8px;margin-bottom:24px;">'
                    . '<tr><td style="padding:20px;">'
                    . '<table border="0" cellpadding="0" cellspacing="0" width="100%">'
                    . '<tr><td style="padding-bottom:12px;color:#64748b;font-size:14px;font-family:Helvetica,Arial,sans-serif;">Usuario:</td>'
                    . '<td style="padding-bottom:12px;color:#0f172a;font-size:16px;font-weight:600;font-family:Helvetica,Arial,sans-serif;">{{username}}</td></tr>'
                    . '<tr><td style="color:#64748b;font-size:14px;font-family:Helvetica,Arial,sans-serif;">Contraseña temporal:</td>'
                    . '<td style="color:#0f172a;font-size:16px;font-weight:600;font-family:Helvetica,Arial,sans-serif;">{{temp_password}}</td></tr>'
                    . '</table>'
                    . '</td></tr>'
                    . '</table>'
                    . '<p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Por motivos de seguridad, te solicitamos que establezcas una nueva contraseña personalizada utilizando el siguiente enlace:</p>'
                    . '<div style="margin-bottom:32px;">' . $btn('{{reset_link}}', 'Establecer mi contraseña') . '</div>'
                    . '<p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.5;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Alternativamente, puedes iniciar sesión temporalmente en <a href="{{login_url}}" style="color:#2563eb;text-decoration:none;font-weight:500;">{{login_url}}</a>.</p>',
            ],
            self::PASSWORD_RESET => [
                'subject'   => 'Restablece tu contraseña de {{org_name}}',
                'body_html' =>
                    '<h2 style="margin:0 0 20px;font-size:22px;color:#1e293b;font-weight:600;font-family:Helvetica,Arial,sans-serif;">Hola, {{user_name}}</h2>'
                    . '<p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta. Para elegir una nueva contraseña, haz clic en el botón inferior. '
                    . 'Ten en cuenta que este enlace expirará en <strong>{{expires_minutes}} minutos</strong>.</p>'
                    . '<div style="margin-bottom:32px;">' . $btn('{{reset_link}}', 'Restablecer contraseña') . '</div>'
                    . '<p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.5;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Si no fuiste tú quien solicitó este cambio, puedes ignorar este mensaje de forma segura. Tu contraseña actual no será modificada.</p>',
            ],
            self::QUOTA_WARNING => [
                'subject'   => 'Alerta de capacidad: Tu almacenamiento está casi lleno',
                'body_html' =>
                    '<h2 style="margin:0 0 20px;font-size:22px;color:#1e293b;font-weight:600;font-family:Helvetica,Arial,sans-serif;">Aviso de almacenamiento</h2>'
                    . '<p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Hola {{user_name}}, te informamos que estás a punto de agotar tu capacidad de almacenamiento en <strong>{{org_name}}</strong>.</p>'
                    . '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;margin-bottom:24px;">'
                    . '<tr><td style="padding:16px 20px;">'
                    . '<p style="margin:0;color:#c2410c;font-size:15px;font-weight:600;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Has ocupado el {{percent}}% de tu cuota ({{used}} de {{quota}}).'
                    . '</p>'
                    . '</td></tr>'
                    . '</table>'
                    . '<p style="margin:0;color:#475569;font-size:16px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Para asegurar que puedas continuar guardando nuevos archivos sin interrupciones, te sugerimos revisar tu cuenta, vaciar la papelera o eliminar documentos que ya no requieras.</p>',
            ],
            self::SUPPORT_REPORT => [
                'subject'   => '[{{report_type}}] Nuevo mensaje de soporte - {{sender_name}}',
                'body_html' =>
                    '<h2 style="margin:0 0 20px;font-size:22px;color:#1e293b;font-weight:600;font-family:Helvetica,Arial,sans-serif;">Reporte de Usuario</h2>'
                    . '<p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">'
                    . 'Se ha recibido un nuevo ticket de soporte desde la plataforma.</p>'
                    . '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">'
                    . '<tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">'
                    . '<p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Remitente</p>'
                    . '<p style="margin:0;color:#0f172a;font-size:15px;font-family:Helvetica,Arial,sans-serif;">{{sender_name}} (<a href="mailto:{{sender_email}}" style="color:#2563eb;text-decoration:none;">{{sender_email}}</a>)</p>'
                    . '</td></tr>'
                    . '<tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">'
                    . '<p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Clasificación</p>'
                    . '<p style="margin:0;color:#0f172a;font-size:15px;font-family:Helvetica,Arial,sans-serif;">{{report_type}}</p>'
                    . '</td></tr>'
                    . '<tr><td style="padding:16px 20px;background-color:#ffffff;border-radius:0 0 8px 8px;">'
                    . '<p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Mensaje</p>'
                    . '<p style="margin:0;color:#334155;font-size:15px;line-height:1.6;white-space:pre-wrap;font-family:Helvetica,Arial,sans-serif;">{{report_message}}</p>'
                    . '</td></tr>'
                    . '</table>',
            ],
        ];
    }
}
