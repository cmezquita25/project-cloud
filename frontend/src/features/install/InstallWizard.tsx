import { useState } from 'react'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { Stepper } from './components/Stepper'
import { StepRequirements } from './components/StepRequirements'
import { StepDatabase } from './components/StepDatabase'
import { StepAdmin } from './components/StepAdmin'
import { StepDone } from './components/StepDone'

const STEPS = ['Requisitos', 'Base de datos', 'Administrador', 'Listo']

/** Asistente de instalación de 4 pasos (estilo Google Drive). */
export function InstallWizard() {
  const [step, setStep] = useState(0)

  return (
    <div className="relative flex min-h-full items-center justify-center bg-surface-container p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-on">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M4 5a2 2 0 0 1 2-2h5l2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-medium text-content-primary">Project Cloud</h1>
            <p className="text-xs text-content-tertiary">Asistente de instalación</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-elevation-1 sm:p-8">
          <div className="mb-8">
            <Stepper steps={STEPS} current={step} />
          </div>

          {step === 0 && <StepRequirements onNext={() => setStep(1)} />}
          {step === 1 && <StepDatabase onBack={() => setStep(0)} onNext={() => setStep(2)} />}
          {step === 2 && <StepAdmin onBack={() => setStep(1)} onDone={() => setStep(3)} />}
          {step === 3 && <StepDone />}
        </div>
      </div>
    </div>
  )
}
