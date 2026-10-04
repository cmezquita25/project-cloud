import { useState } from 'react'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { AppBackdrop, CursorGlow } from '@shared/ui'
import { Stepper } from './components/Stepper'
import { StepRequirements } from './components/StepRequirements'
import { StepDatabase } from './components/StepDatabase'
import { StepAdmin } from './components/StepAdmin'
import { StepConfig } from './components/StepConfig'
import { StepDone } from './components/StepDone'

const STEPS = ['Requisitos', 'Base de datos', 'Administrador', 'Configuración', 'Listo']

/** Asistente de instalación de 4 pasos (estilo Google Drive). */
export function InstallWizard() {
  const [step, setStep] = useState(0)
  // Dirección del deslizamiento entre pasos: hacia la izquierda al avanzar y
  // hacia la derecha al volver. Se decide al cambiar de paso (no en el
  // render, que en modo estricto se ejecuta dos veces).
  const [forward, setForward] = useState(true)
  const goTo = (next: number) => {
    setForward(next >= step)
    setStep(next)
  }

  return (
    // Sin fondo propio: el `AppBackdrop` va en -z-10 y un `bg-*` aquí lo
    // taparía. Corre antes de que exista la BD: siempre con el preset Invicter.
    <div className="relative flex min-h-full items-center justify-center p-4">
      <AppBackdrop animated />
      <CursorGlow />
      <div className="glass-strong absolute right-4 top-4 rounded-full">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        {/* Halo de marca DETRÁS de la tarjeta: es lo que el vidrio desenfoca.
            Sin él la tarjeta solo tenía detrás el fondo casi negro y se veía
            gris (los halos del fondo quedan en las esquinas). `-z-10` dentro
            de este contenedor (que ya es contexto de apilamiento) lo pinta
            detrás de la tarjeta pero encima del fondo. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 flex -translate-y-1/2 justify-center">
          <div className="orb h-[36rem] w-[36rem] animate-pulse-glow text-glow-a/25 dark:text-glow-a/50" />
          <div className="orb -ml-72 mt-32 h-96 w-96 animate-pulse-glow text-glow-b/20 [animation-delay:-2.5s] dark:text-glow-b/45" />
        </div>
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gradient-start to-gradient-end text-btn-text shadow-[0_10px_30px_-8px_rgb(var(--glow-a)/0.7)]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M4 5a2 2 0 0 1 2-2h5l2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-gradient text-xl font-semibold">Project Cloud</h1>
            <p className="text-xs text-content-tertiary">Asistente de instalación</p>
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-6 ring-1 ring-slate-900/5 sm:p-8 dark:ring-white/10 dark:[background:linear-gradient(145deg,rgb(255_255_255/0.08),rgb(255_255_255/0.02))]">
          <div className="mb-8">
            <Stepper steps={STEPS} current={step} />
          </div>

          {/* `key={step}`: cada paso ya se montaba y desmontaba por separado,
              así que reiniciar este contenedor no cambia su comportamiento;
              solo dispara la animación de entrada del paso nuevo. */}
          <div key={step} className={forward ? 'animate-step-in-right' : 'animate-step-in-left'}>
            {step === 0 && <StepRequirements onNext={() => goTo(1)} />}
            {step === 1 && <StepDatabase onBack={() => goTo(0)} onNext={() => goTo(2)} />}
            {step === 2 && <StepAdmin onBack={() => goTo(1)} onDone={() => goTo(3)} />}
            {step === 3 && <StepConfig onBack={() => goTo(2)} onDone={() => goTo(4)} />}
            {step === 4 && <StepDone />}
          </div>
        </div>
      </div>
    </div>
  )
}
