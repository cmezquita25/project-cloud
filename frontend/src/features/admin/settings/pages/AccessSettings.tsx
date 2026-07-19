import { useState } from 'react'
import { Images } from 'lucide-react'
import { Button } from '@shared/ui'
import { AssetsPermissionsDialog } from '@features/assets/components/AssetsPermissionsDialog'

/** Acceso y permisos: control de la unidad compartida "assets". */
export function AccessSettings() {
  const [permOpen, setPermOpen] = useState(false)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Acceso y permisos</h2>
        <p className="text-sm text-content-secondary">
          Controla quién puede ver e interactuar con los recursos compartidos.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-drive border border-border bg-surface p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <Images size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-content-tertiary">Carpeta compartida (assets)</p>
          <p className="text-base font-medium text-content-primary">Acceso restringido</p>
          <p className="text-xs text-content-tertiary">
            Solo tú y los usuarios que autorices pueden verla e interactuar con ella.
          </p>
        </div>
        <Button size="sm" variant="secondary" leftIcon={Images} onClick={() => setPermOpen(true)}>
          Gestionar acceso
        </Button>
      </div>

      <AssetsPermissionsDialog open={permOpen} onClose={() => setPermOpen(false)} />
    </div>
  )
}
