import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Clock,
  Download,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Link2Off,
  LogIn,
  ShieldCheck,
  Building2,
  HardDrive,
} from 'lucide-react'
import { AppBackdrop, Button, EmptyState, Input, Spinner } from '@shared/ui'
import { ApiError, forceRefresh, session } from '@shared/api'
import { cn } from '@shared/lib/cn'
import { formatBytes } from '@shared/lib/formatBytes'
import { getFileIcon } from '@shared/lib/fileIcons'
import { useIsMobile } from '@shared/hooks/useMediaQuery'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useTheme } from '@app/providers/ThemeProvider'
import { useAuth } from '@features/auth/AuthProvider'
import { usePreview } from '@features/preview'
import { PreviewContent } from '@features/preview/components/PreviewModal'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { Breadcrumbs } from '@features/drive-explorer/components/Breadcrumbs'
import { FileGridView } from '@features/drive-explorer/components/FileGridView'
import { FileListView } from '@features/drive-explorer/components/FileListView'
import { SortControl, useSortState } from '@features/drive-explorer/components/SortControl'
import { ViewToggle } from '@features/drive-explorer/components/ViewToggle'
import type { DriveItem, FileItem, FolderRef, ViewMode } from '@features/drive-explorer/types'
import { linkKeyStore, publicLinksApi, type PublicFolderPage, type PublicLinkInfo } from './services/publicLinksApi'

const PAGE_SIZE = 100

type Gate =
  | { kind: 'loading' }
  | { kind: 'ready'; info: PublicLinkInfo; key: string | null }
  | { kind: 'password' }
  | { kind: 'login' }
  | { kind: 'error'; code: string; message: string }

/**
 * Página de un enlace compartido (`/s/{token}`): sin sesión y de solo lectura.
 * Enlace de archivo → vista previa y descarga. Enlace de carpeta → explorador
 * acotado a esa carpeta (migas que empiezan en ella, sin menús de edición).
 */
export function PublicLinkPage() {
  const { token = '' } = useParams()
  const [gate, setGate] = useState<Gate>({ kind: 'loading' })

  const open = useCallback(
    async (key: string | null, retried = false) => {
      try {
        const info = await publicLinksApi.open(token, key)
        const effective = info.key ?? key
        linkKeyStore.set(token, effective)
        setGate({ kind: 'ready', info, key: effective })
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'ERROR'
        // Llave vieja (otra contraseña, caducada): se descarta y se vuelve a pedir.
        if (key && (code === 'LINK_PASSWORD_REQUIRED' || code === 'LINK_LOGIN_REQUIRED')) {
          linkKeyStore.set(token, null)
          return open(null, retried)
        }
        // Con sesión pero el access token caducó: el servidor nos ve como anónimos.
        if (code === 'LINK_LOGIN_REQUIRED' && !retried && session.hasSession()) {
          try {
            await forceRefresh()
            return open(null, true)
          } catch {
            /* sin sesión válida: se pide iniciar sesión */
          }
        }
        if (code === 'LINK_PASSWORD_REQUIRED') setGate({ kind: 'password' })
        else if (code === 'LINK_LOGIN_REQUIRED') setGate({ kind: 'login' })
        else setGate({ kind: 'error', code, message: err instanceof Error ? err.message : 'No se pudo abrir el enlace.' })
      }
    },
    [token]
  )

  useEffect(() => {
    void open(linkKeyStore.get(token))
  }, [open, token])

  const title = gate.kind === 'ready' ? gate.info.name : null

  return (
    <PublicLayout title={title} isFolder={gate.kind === 'ready' && gate.info.link.target_type === 'folder'}>
      {gate.kind === 'loading' && (
        <div className="flex flex-1 items-center justify-center text-content-tertiary">
          <Spinner size={32} tone="brand" />
        </div>
      )}
      {gate.kind === 'password' && <PasswordGate token={token} onUnlocked={(key) => void open(key)} />}
      {gate.kind === 'login' && <LoginGate />}
      {gate.kind === 'error' && <ErrorState code={gate.code} message={gate.message} />}
      {gate.kind === 'ready' &&
        (gate.info.link.target_type === 'file' && gate.info.file ? (
          <PublicFileView file={gate.info.file} />
        ) : (
          <PublicFolderView token={token} linkKey={gate.key} rootName={gate.info.name} />
        ))}
    </PublicLayout>
  )
}

// --- Marco de la página ---

