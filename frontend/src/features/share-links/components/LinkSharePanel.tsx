import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Check,
  Copy,
  Download,
  DownloadCloud,
  Eye,
  Globe,
  KeyRound,
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  QrCode as QrIcon,
  Share2,
  Info,
  AlertTriangle,
  Link2Off,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Spinner, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatDateTime } from '@shared/lib/formatDate'
import { linksApi } from '../services/linksApi'
import { linkUrl, type LinkInput, type LinkTarget, type LinkTargetInfo, type ShareLink } from '../types'
import { LinkForm } from './LinkForm'
import { QrCode } from './QrCode'

interface LinkSharePanelProps {
  target: LinkTarget
  /** URL directa de /storage o de la unidad compartida (archivos públicos). */
  publicUrl?: string | null
  /** Hace privado el elemento (Mi unidad). Si no se pasa, no se ofrece. */
  onMakePrivate?: () => Promise<void>
}

/** «hace 5 min», «en 3 días», a partir de segundos. */
function relative(seconds: number): string {
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(Math.round(seconds), 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
}

function expiryText(link: ShareLink): string {
  if (link.expires_in === null) return 'Sin caducidad'
  const at = formatDateTime(Date.now() + link.expires_in * 1000)
  return link.status === 'expired' ? `Caducó ${relative(link.expires_in)} (${at})` : `Caduca ${relative(link.expires_in)} (${at})`
}

/**
 * Pestaña «Enlace y QR» del diálogo Compartir: los enlaces del elemento y el
 * formulario para crear uno. Solo la ve quien puede crear enlaces (el
 * propietario en Mi unidad; un admin en la unidad compartida).
 */
export function LinkSharePanel({ target, publicUrl, onMakePrivate }: LinkSharePanelProps) {
  const toast = useToast()
  const [links, setLinks] = useState<ShareLink[] | null>(null)
  const [info, setInfo] = useState<LinkTargetInfo | null>(null)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [makingPrivate, setMakingPrivate] = useState(false)
  const [showPublicQr, setShowPublicQr] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await linksApi.list(target)
      setLinks(res.links)
      setInfo(res.target)
      if (res.links.length === 0) setCreating(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los enlaces.')
      setLinks([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.scope, target.target_type, target.target_id, target.target_path])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (input: LinkInput) => {
    setSubmitting(true)
    try {
      const link = await linksApi.create(target, input)
      setLinks((prev) => [link, ...(prev ?? [])])
      setCreating(false)
      await copy(link)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el enlace.')
    } finally {
      setSubmitting(false)
    }
  }

  const replace = (link: ShareLink) =>
    setLinks((prev) => (prev ?? []).map((l) => (l.id === link.id ? link : l)).filter((l) => l.status !== 'revoked'))

  const copy = async (link: ShareLink) => {
    try {
      await navigator.clipboard.writeText(linkUrl(link))
      toast.success('Enlace copiado')
    } catch {
      toast.info(linkUrl(link))
    }
  }

  const makePrivate = async () => {
    if (!onMakePrivate) return
    setMakingPrivate(true)
    try {
      await onMakePrivate()
      await load()
    } finally {
      setMakingPrivate(false)
    }
  }

  if (links === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={28} />
      </div>
    )
  }

  const restricted = links.some((l) => l.access === 'members' || l.has_password)
  const directUrlLeaks = target.scope === 'org' || info?.visibility === 'public'

  return (
    <div className="space-y-4">
      {restricted && directUrlLeaks && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-content-secondary">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
          <div className="flex-1 space-y-2">
            <p>
              {target.scope === 'org'
                ? 'Los archivos de la unidad compartida también se abren por su URL directa: la contraseña o «solo miembros» protegen el enlace, no el archivo.'
                : `Este ${target.target_type === 'file' ? 'archivo' : 'contenido'} también es accesible por su URL pública. Hazlo privado para que solo se abra con el enlace.`}
            </p>
            {onMakePrivate && target.scope === 'drive' && (
              <Button size="sm" variant="secondary" leftIcon={LockKeyhole} loading={makingPrivate} onClick={makePrivate}>
                Hacer privado
              </Button>
            )}
          </div>
        </div>
      )}
      {target.target_type === 'folder' && (info?.private_items ?? 0) > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-subtle/40 p-3 text-xs text-content-secondary">
          <Info size={16} className="mt-0.5 shrink-0 text-info" />
          <span>
            Esta carpeta contiene {info!.private_items} elemento{info!.private_items === 1 ? '' : 's'} privado
            {info!.private_items === 1 ? '' : 's'}: quien abra el enlace también podrá verlo{info!.private_items === 1 ? '' : 's'}.
          </span>
        </div>
      )}

      {publicUrl && (
        <div className="rounded-xl glass-lite p-3">
          <div className="flex items-center gap-2">
            <Globe size={16} className="shrink-0 text-content-tertiary" />
            <span className="text-xs font-medium text-content-secondary">URL pública directa (permanente, sin contador)</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} className="input-glass min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs text-content-primary" />
            <Button
              size="sm"
              variant="secondary"
              leftIcon={Copy}
              onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.success('URL pública copiada'))}
            >
              Copiar
            </Button>
            <Button size="sm" variant={showPublicQr ? 'tonal' : 'secondary'} leftIcon={QrIcon} onClick={() => setShowPublicQr(!showPublicQr)} aria-label="QR de la URL pública">
              QR
            </Button>
          </div>
          {showPublicQr && (
            <div className="mt-3">
              <QrCode value={publicUrl} name={target.name} />
            </div>
          )}
        </div>
      )}

      {creating ? (
        <div className="rounded-xl glass-lite p-3">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-content-primary">
            <Link2 size={16} className="text-primary" /> Nuevo enlace
          </p>
          <LinkForm submitting={submitting} onSubmit={create} onCancel={links.length > 0 ? () => setCreating(false) : undefined} />
        </div>
      ) : (
        <Button variant="secondary" size="sm" leftIcon={Plus} onClick={() => setCreating(true)}>
          Nuevo enlace
        </Button>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">
            Enlaces de {target.target_type === 'file' ? 'este archivo' : 'esta carpeta'} ({links.length})
          </h4>
          {links.map((link) => (
            <LinkCard key={link.id} link={link} name={target.name} onCopy={() => copy(link)} onChange={replace} />
          ))}
        </div>
      )}
    </div>
  )
}

