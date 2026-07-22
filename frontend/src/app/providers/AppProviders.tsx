import { type ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ThemeProvider } from './ThemeProvider'
import { LoaderProvider, ToastProvider } from '@shared/ui'
import { AuthProvider } from '@features/auth/AuthProvider'
import { UploadProvider } from '@features/uploads/UploadProvider'
import { PreviewProvider } from '@features/preview'
import { PlatformSettingsProvider } from '@shared/hooks/usePlatformSettings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000, // 1 minuto de caché por defecto
      gcTime: 1000 * 60 * 60 * 24, // 24 horas guardado en cache
      retry: 1
    }
  }
})

const persister = createSyncStoragePersister({
  storage: window.sessionStorage,
})

/** Envuelve la app con todos los providers globales. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <ThemeProvider>
        <LoaderProvider>
          <ToastProvider>
            <AuthProvider>
              <PlatformSettingsProvider>
                <UploadProvider>
                  <PreviewProvider>{children}</PreviewProvider>
                </UploadProvider>
              </PlatformSettingsProvider>
            </AuthProvider>
          </ToastProvider>
        </LoaderProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  )
}