function PublicLayout({ title, isFolder, children }: { title: string | null; isFolder: boolean; children: ReactNode }) {
  const settings = usePlatformSettings()
  const { resolved: theme } = useTheme()
  const isMobile = useIsMobile()
  const { status } = useAuth()
  const location = useLocation()
  const orgName = settings?.organization_name || 'Project Cloud'

  useEffect(() => {
    if (title) document.title = `${title} - ${orgName}`
  }, [title, orgName])

  const logoType = isMobile && settings?.logo_mobile ? 'mobile' : theme === 'dark' && settings?.logo_white ? 'white' : theme === 'light' && settings?.logo_dark ? 'dark' : 'white'
  const hasLogo = Boolean(settings && (settings.logo_white || settings.logo_dark || settings.logo_mobile))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AppBackdrop />
      <header className="glass-strong flex h-16 shrink-0 items-center gap-3 border-x-0 border-t-0 px-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-2 pr-2 md:w-60">
          {hasLogo ? (
            <img src={`/api/v1/settings/logo/${logoType}`} alt={orgName} className="h-8 max-w-[120px] object-contain" />
          ) : (
            <span className="text-gradient text-lg font-semibold">{orgName}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-content-primary">
          {title && (
            <>
              {isFolder ? <FolderOpen size={20} className="shrink-0 text-primary" /> : null}
              <span className="truncate text-sm font-medium sm:text-base">{title}</span>
            </>
          )}
        </div>
        <ThemeToggle className="h-9 w-9" />
        {status === 'authenticated' ? (
          <Link to="/" className="hidden items-center gap-2 rounded-pill px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 sm:inline-flex">
            <HardDrive size={16} /> Mi unidad
          </Link>
        ) : (
          <Link
            to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
            className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
          >
            <LogIn size={16} /> <span className="hidden sm:inline">Iniciar sesión</span>
          </Link>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Barra lateral vacía a propósito: el visitante no ve unidades, accesos ni cuota. */}
        <aside className="hidden w-64 shrink-0 p-4 md:block">
          <div className="glass-lite rounded-xl p-3 text-xs text-content-secondary">
            <p className="flex items-center gap-2 font-medium text-content-primary">
              <ShieldCheck size={16} className="text-primary" /> Compartido contigo
            </p>
            <p className="mt-1.5">Acceso de solo lectura mediante un enlace. Puedes ver{isFolder ? ', navegar' : ''} y descargar lo que se compartió.</p>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-3 pb-6 pt-4 sm:px-6">{children}</main>
      </div>
    </div>
  )
}

// --- Estados ---

function CenterCard({ icon: Icon, tone = 'primary', title, children }: { icon: typeof Clock; tone?: 'primary' | 'danger' | 'warning'; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="glass w-full max-w-md rounded-drive p-6 text-center sm:p-8">
        <div
          className={cn(
            'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl',
            tone === 'danger' ? 'bg-danger/10 text-danger' : tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
          )}
        >
          <Icon size={28} />
        </div>
        <h1 className="text-lg font-semibold text-content-primary">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function PasswordGate({ token, onUnlocked }: { token: string; onUnlocked: (key: string) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { key } = await publicLinksApi.unlock(token, password)
      onUnlocked(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comprobar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenterCard icon={KeyRound} title="Este enlace está protegido">
      <p className="mt-1 text-sm text-content-secondary">Escribe la contraseña que te dio quien lo compartió.</p>
      <form onSubmit={submit} className="mt-5 space-y-3 text-left">
        <Input type="password" label="Contraseña" autoFocus autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} error={error ?? undefined} />
        <Button type="submit" fullWidth loading={busy} disabled={!password}>
          Abrir
        </Button>
      </form>
    </CenterCard>
  )
}

function LoginGate() {
  const location = useLocation()
  return (
    <CenterCard icon={Building2} title="Solo para miembros de la organización">
      <p className="mt-1 text-sm text-content-secondary">Inicia sesión con tu cuenta de la organización para abrir este enlace.</p>
      <Link to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} className="mt-5 inline-block">
        <Button leftIcon={LogIn}>Iniciar sesión</Button>
      </Link>
    </CenterCard>
  )
}

const ERRORS: Record<string, { icon: typeof Clock; title: string; tone: 'danger' | 'warning' }> = {
  LINK_EXPIRED: { icon: Clock, title: 'Este enlace ha caducado', tone: 'warning' },
  LINK_REVOKED: { icon: Link2Off, title: 'Este enlace fue desactivado', tone: 'danger' },
  LINK_UNAVAILABLE: { icon: AlertTriangle, title: 'Ya no está disponible', tone: 'warning' },
  LINK_NOT_FOUND: { icon: Link2Off, title: 'Este enlace no existe', tone: 'danger' },
  LINKS_DISABLED: { icon: Link2Off, title: 'Enlaces desactivados', tone: 'warning' },
}

function ErrorState({ code, message }: { code: string; message: string }) {
  const meta = ERRORS[code] ?? { icon: AlertTriangle, title: 'No se pudo abrir el enlace', tone: 'danger' as const }
  return (
    <CenterCard icon={meta.icon} tone={meta.tone} title={meta.title}>
      <p className="mt-1 text-sm text-content-secondary">{message}</p>
      {code === 'LINK_EXPIRED' && <p className="mt-3 text-xs text-content-tertiary">Pide a quien lo compartió que lo reactive: la dirección seguirá siendo la misma.</p>}
    </CenterCard>
  )
}

// --- Enlace de archivo ---

function PublicFileView({ file }: { file: FileItem }) {
  const { icon: Icon, className } = getFileIcon(file.name)
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Icon size={28} className={cn('shrink-0', className)} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-content-primary">{file.name}</h1>
          <p className="text-xs text-content-tertiary">{formatBytes(file.size_bytes)}</p>
        </div>
        <div className="flex gap-2">
          <a href={file.url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" leftIcon={ExternalLink}>Abrir</Button>
          </a>
          {file.download_url && (
            <a href={file.download_url} download={file.name}>
              <Button leftIcon={Download}>Descargar</Button>
            </a>
          )}
        </div>
      </div>
      <div className="flex min-h-[60vh] flex-1 items-center justify-center overflow-hidden rounded-drive bg-slate-950/90 p-2 text-white sm:p-4">
        <PreviewContent item={file} />
      </div>
      {!file.download_url && <p className="text-center text-xs text-content-tertiary">Quien compartió este archivo desactivó la descarga.</p>}
    </div>
  )
}

// --- Enlace de carpeta ---

function PublicFolderView({ token, linkKey, rootName }: { token: string; linkKey: string | null; rootName: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const folder = searchParams.get('f') ?? ''
  const [sort, setSort] = useSortState()
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('pc-view') as ViewMode) || 'grid'
    } catch {
      return 'grid'
    }
  })
  const [page, setPage] = useState<PublicFolderPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const preview = usePreview()

  const sortParams = useMemo(
    () => ({ sort: sort.field === 'size' ? 'size_bytes' : sort.field === 'owner' ? 'name' : sort.field, order: sort.dir }),
    [sort]
  )

  useEffect(() => {
    let alive = true
    setPage(null)
    setError(null)
    publicLinksApi
      .items(token, linkKey, { folder, ...sortParams, offset: 0, limit: PAGE_SIZE })
      .then((p) => alive && setPage(p))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudo cargar la carpeta.'))
    return () => {
      alive = false
    }
  }, [token, linkKey, folder, sortParams])

  const items = useMemo<DriveItem[]>(() => (page ? [...page.folders, ...page.files] : []), [page])

  const loadMore = async () => {
    if (!page) return
    setLoadingMore(true)
    try {
      const next = await publicLinksApi.items(token, linkKey, { folder, ...sortParams, offset: items.length, limit: PAGE_SIZE })
      setPage({ ...next, folders: [...page.folders, ...next.folders], files: [...page.files, ...next.files] })
    } finally {
      setLoadingMore(false)
    }
  }

  const navigate = (id: FolderRef) => {
    const next = new URLSearchParams(searchParams)
    if (id === 'root' || id === null || id === '') next.delete('f')
    else next.set('f', String(id))
    setSearchParams(next)
  }

  const openItem = (item: DriveItem) => {
    if (item.type === 'folder') navigate(item.id)
    else preview.open(item, items)
  }

  const setViewMode = (m: ViewMode) => {
    setView(m)
    try {
      localStorage.setItem('pc-view', m)
    } catch {
      /* preferencia solo en memoria */
    }
  }

  // Un clic abre (no hay selección ni acciones en la vista pública).
  const interactions = { onItemClick: (item: DriveItem) => openItem(item) }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Breadcrumbs crumbs={page?.breadcrumbs ?? []} rootLabel={rootName} onNavigate={navigate} />
        <div className="ml-auto flex items-center gap-2">
          <SortControl value={sort} onChange={setSort} showOwner={false} />
          <ViewToggle value={view} onChange={setViewMode} />
        </div>
      </div>

      {error ? (
        <ErrorState code="ERROR" message={error} />
      ) : !page ? (
        <div className="flex h-64 items-center justify-center text-content-tertiary">
          <Spinner size={32} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Esta carpeta está vacía" description="No hay archivos ni carpetas aquí." />
      ) : view === 'list' ? (
        <FileListView items={items} selected={new Set()} onOpen={openItem} onSelectToggle={() => {}} onAction={() => {}} interactions={interactions} readOnly />
      ) : (
        <FileGridView items={items} selected={new Set()} onOpen={openItem} onSelectToggle={() => {}} onAction={() => {}} interactions={interactions} readOnly />
      )}

      {page?.has_more && (
        <div className="flex justify-center py-8">
          <Button variant="secondary" onClick={loadMore} loading={loadingMore} disabled={loadingMore}>
            Cargar más elementos
          </Button>
        </div>
      )}
    </div>
  )
}
