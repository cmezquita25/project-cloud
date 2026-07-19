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
  Presentation,
  AppWindow,
  Palette,
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
  | 'presentation'
  | 'archive'
  | 'code'
  | 'design'
  | 'executable'
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
  presentation: { icon: Presentation, className: 'text-warning' },
  archive: { icon: FileArchive, className: 'text-warning' },
  code: { icon: FileCode, className: 'text-primary' },
  design: { icon: Palette, className: 'text-primary' },
  executable: { icon: AppWindow, className: 'text-content-secondary' },
  other: { icon: File, className: 'text-content-tertiary' },
}

const EXT_KIND: Record<string, FileKind> = {
  // imágenes
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image',
  bmp: 'image', ico: 'image', avif: 'image', heic: 'image', heif: 'image', tif: 'image',
  tiff: 'image', jfif: 'image', raw: 'image', cr2: 'image', nef: 'image',
  // video
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', m4v: 'video',
  mpg: 'video', mpeg: 'video', wmv: 'video', flv: 'video', '3gp': 'video', ogv: 'video',
  // audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio',
  opus: 'audio', wma: 'audio', aiff: 'audio', mid: 'audio', midi: 'audio',
  // pdf
  pdf: 'pdf',
  // documentos
  doc: 'document', docx: 'document', txt: 'document', rtf: 'document', odt: 'document',
  md: 'document', pages: 'document', epub: 'document', tex: 'document', log: 'document',
  // hojas de cálculo
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', ods: 'spreadsheet',
  tsv: 'spreadsheet', numbers: 'spreadsheet',
  // presentaciones
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation', key: 'presentation',
  // archivos comprimidos
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  bz2: 'archive', xz: 'archive', iso: 'archive', tgz: 'archive', cab: 'archive',
  // código
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code', html: 'code', css: 'code',
  scss: 'code', less: 'code', json: 'code', xml: 'code', yml: 'code', yaml: 'code',
  php: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code', h: 'code', cs: 'code',
  go: 'code', rb: 'code', rs: 'code', kt: 'code', swift: 'code', sh: 'code', vue: 'code', sql: 'code',
  // diseño (suite Adobe y afines)
  psd: 'design', ai: 'design', eps: 'design', indd: 'design', xd: 'design', aep: 'design',
  prproj: 'design', fig: 'design', sketch: 'design', afdesign: 'design', afphoto: 'design',
  cdr: 'design', dwg: 'design',
  // ejecutables / instaladores
  exe: 'executable', msi: 'executable', dmg: 'executable', apk: 'executable',
  deb: 'executable', rpm: 'executable', appimage: 'executable', bin: 'executable', bat: 'executable',
}

/** Etiqueta legible (español) por tipo, para la columna "Tipo". */
const KIND_LABEL: Record<FileKind, string> = {
  folder: 'Carpeta',
  image: 'Imagen',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  document: 'Documento',
  spreadsheet: 'Hoja de cálculo',
  presentation: 'Presentación',
  archive: 'Comprimido',
  code: 'Código',
  design: 'Diseño',
  executable: 'Ejecutable',
  other: 'Otro',
}

/** Deriva el tipo lógico de un archivo a partir de su nombre/extensión. */
export function getFileKind(name: string, isFolder = false): FileKind {
  if (isFolder) return 'folder'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_KIND[ext] ?? 'other'
}

/** Etiqueta de tipo legible. Para archivos sin extensión reconocida usa la
 *  extensión en mayúsculas si existe, o "Otro". */
export function getFileKindLabel(name: string, isFolder = false): string {
  const kind = getFileKind(name, isFolder)
  if (kind === 'other' && !isFolder) {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext && ext !== name.toLowerCase()) return ext.toUpperCase()
  }
  return KIND_LABEL[kind]
}

/** Icono + color para un archivo o carpeta. */
export function getFileIcon(name: string, isFolder = false): IconStyle {
  return KIND_STYLE[getFileKind(name, isFolder)]
}
