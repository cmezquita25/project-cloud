import { lazy, Suspense } from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router/AppRouter'

const Agentation = import.meta.env.DEV
  ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
  : null

export function App() {
  return (
    <AppProviders>
      <AppRouter />
      {Agentation && (
        <Suspense fallback={null}>
          <Agentation />
        </Suspense>
      )}
    </AppProviders>
  )
}

