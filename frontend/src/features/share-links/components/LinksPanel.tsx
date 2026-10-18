import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Copy,
  DownloadCloud,
  Eye,
  File as FileIcon,
  Folder,
  History,
  KeyRound,
  Link2,
  Link2Off,
  QrCode as QrIcon,
  Search,
  Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Checkbox, Dialog, EmptyState, Input, Pagination, Spinner, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatDateTime } from '@shared/lib/formatDate'
import { linksApi } from '../services/linksApi'
import { linkUrl, type LinkHit, type PanelLink, type PanelStatus } from '../types'
import { QrCode } from './QrCode'

const STATUS_TABS: { id: PanelStatus; label: string }[] = [
  { id: 'active', label: 'Activos' },
  { id: 'expiring', label: 'Por caducar' },
  { id: 'expired', label: 'Caducados' },
  { id: 'revoked', label: 'Revocados' },
  { id: 'all', label: 'Todos' },
]

const CONFIRM_WORD = 'REVOCAR'

/** «hace 5 min», «en 3 días», a partir de segundos. */
function relative(seconds: number): string {
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(Math.round(seconds), 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
}

function expiryLabel(l: PanelLink): string {
  if (l.status === 'revoked') return 'Revocado'
  if (l.expires_in === null) return 'Sin caducidad'
  const at = formatDateTime(Date.now() + l.expires_in * 1000)
  return l.expires_in <= 0 ? `Caducó ${relative(l.expires_in)} · ${at}` : `Caduca ${relative(l.expires_in)} · ${at}`
}

interface LinksPanelProps {
  /** `mine`: los del usuario · `admin`: todos los de la instancia. */
  mode: 'mine' | 'admin'
}

/**
 * Panel de enlaces compartidos: filtros por estado, búsqueda, contadores,
 * QR, accesos y revocación (de uno, de los seleccionados o de todos).
 */
export function LinksPanel({ mode }: LinksPanelProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<PanelStatus>('active')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [qrFor, setQrFor] = useState<PanelLink | null>(null)
  const [hitsFor, setHitsFor] = useState<PanelLink | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [search])

  const queryKey = ['links-panel', mode, status, q, page, limit]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => linksApi.panel(mode, { status, q, page, limit }),
    placeholderData: keepPreviousData,
  })
  const items = data?.items ?? []

  useEffect(() => setSelected(new Set()), [status, q, page, limit])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['links-panel', mode] })

  const revokeIds = async (ids: number[]) => {
    try {
      const { revoked } = await linksApi.revokeMany(mode, { ids })
      toast.success(revoked === 1 ? 'Enlace revocado' : `${revoked} enlaces revocados`)
      setSelected(new Set())
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo revocar.')
    }
  }

  const copy = async (l: PanelLink) => {
    try {
      await navigator.clipboard.writeText(linkUrl(l))
      toast.success('Enlace copiado')
    } catch {
      toast.info(linkUrl(l))
    }
  }

  const revocable = items.filter((l) => l.status !== 'revoked')
  const allChecked = revocable.length > 0 && revocable.every((l) => selected.has(l.id))
  const activeTotal = (data?.counts.active ?? 0) + (data?.counts.expired ?? 0)

  return (
    <div className="space-y-4">
      {data && !data.policy.enabled && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-content-secondary">
          Los enlaces compartidos están desactivados en la organización: los que ves aquí no abren hasta que se vuelvan a activar.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-slate-900/[0.04] p-1 dark:bg-white/[0.05]">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={status === t.id}
              onClick={() => {
                setStatus(t.id)
                setPage(1)
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                status === t.id ? 'bg-surface text-content-primary shadow-elevation-1 dark:bg-white/[0.1]' : 'text-content-secondary hover:text-content-primary'
              )}
            >
              {t.label}
              {data && <span className="ml-1.5 text-xs text-content-tertiary">{data.counts[t.id] ?? 0}</span>}
            </button>
          ))}
        </div>
        <div className="min-w-[220px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={Search}
            placeholder={mode === 'admin' ? 'Buscar por archivo, etiqueta o usuario' : 'Buscar por archivo o etiqueta'}
            aria-label="Buscar enlaces"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-2 inline-flex cursor-pointer items-center gap-2 text-sm text-content-secondary">
          <Checkbox
            checked={allChecked}
            disabled={revocable.length === 0}
            onChange={() => setSelected(allChecked ? new Set() : new Set(revocable.map((l) => l.id)))}
          />
          Seleccionar página
        </label>
        <Button size="sm" variant="secondary" leftIcon={Link2Off} disabled={selected.size === 0} onClick={() => void revokeIds([...selected])}>
          Revocar seleccionados{selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>
        <Button size="sm" variant="ghost" leftIcon={Link2Off} className="ml-auto text-danger" disabled={activeTotal === 0} onClick={() => setConfirmAll(true)}>
          {mode === 'admin' ? 'Revocar todos los de la instancia' : 'Revocar todos'}
        </Button>
      </div>

      <div className="glass-lite overflow-hidden rounded-drive">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-content-tertiary">
            <Spinner size={28} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Link2}
            title={q ? 'Sin resultados' : 'No hay enlaces aquí'}
            description={mode === 'mine' ? 'Crea enlaces desde el menú de un archivo o carpeta: «Enlace y QR».' : 'Cuando alguien comparta un enlace aparecerá aquí.'}
          />
        ) : (
          <ul className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
            {items.map((l) => (
              <LinkRow
                key={l.id}
                link={l}
                admin={mode === 'admin'}
                selected={selected.has(l.id)}
                onToggle={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    next.has(l.id) ? next.delete(l.id) : next.add(l.id)
                    return next
                  })
                }
                onCopy={() => void copy(l)}
                onQr={() => setQrFor(l)}
                onHits={() => setHitsFor(l)}
                onRevoke={() => void revokeIds([l.id])}
              />
            ))}
          </ul>
        )}
        {data && data.total > 0 && (
          <Pagination page={page} limit={limit} total={data.total} onPageChange={setPage} onLimitChange={(n) => { setLimit(n); setPage(1) }} />
        )}
      </div>

      <Dialog open={qrFor !== null} onClose={() => setQrFor(null)} title={qrFor ? `QR — ${qrFor.label || qrFor.target_name || 'Enlace'}` : ''} size="md">
        {qrFor && (
          <div className="space-y-3">
            <QrCode value={linkUrl(qrFor)} name={qrFor.label || qrFor.target_name || 'enlace'} />
            <p className="break-all text-xs text-content-tertiary">{linkUrl(qrFor)}</p>
          </div>
        )}
      </Dialog>

      <HitsDialog link={hitsFor} onClose={() => setHitsFor(null)} />

      <RevokeAllDialog
        open={confirmAll}
        mode={mode}
        onClose={() => setConfirmAll(false)}
        onDone={(n) => {
          toast.success(n === 1 ? 'Se revocó 1 enlace' : `Se revocaron ${n} enlaces`)
          setConfirmAll(false)
          refresh()
        }}
      />
    </div>
  )
}

