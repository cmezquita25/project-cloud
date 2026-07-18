import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases condicionales (clsx) y resuelve conflictos de Tailwind
 * (tailwind-merge). Utilidad base del design system.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
