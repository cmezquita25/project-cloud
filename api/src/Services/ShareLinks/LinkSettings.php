<?php

declare(strict_types=1);

namespace ProjectCloud\Services\ShareLinks;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Políticas de los enlaces compartidos (Configuración → Espacio de trabajo):
 *
 *   enabled          permitir enlaces. Apagado, los existentes dejan de abrir
 *                    (sin revocarlos: al volver a encender, funcionan).
 *   max_expiry_days  caducidad máxima obligatoria; 0 = sin límite.
 *   allow_never      permitir «Sin caducidad» (nunca con un máximo definido).
 *   allow_anyone     permitir «Cualquiera con el enlace»; si no, solo miembros.
 *
 * Los límites se aplican al crear o editar un enlace; los que ya existen se
 * conservan tal cual (para cortarlos está «Revocar todos»).
 */
final class LinkSettings
{
    public const HIT_RETENTION_DAYS = 90;
    private const MAX_DAYS = 3650;

    /** @return array{enabled:bool,max_expiry_days:int,allow_never:bool,allow_anyone:bool} */
    public static function get(?SettingsRepository $settings = null): array
    {
        $s = $settings ?? new SettingsRepository();
        $max = max(0, min(self::MAX_DAYS, $s->getInt('links_max_expiry_days', 0)));
        return [
            'enabled'         => $s->getInt('links_enabled', 1) === 1,
            'max_expiry_days' => $max,
            'allow_never'     => $max === 0 && $s->getInt('links_allow_never', 1) === 1,
            'allow_anyone'    => $s->getInt('links_allow_anyone', 1) === 1,
        ];
    }

    /**
     * @param array<string,mixed> $in
     * @return array{enabled:bool,max_expiry_days:int,allow_never:bool,allow_anyone:bool}
     */
    public static function save(array $in): array
    {
        $s = new SettingsRepository();
        if (array_key_exists('enabled', $in)) {
            $s->set('links_enabled', $in['enabled'] ? '1' : '0');
        }
        if (array_key_exists('max_expiry_days', $in)) {
            $days = (int) $in['max_expiry_days'];
            if ($days < 0 || $days > self::MAX_DAYS) {
                throw new HttpException(422, 'VALIDATION_ERROR', 'La caducidad máxima debe estar entre 0 (sin límite) y 3650 días.');
            }
            $s->set('links_max_expiry_days', (string) $days);
        }
        if (array_key_exists('allow_never', $in)) {
            $s->set('links_allow_never', $in['allow_never'] ? '1' : '0');
        }
        if (array_key_exists('allow_anyone', $in)) {
            $s->set('links_allow_anyone', $in['allow_anyone'] ? '1' : '0');
        }
        return self::get($s);
    }

    /** Comprueba un enlace nuevo o editado contra las políticas. */
    public static function assertAllowed(?string $access, bool $expirySet, ?int $expiresIn): void
    {
        $p = self::get();
        if (!$p['enabled']) {
            throw new HttpException(403, 'LINKS_DISABLED', 'Los enlaces compartidos están desactivados en esta organización.');
        }
        if ($access === 'anyone' && !$p['allow_anyone']) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'La organización solo permite enlaces para miembros.', ['access' => 'anyone']);
        }
        if (!$expirySet) {
            return;
        }
        if ($expiresIn === null && !$p['allow_never']) {
            throw new HttpException(422, 'VALIDATION_ERROR', $p['max_expiry_days'] > 0
                ? "La organización exige que los enlaces caduquen en {$p['max_expiry_days']} días como máximo."
                : 'La organización no permite enlaces sin caducidad.', ['expires_in' => null]);
        }
        if ($expiresIn !== null && $p['max_expiry_days'] > 0 && $expiresIn > $p['max_expiry_days'] * 86400) {
            throw new HttpException(422, 'VALIDATION_ERROR', "La caducidad máxima permitida es de {$p['max_expiry_days']} días.", ['expires_in' => $expiresIn]);
        }
    }
}
