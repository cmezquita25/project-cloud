import type { DriveItem } from '../types'

/**
 * Estado del arrastre interno (mover elementos dentro de la unidad).
 *
 * El API de arrastre no permite leer `dataTransfer` durante `dragover`, así que
 * guardamos los elementos arrastrados en memoria y usamos un tipo MIME propio
 * como bandera para distinguirlos del arrastre de archivos del SO (que sube).
 */
export const PC_DND_MIME = 'application/x-pc-items'

let dragged: DriveItem[] = []

export const dragState = {
  set(items: DriveItem[]) {
    dragged = items
  },
  get(): DriveItem[] {
    return dragged
  },
  clear() {
    dragged = []
  },
}

/** ¿El arrastre actual es interno (mover) y no archivos del SO (subir)? */
export function isInternalDrag(e: { dataTransfer: DataTransfer | null }): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(PC_DND_MIME)
}
