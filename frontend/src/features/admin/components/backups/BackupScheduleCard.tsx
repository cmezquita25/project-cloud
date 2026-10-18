import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, HardDrive, X } from 'lucide-react'
import { Button, Checkbox, Select, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatBytes } from '@shared/lib/formatBytes'
import {
  databaseApi,
  type BackupConfig,
  type BackupEstimate,
  type BackupSchedule,
  type BackupSettingsPayload,
} from '../../services/databaseApi'

export const BACKUP_SETTINGS_KEY = ['admin', 'backup-settings'] as const

const SCHEDULES: { value: BackupSchedule; label: string }[] = [
  { value: 'off', label: 'Desactivadas' },
  { value: 'daily', label: 'Cada día' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'biweekly', label: 'Cada 15 días' },
  { value: 'monthly', label: 'Cada mes' },
]

/** Desfase del navegador respecto a UTC, en horas (México: -6). */
const OFFSET_HOURS = Math.round(-new Date().getTimezoneOffset() / 60)
const toLocalHour = (utc: number) => (utc + OFFSET_HOURS + 24) % 24
const toUtcHour = (local: number) => (local - OFFSET_HOURS + 24) % 24
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }))

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/** Configuración → Base de datos: programación, rotación y contenido de las copias. */
export function BackupScheduleCard() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: BACKUP_SETTINGS_KEY, queryFn: databaseApi.backupSettings, staleTime: 0 })
  const { data: extensions = [] } = useQuery({ queryKey: ['admin', 'backup-extensions'], queryFn: databaseApi.extensions })

  const [draft, setDraft] = useState<BackupConfig | null>(null)
  const [estimate, setEstimate] = useState<{ estimate: BackupEstimate; disk_free: number | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [extInput, setExtInput] = useState('')

  useEffect(() => {
    if (data && !draft) setDraft(data.settings)
  }, [data, draft])

  const dirty = useMemo(() => !!data && !!draft && JSON.stringify(data.settings) !== JSON.stringify(draft), [data, draft])

  // Estimación con los cambios sin guardar (con una pequeña espera al teclear).
  useEffect(() => {
    if (!draft || !dirty) {
      setEstimate(null)
      return
    }
    const id = window.setTimeout(() => {
      databaseApi.estimate(draft).then(setEstimate).catch(() => setEstimate(null))
    }, 400)
    return () => window.clearTimeout(id)
  }, [draft, dirty])

  if (!data || !draft) return null

  const set = (patch: Partial<BackupConfig>) => setDraft({ ...draft, ...patch })
  const setContent = (patch: Partial<BackupConfig['content']>) => setDraft({ ...draft, content: { ...draft.content, ...patch } })
  const full = draft.scope === 'full'
  const shown = estimate ?? { estimate: data.estimate, disk_free: data.disk_free }
  const total = shown.estimate.total
  const peak = total * (draft.max_copies + 1) // durante la rotación hay una copia de más
  const lowSpace = shown.disk_free !== null && shown.disk_free < total * 1.1

  const toggleExt = (ext: string) => {
    const list = draft.content.extensions
    setContent({ extensions: list.includes(ext) ? list.filter((e) => e !== ext) : [...list, ext] })
  }
  const addExt = () => {
    const ext = extInput.trim().toLowerCase().replace(/^\./, '')
    if (/^[a-z0-9]{1,16}$/.test(ext) && !draft.content.extensions.includes(ext)) {
      setContent({ extensions: [...draft.content.extensions, ext] })
    }
    setExtInput('')
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await databaseApi.saveBackupSettings(draft)
      queryClient.setQueryData<BackupSettingsPayload>(BACKUP_SETTINGS_KEY, res)
      setDraft(res.settings)
      toast.success('Configuración de copias guardada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 rounded-drive glass p-5">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-medium text-content-primary">
          <CalendarClock size={18} className="text-primary" /> Copias automáticas
        </h3>
        <p className="text-xs text-content-secondary">
          Las crea el cron del servidor. Al llegar al máximo, la más antigua se borra solo cuando la nueva terminó bien.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs text-content-secondary">
          <span>
            Próxima: <span className="font-medium text-content-primary">{data.next_run ? formatDateTime(data.next_run) : 'Desactivadas'}</span>
          </span>
          <span>Última programada: {formatDateTime(data.last_scheduled_run)}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Frecuencia">
          <Select value={draft.schedule} onChange={(v) => set({ schedule: v as BackupSchedule })} options={SCHEDULES} />
        </Field>
        <Field label="Hora" hint="Hora de tu navegador. Si el cron no corre a esa hora, la copia se hace en la siguiente pasada.">
          <Select value={toLocalHour(draft.hour_utc)} onChange={(v) => set({ hour_utc: toUtcHour(Number(v)) })} options={HOURS} disabled={draft.schedule === 'off'} />
        </Field>
        <Field label="Copias a conservar" hint="Incluye las manuales. Las pre-actualización van aparte (se guarda 1).">
          <Select
            value={draft.max_copies}
            onChange={(v) => set({ max_copies: Number(v) })}
            options={[1, 2, 3].map((n) => ({ value: n, label: n === 1 ? '1 copia' : `${n} copias` }))}
          />
        </Field>
        <Field label="Tipo">
          <Select
            value={draft.scope}
            onChange={(v) => set({ scope: v as BackupConfig['scope'] })}
            options={[
              { value: 'full', label: 'Completa (sistema + archivos)' },
              { value: 'system', label: 'Solo sistema (base de datos y configuración)' },
            ]}
          />
        </Field>
      </div>

      {/* Contenido */}
      <div className={cn('space-y-3 border-t border-border pt-4', !full && 'pointer-events-none opacity-50')}>
        <h4 className="text-sm font-medium text-content-primary">Contenido de la copia completa</h4>
        <p className="text-xs text-content-secondary">Siempre se incluyen la base de datos, la configuración y los logos. Las miniaturas no: se regeneran solas.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Unidades de los usuarios" bytes={shown.estimate.users} checked={draft.content.users} onChange={(v) => setContent({ users: v })} />
          <Toggle label="Unidad compartida" bytes={shown.estimate.shared} checked={draft.content.shared} onChange={(v) => setContent({ shared: v })} />
          <Toggle label="Papeleras" bytes={shown.estimate.trash} checked={draft.content.trash} onChange={(v) => setContent({ trash: v })} />
          <Toggle label="Fotos de perfil" bytes={shown.estimate.avatars} checked={draft.content.avatars} onChange={(v) => setContent({ avatars: v })} />
        </div>

        <Field label="Tipos de archivo">
          <Select
            value={draft.content.ext_mode}
            onChange={(v) => setContent({ ext_mode: v as BackupConfig['content']['ext_mode'] })}
            options={[
              { value: 'all', label: 'Todos los tipos de archivo' },
              { value: 'only', label: 'Solo los tipos seleccionados' },
              { value: 'except', label: 'Todos excepto los seleccionados' },
            ]}
          />
        </Field>

        {draft.content.ext_mode !== 'all' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {extensions.map((e) => {
                const on = draft.content.extensions.includes(e.ext)
                return (
                  <button
                    key={e.ext}
                    type="button"
                    onClick={() => toggleExt(e.ext)}
                    aria-pressed={on}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-content-secondary hover:border-primary/30'
                    )}
                    title={`${e.count} archivos`}
                  >
                    .{e.ext} <span className="opacity-70">· {formatBytes(e.bytes)}</span>
                  </button>
                )
              })}
              {draft.content.extensions
                .filter((ext) => !extensions.some((e) => e.ext === ext))
                .map((ext) => (
                  <button key={ext} type="button" onClick={() => toggleExt(ext)} className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                    .{ext} <X size={11} />
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                value={extInput}
                onChange={(e) => setExtInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExt())}
                placeholder="Añadir otra extensión (p. ej. psd)"
                className="input-glass ring-glow-focus w-full max-w-xs rounded-drive px-3 py-1.5 text-sm text-content-primary placeholder:text-content-tertiary"
              />
              <Button size="sm" variant="secondary" onClick={addExt}>Añadir</Button>
            </div>
            <p className="text-xs text-amber-500">
              Los archivos excluidos seguirán registrados en la base de datos. Si restauras esta copia, aparecerán como no disponibles.
            </p>
          </div>
        )}
      </div>

      {/* Estimación */}
      <div className={cn('flex gap-3 rounded-xl border p-3 text-xs', lowSpace ? 'border-red-500/30 bg-red-500/5' : 'border-border')}>
        <HardDrive size={16} className="mt-0.5 shrink-0 text-content-tertiary" />
        <div className="space-y-0.5">
          <p className="text-content-secondary">
            Cada copia ocupará unos <b className="text-content-primary">{formatBytes(total)}</b>.
            {draft.max_copies > 1 && ` Con ${draft.max_copies} copias, hasta ${formatBytes(peak)} mientras se crea la siguiente.`}
          </p>
          <p className={lowSpace ? 'font-medium text-red-500' : 'text-content-tertiary'}>
            {shown.disk_free !== null ? `${formatBytes(shown.disk_free)} libres en el servidor` : 'Espacio libre desconocido'}
            {lowSpace && ': no alcanza para una copia nueva.'}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(data.settings)} disabled={saving}>
            Descartar
          </Button>
        )}
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Guardar configuración
        </Button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-content-secondary">{label}</span>
      {children}
      {hint && <p className="text-xs text-content-tertiary">{hint}</p>}
    </div>
  )
}

function Toggle({ label, bytes, checked, onChange }: { label: string; bytes: number; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex-1 text-sm text-content-primary">{label}</span>
      <span className="text-xs text-content-tertiary">{checked ? formatBytes(bytes) : '—'}</span>
    </label>
  )
}
