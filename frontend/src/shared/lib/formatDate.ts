const RELATIVE = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const ABSOLUTE = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const ABSOLUTE_TIME = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Fecha absoluta corta: "15 jul 2026". */
export function formatDate(input: string | number | Date): string {
  return ABSOLUTE.format(new Date(input))
}

/** Fecha con hora: "15 jul 2026, 14:30". */
export function formatDateTime(input: string | number | Date): string {
  return ABSOLUTE_TIME.format(new Date(input))
}

/**
 * Fecha relativa para listados estilo Drive ("hace 5 min", "ayer"),
 * cae a fecha absoluta cuando supera ~30 días.
 */
export function formatRelative(input: string | number | Date): string {
  const date = new Date(input)
  const diffMs = date.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const abs = Math.abs(diffSec)

  if (abs < 60) return RELATIVE.format(Math.round(diffSec), 'second')
  if (abs < 3600) return RELATIVE.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return RELATIVE.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return RELATIVE.format(Math.round(diffSec / 86400), 'day')
  return formatDate(date)
}
