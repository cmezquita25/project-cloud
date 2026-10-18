<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use Generator;

/**
 * Divide un script SQL en sentencias, respetando comillas y comentarios.
 *
 * Partir por ';' a ciegas rompe cualquier valor que contenga ';' o '--'
 * (p. ej. el HTML de las plantillas de correo dentro de un dump). Este lector
 * recorre el texto con una pequeña máquina de estados:
 *   - Dentro de '…', "…" o `…` todo es literal (con escapes \x de MySQL).
 *   - Fuera de ellas se descartan comentarios `-- `, `#` y `/* … *\/`.
 *   - Un ';' fuera de comillas cierra la sentencia.
 *
 * Lee por líneas desde un stream, así que un dump de varios GB no se carga
 * entero en memoria.
 */
final class SqlStatementReader
{
    /**
     * @param resource $handle Stream de lectura posicionado al inicio.
     * @return Generator<int,string>
     */
    public static function fromHandle($handle): Generator
    {
        $buffer = '';
        $inBlockComment = false;
        $quote = ''; // '' = fuera de comillas; si no, el carácter de cierre.

        while (($line = fgets($handle)) !== false) {
            $i = 0;
            $len = strlen($line);

            while ($i < $len) {
                if ($inBlockComment) {
                    $end = strpos($line, '*/', $i);
                    if ($end === false) {
                        $i = $len;
                        break;
                    }
                    $i = $end + 2;
                    $inBlockComment = false;
                    $buffer .= ' ';
                    continue;
                }

                if ($quote !== '') {
                    $span = strcspn($line, '\\' . $quote, $i);
                    $buffer .= substr($line, $i, $span);
                    $i += $span;
                    if ($i >= $len) {
                        break;
                    }
                    if ($line[$i] === '\\') {
                        $buffer .= substr($line, $i, 2); // escape: copia "\x" literal
                        $i += 2;
                        continue;
                    }
                    $buffer .= $quote; // cierre ('' dentro de un literal = cierra y reabre)
                    $i++;
                    $quote = '';
                    continue;
                }

                $span = strcspn($line, "'\"`;-#/", $i);
                $buffer .= substr($line, $i, $span);
                $i += $span;
                if ($i >= $len) {
                    break;
                }

                $ch = $line[$i];
                $next = $line[$i + 1] ?? '';

                if ($ch === "'" || $ch === '"' || $ch === '`') {
                    $quote = $ch;
                    $buffer .= $ch;
                    $i++;
                } elseif ($ch === ';') {
                    $statement = trim($buffer);
                    $buffer = '';
                    $i++;
                    if ($statement !== '') {
                        yield $statement;
                    }
                } elseif ($ch === '#' || ($ch === '-' && $next === '-' && ($line[$i + 2] ?? "\n") <= ' ')) {
                    // Comentario de línea: se descarta el resto de la línea.
                    $buffer .= "\n";
                    break;
                } elseif ($ch === '/' && $next === '*') {
                    $inBlockComment = true;
                    $i += 2;
                } else {
                    $buffer .= $ch;
                    $i++;
                }
            }
        }

        $statement = trim($buffer);
        if ($statement !== '') {
            yield $statement;
        }
    }

    /** @return Generator<int,string> */
    public static function fromString(string $sql): Generator
    {
        $handle = fopen('php://temp', 'r+b');
        if ($handle === false) {
            return;
        }
        fwrite($handle, $sql);
        rewind($handle);
        try {
            yield from self::fromHandle($handle);
        } finally {
            fclose($handle);
        }
    }
}
