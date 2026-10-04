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

  return (
    // Sin fondo propio: el `AppBackdrop` va en -z-10 y un `bg-*` aquí lo
    // taparía. Corre antes de que exista la BD: siempre con el preset Invicter.
    <div className="relative flex min-h-full items-center justify-center p-4">
      <AppBackdrop animated />
      <CursorGlow />
      <div className="glass-strong absolute right-4 top-4 rounded-full">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-3xl">
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

        <div className="glass-strong rounded-2xl p-6 ring-1 ring-slate-900/5 sm:p-8 dark:ring-white/10">
          <div className="mb-8">
            <Stepper steps={STEPS} current={step} />
          </div>

          {step === 0 && <StepRequirements onNext={() => setStep(1)} />}
          {step === 1 && <StepDatabase onBack={() => setStep(0)} onNext={() => setStep(2)} />}
          {step === 2 && <StepAdmin onBack={() => setStep(1)} onDone={() => setStep(3)} />}
          {step === 3 && <StepConfig onBack={() => setStep(2)} onDone={() => setStep(4)} />}
          {step === 4 && <StepDone />}
        </div>
      </div>
    </div>
  )
}
