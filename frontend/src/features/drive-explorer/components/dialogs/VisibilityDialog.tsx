import { useState } from 'react'
import { Globe, LockKeyhole } from 'lucide-react'
import { Button, Dialog, useToast } from '@shared/ui'
import type { DriveItem, Visibility } from '../../types'

interface Props {
  item: DriveItem | null
  onClose: () => void
  /** Aplica el cambio (adaptador del explorador). */
  onConfirm: (item: DriveItem, visibility: Visibility) => Promise<{ filesChanged: number }>
  onDone: () => void
}

/** Confirmación de «Hacer privado» / «Hacer público» de un archivo o carpeta. */
export function VisibilityDialog({ item, onClose, onConfirm, onDone }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!item) return null

  const target: Visibility = item.visibility === 'private' ? 'public' : 'private'
  const isFolder = item.type === 'folder'
  const toPrivate = target === 'private'

  const confirm = async () => {
    setBusy(true)
    try {
      const { filesChanged } = await onConfirm(item, target)
      toast.success(
        toPrivate
          ? isFolder ? `Carpeta privada · ${filesChanged} ${filesChanged === 1 ? 'archivo' : 'archivos'} sin URL pública` : 'Archivo privado'
          : isFolder ? `Carpeta pública · ${filesChanged} ${filesChanged === 1 ? 'archivo' : 'archivos'} con URL pública` : 'Archivo público'
      )
      onDone()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar la visibilidad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={toPrivate ? `¿Hacer privado «${item.name}»?` : `¿Hacer público «${item.name}»?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button leftIcon={toPrivate ? LockKeyhole : Globe} loading={busy} onClick={confirm}>
            {toPrivate ? 'Hacer privado' : 'Hacer público'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-content-secondary">
        {toPrivate ? (
          <>
            <p>
              {isFolder ? 'Todo el contenido de la carpeta, incluido lo que subas después, ' : 'El archivo '}
              <b className="text-content-primary">dejará de tener URL pública</b>. Solo tú y las personas con acceso podrán verlo
              desde la plataforma.
            </p>
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              Si usas su URL en un sitio web, en código o la compartiste, <b>dejará de funcionar</b>.
            </p>
          </>
        ) : (
          <>
            <p>
              {isFolder ? 'Todos los archivos de la carpeta tendrán ' : 'El archivo tendrá '}
              <b className="text-content-primary">URL pública</b>: cualquiera que la conozca podrá abrirlo, sin iniciar sesión.
            </p>
            {isFolder && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                También los archivos privados que haya dentro pasarán a públicos.
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
