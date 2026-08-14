import { useState } from 'react'
import { Link as LinkIcon, Check, Copy, CheckCheck, Loader2 } from 'lucide-react'
import { Dialog, Button } from '@shared/ui'
import { getFileIcon } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { cn } from '@shared/lib/cn'

export interface PublicUrlItem {
  id?: string | number
  name: string
  size_bytes?: number
  mime_type?: string | null
  url?: string
  status?: 'done' | 'uploading' | 'queued' | 'error' | 'canceled'
}

interface PublicUrlsModalProps {
  open: boolean
  onClose: () => void
  items: PublicUrlItem[]
  title?: string
}

export function PublicUrlsModal({ open, onClose, items, title = 'Listado de URLs públicas' }: PublicUrlsModalProps) {
  const [copiedId, setCopiedId] = useState<string | number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const handleCopySingle = async (item: PublicUrlItem, key: string | number) => {
    if (!item.url) return
    await navigator.clipboard.writeText(item.url)
    setCopiedId(key)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleCopyAll = async () => {
    const urls = items.map((i) => i.url).filter((url): url is string => Boolean(url))
    if (urls.length === 0) return
    await navigator.clipboard.writeText(urls.join('\n'))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const availableUrls = items.filter((i) => Boolean(i.url))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <LinkIcon size={20} className="text-primary" />
          <span>{title}</span>
        </div>
      }
      description={`Listado de URLs públicas (${availableUrls.length} de ${items.length} disponibles)`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={copiedAll ? CheckCheck : Copy}
            disabled={availableUrls.length === 0}
            onClick={handleCopyAll}
          >
            {copiedAll ? '¡Todas copiadas!' : `Copiar todas las URLs (${availableUrls.length})`}
          </Button>
        </div>
      }
    >
      <div className="max-h-96 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface-container/50">
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-content-tertiary">
            No hay elementos para mostrar
          </div>
        ) : (
          items.map((item, idx) => {
            const itemKey = item.id ?? `${item.name}-${idx}`
            const isCopied = copiedId === itemKey
            const { icon: Icon, className: iconColor } = getFileIcon(item.name, false)
            const isUploading = item.status === 'uploading' || item.status === 'queued'

            return (
              <div key={itemKey} className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-hover">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface shadow-sm border border-border/50">
                  <Icon size={22} className={cn('opacity-90', iconColor)} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content-primary">{item.name}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-content-tertiary">
                    {item.size_bytes !== undefined && <span>{formatBytes(item.size_bytes)}</span>}
                    {item.mime_type && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[160px]">{item.mime_type}</span>
                      </>
                    )}
                  </div>
                  {item.url ? (
                    <p className="mt-1 truncate font-mono text-[11px] text-content-secondary select-all bg-surface-container px-2 py-0.5 rounded border border-border/60">
                      {item.url}
                    </p>
                  ) : isUploading ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-primary">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Generando URL…</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-content-tertiary italic">Sin URL disponible</p>
                  )}
                </div>

                <div className="shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={isCopied ? Check : Copy}
                    disabled={!item.url}
                    onClick={() => handleCopySingle(item, itemKey)}
                  >
                    {isCopied ? 'Copiado' : 'Copiar URL'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Dialog>
  )
}
