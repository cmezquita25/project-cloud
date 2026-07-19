<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Cálculo de uso de almacenamiento y desglose por tipo.
 */
final class QuotaService
{
    /** Umbral de aviso por correo (%). */
    private const WARN_PERCENT = 90.0;

    public function __construct(
        private readonly UserRepository $users,
        private readonly FileRepository $files,
    ) {
    }

    /**
     * Envía un aviso por correo cuando el uso cruza el 90% de la cuota, una sola
     * vez por cruce (clave settings 'quota_warned_{id}'). Al bajar del umbral se
     * limpia la marca para poder avisar de nuevo en el futuro. No rompe la
     * operación llamante: cualquier error se ignora (se invoca tras subir).
     */
    public function checkQuotaWarning(int $userId): void
    {
        $usage = $this->usage($userId);
        $percent = (float) $usage['percent'];
        $settings = new SettingsRepository();
        $flagKey = 'quota_warned_' . $userId;

        if ($percent < self::WARN_PERCENT) {
            if ($settings->get($flagKey) !== null) {
                $settings->delete($flagKey);
            }
            return;
        }

        // Ya avisado en este cruce: no repetir en cada subida.
        if ($settings->get($flagKey) !== null) {
            return;
        }

        $user = $this->users->findById($userId);
        if ($user === null) {
            return;
        }

        $mail = new MailService($settings);
        if (!$mail->isEnabled()) {
            return; // sin SMTP no se avisa (ni se marca: se reintentará cuando se configure)
        }

        $rendered = (new EmailTemplateService())->render(EmailTemplateService::QUOTA_WARNING, [
            'user_name' => (string) $user['display_name'],
            'percent'   => rtrim(rtrim(number_format($percent, 1, '.', ''), '0'), '.'),
            'used'      => self::humanBytes((int) $usage['used_bytes']),
            'quota'     => self::humanBytes((int) $usage['quota_bytes']),
            'org_name'  => $mail->organizationName(),
        ]);

        $sent = $mail->send(
            (string) $user['email'],
            (string) $user['display_name'],
            $rendered['subject'],
            $rendered['html'],
        );

        if ($sent) {
            $settings->set($flagKey, gmdate('c'));
        }
    }

    /** Formato humano de bytes (equivalente ligero al del frontend). */
    private static function humanBytes(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));
        $i = max(0, min($i, count($units) - 1));
        $value = $bytes / (1024 ** $i);
        return rtrim(rtrim(number_format($value, 1, '.', ''), '0'), '.') . ' ' . $units[$i];
    }

    /**
     * Uso del usuario con desglose por tipo de archivo.
     *
     * @return array<string,mixed>
     */
    public function usage(int $userId): array
    {
        $user = $this->users->findById($userId);
        $quota = $user !== null ? (int) $user['quota_bytes'] : 0;
        $maxUpload = $user !== null ? (int) $user['max_upload_bytes'] : 0;

        $breakdown = [];
        $used = 0;
        foreach ($this->files->usageGroups($userId) as $group) {
            $kind = self::kindOf($group['mime'], $group['ext']);
            $breakdown[$kind] ??= ['kind' => $kind, 'bytes' => 0, 'count' => 0];
            $breakdown[$kind]['bytes'] += $group['bytes'];
            $breakdown[$kind]['count'] += $group['count'];
            $used += $group['bytes'];
        }

        // Ordena el desglose de mayor a menor.
        $breakdownList = array_values($breakdown);
        usort($breakdownList, static fn ($a, $b) => $b['bytes'] <=> $a['bytes']);

        return [
            'used_bytes'       => $used,
            'quota_bytes'      => $quota,
            'max_upload_bytes' => $maxUpload,
            'percent'          => $quota > 0 ? min(100, round($used / $quota * 100, 1)) : 0,
            'breakdown'        => $breakdownList,
        ];
    }

    /** Recalcula el uso real desde la BD y lo persiste en users.used_bytes. */
    public function recalculate(int $userId): int
    {
        $used = $this->files->totalUsed($userId);
        $this->users->setUsedBytes($userId, $used);
        return $used;
    }

    /** Mapea mime/extensión a un tipo lógico (igual que el frontend). */
    private static function kindOf(?string $mime, ?string $ext): string
    {
        $mime = strtolower($mime ?? '');
        $ext = strtolower($ext ?? '');

        if (str_starts_with($mime, 'image/')) {
            return 'image';
        }
        if (str_starts_with($mime, 'video/')) {
            return 'video';
        }
        if (str_starts_with($mime, 'audio/')) {
            return 'audio';
        }
        if ($mime === 'application/pdf' || $ext === 'pdf') {
            return 'pdf';
        }
        if (in_array($ext, ['doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'pages', 'epub', 'tex', 'log'], true)) {
            return 'document';
        }
        if (in_array($ext, ['xls', 'xlsx', 'csv', 'ods', 'tsv', 'numbers'], true)) {
            return 'spreadsheet';
        }
        if (in_array($ext, ['ppt', 'pptx', 'odp', 'key'], true)) {
            return 'presentation';
        }
        if (in_array($ext, ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz', 'cab'], true)) {
            return 'archive';
        }
        if (in_array($ext, [
            'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'scss', 'less', 'json', 'xml', 'yml', 'yaml',
            'php', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rb', 'rs', 'kt', 'swift', 'sh', 'vue', 'sql',
        ], true)) {
            return 'code';
        }
        if (in_array($ext, [
            'psd', 'ai', 'eps', 'indd', 'xd', 'aep', 'prproj', 'fig', 'sketch',
            'afdesign', 'afphoto', 'cdr', 'dwg',
        ], true)) {
            return 'design';
        }
        if (in_array($ext, ['exe', 'msi', 'dmg', 'apk', 'deb', 'rpm', 'appimage', 'bin', 'bat'], true)) {
            return 'executable';
        }
        return 'other';
    }
}