interface LinkRowProps {
  link: PanelLink
  admin: boolean
  selected: boolean
  onToggle: () => void
  onCopy: () => void
  onQr: () => void
  onHits: () => void
  onRevoke: () => void
}

function LinkRow({ link: l, admin, selected, onToggle, onCopy, onQr, onHits, onRevoke }: LinkRowProps) {
  const [confirm, setConfirm] = useState(false)
  const revoked = l.status === 'revoked'
  const ItemIcon = l.target_type === 'folder' ? Folder : FileIcon
  return (
    <li className={cn('flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center', selected && 'bg-primary/5', revoked && 'opacity-70')}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="pt-0.5">
          <Checkbox checked={selected} disabled={revoked} onChange={onToggle} aria-label="Seleccionar enlace" />
        </span>
        <ItemIcon size={20} className="mt-0.5 shrink-0 text-content-tertiary" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="truncate font-medium text-content-primary">{l.target_name ?? 'Elemento eliminado'}</span>
            {l.label && <span className="truncate text-content-tertiary">· {l.label}</span>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge icon={l.access === 'members' ? Building2 : Link2}>{l.access === 'members' ? 'Solo miembros' : 'Cualquiera'}</Badge>
            {l.has_password && <Badge icon={KeyRound}>Contraseña</Badge>}
            {!l.allow_download && <Badge icon={Download}>Sin descarga</Badge>}
            {l.scope === 'org' && <Badge>Unidad compartida</Badge>}
            {l.target_state === 'trashed' && <Badge tone="warning">En la papelera</Badge>}
            {l.target_state === 'deleted' && <Badge tone="danger">Eliminado</Badge>}
            {admin && <span className="text-xs text-content-tertiary">por {l.creator_name}</span>}
          </div>
          <p className={cn('mt-1 text-xs', l.status === 'expired' || revoked ? 'text-danger' : 'text-content-tertiary')}>{expiryLabel(l)}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pl-8 text-xs text-content-tertiary sm:pl-0">
        <span className="inline-flex items-center gap-1" title="Visitas"><Eye size={13} /> {l.view_count.toLocaleString('es')}</span>
        <span className="inline-flex items-center gap-1" title="Descargas"><DownloadCloud size={13} /> {l.download_count.toLocaleString('es')}</span>
        <span className="w-32">{l.accessed_ago === null ? 'Sin abrir' : `Abierto ${relative(-l.accessed_ago)}`}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1 pl-8 sm:pl-0">
        {!revoked && (
          <>
            <IconAction icon={Copy} label="Copiar enlace" onClick={onCopy} />
            <IconAction icon={QrIcon} label="Ver QR" onClick={onQr} />
          </>
        )}
        <IconAction icon={History} label="Accesos" onClick={onHits} />
        {!revoked &&
          (confirm ? (
            <span className="inline-flex items-center gap-1">
              <Button size="sm" variant="danger" onClick={onRevoke}>Revocar</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>No</Button>
            </span>
          ) : (
            <IconAction icon={Link2Off} label="Revocar" danger onClick={() => setConfirm(true)} />
          ))}
      </div>
    </li>
  )
}

function IconAction({ icon: Icon, label, onClick, danger = false }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'rounded-lg p-2 transition-colors',
        danger ? 'text-danger hover:bg-danger/10' : 'text-content-secondary hover:bg-slate-900/[0.05] hover:text-content-primary dark:hover:bg-white/[0.07]'
      )}
    >
      <Icon size={16} />
    </button>
  )
}

