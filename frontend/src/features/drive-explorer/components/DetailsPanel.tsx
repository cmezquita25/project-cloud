import { X, Link as LinkIcon, Check } from 'lucide-react'
import { useState } from 'react'
import { IconButton, Button } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { getFileIcon } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { formatDateTime } from '@shared/lib/formatDate'
import type { DriveItem } from '../types'

interface DetailsPanelProps {
  item: DriveItem
  onClose: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-content-tertiary">{label}</span>
      <span className="truncate text-right text-content-primary">{value}</span>
    </div>
  )
}

/** Panel lateral de detalles con metadatos y URL pública. */
export function DetailsPanel({ item, onClose }: DetailsPanelProps) {
  const { icon: Icon, className } = getFileIcon(item.name, item.type === 'folder')
  const [copied, setCopied] = useState(false)

  const copyUrl = async () => {
    if (item.type !== 'file') return
    await navigator.clipboard.writeText(item.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <aside className="flex h-full w-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-medium text-content-primary">Detalles</h2>
        <IconButton icon={X} label="Cerrar" size="sm" onClick={onClose} />
      </div>

      <div className="flex flex-col items-center gap-3 border-b border-border px-4 py-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-drive bg-surface-container">
          <Icon size={48} className={cn('opacity-80', className)} strokeWidth={1.5} />
        </div>
        <p className="break-all text-center text-sm font-medium text-content-primary">{item.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <Row label="Tipo" value={item.type === 'folder' ? 'Carpeta' : item.mime_type ?? 'Archivo'} />
        {item.type === 'file' && <Row label="Tamaño" value={formatBytes(item.size_bytes)} />}
        {item.created_at && <Row label="Creado" value={formatDateTime(item.created_at)} />}
        {item.updated_at && <Row label="Modificado" value={formatDateTime(item.updated_at)} />}
        <Row label="Ubicación" value={'/' + (item.path.split('/').slice(0, -1).join('/') || '')} />

        {item.type === 'file' && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-content-tertiary">URL pública</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-container px-3 py-2">
              <LinkIcon size={16} className="shrink-0 text-content-tertiary" />
              <span className="min-w-0 flex-1 truncate text-xs text-content-secondary">{item.url}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              className="mt-2"
              leftIcon={copied ? Check : LinkIcon}
              onClick={copyUrl}
            >
              {copied ? 'Copiado' : 'Copiar URL'}
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
