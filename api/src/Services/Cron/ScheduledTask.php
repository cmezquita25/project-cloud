<?php

declare(strict_types=1);

namespace ProjectCloud\Services\Cron;

/**
 * Tarea en segundo plano del programador (cron). El cron del servidor se
 * ejecuta cada minuto; cada tarea decide su propio intervalo.
 */
interface ScheduledTask
{
    /** Identificador estable (se usa en settings y en la API). */
    public function key(): string;

    /** Nombre visible en la pantalla Tareas Cron. */
    public function label(): string;

    /** Qué hace, en una frase. */
    public function description(): string;

    /** Cada cuántos segundos debe ejecutarse. */
    public function intervalSeconds(): int;

    /**
     * Ejecuta la tarea. Devuelve métricas legibles para el registro.
     *
     * @return array<string,int|string|bool>
     */
    public function run(): array;
}
