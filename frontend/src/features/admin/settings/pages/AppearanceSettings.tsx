import { LogoUploader } from '../../components/LogoUploader'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { Button, ProgressBar, useLoader, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { usePlatformSettings, type ThemePreset } from '@shared/hooks/usePlatformSettings'
import { adminApi } from '../../services/adminApi'

type ColorKey = 'primary_color' | 'btn_gradient_start' | 'btn_gradient_end' | 'btn_text_color'

/**
 * Los dos estilos base. Sus valores son los mismos que definen `index.css`
 * (`:root` para Blizzard y `[data-theme-preset='nebula']` para Nebula); aquí
 * solo se usan para mostrarlos en los selectores y en la vista previa.
 */
const PRESETS: Record<ThemePreset, { label: string; description: string; check: string; colors: Record<ColorKey, string> }> = {
  blizzard: {
    label: 'Blizzard',
    description: 'Azul → cian. El estilo de marca por defecto.',
    check: '#2563eb', // = --color-check de index.css
    colors: {
      primary_color: '#2563eb',
      btn_gradient_start: '#2563eb',
      btn_gradient_end: '#06b6d4',
      btn_text_color: '#ffffff',
    },
  },
  nebula: {
    label: 'Nebula',
    description: 'Azul → morado. El estilo original de la plataforma.',
    check: '#9333ea', // = --color-check de index.css
    colors: {
      primary_color: '#1a73e8',
      btn_gradient_start: '#1a73e8',
      btn_gradient_end: '#9333ea',
      btn_text_color: '#ffffff',
    },
  },
}

const COLOR_FIELDS: { key: ColorKey; label: string }[] = [
  { key: 'primary_color', label: 'Color primario (Global)' },
  { key: 'btn_text_color', label: 'Texto del Botón' },
  { key: 'btn_gradient_start', label: 'Botón Gradiente (Inicio)' },
  { key: 'btn_gradient_end', label: 'Botón Gradiente (Fin)' },
]

const NO_CUSTOM: Record<ColorKey, string | null> = {
  primary_color: null,
  btn_gradient_start: null,
  btn_gradient_end: null,
  btn_text_color: null,
}

/** `#rrggbb` → `"r g b"`, el formato de los tokens de `index.css`. */
function hexToChannels(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '0 0 0'
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`
}

/** Estilo base, colores personalizados y logos de la plataforma. */
export function AppearanceSettings() {
  const settings = usePlatformSettings()
  const toast = useToast()
  const loader = useLoader()

  const [preset, setPreset] = useState<ThemePreset>('blizzard')
  // `null` = sin personalizar: se usa el color del estilo base.
  const [custom, setCustom] = useState<Record<ColorKey, string | null>>(NO_CUSTOM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setPreset(settings.theme_preset === 'nebula' ? 'nebula' : 'blizzard')
    setCustom({
      primary_color: settings.primary_color || null,
      btn_gradient_start: settings.btn_gradient_start || null,
      btn_gradient_end: settings.btn_gradient_end || null,
      btn_text_color: settings.btn_text_color || null,
    })
  }, [settings])

  const valueOf = (key: ColorKey) => custom[key] ?? PRESETS[preset].colors[key]
  const isCustomized = Object.values(custom).some((v) => v !== null)

  /*
    Vista previa: los tokens se fijan EN el contenedor, no en <html>, para no
    teñir la app antes de guardar. Se redefinen también `--glow-*` y
    `--text-gradient-*` porque en `:root` se calcularon a partir del color
    global y los descendientes heredan ese valor ya resuelto.
  */
  const previewStyle = useMemo(() => {
    const start = hexToChannels(valueOf('btn_gradient_start'))
    const end = hexToChannels(valueOf('btn_gradient_end'))
    return {
      '--color-primary': hexToChannels(valueOf('primary_color')),
      '--color-gradient-start': start,
      '--color-gradient-end': end,
      '--color-btn-text': hexToChannels(valueOf('btn_text_color')),
      '--glow-a': start,
      '--glow-b': end,
      '--text-gradient-from': start,
      '--text-gradient-via': end,
      '--text-gradient-to': end,
    } as CSSProperties
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, custom])

  const saveColor = async () => {
    setSaving(true)
    try {
      // Solo se guardan los colores que se personalizaron; el resto se envía
      // vacío para que los siga dando el estilo base (antes se guardaban los
      // cuatro siempre y quedaban fijos aunque nadie los hubiera tocado).
      await adminApi.updateSettings({
        theme_preset: preset,
        primary_color: custom.primary_color ?? '',
        btn_gradient_start: custom.btn_gradient_start ?? '',
        btn_gradient_end: custom.btn_gradient_end ?? '',
        btn_text_color: custom.btn_text_color ?? '',
      })
      loader.show('Aplicando cambios...')
      window.location.reload()
    } catch {
      toast.error('Error al guardar los colores')
    } finally {
      setSaving(false)
    }
  }

  /** Quita la personalización y conserva el estilo base elegido. */
  const resetColors = async () => {
    setSaving(true)
    try {
      await adminApi.updateSettings({
        theme_preset: preset,
        primary_color: '',
        btn_gradient_start: '',
        btn_gradient_end: '',
        btn_text_color: '',
      })
      loader.show('Restaurando colores...')
      window.location.reload()
    } catch {
      toast.error('Error al restaurar los colores')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-content-primary">Configuración visual</h2>
        <p className="text-sm text-content-secondary">
          Elige el estilo de color, personalízalo si lo necesitas y sube los logos de la plataforma.
        </p>
      </div>

      <div className="rounded-xl glass p-6">
        {/* ── 1. Estilo base ─────────────────────────────────────────── */}
        <h3 className="mb-1 font-semibold text-content-primary">Estilo de color</h3>
        <p className="mb-4 text-sm text-content-secondary">
          El estilo base define el degradado de botones, halos y acentos de toda la plataforma.
        </p>

        <div role="radiogroup" aria-label="Estilo de color" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(PRESETS) as ThemePreset[]).map((id) => {
            const p = PRESETS[id]
            const selected = preset === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreset(id)}
                className={cn(
                  'glass-lite glass-hover relative flex flex-col gap-3 rounded-xl p-4 text-left transition-all duration-300',
                  selected && 'border-primary ring-2 ring-primary/40'
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-10 w-full rounded-lg"
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${p.colors.btn_gradient_start}, ${p.colors.btn_gradient_end})`,
                    boxShadow: `0 10px 30px -10px ${p.colors.btn_gradient_start}`,
                  }}
                />
                <span className="flex items-start justify-between gap-2">
                  <span>
                    <span className="block font-semibold text-content-primary">{p.label}</span>
                    <span className="block text-xs text-content-secondary">{p.description}</span>
                  </span>
                  {selected && (
                    // Sólido con el color de check de ESE estilo (como las casillas).
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: p.check, boxShadow: `0 2px 10px -2px ${p.check}` }}
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── 2. Personalización ─────────────────────────────────────── */}
        <div className="mb-1 flex items-center gap-2">
          <h3 className="font-semibold text-content-primary">Personalización</h3>
          {isCustomized && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/20">
              Personalizado
            </span>
          )}
        </div>
        <p className="mb-6 text-sm text-content-secondary">
          Opcional. Cada color que cambies se aplica por encima del estilo base; los demás siguen el estilo elegido.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`color-${key}`} className="mb-2 block text-sm font-medium text-content-primary">
                {label}
              </label>
              <input
                id={`color-${key}`}
                type="color"
                value={valueOf(key)}
                onChange={(e) => setCustom((prev) => ({ ...prev, [key]: e.target.value }))}
                className="input-glass h-10 w-full cursor-pointer rounded p-1"
              />
            </div>
          ))}
        </div>

        {/* ── 3. Vista previa en vivo ────────────────────────────────── */}
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-tertiary">Vista previa</p>
        <div
          style={previewStyle}
          aria-hidden="true"
          className="pointer-events-none relative mb-6 overflow-hidden rounded-xl bg-slate-900/[0.03] p-6 ring-1 ring-inset ring-slate-900/[0.06] dark:bg-white/[0.02] dark:ring-white/[0.06]"
        >
          <div className="orb absolute -left-16 -top-16 h-48 w-48 text-glow-a/30" />
          <div className="orb absolute -bottom-20 -right-10 h-56 w-56 text-glow-b/25" />
          <div className="glass relative rounded-xl p-5">
            <p className="text-gradient text-xl font-semibold">Tu plataforma</p>
            <p className="mt-1 text-sm text-content-secondary">Así se verán botones, acentos y barras.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button tabIndex={-1}>Botón principal</Button>
              <Button tabIndex={-1} variant="secondary">
                Secundario
              </Button>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                Etiqueta
              </span>
            </div>
            <ProgressBar value={64} className="mt-5" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button onClick={saveColor} disabled={saving} className="min-w-[120px]">
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button variant="secondary" onClick={resetColors} disabled={saving || !isCustomized}>
            Quitar personalización
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <LogoUploader
          type="favicon"
          title="Favicon"
          description="Aparece en la pestaña del navegador. Resolución máxima recomendada de 512x512 píxeles."
        />
        <LogoUploader
          type="white"
          title="Logo claro (white)"
          description="Se utiliza cuando el tema de la aplicación está en modo oscuro."
        />
        <LogoUploader
          type="dark"
          title="Logo oscuro (dark)"
          description="Se utiliza cuando el tema de la aplicación está en modo claro. También es el que se incrusta en los correos."
        />
        <LogoUploader
          type="mobile"
          title="Logo móvil"
          description="Versión compacta del logo para la vista móvil. Si no se define, se usará el logo predeterminado."
        />
      </div>
    </div>
  )
}
