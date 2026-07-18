<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\UserRepository;

/**
 * Cálculo de uso de almacenamiento y desglose por tipo.
 */
final class QuotaService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly FileRepository $files,
    ) {
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
        if (in_array($ext, ['doc', 'docx', 'txt', 'rtf', 'odt', 'md'], true)) {
            return 'document';
        }
        if (in_array($ext, ['xls', 'xlsx', 'csv', 'ods'], true)) {
            return 'spreadsheet';
        }
        if (in_array($ext, ['zip', 'rar', '7z', 'tar', 'gz'], true)) {
            return 'archive';
        }
        if (in_array($ext, ['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'php', 'py', 'java', 'sql'], true)) {
            return 'code';
        }
        return 'other';
    }
}
