import { X, Link as LinkIcon, Check, Info, FileStack, Lock } from 'lucide-react'
import { useState } from 'react'
import { IconButton, Button, Avatar, AvatarGroup } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { getFileIcon } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { formatDateTime } from '@shared/lib/formatDate'
import type { DriveItem } from '../types'

interface DetailsPanelProps {
  items: DriveItem[]
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
export function DetailsPanel({ items, onClose }: DetailsPanelProps) {
  const [copied, setCopied] = useState(false)

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <aside className="flex h-full w-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-medium text-content-primary">Detalles</h2>
        <IconButton icon={X} label="Cerrar" size="sm" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-content-tertiary">
            <Info size={48} className="mb-4 opacity-50" strokeWidth={1.5} />
            <p className="text-sm font-medium">Selecciona un elemento para ver sus detalles</p>
          </div>
        ) : items.length > 1 ? (
          <div className="flex h-full flex-col items-center p-6">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-drive bg-surface-container">
              <FileStack size={48} className="text-content-secondary opacity-80" strokeWidth={1.5} />
            </div>
            <p className="text-base font-medium text-content-primary">{items.length} elementos seleccionados</p>
            <div className="mt-8 w-full border-t border-border pt-4">
               <Row label="Tamaño total" value={formatBytes(items.reduce((acc, i) => acc + (i.type === 'file' ? i.size_bytes : 0), 0))} />
            </div>
          </div>
        ) : (
          items[0] ? <SingleItemDetails item={items[0]} copied={copied} onCopyUrl={() => copyUrl((items[0] as any).url)} /> : null
        )}
      </div>
    </aside>
  )
}

function SingleItemDetails({ item, copied, onCopyUrl }: { item: DriveItem, copied: boolean, onCopyUrl: () => void }) {
  const { icon: Icon, className } = getFileIcon(item.name, item.type === 'folder')

  return (
    <>
      <div className="flex flex-col items-center gap-3 border-b border-border px-4 py-6">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-drive bg-surface-container">
          <Icon size={48} className={cn('opacity-80', className)} strokeWidth={1.5} />
          {item.blocked_actions && item.blocked_actions.length > 0 && (
            <div className="absolute right-0 top-0 rounded-full bg-danger-subtle p-1.5 text-danger shadow-sm">
              <Lock size={16} />
            </div>
          )}
        </div>
        <p className="break-all text-center text-sm font-medium text-content-primary">{item.name}</p>
      </div>

      <div className="px-4 py-2">
        <Row label="Tipo" value={item.type === 'folder' ? 'Carpeta' : item.mime_type ?? 'Archivo'} />
        {item.type === 'file' && <Row label="Tamaño" value={formatBytes(item.size_bytes)} />}
        {item.created_at && <Row label="Creado" value={formatDateTime(item.created_at)} />}
        {item.updated_at && <Row label="Modificado" value={formatDateTime(item.updated_at)} />}
        <Row label="Ubicación" value={'/' + (item.path.split('/').slice(0, -1).join('/') || '')} />
        <Row label="Bloqueado" value={item.blocked_actions && item.blocked_actions.length > 0 ? 'Sí' : 'No'} />

        {item.owners && item.owners.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-content-tertiary">Creado por</p>
            <div className="mb-4 flex items-center gap-3">
              <Avatar src={item.owners[0]?.avatar_url ?? null} name={item.owners[0]?.display_name ?? 'Desconocido'} size={32} />
              <span className="text-sm text-content-primary">{item.owners[0]?.display_name ?? 'Desconocido'}</span>
            </div>

            {item.type === 'folder' && item.owners.length > 1 && (
              <>
                <p className="mb-2 text-xs font-medium text-content-tertiary">Participantes</p>
                <div className="mb-4">
                  <AvatarGroup owners={item.owners} max={99} size={32} overlap={false} />
                </div>
              </>
            )}
          </div>
        )}

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
              onClick={onCopyUrl}
            >
              {copied ? 'Copiado' : 'Copiar URL'}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
