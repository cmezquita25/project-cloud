import { useState, useEffect } from 'react'
import { Images, FolderPlus, Save } from 'lucide-react'
import { Button } from '@shared/ui'
import { AssetsPermissionsDialog } from '@features/assets/components/AssetsPermissionsDialog'
import { useAssetsAccess } from '@features/assets/hooks/useAssetsAccess'
import { assetsApi } from '@features/assets/services/assetsApi'
import { useToast } from '@shared/ui'
import { useQueryClient } from '@tanstack/react-query'

/** Espacio de trabajo: control de la unidad compartida "assets" y permisos. */
export function WorkspaceSettings() {
  const [permOpen, setPermOpen] = useState(false)
  const { access, loading } = useAssetsAccess()
  const [folderName, setFolderName] = useState('')
  const [folderAlias, setFolderAlias] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAlias, setIsSavingAlias] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const toast = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (access?.folder_name) {
      setFolderName(access.folder_name)
    }
    setFolderAlias(access?.custom_alias ?? '')
  }, [access?.folder_name, access?.custom_alias])

  const handleSaveFolderName = async () => {
    if (!folderName.trim()) return
    setIsSaving(true)
    try {
      await assetsApi.setFolderName(folderName, folderAlias)
      toast.success('Ruta de la unidad actualizada')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar ruta')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveFolderAlias = async () => {
    setIsSavingAlias(true)
    try {
      await assetsApi.setFolderName(folderName, folderAlias)
      toast.success('Alias de la unidad actualizado')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar alias')
    } finally {
      setIsSavingAlias(false)
    }
  }

  const handleActivate = async () => {
    setIsActivating(true)
    try {
      await assetsApi.activate()
      toast.success('Unidad compartida creada exitosamente')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    } catch (e: any) {
      toast.error(e.message || 'Error al crear unidad')
    } finally {
      setIsActivating(false)
    }
  }

  if (loading) return <div className="p-4 text-sm text-content-secondary">Cargando...</div>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Espacio de trabajo</h2>
        <p className="text-sm text-content-secondary">
          Configuración de la unidad compartida, su nombre/alias público y quiénes pueden acceder a ella.
        </p>
      </div>

      <div className="space-y-2 rounded-drive border border-border bg-surface p-4">
        <label className="text-sm font-medium text-content-primary block">
          Alias de la unidad compartida (Apodo visual)
        </label>
        <p className="text-xs text-content-tertiary mb-3">
          El nombre visible de esta carpeta compartida para todos los usuarios en la navegación lateral y accesos directos. Por defecto usará «Nombre de la Organización + Workspace» o «Unidad compartida».
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderAlias}
            onChange={(e) => setFolderAlias(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-content-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder={access?.folder_alias || 'Ej: Techmaleon Workspace'}
          />
          <Button leftIcon={Save} onClick={handleSaveFolderAlias} disabled={isSavingAlias || folderAlias === (access?.custom_alias ?? '')}>
            {isSavingAlias ? 'Guardando...' : 'Guardar Alias'}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-drive border border-border bg-surface p-4">
        <label className="text-sm font-medium text-content-primary block">
          Raíz de la carpeta compartida (Ruta física)
        </label>
        <p className="text-xs text-content-tertiary mb-3">
          El nombre de la carpeta (dentro de storage) que actúa como raíz en el servidor. Cambiar esto no eliminará la unidad anterior, solo apuntará a una nueva ubicación física.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-content-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Ej: assets"
          />
          <Button leftIcon={Save} onClick={handleSaveFolderName} disabled={isSaving || !folderName.trim() || folderName === access?.folder_name}>
            {isSaving ? 'Guardando...' : 'Guardar Ruta'}
          </Button>
        </div>
      </div>

      {!access?.active ? (
        <div className="flex items-center gap-4 rounded-drive border border-border bg-surface p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
            <FolderPlus size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-content-tertiary">Unidad compartida no activada</p>
            <p className="text-base font-medium text-content-primary">La carpeta "{folderName || 'assets'}" no existe.</p>
            <p className="text-xs text-content-tertiary">
              Crea la unidad compartida para comenzar a colaborar con otros usuarios.
            </p>
          </div>
          <Button size="sm" variant="primary" leftIcon={FolderPlus} onClick={handleActivate} disabled={isActivating}>
            Crear unidad compartida
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-drive border border-border bg-surface p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
            <Images size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-content-tertiary">Carpeta compartida ({access?.folder_name})</p>
            <p className="text-base font-medium text-content-primary">Acceso restringido</p>
            <p className="text-xs text-content-tertiary">
              Solo tú y los usuarios que autorices pueden verla e interactuar con ella.
            </p>
          </div>
          <Button size="sm" variant="secondary" leftIcon={Images} onClick={() => setPermOpen(true)}>
            Gestionar acceso
          </Button>
        </div>
      )}

      {access?.active && <AssetsPermissionsDialog open={permOpen} onClose={() => setPermOpen(false)} />}
    </div>
  )
}
