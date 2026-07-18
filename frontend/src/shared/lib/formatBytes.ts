/**
 * Formatea bytes a una cadena legible (KB, MB, GB…).
 * @example formatBytes(1536) // "1.5 KB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  const value = bytes / Math.pow(k, i)
  // Los bytes no llevan decimales.
  const dm = i === 0 ? 0 : decimals
  return `${parseFloat(value.toFixed(dm))} ${units[i]}`
}

/** Porcentaje de uso acotado a [0, 100]. */
export function usagePercent(used: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (used / total) * 100))
}
