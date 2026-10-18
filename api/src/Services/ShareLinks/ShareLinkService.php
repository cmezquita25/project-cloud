<?php

declare(strict_types=1);

namespace ProjectCloud\Services\ShareLinks;

use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\ShareLinkRepository;

/**
 * Crear, listar, editar y revocar enlaces (lado del que comparte).
 * Lo que ve el visitante está en PublicLinkService.
 */
final class ShareLinkService
{
    private const MIN_EXPIRY = 60;                 // 1 minuto
    private const MAX_EXPIRY = 10 * 365 * 86400;   // 10 años
    private const MIN_PASSWORD = 4;

    private ShareLinkRepository $links;

    public function __construct(?ShareLinkRepository $links = null)
    {
        $this->links = $links ?? new ShareLinkRepository();
    }

    /**
     * Enlaces de un archivo o carpeta, más lo que el diálogo necesita saber
     * del destino (visibilidad y cuántos privados contiene una carpeta).
     *
     * @param array{id:int,role:string} $user
     * @param array<string,mixed> $q scope, target_type, target_id, target_path
     * @return array{links:list<array<string,mixed>>,target:array<string,mixed>}
     */
    public function listForTarget(array $user, array $q): array
    {
        $t = ShareLinkPolicy::assertCanManageTarget($user, (string) ($q['scope'] ?? 'drive'), (string) ($q['target_type'] ?? ''), $q['target_id'] ?? null, $q['target_path'] ?? null);
        $rows = $this->links->forTarget($t['scope'], $t['target_type'], $t['target_id'], $t['target_path']);

        $target = ['visibility' => 'public', 'private_items' => 0];
        if ($t['scope'] === 'drive' && $t['row'] !== null) {
            $target['visibility'] = (string) ($t['row']['visibility'] ?? 'public');
            if ($t['target_type'] === 'folder') {
                $target['private_items'] = $this->privateItemsUnder((int) $t['row']['user_id'], (string) $t['row']['path']);
            }
        }

        return ['links' => array_map([self::class, 'present'], $rows), 'target' => $target];
    }

    /**
     * @param array{id:int,role:string} $user
     * @param array<string,mixed> $in
     * @return array<string,mixed>
     */
    public function create(array $user, array $in): array
    {
        $t = ShareLinkPolicy::assertCanManageTarget($user, (string) ($in['scope'] ?? 'drive'), (string) ($in['target_type'] ?? ''), $in['target_id'] ?? null, $in['target_path'] ?? null);

        do {
            $token = LinkKeys::token();
        } while ($this->links->tokenExists($token));

        $id = $this->links->create([
            'token'          => $token,
            'created_by'     => $user['id'],
            'scope'          => $t['scope'],
            'target_type'    => $t['target_type'],
            'target_id'      => $t['target_id'],
            'target_path'    => $t['target_path'],
            'access'         => self::access($in['access'] ?? 'anyone'),
            'label'          => self::label($in['label'] ?? null),
            'allow_download' => (bool) ($in['allow_download'] ?? true),
            'password_hash'  => isset($in['password']) && $in['password'] !== '' ? self::passwordHash($in['password']) : null,
            'expires_in'     => self::expiresIn($in['expires_in'] ?? null),
        ]);

        return self::present((array) $this->links->find($id));
    }

    /**
     * Cambia acceso, caducidad (extender, hacer permanente, reactivar un
     * caducado), etiqueta, contraseña o descarga. El token no cambia: un QR
     * impreso sigue sirviendo.
     *
     * @param array{id:int,role:string} $user
     * @param array<string,mixed> $in
     * @return array<string,mixed>
     */
    public function update(array $user, int $id, array $in): array
    {
        $link = $this->findOwned($user, $id, edit: true);
        if ($link['revoked_at'] !== null) {
            throw new HttpException(410, 'LINK_REVOKED', 'El enlace está revocado; crea uno nuevo.');
        }

        $fields = [];
        if (array_key_exists('access', $in)) {
            $fields['access'] = self::access($in['access']);
        }
        if (array_key_exists('label', $in)) {
            $fields['label'] = self::label($in['label']);
        }
        if (array_key_exists('allow_download', $in)) {
            $fields['allow_download'] = (bool) $in['allow_download'];
        }
        if (array_key_exists('expires_in', $in)) {
            $fields['expires_in'] = self::expiresIn($in['expires_in']);
        }
        if (array_key_exists('password', $in)) {
            $fields['password_hash'] = $in['password'] === null || $in['password'] === '' ? null : self::passwordHash($in['password']);
        }
        if ($fields === []) {
            throw HttpException::badRequest('Nada que actualizar.');
        }

        $this->links->update($id, $fields);
        return self::present((array) $this->links->find($id));
    }

