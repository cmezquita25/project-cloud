import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, useLoader, useToast, IconButton } from '@shared/ui'
import { Menu, MenuItem } from '@shared/ui/Menu'
import { databaseApi, BackupItem } from '../../services/databaseApi'
import { RefreshCw, MoreVertical, Download, RotateCcw, Trash2 } from 'lucide-react'

function BackupRow({ 
  backup, 
  onRestore, 
  onDelete 
}: { 
  backup: BackupItem, 
  onRestore: (b: string) => void, 
  onDelete: (b: string) => void 
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const items: MenuItem[] = [
    {
      id: 'download',
      label: 'Descargar',
      icon: Download,
      onSelect: () => window.open(databaseApi.getDownloadUrl(backup.filename), '_blank')
    },
    {
      id: 'restore',
      label: 'Restaurar',
      icon: RotateCcw,
      onSelect: () => onRestore(backup.filename)
    },
    {
      id: 'delete',
      label: 'Eliminar',
      icon: Trash2,
      danger: true,
      divider: true,
      onSelect: () => onDelete(backup.filename)
    }
  ]

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <tr className="hover:bg-surface-hover transition-colors">
      <td className="px-4 py-3 font-medium text-content-primary whitespace-nowrap">
        {backup.filename}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {backup.created_at ? new Date(backup.created_at).toLocaleString() : 'Desconocida'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {formatBytes(backup.size_bytes)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <IconButton
          ref={anchorRef}
          icon={MoreVertical}
          onClick={() => setMenuOpen(true)}
          label="Opciones de backup"
        />
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRef={anchorRef}
          align="right"
          items={items}
          title="Opciones de Backup"
        />
      </td>
    </tr>
  )
}

export function DatabaseSettings() {
  const toast = useToast()
  const loader = useLoader()
  
  const queryClient = useQueryClient()
  const { data: backups = [], isLoading, refetch } = useQuery({
    queryKey: ['admin', 'backups'],
    queryFn: () => databaseApi.listBackups()
  })

  const [isMigrating, setIsMigrating] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadBackups = async (showToast = false) => {
    await refetch()
    if (showToast) toast.success('Lista de backups actualizada.')
  }

  const handleMigrate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.sql')) {
      toast.error('El archivo debe tener extensión .sql')
      return
    }

    if (!window.confirm(`¿Estás seguro de ejecutar el script SQL "${file.name}" en la base de datos? Esto es irreversible.`)) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsMigrating(true)
    loader.show('Aplicando migración en la base de datos...')
    try {
      const res = await databaseApi.migrate(file)
      toast.success(`Migración completada con éxito. Se ejecutaron ${res.statements} sentencias.`)
    } catch {
      toast.error('Error al ejecutar la migración.')
    } finally {
      setIsMigrating(false)
      loader.hide()
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCreateBackup = async () => {
    setIsBackingUp(true)
    loader.show('Generando copia de seguridad. Esto puede tardar unos minutos...')
    try {
      await databaseApi.createBackup()
      toast.success('Backup generado con éxito.')
      await loadBackups()
    } catch {
      toast.error('Error al generar el backup.')
    } finally {
      setIsBackingUp(false)
      loader.hide()
    }
  }

  const handleRestore = async (filename: string) => {
    if (!window.confirm(`¿Estás seguro de restaurar el backup "${filename}"? Esto reemplazará toda tu base de datos y archivos de almacenamiento actuales.`)) {
      return
    }

    loader.show('Restaurando sistema desde el backup...')
    try {
      await databaseApi.restoreBackup(filename)
      toast.success('Restauración completada. Se recargará la página.')
      setTimeout(() => window.location.reload(), 2000)
    } catch {
      toast.error('Error al restaurar el backup.')
      loader.hide()
    }
  }

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el backup "${filename}"?`)) {
      return
    }

    try {
      await databaseApi.deleteBackup(filename)
      toast.success('Backup eliminado.')
      queryClient.setQueryData<BackupItem[]>(['admin', 'backups'], (old) => 
        old ? old.filter(b => b.filename !== filename) : []
      )
    } catch {
      toast.error('Error al eliminar el backup.')
    }
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12 overflow-hidden">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Base de Datos</h2>
        <p className="text-sm text-content-secondary">
          Gestiona migraciones de esquema y copias de seguridad de "Mi unidad".
        </p>
      </div>

      {/* Card 1: Migración */}
      <div className="space-y-4 rounded-drive border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-medium text-content-primary">Migrar / Actualizar BD</h3>
        <p className="text-xs text-content-secondary -mt-2">
          Sube un archivo `.sql` para actualizar la estructura de la base de datos.
        </p>
        
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".sql"
            className="hidden"
            ref={fileInputRef}
            onChange={handleMigrate}
          />
          <Button 
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            loading={isMigrating}
          >
            Subir archivo SQL
          </Button>
          <span className="text-xs text-content-tertiary">
            Formatos soportados: .sql
          </span>
        </div>
      </div>

      {/* Card 2: Backup y Restauración */}
      <div className="space-y-5 rounded-drive border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1 flex-1">
            <h3 className="text-base font-medium text-content-primary">Copias de Seguridad (Backups)</h3>
            <p className="text-xs text-content-secondary">
              Respalda la base de datos y todos los archivos de los usuarios. 
              Si tu backup es muy pesado para procesarlo aquí, puedes descargarlo/subirlo vía FTP directamente en la carpeta <code className="bg-surface-container px-1 py-0.5 rounded text-content-primary">storage/backups/</code>.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={() => loadBackups(true)} aria-label="Actualizar registros" title="Actualizar registros">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            <Button onClick={handleCreateBackup} loading={isBackingUp}>
              Generar Backup
            </Button>
          </div>
        </div>

        <div className="border border-border/40 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm text-content-secondary">
            <thead className="bg-surface-container/50 text-xs text-content-primary border-b border-border/40">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Nombre de Archivo</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Tamaño</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap w-[1%]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 bg-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-content-tertiary">
                    Cargando backups...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-content-tertiary">
                    No se encontraron copias de seguridad en el servidor.
                  </td>
                </tr>
              ) : (
                backups.map(backup => (
                  <BackupRow 
                    key={backup.filename} 
                    backup={backup} 
                    onRestore={handleRestore} 
                    onDelete={handleDelete} 
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
