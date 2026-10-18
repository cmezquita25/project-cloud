/**
 * Descargas con «Guardar como»: en los navegadores que lo permiten (Chrome,
 * Edge, Opera) se elige dónde guardar y el archivo se escribe ahí mientras se
 * descarga, sin cargarlo entero en memoria. En los demás (Firefox, Safari)
 * se descarga como siempre, a la carpeta de descargas del navegador.
 *
 * Importante: hay que llamarlas directamente desde el clic. El navegador solo
 * abre el selector en respuesta a una acción del usuario.
 */

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<FileSystemFileHandle>
  showDirectoryPicker?: (options?: { mode?: 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

export interface DownloadTarget {
  url: string
  name: string
}

/** Resultado: `saved` (guardado donde eligió), `browser` (descarga normal) o `cancelled`. */
export type DownloadResult = 'saved' | 'browser' | 'cancelled'

const pickerWindow = () => window as SavePickerWindow

/** ¿Este navegador deja elegir la ubicación? */
export const canChooseLocation = (): boolean => typeof pickerWindow().showSaveFilePicker === 'function'

function browserDownload({ url, name }: DownloadTarget): void {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

async function writeTo(handle: FileSystemFileHandle, url: string): Promise<void> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok || !res.body) {
    let message = 'No se pudo descargar el archivo.'
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(message)
  }
  await res.body.pipeTo(await handle.createWritable())
}

/** Un archivo: pregunta dónde guardarlo (o descarga normal si no se puede elegir). */
export async function saveFile(target: DownloadTarget): Promise<DownloadResult> {
  const w = pickerWindow()
  if (!w.showSaveFilePicker) {
    browserDownload(target)
    return 'browser'
  }
  let handle: FileSystemFileHandle
  try {
    handle = await w.showSaveFilePicker({ suggestedName: target.name })
  } catch (err) {
    if (isAbort(err)) return 'cancelled'
    // Selector no disponible en este contexto (iframe, permisos…): descarga normal.
    browserDownload(target)
    return 'browser'
  }
  await writeTo(handle, target.url)
  return 'saved'
}

/** Varios archivos: se elige una carpeta una sola vez y se guardan todos ahí. */
export async function saveFiles(targets: DownloadTarget[]): Promise<DownloadResult> {
  if (targets.length === 1) return saveFile(targets[0]!)
  const w = pickerWindow()
  if (!w.showDirectoryPicker) {
    targets.forEach(browserDownload)
    return 'browser'
  }
  let dir: FileSystemDirectoryHandle
  try {
    dir = await w.showDirectoryPicker({ mode: 'readwrite' })
  } catch (err) {
    if (isAbort(err)) return 'cancelled'
    targets.forEach(browserDownload)
    return 'browser'
  }
  for (const t of targets) {
    await writeTo(await dir.getFileHandle(t.name.replace(/[\\/:*?"<>|]/g, '_'), { create: true }), t.url)
  }
  return 'saved'
}
