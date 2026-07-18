import { type ReactNode } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from '@shared/ui'
import { AuthProvider } from '@features/auth/AuthProvider'
import { UploadProvider } from '@features/uploads/UploadProvider'

/** Envuelve la app con todos los providers globales. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <UploadProvider>{children}</UploadProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