interface LinkCardProps {
  link: ShareLink
  name: string
  onCopy: () => void
  onChange: (link: ShareLink) => void
}

function LinkCard({ link, name, onCopy, onChange }: LinkCardProps) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = linkUrl(link)
  const expired = link.status === 'expired'

  const save = async (input: LinkInput) => {
    setSaving(true)
    try {
      onChange(await linksApi.update(link.id, input))
      setEditing(false)
      toast.success('Enlace actualizado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const revoke = async () => {
    try {
      onChange(await linksApi.revoke(link.id))
      toast.success('Enlace revocado: ya no abre.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo revocar.')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: name, url })
    } catch {
      /* cancelado por el usuario */
    }
  }

  return (
    <div className={cn('rounded-xl glass-lite p-3', expired && 'opacity-80')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 truncate text-sm font-semibold text-content-primary">{link.label || 'Enlace sin etiqueta'}</span>
        <Badge icon={link.access === 'members' ? Building2 : Link2}>{link.access === 'members' ? 'Solo miembros' : 'Cualquiera con el enlace'}</Badge>
        {link.has_password && <Badge icon={KeyRound}>Contraseña</Badge>}
        {!link.allow_download && <Badge icon={Download}>Sin descarga</Badge>}
        {expired && <Badge tone="danger">Caducado</Badge>}
      </div>
      <p className={cn('mt-1 text-xs', expired ? 'text-danger' : 'text-content-tertiary')}>{expiryText(link)}</p>

      <div className="mt-2 flex items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="input-glass min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs text-content-primary" />
        <Button
          size="sm"
          variant="secondary"
          leftIcon={copied ? Check : Copy}
          onClick={() => {
            onCopy()
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }}
        >
          Copiar
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-tertiary">
          <span className="inline-flex items-center gap-1"><Eye size={13} /> {link.view_count.toLocaleString('es')} {link.view_count === 1 ? 'visita' : 'visitas'}</span>
          <span className="inline-flex items-center gap-1"><DownloadCloud size={13} /> {link.download_count.toLocaleString('es')} {link.download_count === 1 ? 'descarga' : 'descargas'}</span>
          <span>{link.accessed_ago === null ? 'Sin abrir aún' : `Último acceso ${relative(-link.accessed_ago)}`}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant={showQr ? 'tonal' : 'ghost'} leftIcon={QrIcon} onClick={() => setShowQr(!showQr)}>
            QR
          </Button>
          {typeof navigator.share === 'function' && (
            <Button size="sm" variant="ghost" leftIcon={Share2} onClick={share}>
              Compartir
            </Button>
          )}
          <Button size="sm" variant={editing ? 'tonal' : 'ghost'} leftIcon={Pencil} onClick={() => setEditing(!editing)}>
            {expired ? 'Reactivar' : 'Editar'}
          </Button>
          {confirmRevoke ? (
            <span className="inline-flex items-center gap-1">
              <Button size="sm" variant="danger" onClick={revoke}>Revocar</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(false)}>No</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" leftIcon={Link2Off} onClick={() => setConfirmRevoke(true)} className="text-danger">
              Revocar
            </Button>
          )}
        </div>
      </div>

      {showQr && (
        <div className="mt-3 border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.06]">
          <QrCode value={url} name={link.label || name} />
        </div>
      )}
      {editing && (
        <div className="mt-3 border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.06]">
          {expired && <p className="mb-2 text-xs text-content-secondary">Elige una nueva caducidad: el enlace (y su QR) vuelven a funcionar con la misma dirección.</p>}
          <LinkForm link={link} submitting={saving} onSubmit={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  )
}

function Badge({ children, icon: Icon, tone = 'neutral' }: { children: React.ReactNode; icon?: LucideIcon; tone?: 'neutral' | 'danger' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium',
        tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-slate-900/[0.05] text-content-secondary dark:bg-white/[0.07]'
      )}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}
