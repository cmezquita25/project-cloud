<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use PDO;
use ProjectCloud\Core\Database;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Cierre global de sesiones.
 *
 * Revocar los refresh tokens no basta: un access token sigue siendo válido
 * hasta que caduca (~15 min). Por eso cada access token lleva el claim `ep`
 * (época de sesión) y AuthMiddleware rechaza los que tengan una época anterior
 * a `settings.auth_epoch`. Subir la época invalida TODOS los access tokens al
 * instante; borrar los refresh tokens obliga a iniciar sesión de nuevo.
 */
final class SessionRevoker
{
    public const EPOCH_KEY = 'auth_epoch';

    private PDO $pdo;
    private SettingsRepository $settings;

    public function __construct(?PDO $pdo = null, ?SettingsRepository $settings = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
        $this->settings = $settings ?? new SettingsRepository($this->pdo);
    }

    public static function currentEpoch(?SettingsRepository $settings = null): int
    {
        return ($settings ?? new SettingsRepository())->getInt(self::EPOCH_KEY, 0);
    }

    /**
     * Cierra la sesión de todos los usuarios. Devuelve la nueva época.
     * Los refresh tokens se borran (no solo se revocan) para que el cliente
     * reciba "sesión inválida" en vez de la alarma de reuso de token.
     */
    public function revokeAll(int $atLeast = 0): int
    {
        // $atLeast: tras restaurar una copia, la época guardada en la BD es la
        // de entonces; la nueva debe superar también a la que había antes.
        $epoch = max(self::currentEpoch($this->settings), $atLeast) + 1;
        $this->settings->set(self::EPOCH_KEY, (string) $epoch);
        $this->pdo->exec('DELETE FROM refresh_tokens');
        return $epoch;
    }
}
