import { useState } from 'react'
import { TopBar, StepBar } from '../components/layout'
import { Dialog, IconButton, C } from '../components/ui'
import { Step1, Step2, Step3, Step4, Step5, Step6 } from '../components/survey/Steps'
import { useStore } from '../lib/store'
import { TOTAL_STEPS, FIELD_GUIDE } from '../lib/constants'
import type { SurveyDraft } from '../types'

// ─── WIZARD PAGE ──────────────────────────────────────────────────────────

export function WizardPage() {
  const { wizard, setWizardStep, updateDraft, closeWizard, addSurvey, updateSurvey, surveys } = useStore()
  const [guideOpen, setGuideOpen] = useState(false)
  if (!wizard) return null
  const { step, draft, editingId, backcheckOf } = wizard
  const originalNui = backcheckOf ? surveys.find(s => s.id === backcheckOf)?.nui : undefined

  function handleNext(patch: Partial<SurveyDraft>) {
    updateDraft(patch)
    if (step < TOTAL_STEPS) setWizardStep(step + 1)
    else {
      const finalDraft = { ...draft, ...patch }
      if (editingId) updateSurvey(editingId, finalDraft)
      else addSurvey(finalDraft)
    }
  }

  function handleBack() {
    if (step > 1) setWizardStep(step - 1)
    else closeWizard()
  }

  const stepProps = { draft, onNext: handleNext, onBack: handleBack, isFirst: step === 1, isLast: step === TOTAL_STEPS }

  return (
    <div>
      <TopBar
        title={backcheckOf ? 'Back-check (control)' : editingId ? 'Editar encuesta' : 'Nueva encuesta'}
        actions={
          <>
            <IconButton icon="ti-help" label="Guía de campo" onClick={() => setGuideOpen(true)} />
            <IconButton icon="ti-x" label="Cancelar" onClick={closeWizard} />
          </>
        }
      />
      {guideOpen && <FieldGuideDialog onClose={() => setGuideOpen(false)} />}
      {backcheckOf && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: C.tealLight, color: C.teal, fontSize: 12.5, fontWeight: 500,
          padding: '8px 16px', borderBottom: `0.5px solid ${C.teal}40`, lineHeight: 1.4,
        }}>
          <i className="ti ti-clipboard-check" style={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
          Re-entrevista de control{originalNui != null ? ` de la encuesta #${String(originalNui).padStart(3, '0')}` : ''} — captura sin mirar el original.
        </div>
      )}
      <StepBar currentStep={step} />
      <div className="page-content narrow" style={{ paddingBottom: 24 }}>
        {step === 1 && <Step1 {...stepProps} />}
        {step === 2 && <Step2 {...stepProps} />}
        {step === 3 && <Step3 {...stepProps} />}
        {step === 4 && <Step4 {...stepProps} />}
        {step === 5 && <Step5 {...stepProps} />}
        {step === 6 && <Step6 {...stepProps} />}
      </div>
    </div>
  )
}

// Field guide: codebook definitions so every surveyor reads each field the same
// way (standardisation → less inter-observer variability).
function FieldGuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Guía de campo — definiciones" onClose={onClose}>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Usa siempre estas definiciones para registrar de forma consistente entre encuestadores.
      </p>
      {FIELD_GUIDE.map(g => (
        <div key={g.key} style={{ padding: '8px 0', borderBottom: `0.5px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{g.term}</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{g.def}</div>
        </div>
      ))}
    </Dialog>
  )
}

