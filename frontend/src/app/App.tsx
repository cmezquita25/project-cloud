import { lazy, Suspense } from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router/AppRouter'
import { MaintenanceGate } from './maintenance/MaintenanceGate'

const Agentation = import.meta.env.DEV
  ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
  : null

export function App() {
  return (
    <AppProviders>
      <MaintenanceGate>
        <AppRouter />
      </MaintenanceGate>
      {Agentation && (
        <Suspense fallback={null}>
          <Agentation />
        </Suspense>
      )}
    </AppProviders>
  )
}

