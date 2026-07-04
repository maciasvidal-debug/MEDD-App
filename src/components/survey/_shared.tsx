import type React from 'react'
import { Button, C } from '../ui'
import type { SurveyDraft } from '../../types'

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface StepProps {
  draft: SurveyDraft
  onNext: (patch: Partial<SurveyDraft>) => void
  onBack: () => void
  isFirst?: boolean
  isLast?: boolean
}

export function WizardNavBar({
  onBack, showBack = true, isSave = false,
}: { onBack: () => void; showBack?: boolean; isSave?: boolean }) {
  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 5,
      background: C.surface, borderTop: `1px solid ${C.border}`,
      boxShadow: '0 -6px 16px -10px rgba(14, 23, 38, 0.18)',
      padding: '12px 0 0', marginTop: 24,
      display: 'flex', gap: 10,
    }}>
      {showBack && (
        <Button type="button" variant="ghost" onClick={onBack} style={{ flexShrink: 0 }}>
          Anterior
        </Button>
      )}
      <Button
        type="submit" variant="primary" fullWidth
        style={{ background: isSave ? C.green : C.teal }}
        icon={isSave ? 'ti-device-floppy' : undefined}
        iconRight={isSave ? undefined : 'ti-arrow-right'}
      >
        {isSave ? 'Guardar encuesta' : 'Siguiente'}
      </Button>
    </div>
  )
}

// Section label used across the step-6 summary cards and the step-5 medication list.
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 3, height: 13, borderRadius: 2, background: C.teal, flexShrink: 0 }} aria-hidden />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>
        {children}
      </span>
    </div>
  )
}

