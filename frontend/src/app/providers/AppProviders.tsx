import { type ReactNode } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from '@shared/ui'

/** Envuelve la app con todos los providers globales. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  )
}