    /** @param array{id:int,role:string} $user */
    public function revoke(array $user, int $id): array
    {
        $link = $this->findOwned($user, $id, edit: false);
        $this->links->revoke($id);
        return self::present((array) $this->links->find((int) $link['id']));
    }

    /**
     * Forma pública de un enlace para el panel del que comparte. Las fechas
     * relativas («caduca en», «último acceso hace») vienen en segundos,
     * calculadas por la base de datos.
     *
     * @param array<string,mixed> $l
     * @return array<string,mixed>
     */
    public static function present(array $l): array
    {
        $status = $l['revoked_at'] !== null ? 'revoked' : ((int) $l['is_expired'] === 1 ? 'expired' : 'active');
        return [
            'id'               => (int) $l['id'],
            'token'            => (string) $l['token'],
            'path'             => '/s/' . $l['token'],
            'scope'            => (string) $l['scope'],
            'target_type'      => (string) $l['target_type'],
            'target_id'        => $l['target_id'] !== null ? (int) $l['target_id'] : null,
            'target_path'      => $l['target_path'] !== null ? (string) $l['target_path'] : null,
            'access'           => (string) $l['access'],
            'label'            => $l['label'] !== null ? (string) $l['label'] : null,
            'allow_download'   => (bool) $l['allow_download'],
            'has_password'     => $l['password_hash'] !== null,
            'status'           => $status,
            'expires_in'       => $l['expires_at'] !== null ? (int) $l['expires_in'] : null,
            'view_count'       => (int) $l['view_count'],
            'download_count'   => (int) $l['download_count'],
            'accessed_ago'     => $l['last_accessed_at'] !== null ? (int) $l['accessed_ago'] : null,
            'created_ago'      => (int) $l['created_ago'],
        ];
    }

    // --- Ayudantes ---

    /** @param array{id:int,role:string} $user */
    private function findOwned(array $user, int $id, bool $edit): array
    {
        $link = $this->links->find($id);
        if ($link === null) {
            throw HttpException::notFound('Enlace no encontrado.');
        }
        $allowed = $edit ? ShareLinkPolicy::canEdit($user, $link) : ShareLinkPolicy::canRevoke($user, $link);
        if (!$allowed) {
            // 404 y no 403: no confirma que el enlace exista.
            throw HttpException::notFound('Enlace no encontrado.');
        }
        return $link;
    }

    private function privateItemsUnder(int $ownerId, string $path): int
    {
        $pdo = Database::pdo();
        $like = addcslashes($path, '%_' . chr(92)) . '/%';
        $count = 0;
        foreach (['files', 'folders'] as $table) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM `{$table}` WHERE user_id = ? AND deleted_at IS NULL AND visibility = 'private' AND path LIKE ?");
            $stmt->execute([$ownerId, $like]);
            $count += (int) $stmt->fetchColumn();
        }
        return $count;
    }

    private static function invalid(string $field, string $message): HttpException
    {
        return new HttpException(422, 'VALIDATION_ERROR', $message, [$field => $message]);
    }

    private static function access(mixed $value): string
    {
        if (!in_array($value, ['anyone', 'members'], true)) {
            throw self::invalid('access', 'Acceso no válido.');
        }
        return $value;
    }

    private static function label(mixed $value): ?string
    {
        $label = trim((string) ($value ?? ''));
        if ($label === '') {
            return null;
        }
        if (mb_strlen($label) > 120) {
            throw self::invalid('label', 'La etiqueta admite hasta 120 caracteres.');
        }
        return $label;
    }

    /** Segundos desde ahora; null = sin caducidad. */
    private static function expiresIn(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_numeric($value) || (int) $value < self::MIN_EXPIRY || (int) $value > self::MAX_EXPIRY) {
            throw self::invalid('expires_in', 'La caducidad debe estar entre 1 minuto y 10 años.');
        }
        return (int) $value;
    }

    private static function passwordHash(mixed $value): string
    {
        $password = (string) $value;
        if (mb_strlen($password) < self::MIN_PASSWORD || mb_strlen($password) > 200) {
            throw self::invalid('password', 'La contraseña del enlace debe tener al menos 4 caracteres.');
        }
        return password_hash($password, PASSWORD_DEFAULT);
    }
}
