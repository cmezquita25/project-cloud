import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { AppBackdrop, Portal, useEntranceOnChange } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { useIsMobile } from '@shared/hooks/useMediaQuery'
import { UploadDock } from '@features/uploads/components/UploadDock'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { Footer } from './components/Footer'
import { HeaderSearchProvider } from './HeaderSearchContext'

import { GoogleAnalyticsTracker } from '@shared/components/GoogleAnalyticsTracker'

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
    }, 240) // Duración de la animación (240ms)
  }

  const showDrawer = isMobile && (drawer.isOpen || isClosing)

  // Entrada suave al cambiar de SECCIÓN (Mi unidad, Recientes, Admin…), no
  // al navegar entre carpetas: eso se hace muchas veces seguidas y animarlo
  // solo estorbaría. Las subsecciones de admin cuentan como sección propia.
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const section =
    segments[0] === 'folder' ? '' : segments[0] === 'admin' ? segments.slice(0, 2).join('/') : (segments[0] ?? '')
  const pageRef = useRef<HTMLDivElement>(null)
  useEntranceOnChange(pageRef, section)

  return (
    <HeaderSearchProvider>
      <GoogleAnalyticsTracker />
      <div className="flex h-full flex-col overflow-hidden">
      {/* Fondo de marca (estático en la app). Hermano del contenido, no envoltorio. */}
      <AppBackdrop />
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
                className={`absolute inset-0 bg-overlay/70 backdrop-blur-md ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
                onClick={handleClose}
                aria-hidden="true"
              />
              <div className={`absolute left-0 top-0 h-full w-72 shadow-elevation-3 ${isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}>
                <Sidebar onNavigate={handleClose} inDrawer />
              </div>
            </div>
          </Portal>
        )}

        {/* Contenido */}
        {/* Transparente para que se vea el fondo de marca. Sin `backdrop-filter`,
            `filter` ni `transform`: el recuadro de selección por arrastre es
            `fixed` y vive aquí dentro; cualquiera de ellos lo descolocaría. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main className="min-w-0 flex-1 flex flex-col overflow-y-auto">
            {/* Recibe la animación de entrada (sin `fill`: no deja transform). */}
            <div ref={pageRef} className="mx-auto h-full w-full max-w-[1600px] px-4 py-4 sm:px-6 flex flex-col">
              <Outlet />
            </div>

            {/* Móvil: footer dentro del scroll (se ve al llegar al final) */}
            <div className="mt-auto block sm:hidden">
              <Footer />
            </div>
          </main>

          {/* Escritorio: footer fijo abajo */}
          <div className="hidden shrink-0 sm:block">
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
