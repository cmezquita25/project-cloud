/**
 * Evaluación de los límites de PHP relevantes para la plataforma.
 *
 * Umbrales revisados para un clon de Drive sobre hosting compartido (Plesk):
 * las subidas son POR CHUNKS de ~4 MB, así que `upload_max_filesize` y
 * `post_max_size` NO necesitan ser enormes — basta con superar con holgura el
 * tamaño de un chunk. Por eso se relajan respecto a un valor "de subida directa".
 */

export type LimitStatus = 'good' | 'warning' | 'bad'

const KB = 1024
const MB = 1024 * KB
const GB = 1024 * MB

/** Convierte un valor de php.ini (p. ej. "512M", "2G", "128K", "-1") a bytes. -1 = ilimitado/desconocido. */
export function parsePhpSize(val: string): number {
  if (!val || val === 'N/A') return -1
  const num = parseInt(val, 10)
  if (Number.isNaN(num)) return -1
  const suffix = val.trim().slice(-1).toUpperCase()
  switch (suffix) {
    case 'G':
      return num * GB
    case 'M':
      return num * MB
    case 'K':
      return num * KB
    default:
      return num
  }
}

/** memory_limit — GD (miniaturas) y operaciones puntuales. 256M cómodo, 128M aceptable. */
export function getMemoryStatus(val: string): LimitStatus {
  const bytes = parsePhpSize(val)
  if (bytes === -1) return 'good' // -1 = ilimitado
  if (bytes >= 256 * MB) return 'good'
  if (bytes >= 128 * MB) return 'warning'
  return 'bad'
}

/**
 * upload_max_filesize / post_max_size — con subida por chunks solo debe superar
 * el tamaño de un chunk (~4 MB) con margen. 16M+ óptimo, 8M+ aceptable.
 */
export function getUploadStatus(val: string): LimitStatus {
  const bytes = parsePhpSize(val)
  if (bytes === 0 || bytes === -1) return 'good' // 0/-1 = sin límite
  if (bytes >= 16 * MB) return 'good'
  if (bytes >= 8 * MB) return 'warning'
  return 'bad'
}

/** Tiempos (segundos). unlimitedVals se consideran óptimos (0 o -1 según el ajuste). */
export function getTimeStatus(
  val: string,
  goodSecs: number,
  warnSecs: number,
  unlimitedVals: number[] = [0, -1],
): LimitStatus {
  if (val === 'N/A') return 'bad'
  const secs = parseInt(val, 10)
  if (Number.isNaN(secs)) return 'bad'
  if (unlimitedVals.includes(secs)) return 'good'
  if (secs >= goodSecs) return 'good'
  if (secs >= warnSecs) return 'warning'
  return 'bad'
}

/**
 * Coherencia: post_max_size debe ser ≥ upload_max_filesize; si no, la subida
 * se corta antes de llegar al límite de archivo. Devuelve true si es incoherente.
 */
export function isPostSmallerThanUpload(postMaxSize: string, uploadMaxFilesize: string): boolean {
  const post = parsePhpSize(postMaxSize)
  const upload = parsePhpSize(uploadMaxFilesize)
  if (post <= 0 || upload <= 0) return false // ilimitado/desconocido: no se evalúa
  return post < upload
}

export interface ServerLimitDescriptor {
  key: string
  title: string
  description: string
  status: (info: Record<string, string>) => LimitStatus
}

/** Definición declarativa de las tarjetas de límites (título, ayuda y evaluación). */
export const SERVER_LIMITS: ServerLimitDescriptor[] = [
  {
    key: 'memory_limit',
    title: 'Límite de memoria',
    description: 'Memoria por script (GD/miniaturas). Óptimo 256M o más.',
    status: (info) => getMemoryStatus(info.memory_limit ?? 'N/A'),
  },
  {
    key: 'upload_max_filesize',
    title: 'Tamaño máx. subida',
    description: 'Con subida por chunks basta con superar 4 MB. Óptimo 16M o más.',
    status: (info) => getUploadStatus(info.upload_max_filesize ?? 'N/A'),
  },
  {
    key: 'post_max_size',
    title: 'Tamaño máx. POST',
    description: 'Total de la petición. Debe ser ≥ al tamaño máx. de subida.',
    status: (info) => getUploadStatus(info.post_max_size ?? 'N/A'),
  },
  {
    key: 'max_execution_time',
    title: 'Tiempo máx. ejecución',
    description: 'Límite por script (seg.). Óptimo 60+ (o 0 = sin límite).',
    status: (info) => getTimeStatus(info.max_execution_time ?? 'N/A', 60, 30, [0]),
  },
  {
    key: 'max_input_time',
    title: 'Tiempo máx. entrada',
    description: 'Máximo para recibir datos (seg.). Óptimo 60+ (o -1).',
    status: (info) => getTimeStatus(info.max_input_time ?? 'N/A', 60, 30, [-1]),
  },
]