function Badge({ children, icon: Icon, tone = 'neutral' }: { children: React.ReactNode; icon?: LucideIcon; tone?: 'neutral' | 'warning' | 'danger' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium',
        tone === 'danger' ? 'bg-danger/10 text-danger' : tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-slate-900/[0.05] text-content-secondary dark:bg-white/[0.07]'
      )}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}

function HitsDialog({ link, onClose }: { link: PanelLink | null; onClose: () => void }) {
  const [hits, setHits] = useState<LinkHit[] | null>(null)
  useEffect(() => {
    if (!link) return
    setHits(null)
    linksApi.hits(link.id).then((r) => setHits(r.hits)).catch(() => setHits([]))
  }, [link])

  return (
    <Dialog open={link !== null} onClose={onClose} title="Últimos accesos" description="Se guardan 90 días. La IP del visitante nunca se guarda: solo un identificador para distinguir visitas repetidas." size="lg">
      {hits === null ? (
        <div className="flex justify-center py-8"><Spinner size={24} /></div>
      ) : hits.length === 0 ? (
        <p className="py-6 text-center text-sm text-content-tertiary">Nadie ha abierto este enlace todavía.</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-slate-900/[0.06] overflow-y-auto dark:divide-white/[0.06]">
          {hits.map((h, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              {h.kind === 'download' ? <DownloadCloud size={16} className="shrink-0 text-success" /> : <Eye size={16} className="shrink-0 text-primary" />}
              <span className="w-20 shrink-0 text-content-primary">{h.kind === 'download' ? 'Descarga' : 'Visita'}</span>
              <span className="min-w-0 flex-1 truncate text-content-secondary" title={h.user_agent ?? undefined}>
                {h.member ?? `Visitante ${h.visitor}`}
              </span>
              <span className="shrink-0 text-xs text-content-tertiary">{relative(-h.ago)}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

function RevokeAllDialog({ open, mode, onClose, onDone }: { open: boolean; mode: 'mine' | 'admin'; onClose: () => void; onDone: (n: number) => void }) {
  const toast = useToast()
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setWord('')
  }, [open])

  const submit = async () => {
    setBusy(true)
    try {
      const { revoked } = await linksApi.revokeMany(mode, { all: true, confirm: word })
      onDone(revoked)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo revocar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'admin' ? 'Revocar todos los enlaces de la instancia' : 'Revocar todos mis enlaces'}
      description={
        mode === 'admin'
          ? 'Todos los enlaces de todos los usuarios dejarán de abrir al instante (también sus QR). No se puede deshacer: habría que crear enlaces nuevos.'
          : 'Todos tus enlaces dejarán de abrir al instante (también sus QR). No se puede deshacer: habría que crear enlaces nuevos.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" loading={busy} disabled={word !== CONFIRM_WORD} onClick={submit}>Revocar todos</Button>
        </>
      }
    >
      <Input label={`Escribe ${CONFIRM_WORD} para confirmar`} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
    </Dialog>
  )
}
