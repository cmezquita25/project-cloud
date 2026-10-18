<?php

declare(strict_types=1);

namespace ProjectCloud\Updater;

/**
 * Llave PÚBLICA de firma de releases (Ed25519).
 * GENERADO por scripts/release/keygen.mjs — no editar a mano.
 *
 * El actualizador solo instala paquetes cuya firma valide con esta llave. La
 * llave privada correspondiente vive fuera del repositorio, en la máquina de
 * quien publica las versiones.
 */
final class ReleaseKey
{
    public const ALGORITHM = 'ed25519';
    public const KEY_ID = '637f4a7d43b7ddba';
    public const PUBLIC_KEY = 'OUnuKsK0I5PhP6sNyEvH/4pJhTAKzUPUdBfbf3NPAoY=';
}
