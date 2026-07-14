import React from 'react'
import { useForm, Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, SectionHead, Divider, RevealNote } from '../ui'
import { useFocusOnReveal } from '../ui/useFocusOnReveal'
import { MultiChipField, YesNoField } from '../form'
import { OPT, FIELD_HELP } from '../../lib/constants'
import { step4Schema, type Step4Data } from '../../lib/validators'
import type { SurveyDraft } from '../../types'
import { WizardNavBar, scrollToFirstError, type StepProps } from './_shared'

// ─── Step 4 — Almacenamiento & disposición ────────────────────────────────
// Implements: DISP_MED_VC=No → clear CTO_DISP_VC

// The "Otro: especifique" free-text box that follows a multi-select when "Otro"
// is picked. Identical across the three motive/disposal questions, so factored
// out. `inputRef` scrolls/focuses the box into view when it reveals.
function OtroField({ control, name, label, error, inputRef }: {
  control: Control<Step4Data>
  name: 'motNoConsumoOtro' | 'motVencimientoOtro' | 'dispFinalOtro'
  label: string
  error?: string
  inputRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div ref={inputRef}>
      <Field label={label} hint="Seleccionó «Otro»: especifique cuál." error={error}>
        <Controller name={name} control={control}
          render={({ field }) => <input placeholder="Especifique…" {...field} />} />
      </Field>
    </div>
  )
}

