import { useEffect, useRef, useState } from 'react'
import { Check, ImageUp, QrCode, Trash2 } from 'lucide-react'
import { Button, Spinner, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { patchPlatformSettings } from '@shared/hooks/usePlatformSettings'
import { loadLogo, qrSvg } from '@features/share-links/lib/qr'
import { adminApi, type QrLogoMode, type QrSettings } from '../services/adminApi'

const OPTIONS: { id: QrLogoMode; label: string; description: string }[] = [
  { id: 'none', label: 'Sin logo', description: 'QR normal, sin diseño. Es el más fácil de leer.' },
  { id: 'platform', label: 'Logo de la plataforma', description: 'El favicon, centrado.' },
  { id: 'custom', label: 'Imagen personalizada', description: 'Sube una imagen propia para el centro.' },
]

/** Vista previa con un enlace de ejemplo. */
function QrPreview({ logoUrl }: { logoUrl: string | null }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setSvg(null)
    loadLogo(logoUrl)
      .then((logo) => qrSvg(`${window.location.origin}/s/EjemploDeEnlace1234567`, logo))
      .then((out) => alive && setSvg(out))
      .catch(() => alive && setSvg(null))
    return () => {
      alive = false
    }
  }, [logoUrl])
  return (
    <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-slate-900/10">
      {svg ? (
        <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          <Spinner size={24} />
        </div>
      )}
    </div>
  )
}

/**
 * Configuración → Apariencia → «Códigos QR»: qué lleva al centro el QR de los
 * enlaces compartidos. Por defecto, nada.
 */
export function QrAppearanceCard() {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<QrSettings | null>(null)
  const [busy, setBusy] = useState<QrLogoMode | 'upload' | 'delete' | null>(null)

  useEffect(() => {
    adminApi.getQrSettings().then(setState).catch(() => toast.error('No se pudo cargar la configuración de los QR.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = (next: QrSettings) => {
    setState(next)
    patchPlatformSettings({ qr_logo_mode: next.qr_logo_mode, qr_logo_url: next.qr_logo_url })
  }

  const choose = async (mode: QrLogoMode) => {
    if (!state || mode === state.mode) return
    if (mode === 'custom' && !state.has_custom) {
      inputRef.current?.click()
      return
    }
    setBusy(mode)
    try {
      apply(await adminApi.setQrMode(mode))
      toast.success('Apariencia de los QR guardada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusy(null)
    }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy('upload')
    try {
      const res = await adminApi.uploadQrLogo(file)
      apply(res)
      toast.success(
        res.resized
          ? `Imagen ajustada de ${res.original.width} × ${res.original.height} px a un máximo de ${res.max_px} px.`
          : 'Imagen guardada'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setBusy(null)
    }
  }

  const removeCustom = async () => {
    setBusy('delete')
    try {
      apply(await adminApi.deleteQrLogo())
      toast.success('Imagen eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl glass p-6">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-content-primary">
        <QrCode size={18} className="text-primary" /> Códigos QR
      </h3>
      <p className="mb-4 text-sm text-content-secondary">
        Qué lleva al centro el QR de los enlaces compartidos. El QR se genera con corrección de errores alta, así que se
        sigue leyendo con el logo encima.
      </p>

      {!state ? (
        <div className="flex justify-center py-8">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex-1 space-y-2" role="radiogroup" aria-label="Logo de los QR">
            {OPTIONS.map((o) => {
              const selected = state.mode === o.id
              const unavailable = o.id === 'platform' && !state.has_platform
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={unavailable || busy !== null}
                  onClick={() => void choose(o.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    selected ? 'border-primary bg-primary/10' : 'glass-lite glass-hover border-transparent'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-primary bg-primary text-white' : 'border-border-strong'
                    )}
                  >
                    {busy === o.id ? <Spinner size={12} /> : selected && <Check size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-content-primary">{o.label}</span>
                    <span className="block text-xs text-content-tertiary">
                      {unavailable ? 'Sube primero un favicon en «Logos» (más abajo).' : o.description}
                    </span>
                  </span>
                </button>
              )
            })}

            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="text-xs text-content-secondary">
                <strong className="text-content-primary">Imagen personalizada:</strong> recomendado{' '}
                <strong>{state.max_px} × {state.max_px} px</strong>, cuadrada (1:1), PNG con fondo transparente. PNG, JPG,
                WEBP o GIF de hasta 5 MB. Si es más grande, la plataforma la reduce a {state.max_px} px conservando sus
                proporciones.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" leftIcon={ImageUp} loading={busy === 'upload'} disabled={busy !== null} onClick={() => inputRef.current?.click()}>
                  {state.has_custom ? 'Reemplazar imagen' : 'Subir imagen'}
                </Button>
                {state.has_custom && (
                  <Button size="sm" variant="ghost" leftIcon={Trash2} loading={busy === 'delete'} disabled={busy !== null} onClick={removeCustom} className="text-danger">
                    Quitar
                  </Button>
                )}
              </div>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={upload} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <QrPreview logoUrl={state.qr_logo_url} />
            <span className="text-xs text-content-tertiary">Vista previa</span>
          </div>
        </div>
      )}
    </div>
  )
}
