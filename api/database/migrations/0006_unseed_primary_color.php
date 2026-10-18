<?php

declare(strict_types=1);

/**
 * El instalador sembraba `primary_color = #3b82f6`. La plataforma lo trataba
 * como un color personalizado y lo aplicaba encima de cualquier estilo base
 * (Blizzard, Nebula, Supernova, Techmaleon): enlaces, casillas y foco salían
 * siempre azules. Se borra solo si sigue siendo exactamente el valor sembrado;
 * un color elegido a mano se respeta.
 */
return static function (PDO $pdo): void {
    $pdo->exec("DELETE FROM settings WHERE `key` = 'primary_color' AND LOWER(`value`) = '#3b82f6'");
};
