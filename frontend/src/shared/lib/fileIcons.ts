import {
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileType,
  Folder,
  type LucideIcon,
} from 'lucide-react'

export type FileKind =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'archive'
  | 'code'
  | 'other'

interface IconStyle {
  icon: LucideIcon
  /** Clase de color estilo Google Drive por tipo. */
  className: string
}

const KIND_STYLE: Record<FileKind, IconStyle> = {
  folder: { icon: Folder, className: 'text-content-secondary' },
  image: { icon: FileImage, className: 'text-danger' },
  video: { icon: FileVideo, className: 'text-danger' },
  audio: { icon: FileAudio, className: 'text-warning' },
  pdf: { icon: FileType, className: 'text-danger' },
  document: { icon: FileText, className: 'text-primary' },
  spreadsheet: { icon: FileSpreadsheet, className: 'text-success' },
  archive: { icon: FileArchive, className: 'text-warning' },
  code: { icon: FileCode, className: 'text-primary' },
  other: { icon: File, className: 'text-content-tertiary' },
}

const EXT_KIND: Record<string, FileKind> = {
  // imágenes
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  svg: 'image', bmp: 'image', ico: 'image', avif: 'image', heic: 'image',
  // video
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', m4v: 'video',
  // audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio',
  // pdf
  pdf: 'pdf',
  // documentos
  doc: 'document', docx: 'document', txt: 'document', rtf: 'document', odt: 'document', md: 'document',
  // hojas de cálculo
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', ods: 'spreadsheet',
  // archivos comprimidos
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  // código
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code', html: 'code', css: 'code',
  json: 'code', php: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code', sql: 'code',
}

/** Deriva el tipo lógico de un archivo a partir de su nombre/extensión. */
export function getFileKind(name: string, isFolder = false): FileKind {
  if (isFolder) return 'folder'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_KIND[ext] ?? 'other'
}

/** Icono + color para un archivo o carpeta. */
export function getFileIcon(name: string, isFolder = false): IconStyle {
  return KIND_STYLE[getFileKind(name, isFolder)]
}