// Body of Step 4, shown only when the home keeps unused medicines. Owns its own
// just-in-time reveal refs (only relevant while this block is mounted) so Step4
// stays a thin orchestrator. Form state is threaded down from Step4's useForm.
function MedSobSection({ control, register, watch, errors }: {
  control: Control<Step4Data>
  register: UseFormRegister<Step4Data>
  watch: UseFormWatch<Step4Data>
  errors: FieldErrors<Step4Data>
}) {
  const dispMedVc = watch('dispMedVc')
  const cantMed   = watch('cantMed')
  const vtoMedNc  = watch('vtoMedNc')
  const cantMedVto = watch('cantMedVto')
  const motNoConsumo = watch('motNoConsumo')
  const motVencimiento = watch('motVencimiento')
  const dispFinal = watch('dispFinal')
  const conocePuntos = watch('conocePuntos')
  // Reasons for expiry only make sense once expired meds are declared.
  const hasExpired = vtoMedNc === 'Sí' || (cantMedVto ?? 0) > 0

  // Just-in-time focus/scroll when an answer reveals a follow-up block: big
  // blocks scroll into view; the small "Otro" boxes also grab focus so the
  // surveyor lands right on the field to fill.
  const dispVcRef   = useFocusOnReveal<HTMLDivElement>(dispMedVc === 'Sí', true)
  const expiredRef  = useFocusOnReveal<HTMLDivElement>(hasExpired)
  const otroNoConRef  = useFocusOnReveal<HTMLDivElement>(!!motNoConsumo?.includes('Otro'), true)
  const otroVencRef   = useFocusOnReveal<HTMLDivElement>(!!motVencimiento?.includes('Otro'), true)
  const otroDispRef   = useFocusOnReveal<HTMLDivElement>(!!dispFinal?.includes('Otro'), true)
  const conocePuntosRef = useFocusOnReveal<HTMLDivElement>(conocePuntos === 'Sí', true)

  return (
    <>
      <RevealNote>
        Como el hogar <strong>guarda medicamentos sin consumir</strong>, complete las cantidades y,
        si observa vencidos, regístrelos uno a uno en el paso de <strong>Medicamentos</strong>.
      </RevealNote>
      <Divider label="Conocimiento del entrevistado" />

      <YesNoField control={control} name="dispMedVc" help={FIELD_HELP.dispMedVc}
        label="¿Sabe qué hacer con los medicamentos vencidos?" />

      {dispMedVc === 'Sí' && (
        <div className="fade-in" ref={dispVcRef}>
          <Field label="¿Qué hace con los medicamentos vencidos?"
            hint="En palabras del entrevistado: qué hace hoy con ellos.">
            <Controller name="ctoDispVc" control={control}
              render={({ field }) => (
                <textarea placeholder="Describa la práctica actual…" rows={3} {...field} />
              )} />
          </Field>
        </div>
      )}

      <Divider label="Observación directa — encuestador" />

      <YesNoField control={control} name="vtoMedNc" help={FIELD_HELP.vtoMedNc}
        label="¿Hay unidades vencidas entre los almacenados?" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Cant. sin consumir" help={FIELD_HELP.cantMed} error={errors.cantMed?.message}>
          <input
            type="number" inputMode="numeric" min={0} placeholder="0"
            {...register('cantMed', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Cant. vencidos" help={FIELD_HELP.cantMedVto} error={errors.cantMedVto?.message}>
          <input
            type="number" inputMode="numeric" min={0}
            max={cantMed ?? undefined} placeholder="0"
            {...register('cantMedVto', { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Field
        label="Peso total en balanza (g)"
        hint="Medir en balanza. Solo el número."
        error={errors.pesoMedNc?.message}
      >
        <input
          type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00"
          {...register('pesoMedNc', { valueAsNumber: true })}
        />
      </Field>

      {/* ─── Motivos y disposición (instrumento v2) ─── */}
      <Divider label="Motivos y disposición" />

      <MultiChipField control={control} name="motNoConsumo"
        label="¿Por qué no se consumieron? (puede elegir varias)"
        options={OPT.motNoConsumo} />
      {motNoConsumo?.includes('Otro') && (
        <OtroField control={control} name="motNoConsumoOtro" inputRef={otroNoConRef}
          label="Otro motivo de no consumo" error={errors.motNoConsumoOtro?.message} />
      )}

      {hasExpired && (
        <div className="fade-in" ref={expiredRef}>
          <RevealNote icon="ti-alert-triangle">
            Marcó <strong>medicamentos vencidos</strong> en el hogar: registre cada producto vencido
            con su <strong>fecha de vencimiento</strong> en el paso de Medicamentos — es lo que habilita
            el análisis por producto.
          </RevealNote>
          <MultiChipField control={control} name="motVencimiento"
            label="¿Por qué llegaron a acumularse o vencerse? (puede elegir varias)"
            options={OPT.motVencimiento} />
          {motVencimiento?.includes('Otro') && (
            <OtroField control={control} name="motVencimientoOtro" inputRef={otroVencRef}
              label="Otra razón de acumulación/vencimiento" error={errors.motVencimientoOtro?.message} />
          )}
        </div>
      )}

      <MultiChipField control={control} name="dispFinal"
        label="¿Qué hace realmente con los medicamentos que ya no usa? (puede elegir varias)"
        options={OPT.dispFinal} />
      {dispFinal?.includes('Otro') && (
        <OtroField control={control} name="dispFinalOtro" inputRef={otroDispRef}
          label="Otra conducta de disposición" error={errors.dispFinalOtro?.message} />
      )}

      <YesNoField control={control} name="conocePuntos"
        label="¿Conoce puntos de recolección de medicamentos (punto azul, farmacia)?" />
      {conocePuntos === 'Sí' && (
        <div ref={conocePuntosRef}>
          <Field label="¿Cuál(es) conoce?" hint="Nombre del punto azul, farmacia o lugar de recolección.">
            <Controller name="cualPunto" control={control}
              render={({ field }) => <input placeholder="Nombre del punto / lugar…" {...field} />} />
          </Field>
        </div>
      )}
    </>
  )
}

export function Step4({ draft, onNext, onBack }: StepProps) {
  const { control, register, handleSubmit, watch, formState: { errors } } = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      medSob:    draft.medSob,
      dispMedVc: draft.dispMedVc,
      ctoDispVc: draft.ctoDispVc,
      vtoMedNc:  draft.vtoMedNc,
      cantMed:    draft.cantMed,
      cantMedVto: draft.cantMedVto,
      pesoMedNc:  draft.pesoMedNc,
      motNoConsumo:       draft.motNoConsumo,
      motNoConsumoOtro:   draft.motNoConsumoOtro,
      motVencimiento:     draft.motVencimiento,
      motVencimientoOtro: draft.motVencimientoOtro,
      dispFinal:          draft.dispFinal,
      dispFinalOtro:      draft.dispFinalOtro,
      conocePuntos:       draft.conocePuntos,
      cualPunto:          draft.cualPunto,
    },
  })

  // The whole questionnaire body is gated on "keeps unused meds at home"; it
  // scrolls into view when revealed. Its many sub-reveals live in MedSobSection.
  const medSob    = watch('medSob')
  const medSobRef = useFocusOnReveal<HTMLDivElement>(medSob === 'Sí')

  function handleNext(data: Step4Data) {
    const patch: Partial<SurveyDraft> = { ...data } as Partial<SurveyDraft>
    if (data.dispMedVc !== 'Sí') patch.ctoDispVc = ''
    // Drop free-text / sub-answers that no longer apply, so a back-and-forth in
    // the wizard can't leave orphaned values.
    if (!data.motNoConsumo?.includes('Otro')) patch.motNoConsumoOtro = ''
    if (!data.motVencimiento?.includes('Otro')) patch.motVencimientoOtro = ''
    if (!data.dispFinal?.includes('Otro')) patch.dispFinalOtro = ''
    if (data.conocePuntos !== 'Sí') patch.cualPunto = ''
    onNext(patch)
  }

  return (
    <form onSubmit={handleSubmit(handleNext, scrollToFirstError)} noValidate>
      <SectionHead icon="ti-package" label="Medicamentos sin consumir y disposición" />

      <YesNoField control={control} name="medSob" required help={FIELD_HELP.medSob}
        label="¿Tiene medicamentos guardados sin consumir?" error={errors.medSob?.message} />

      {medSob === 'Sí' && (
        <div className="fade-in" ref={medSobRef}>
          <MedSobSection control={control} register={register} watch={watch} errors={errors} />
        </div>
      )}

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

