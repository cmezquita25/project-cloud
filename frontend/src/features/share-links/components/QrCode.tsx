import { useEffect, useState } from 'react'
import { Download, Maximize2, X } from 'lucide-react'
import { Button, Portal, Spinner, useToast } from '@shared/ui'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { loadLogo, qrFilename, qrPng, qrSvg, saveBlob } from '../lib/qr'

interface QrCodeProps {
  /** URL que codifica el QR. */
  value: string
  /** Nombre del archivo o carpeta (para el nombre del PNG/SVG y la pantalla completa). */
  name: string
}

/** QR de un enlace: vista, pantalla completa y descarga PNG o SVG. */
export function QrCode({ value, name }: QrCodeProps) {
  const settings = usePlatformSettings()
  const toast = useToast()
  const [svg, setSvg] = useState<string | null>(null)
  const [logo, setLogo] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    let alive = true
    loadLogo(Boolean(settings?.logo_favicon))
      .then(async (l) => {
        const out = await qrSvg(value, l)
        if (alive) {
          setLogo(l)
          setSvg(out)
        }
      })
      .catch(() => alive && setSvg(null))
    return () => {
      alive = false
    }
  }, [value, settings?.logo_favicon])

  // Esc cierra la pantalla completa (sin cerrar también el diálogo de debajo).
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setFullscreen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [fullscreen])

  const downloadPng = async () => {
    try {
      saveBlob(await qrPng(value, logo), qrFilename(name, 'png'))
    } catch {
      toast.error('No se pudo generar el PNG.')
    }
  }
  const downloadSvg = () => {
    if (svg) saveBlob(new Blob([svg], { type: 'image/svg+xml' }), qrFilename(name, 'svg'))
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <div className="h-36 w-36 shrink-0 overflow-hidden rounded-xl bg-white p-1 ring-1 ring-slate-900/10">
        {svg ? (
          <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Spinner size={24} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2 sm:flex-col sm:items-stretch">
        <Button variant="secondary" size="sm" leftIcon={Maximize2} onClick={() => setFullscreen(true)} disabled={!svg}>
          Pantalla completa
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={Download} onClick={downloadPng} disabled={!svg}>
            PNG
          </Button>
          <Button variant="secondary" size="sm" leftIcon={Download} onClick={downloadSvg} disabled={!svg}>
            SVG
          </Button>
        </div>
      </div>

      {fullscreen && svg && (
        <Portal>
          <div
            className="fixed inset-0 z-modal flex flex-col items-center justify-center gap-6 bg-white p-6 text-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label="Código QR en pantalla completa"
            onClick={() => setFullscreen(false)}
          >
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 rounded-full p-2 text-slate-600 hover:bg-slate-100"
            >
              <X size={24} />
            </button>
            <div
              className="aspect-square w-[min(80vw,70vh)] [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <div className="max-w-[90vw] text-center">
              <p className="truncate text-lg font-semibold">{name}</p>
              <p className="break-all text-sm text-slate-500">{value}</p>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
