import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, SectionHead } from '../ui'
import { FIELD_HELP } from '../../lib/constants'
import { step1Schema, type Step1Data } from '../../lib/validators'
import type { SurveyDraft } from '../../types'
import { WizardNavBar, scrollToFirstError, type StepProps } from './_shared'

// ─── Step 1 — Identificación ──────────────────────────────────────────────

export function Step1({ draft, onNext, onBack, isFirst }: StepProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fEta: draft.fEta, nuiEtr: draft.nuiEtr ?? undefined, nui: draft.nui,
      hogarId: draft.hogarId,
    },
  })

  return (
    <form onSubmit={handleSubmit(data => onNext(data as Partial<SurveyDraft>), scrollToFirstError)} noValidate>
      <SectionHead icon="ti-id-badge" label="Datos de identificación" />

      <Field label="Fecha de la entrevista" required help={FIELD_HELP.fEta} error={errors.fEta?.message}>
        <input
          type="date" max={new Date().toISOString().split('T')[0]}
          {...register('fEta')}
        />
      </Field>

      <Field label="ID del encuestador" required error={errors.nuiEtr?.message}>
        <input
          type="number" inputMode="numeric" min={1} step={1}
          placeholder="Ej: 1012345678"
          {...register('nuiEtr', { valueAsNumber: true })}
        />
      </Field>

      <Field label="Número de encuesta" hint="Asignado automáticamente">
        <input type="text" value={draft.nui} readOnly {...register('nui', { valueAsNumber: true })} />
      </Field>

      <Field
        label="Identificador de hogar"
        required
        hint="Autogenerado. Use el MISMO código para varias personas del mismo hogar."
        error={errors.hogarId?.message}
      >
        <input type="text" placeholder="H-XXXXXX" {...register('hogarId')} />
      </Field>

      {/* El método de selección muestral NO se captura aquí: lo define el
          investigador antes del estudio (constante de estudio/ola), no el
          encuestador por encuesta. */}

      <WizardNavBar onBack={onBack} showBack={!isFirst} />
    </form>
  )
}

