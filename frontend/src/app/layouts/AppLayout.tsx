import { Outlet } from 'react-router-dom'
import { Portal } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { useIsMobile } from '@shared/hooks/useMediaQuery'
import { UploadDock } from '@features/uploads/components/UploadDock'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'

/**
 * Layout principal de la app autenticada (clon de Google Drive):
 *  - Escritorio: sidebar fijo + topbar + área de contenido.
 *  - Móvil: sidebar como drawer sobre overlay.
 */
export function AppLayout() {
  const drawer = useDisclosure()
  const isMobile = useIsMobile()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar onMenuClick={drawer.open} />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar de escritorio */}
        <aside className="hidden w-64 shrink-0 md:block">
          <Sidebar />
        </aside>

        {/* Drawer móvil */}
        {isMobile && drawer.isOpen && (
          <Portal>
            <div className="fixed inset-0 z-sidebar">
              <div
                className="absolute inset-0 animate-fade-in bg-overlay/50"
                onClick={drawer.close}
                aria-hidden="true"
              />
              <div className="absolute left-0 top-0 h-full w-72 animate-slide-in-right shadow-elevation-3">
                <Sidebar onNavigate={drawer.close} />
              </div>
            </div>
          </Portal>
        )}

        {/* Contenido */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-canvas">
          <div className="mx-auto h-full max-w-[1600px] px-4 py-4 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Tarjeta de progreso de subidas (global) */}
      <UploadDock />
    </div>
  )
}
