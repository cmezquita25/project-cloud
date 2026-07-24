import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Portal } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { useIsMobile } from '@shared/hooks/useMediaQuery'
import { UploadDock } from '@features/uploads/components/UploadDock'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { Footer } from './components/Footer'
import { HeaderSearchProvider } from './HeaderSearchContext'

/**
 * Layout principal de la app autenticada (clon de Google Drive):
 *  - Escritorio: sidebar fijo + topbar + área de contenido.
 *  - Móvil: sidebar como drawer sobre overlay.
 */
export function AppLayout() {
  const drawer = useDisclosure()
  const isMobile = useIsMobile()
  const [isClosing, setIsClosing] = useState(false)

  // Manejar el cierre con animación
  useEffect(() => {
    if (drawer.isOpen) {
      setIsClosing(false)
    }
  }, [drawer.isOpen])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      drawer.close()
      setIsClosing(false)
    }, 200) // Duración de la animación (menor o igual a la duración CSS)
  }

  const showDrawer = isMobile && (drawer.isOpen || isClosing)

  return (
    <HeaderSearchProvider>
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar onMenuClick={drawer.open} />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar de escritorio */}
        <aside className="hidden w-64 shrink-0 md:block">
          <Sidebar />
        </aside>

        {/* Drawer móvil */}
        {showDrawer && (
          <Portal>
            <div className="fixed inset-0 z-sidebar">
              <div
                className={`absolute inset-0 bg-overlay/60 backdrop-blur-sm ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
                onClick={handleClose}
                aria-hidden="true"
              />
              <div className={`absolute left-0 top-0 h-full w-72 shadow-elevation-3 ${isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}>
                <Sidebar onNavigate={handleClose} />
              </div>
            </div>
          </Portal>
        )}

        {/* Contenido */}
        <div className="flex min-w-0 flex-1 flex-col bg-canvas overflow-hidden">
          <main className="min-w-0 flex-1 flex flex-col overflow-y-auto">
            <div className="mx-auto h-full w-full max-w-[1600px] px-4 py-4 sm:px-6 flex flex-col">
              <Outlet />
            </div>
          </main>

          {/* Pie de página global (fijo abajo) */}
          <div className="shrink-0">
            <Footer />
          </div>
        </div>
      </div>

      {/* Tarjeta de progreso de subidas (global) */}
      <UploadDock />
    </div>
    </HeaderSearchProvider>
  )
}
