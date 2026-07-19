import type { FileKind } from './services/quotaApi'

/**
 * Metadatos visuales por tipo de archivo para el desglose de almacenamiento.
 * Reutilizado por StoragePage y ProfilePage. Debe cubrir TODOS los `FileKind`
 * que el backend (QuotaService::kindOf) puede devolver.
 */
export const KIND_META: Record<FileKind, { label: string; bar: string; dot: string }> = {
  image: { label: 'Imágenes', bar: 'bg-[#4285f4]', dot: 'bg-[#4285f4]' },
  video: { label: 'Videos', bar: 'bg-[#ea4335]', dot: 'bg-[#ea4335]' },
  audio: { label: 'Audio', bar: 'bg-[#fbbc04]', dot: 'bg-[#fbbc04]' },
  pdf: { label: 'PDF', bar: 'bg-[#d93025]', dot: 'bg-[#d93025]' },
  document: { label: 'Documentos', bar: 'bg-[#1a73e8]', dot: 'bg-[#1a73e8]' },
  spreadsheet: { label: 'Hojas de cálculo', bar: 'bg-[#188038]', dot: 'bg-[#188038]' },
  presentation: { label: 'Presentaciones', bar: 'bg-[#e37400]', dot: 'bg-[#e37400]' },
  archive: { label: 'Comprimidos', bar: 'bg-[#e8710a]', dot: 'bg-[#e8710a]' },
  code: { label: 'Código', bar: 'bg-[#9334e6]', dot: 'bg-[#9334e6]' },
  design: { label: 'Diseño', bar: 'bg-[#a142f4]', dot: 'bg-[#a142f4]' },
  executable: { label: 'Ejecutables', bar: 'bg-[#5f6368]', dot: 'bg-[#5f6368]' },
  other: { label: 'Otros', bar: 'bg-content-tertiary', dot: 'bg-content-tertiary' },
}
