import { useEffect, useState } from 'react'
import {
  X,
  Download,
  Link as LinkIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react'
import { Portal, IconButton, Spinner } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { getFileIcon, getFileKind } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import type { FileItem } from '@features/drive-explorer/types'

interface PreviewModalProps {
  items: FileItem[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

/** Extensiones que se muestran como texto plano embebido. */
const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'csv', 'log', 'json', 'xml', 'yml', 'yaml', 'ini', 'env',
  'js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'html', 'php', 'py', 'java', 'c', 'cpp',
  'sql', 'sh', 'rb', 'go', 'rs',
])

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/**
 * Visor a pantalla completa estilo Drive: imagen, vídeo, audio, PDF y texto.
 * Atajos: Esc cierra, ← / → navegan entre elementos.
 */
export function PreviewModal({ items, index, onIndex, onClose }: PreviewModalProps) {
  const item = items[index]
  const [copied, setCopied] = useState(false)

  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      else if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, items.length, onIndex, onClose])

  if (!item) return null

  const copyUrl = async () => {
    await navigator.clipboard.writeText(item.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = item.url
    a.download = item.name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-modal flex flex-col bg-black/90 text-white" role="dialog" aria-modal="true">
        {/* Barra superior */}
        <header className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
          <IconButton
            icon={X}
            label="Cerrar"
            onClick={onClose}
            className="text-white hover:bg-white/15"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="truncate text-xs text-white/60">{formatBytes(item.size_bytes)}</p>
          </div>
          <IconButton icon={Download} label="Descargar" onClick={download} className="text-white hover:bg-white/15" />
          <IconButton
            icon={copied ? Check : LinkIcon}
            label="Copiar URL pública"
            onClick={copyUrl}
            className="text-white hover:bg-white/15"
          />
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir en pestaña nueva"
            className="hidden rounded-full p-2 text-white transition-colors hover:bg-white/15 sm:inline-flex"
          >
            <ExternalLink size={20} />
          </a>
        </header>

        {/* Contenido */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-14">
          {hasPrev && (
            <button
              onClick={() => onIndex(index - 1)}
              aria-label="Anterior"
              className="absolute left-2 z-10 hidden rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 sm:block"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <PreviewContent key={item.id} item={item} />

          {hasNext && (
            <button
              onClick={() => onIndex(index + 1)}
              aria-label="Siguiente"
              className="absolute right-2 z-10 hidden rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 sm:block"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>

        {items.length > 1 && (
          <footer className="py-2 text-center text-xs text-white/60">
            {index + 1} de {items.length}
          </footer>
        )}
      </div>
    </Portal>
  )
}

/** Renderiza el visor adecuado al tipo de archivo. */
function PreviewContent({ item }: { item: FileItem }) {
  const kind = getFileKind(item.name)
  const ext = extOf(item.name)

  if (kind === 'image') {
    return (
      <img
        src={item.url}
        alt={item.name}
        className="max-h-full max-w-full rounded-lg object-contain shadow-elevation-3"
      />
    )
  }

  if (kind === 'video') {
    return (
      <video src={item.url} controls autoPlay className="max-h-full max-w-full rounded-lg shadow-elevation-3">
        Tu navegador no admite la reproducción de vídeo.
      </video>
    )
  }

  if (kind === 'audio') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <FallbackIcon item={item} />
        <audio src={item.url} controls autoPlay className="w-full">
          Tu navegador no admite la reproducción de audio.
        </audio>
      </div>
    )
  }

  if (kind === 'pdf') {
    return (
      <iframe
        src={item.url}
        title={item.name}
        className="h-full w-full max-w-5xl rounded-lg bg-white shadow-elevation-3"
      />
    )
  }

  if (TEXT_EXT.has(ext)) {
    return <TextPreview url={item.url} />
  }

  return <FallbackIcon item={item} withHint />
}

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ text: string; loading: boolean; error: boolean }>({
    text: '',
    loading: true,
    error: false,
  })

  useEffect(() => {
    let alive = true
    setState({ text: '', loading: true, error: false })
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('http'))))
      .then((t) => alive && setState({ text: t.slice(0, 500_000), loading: false, error: false }))
      .catch(() => alive && setState({ text: '', loading: false, error: true }))
    return () => {
      alive = false
    }
  }, [url])

  if (state.loading) return <Spinner size={32} className="text-white/70" />
  if (state.error)
    return <p className="text-sm text-white/70">No se pudo cargar la vista previa del texto.</p>

  return (
    <pre className="h-full w-full max-w-4xl overflow-auto rounded-lg bg-neutral-900 p-4 text-left text-xs leading-relaxed text-neutral-100 sm:text-sm">
      {state.text}
    </pre>
  )
}

function FallbackIcon({ item, withHint = false }: { item: FileItem; withHint?: boolean }) {
  const { icon: Icon, className } = getFileIcon(item.name)
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-white/10">
        <Icon size={64} className={cn('opacity-90', className)} strokeWidth={1.5} />
      </div>
      {withHint && (
        <p className="max-w-xs text-sm text-white/70">
          No hay vista previa disponible para este tipo de archivo. Descárgalo para abrirlo.
        </p>
      )}
    </div>
  )
}
