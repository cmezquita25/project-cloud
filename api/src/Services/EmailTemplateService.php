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
            '<a href="' . $href . '" style="display:inline-block;background:#1a73e8;color:#ffffff;'
            . 'text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">' . $label . '</a>';

        return [
            self::WELCOME => [
                'subject'   => 'Tu cuenta en {{org_name}} está lista',
                'body_html' =>
                    '<h2 style="margin:0 0 16px;font-size:20px;color:#202124;">¡Hola, {{user_name}}!</h2>'
                    . '<p style="margin:0 0 16px;color:#5f6368;line-height:1.6;">'
                    . 'Se ha creado tu cuenta en <strong>{{org_name}}</strong>. Estos son tus datos de acceso:</p>'
                    . '<table style="margin:0 0 16px;font-size:14px;color:#202124;">'
                    . '<tr><td style="padding:4px 12px 4px 0;color:#5f6368;">Usuario</td><td><strong>{{username}}</strong></td></tr>'
                    . '<tr><td style="padding:4px 12px 4px 0;color:#5f6368;">Contraseña temporal</td><td><strong>{{temp_password}}</strong></td></tr>'
                    . '</table>'
                    . '<p style="margin:0 0 24px;color:#5f6368;line-height:1.6;">'
                    . 'Por seguridad, establece tu propia contraseña con el siguiente botón:</p>'
                    . '<p style="margin:0 0 24px;">' . $btn('{{reset_link}}', 'Establecer mi contraseña') . '</p>'
                    . '<p style="margin:0;color:#9aa0a6;font-size:13px;line-height:1.6;">'
                    . 'También puedes iniciar sesión en <a href="{{login_url}}" style="color:#1a73e8;">{{login_url}}</a> con la contraseña temporal.</p>',
            ],
            self::PASSWORD_RESET => [
                'subject'   => 'Restablece tu contraseña de {{org_name}}',
                'body_html' =>
                    '<h2 style="margin:0 0 16px;font-size:20px;color:#202124;">Hola, {{user_name}}</h2>'
                    . '<p style="margin:0 0 24px;color:#5f6368;line-height:1.6;">'
                    . 'Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón para elegir una nueva. '
                    . 'El enlace caduca en {{expires_minutes}} minutos.</p>'
                    . '<p style="margin:0 0 24px;">' . $btn('{{reset_link}}', 'Restablecer contraseña') . '</p>'
                    . '<p style="margin:0;color:#9aa0a6;font-size:13px;line-height:1.6;">'
                    . 'Si no solicitaste este cambio, puedes ignorar este correo; tu contraseña seguirá igual.</p>',
            ],
            self::QUOTA_WARNING => [
                'subject'   => 'Tu almacenamiento en {{org_name}} está casi lleno',
                'body_html' =>
                    '<h2 style="margin:0 0 16px;font-size:20px;color:#202124;">Hola, {{user_name}}</h2>'
                    . '<p style="margin:0 0 16px;color:#5f6368;line-height:1.6;">'
                    . 'Has usado el <strong>{{percent}}%</strong> de tu almacenamiento ({{used}} de {{quota}}).</p>'
                    . '<p style="margin:0;color:#5f6368;line-height:1.6;">'
                    . 'Te recomendamos liberar espacio eliminando archivos que ya no necesites o vaciando la papelera.</p>',
            ],
            self::SUPPORT_REPORT => [
                'subject'   => '[{{report_type}}] {{org_name}} - {{sender_name}}',
                'body_html' =>
                    '<h2 style="margin:0 0 16px;font-size:20px;color:#202124;">Nuevo reporte de soporte</h2>'
                    . '<p style="margin:0 0 8px;color:#5f6368;"><strong>De:</strong> {{sender_name}} ({{sender_email}})</p>'
                    . '<p style="margin:0 0 16px;color:#5f6368;"><strong>Tipo:</strong> {{report_type}}</p>'
                    . '<p style="margin:0 0 8px;color:#5f6368;"><strong>Mensaje:</strong></p>'
                    . '<div style="background:#f4f4f4;padding:15px;border-radius:5px;white-space:pre-wrap;color:#333;">{{report_message}}</div>',
            ],
        ];
    }
}
