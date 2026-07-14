import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, SectionHead, Divider, C, RevealNote } from '../ui'
import { useFocusOnReveal } from '../ui/useFocusOnReveal'
import { ChipField, YesNoField } from '../form'
import { OPT, FIELD_HELP } from '../../lib/constants'
import { step3Schema, type Step3Data } from '../../lib/validators'
import type { SurveyDraft } from '../../types'
import { WizardNavBar, scrollToFirstError, type StepProps } from './_shared'

// ─── Step 3 — Salud ───────────────────────────────────────────────────────
// Implements the deterministic field-logic state machine:
//   EST_SALUD=No → clear PRB_SALUD, CON_MED, MED_PRC, F_PRC, F_DISP, IND_MED
//   CON_MED=No   → clear MED_PRC, F_PRC, F_DISP, IND_MED
//   MED_PRC=No   → clear F_PRC, F_DISP, IND_MED

export function Step3({ draft, onNext, onBack }: StepProps) {
  const { control, register, handleSubmit, watch, formState: { errors } } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      perSalud: draft.perSalud,
      estSalud: draft.estSalud,
      prbSalud: draft.prbSalud,
      conMed:   draft.conMed,
      medPrc:   draft.medPrc,
      fPrc:     draft.fPrc,
      fDisp:    draft.fDisp,
      indMed:   draft.indMed,
    },
  })

  const estSalud = watch('estSalud')
  const conMed   = watch('conMed')
  const medPrc   = watch('medPrc')
  const fPrc     = watch('fPrc')

  // Reveal guidance + focus/scroll down the health chain.
  const estSaludRef = useFocusOnReveal<HTMLDivElement>(estSalud === 'Sí', true)
  const conMedRef   = useFocusOnReveal<HTMLDivElement>(conMed === 'Sí')
  const medPrcRef   = useFocusOnReveal<HTMLDivElement>(medPrc === 'Sí')

  function handleNext(data: Step3Data) {
    const patch: Partial<SurveyDraft> = { ...data } as Partial<SurveyDraft>
    if (data.estSalud !== 'Sí') {
      Object.assign(patch, { prbSalud: '', conMed: '', medPrc: '', fPrc: '', fDisp: '', indMed: '' })
    }
    if (data.conMed !== 'Sí') {
      Object.assign(patch, { medPrc: '', fPrc: '', fDisp: '', indMed: '' })
    }
    if (data.medPrc !== 'Sí') {
      Object.assign(patch, { fPrc: '', fDisp: '', indMed: '' })
    }
    onNext(patch)
  }

  return (
    <form onSubmit={handleSubmit(handleNext, scrollToFirstError)} noValidate>
      <SectionHead icon="ti-heart-rate-monitor" label="Estado de salud" />

      <ChipField control={control} name="perSalud" label="Percepción general de salud" required
        options={OPT.perSalud} error={errors.perSalud?.message} />

      <Divider />

      <YesNoField
        control={control} name="estSalud"
        label="¿En las últimas 4 semanas ha padecido alguna enfermedad o problema de salud?"
        required error={errors.estSalud?.message}
      />

      {estSalud === 'Sí' && (
        <div className="fade-in" ref={estSaludRef}>
          <RevealNote>
            Indicó un <strong>problema de salud reciente</strong>: describa cuál e indique si toma
            medicamentos para tratarlo.
          </RevealNote>
          <Field label="¿Cuál es su principal problema de salud?">
            <Controller name="prbSalud" control={control}
              render={({ field }) => (
                <input placeholder="Describa brevemente…" {...field} />
              )} />
          </Field>

          <YesNoField control={control} name="conMed" label="¿Consume medicamentos para este problema?" />

          {conMed === 'Sí' && (
            <div className="fade-in" ref={conMedRef}>
              <YesNoField control={control} name="medPrc"
                label="¿Los medicamentos fueron prescritos por un profesional de salud?" />

              {medPrc === 'Sí' && (
                <div className="fade-in" ref={medPrcRef}>
                  <RevealNote>
                    Medicamento <strong>prescrito</strong>: registre la fecha de prescripción y la de
                    entrega en farmacia (ambas entre el nacimiento y la entrevista).
                  </RevealNote>
                  <Field label="Fecha de prescripción médica">
                    <input
                      type="date"
                      min={draft.fNac || undefined}
                      max={draft.fEta || undefined}
                      {...register('fPrc')}
                    />
                    <p style={{ fontSize: 11, color: C.hint, margin: '3px 0 0' }}>
                      Entre la fecha de nacimiento y la fecha de la entrevista
                    </p>
                  </Field>

                  <Field label="Fecha de entrega en farmacia" help={FIELD_HELP.fDisp}>
                    <input
                      type="date"
                      min={fPrc || draft.fNac || undefined}
                      max={draft.fEta || undefined}
                      {...register('fDisp')}
                    />
                    <p style={{ fontSize: 11, color: C.hint, margin: '3px 0 0' }}>
                      Posterior a la prescripción y anterior a la fecha de entrevista
                    </p>
                  </Field>

                  <YesNoField control={control} name="indMed"
                    label="¿Sigue las indicaciones del profesional de salud?" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

