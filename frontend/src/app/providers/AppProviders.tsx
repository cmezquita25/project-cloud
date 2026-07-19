import { type ReactNode } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from '@shared/ui'
import { AuthProvider } from '@features/auth/AuthProvider'
import { UploadProvider } from '@features/uploads/UploadProvider'
import { PreviewProvider } from '@features/preview'
import { PlatformSettingsProvider } from '@shared/hooks/usePlatformSettings'

/** Envuelve la app con todos los providers globales. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <PlatformSettingsProvider>
            <UploadProvider>
              <PreviewProvider>{children}</PreviewProvider>
            </UploadProvider>
          </PlatformSettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
