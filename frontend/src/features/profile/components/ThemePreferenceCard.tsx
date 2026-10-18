import { useState } from 'react'
import { Check, MonitorCog } from 'lucide-react'
import { Spinner, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { normalizeThemePreset, usePlatformSettings, type ThemePreset } from '@shared/hooks/usePlatformSettings'
import { useAuth } from '@features/auth/AuthProvider'
import { authApi } from '@features/auth/services/authApi'

/** Muestra de cada estilo (los mismos degradados de index.css). */
const PRESETS: { id: ThemePreset; label: string; from: string; to: string }[] = [
  { id: 'blizzard', label: 'Blizzard', from: '#1d4ed8', to: '#38bdf8' },
  { id: 'nebula', label: 'Nebula', from: '#1a73e8', to: '#9333ea' },
  { id: 'supernova', label: 'Supernova', from: '#e11d48', to: '#7e22ce' },
  { id: 'techmaleon', label: 'Techmaleon', from: '#00c950', to: '#1e48b0' },
]

/**
 * Mi perfil → «Apariencia»: estilo de color solo para este usuario. Sin elegir
 * nada se usa el de la plataforma (el que define el admin). Se guarda en la
 * cuenta (sigue al usuario en cualquier equipo) y en este navegador, para
 * aplicarlo antes de pintar al recargar.
 */
export function ThemePreferenceCard() {
  const { user, setUser } = useAuth()
  const settings = usePlatformSettings()
  const toast = useToast()
  const [saving, setSaving] = useState<string | null>(null)
  if (!user) return null

  const current = user.theme_preset ?? null
  const system = normalizeThemePreset(settings?.theme_preset)
  const systemLabel = PRESETS.find((p) => p.id === system)?.label ?? 'Blizzard'

  const choose = async (value: ThemePreset | null) => {
    if (value === current) return
    setSaving(value ?? 'system')
    try {
      setUser(await authApi.updateProfile({ theme_preset: value }))
      toast.success(value ? `Estilo ${PRESETS.find((p) => p.id === value)?.label} aplicado` : 'Usando el estilo de la plataforma')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la preferencia')
    } finally {
      setSaving(null)
    }
  }

  const Tile = ({ id, label, from, to, hint }: { id: ThemePreset | null; label: string; from: string; to: string; hint?: string }) => {
    const active = current === id
    const key = id ?? 'system'
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={saving !== null}
        onClick={() => choose(id)}
        className={cn(
          'relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors disabled:opacity-60',
          active ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'
        )}
      >
        <span className="relative block h-10 w-full overflow-hidden rounded-lg" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
          {id === null && (
            <span className="absolute inset-0 flex items-center justify-center text-white/90">
              <MonitorCog size={18} />
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-content-primary">
          {label}
          {saving === key ? <Spinner size={12} /> : active && <Check size={14} className="text-primary" />}
        </span>
        {hint && <span className="-mt-1.5 text-xs text-content-tertiary">{hint}</span>}
      </button>
    )
  }

  const systemSwatch = PRESETS.find((p) => p.id === system) ?? PRESETS[0]!

  return (
    <div className="lg:col-span-12 rounded-drive glass p-6 transition-all hover:border-border-strong">
      <h3 className="text-base font-medium text-content-primary">Apariencia</h3>
      <p className="mt-1 text-sm text-content-secondary">
        Elige el estilo de color de tu interfaz. Solo cambia para ti; el resto de la organización sigue viendo el de la plataforma.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Estilo de color">
        <Tile id={null} label="De la plataforma" from={systemSwatch.from} to={systemSwatch.to} hint={`Ahora: ${systemLabel}`} />
        {PRESETS.map((p) => (
          <Tile key={p.id} id={p.id} label={p.label} from={p.from} to={p.to} />
        ))}
      </div>
      <p className="mt-3 text-xs text-content-tertiary">
        El modo claro u oscuro se cambia con el botón de la barra superior. «De la plataforma» vuelve al estilo que definió el administrador para todos.
      </p>
    </div>
  )
}
