import React, { useState, useRef, useEffect } from 'react'
import {
  useForm, Controller,
  type Control, type FieldErrors,
  type UseFormSetValue, type UseFormRegisterReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Field, ChipGroup, SectionHead, Divider,
  Card, Button, Spinner, C, Badge,
} from '../ui'
import { ChipField, YesNoField, MultiChipField } from '../form'
import { useCUM } from '../../hooks/useCUM'
import { useMunicipios } from '../../hooks/useMunicipios'
import { normalizeCiudad } from '../../lib/ciudad'
import { OPT, FIELD_HELP } from '../../lib/constants'
import { calcEdad, fmtDate, productMetrics } from '../../lib/utils'
import { validateDraft } from '../../lib/quality'
import { useStore } from '../../lib/store'
import {
  step1Schema, step2Schema, step3Schema, step4Schema,
  type Step1Data, type Step2Data, type Step3Data, type Step4Data,
} from '../../lib/validators'
import type { SurveyDraft, Medication, UnidadConc, CUMRecord } from '../../types'

// ─── Municipio combobox ───────────────────────────────────────────────────────

function toTitleCase(s: string): string {
  const lower = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i === 0 || !lower.includes(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ')
}

interface MunicipioComboboxProps {
  value: string
  onChange: (v: string) => void
  onDepartamento?: (d: string) => void
}

function MunicipioCombobox({ value, onChange, onDepartamento }: MunicipioComboboxProps) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const { results, loading, error, search, clear } = useMunicipios()
  const skipSearch = useRef(false)

  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return }
    setText(value)
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setText(v)
    onChange(v)
    setOpen(true)
    search(v)
  }

  function handleSelect(r: { municipio: string; departamento?: string }) {
    const name = toTitleCase(r.municipio)
    skipSearch.current = true
    setText(name)
    onChange(name)
    if (r.departamento) onDepartamento?.(toTitleCase(r.departamento))
    setOpen(false)
    clear()
  }

  function handleClear() {
    setText('')
    onChange('')
    setOpen(false)
    clear()
  }

  // Canonicalise free text on blur so values typed without picking a suggestion
  // (the only path when offline) don't accumulate as casing/accent/department
  // variants of the same municipality. Picking a suggestion already stores a
  // clean name, so re-normalising it here is a harmless no-op.
  function handleBlur() {
    setTimeout(() => setOpen(false), 160)
    const { municipio, departamento } = normalizeCiudad(text)
    if (municipio && municipio !== text) {
      skipSearch.current = true
      setText(municipio)
      onChange(municipio)
    }
    // If the surveyor typed the department into the city box, lift it out into
    // its own field instead of leaving it glued to the municipality.
    if (departamento) onDepartamento?.(departamento)
  }

  const showDropdown = open && (results.length > 0 || (error !== '' && text.trim().length >= 2) || loading)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={text}
          onChange={handleChange}
          onFocus={() => { if (text.trim().length >= 2 && results.length > 0) setOpen(true) }}
          onBlur={handleBlur}
          placeholder="Escriba para buscar municipio…"
          autoComplete="off"
        />
        <div style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {loading && <Spinner size={14} color={C.teal} />}
          {text && !loading && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleClear() }}
              aria-label="Limpiar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.hint, fontSize: 18, lineHeight: 1, padding: 0 }}
            >×</button>
          )}
        </div>
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 30,
          background: C.surface, border: `0.5px solid ${C.border}`,
          borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {error && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-wifi-off" style={{ fontSize: 14 }} aria-hidden />
              {error} — el texto ingresado se guardará tal cual
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 12px', border: 'none', cursor: 'pointer',
                background: 'transparent',
                borderBottom: i < results.length - 1 ? `0.5px solid ${C.border}` : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                {toTitleCase(r.municipio)}
              </div>
              {r.departamento && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                  {toTitleCase(r.departamento)}
                </div>
              )}
            </button>
          ))}
          {!loading && !error && results.length === 0 && text.trim().length >= 2 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: C.muted }}>
              Sin resultados — el texto ingresado se guardará tal cual
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

interface StepProps {
  draft: SurveyDraft
  onNext: (patch: Partial<SurveyDraft>) => void
  onBack: () => void
  isFirst?: boolean
  isLast?: boolean
}

function WizardNavBar({
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

// ─── Step 1 — Identificación ──────────────────────────────────────────────

export function Step1({ draft, onNext, onBack, isFirst }: StepProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { fEta: draft.fEta, nuiEtr: draft.nuiEtr ?? undefined, nui: draft.nui },
  })

  return (
    <form onSubmit={handleSubmit(data => onNext(data as Partial<SurveyDraft>))} noValidate>
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

      <WizardNavBar onBack={onBack} showBack={!isFirst} />
    </form>
  )
}

// ─── Step 2 — Demografía ─────────────────────────────────────────────────

// Date of birth + live age readout derived from the interview date.
function BirthDateField({ register, max, edad, error }: {
  register: UseFormRegisterReturn
  max?:     string
  edad:     number | null
  error?:   string
}) {
  return (
    <Field label="Fecha de nacimiento" required error={error}>
      <input type="date" max={max} {...register} />
      {edad !== null && (
        <div style={{
          marginTop: 6, padding: '6px 10px',
          background: C.tealLight, borderRadius: 6,
          fontSize: 13, color: C.teal, fontWeight: 500,
        }}>
          <i className="ti ti-calendar-check" style={{ marginRight: 6, fontSize: 13 }} aria-hidden />
          Edad calculada: {edad} años
        </div>
      )}
    </Field>
  )
}

// Socioeconomic stratum: single-select 1–6 with toggle-off, rendered as a
// compact square radio group rather than chips.
function EstratoField({ control, error }: { control: Control<Step2Data>; error?: string }) {
  return (
    <Field label="Estrato socioeconómico" help={FIELD_HELP.estrato} error={error}>
      <Controller name="estrato" control={control}
        render={({ field }) => (
          <div role="radiogroup" style={{ display: 'flex', gap: 6 }}>
            {OPT.estrato.map(n => (
              <button
                key={n} type="button" role="radio"
                aria-checked={field.value === n}
                onClick={() => field.onChange(field.value === n ? null : n)}
                style={{
                  width: 42, height: 38, borderRadius: 8, fontWeight: 500, fontSize: 14,
                  border: field.value === n ? `1.5px solid ${C.teal}` : `0.5px solid ${C.border}`,
                  background: field.value === n ? C.tealLight : C.surface,
                  color: field.value === n ? C.teal : C.text,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        )} />
    </Field>
  )
}

// Education level + its postgrad sub-level. The sub-level only appears for
// "Posgrado" and is cleared whenever the parent changes (deterministic gate).
function EducationFields({ control, nvEstu, setValue, errors }: {
  control:  Control<Step2Data>
  nvEstu:   Step2Data['nvEstu']
  setValue: UseFormSetValue<Step2Data>
  errors:   FieldErrors<Step2Data>
}) {
  return (
    <>
      <ChipField
        control={control} name="nvEstu" label="Nivel educativo" required
        options={OPT.nvEstu} error={errors.nvEstu?.message}
        onAfterChange={val => { if (val !== 'Posgrado') setValue('nvPosg', '') }}
      />
      {nvEstu === 'Posgrado' && (
        <ChipField
          control={control} name="nvPosg" label="Nivel de posgrado" required
          options={OPT.nvPosg} error={errors.nvPosg?.message}
        />
      )}
    </>
  )
}

export function Step2({ draft, onNext, onBack }: StepProps) {
  const { control, register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      fNac:    draft.fNac,
      ciudad:  draft.ciudad,
      departamento: draft.departamento ?? '',
      dir:     draft.dir,
      estrato: draft.estrato,
      etnia:   draft.etnia,
      asSalud: draft.asSalud,
      estLab:  draft.estLab,
      ingreso: draft.ingreso,
      nvEstu:  draft.nvEstu,
      nvPosg:  draft.nvPosg,
    },
  })

  const fNac   = watch('fNac')
  const nvEstu = watch('nvEstu')
  const edad   = calcEdad(draft.fEta, fNac)

  return (
    <form onSubmit={handleSubmit(data => onNext(data as Partial<SurveyDraft>))} noValidate>
      <SectionHead icon="ti-users" label="Datos sociodemográficos" />

      <BirthDateField
        register={register('fNac')}
        max={draft.fEta || undefined}
        edad={edad}
        error={errors.fNac?.message}
      />

      <Field label="Ciudad / Municipio" error={errors.ciudad?.message}>
        <Controller name="ciudad" control={control}
          render={({ field }) => (
            <MunicipioCombobox
              value={field.value ?? ''}
              onChange={field.onChange}
              onDepartamento={d => setValue('departamento', d)}
            />
          )} />
      </Field>

      <Field label="Dirección de residencia" error={errors.dir?.message}>
        <input placeholder="Calle, carrera, barrio…" {...register('dir')} />
      </Field>

      <EstratoField control={control} error={errors.estrato?.message} />

      <ChipField control={control} name="etnia" label="Pertenencia étnica" required
        options={OPT.etnia} error={errors.etnia?.message} />

      <ChipField control={control} name="asSalud" label="Régimen de salud" required
        help={FIELD_HELP.asSalud} options={OPT.asSalud} error={errors.asSalud?.message} />

      <ChipField control={control} name="estLab" label="Ocupación actual" required
        help={FIELD_HELP.estLab} options={OPT.estLab} error={errors.estLab?.message} />

      <ChipField control={control} name="ingreso" label="Ingresos mensuales del hogar" required
        options={OPT.ingreso} error={errors.ingreso?.message} />

      <EducationFields control={control} nvEstu={nvEstu} setValue={setValue} errors={errors} />

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

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
    <form onSubmit={handleSubmit(handleNext)} noValidate>
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
        <div className="fade-in">
          <Field label="¿Cuál es su principal problema de salud?">
            <Controller name="prbSalud" control={control}
              render={({ field }) => (
                <input placeholder="Describa brevemente…" {...field} />
              )} />
          </Field>

          <YesNoField control={control} name="conMed" label="¿Consume medicamentos para este problema?" />

          {conMed === 'Sí' && (
            <div className="fade-in">
              <YesNoField control={control} name="medPrc"
                label="¿Los medicamentos fueron prescritos por un profesional de salud?" />

              {medPrc === 'Sí' && (
                <div className="fade-in">
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

// ─── Step 4 — Almacenamiento & disposición ────────────────────────────────
// Implements: DISP_MED_VC=No → clear CTO_DISP_VC

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

  const medSob    = watch('medSob')
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
    <form onSubmit={handleSubmit(handleNext)} noValidate>
      <SectionHead icon="ti-package" label="Medicamentos sin consumir y disposición" />

      <YesNoField control={control} name="medSob" required help={FIELD_HELP.medSob}
        label="¿Tiene medicamentos guardados sin consumir?" error={errors.medSob?.message} />

      {medSob === 'Sí' && (
        <div className="fade-in">
          <Divider label="Conocimiento del entrevistado" />

          <YesNoField control={control} name="dispMedVc" help={FIELD_HELP.dispMedVc}
            label="¿Sabe qué hacer con los medicamentos vencidos?" />

          {dispMedVc === 'Sí' && (
            <div className="fade-in">
              <Field label="¿Qué hace con los medicamentos vencidos?">
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
            <Field label="Otro motivo de no consumo">
              <Controller name="motNoConsumoOtro" control={control}
                render={({ field }) => <input placeholder="Especifique…" {...field} />} />
            </Field>
          )}

          {hasExpired && (
            <div className="fade-in">
              <MultiChipField control={control} name="motVencimiento"
                label="¿Por qué llegaron a acumularse o vencerse? (puede elegir varias)"
                options={OPT.motVencimiento} />
              {motVencimiento?.includes('Otro') && (
                <Field label="Otra razón de acumulación/vencimiento">
                  <Controller name="motVencimientoOtro" control={control}
                    render={({ field }) => <input placeholder="Especifique…" {...field} />} />
                </Field>
              )}
            </div>
          )}

          <MultiChipField control={control} name="dispFinal"
            label="¿Qué hace realmente con los medicamentos que ya no usa? (puede elegir varias)"
            options={OPT.dispFinal} />
          {dispFinal?.includes('Otro') && (
            <Field label="Otra conducta de disposición">
              <Controller name="dispFinalOtro" control={control}
                render={({ field }) => <input placeholder="Especifique…" {...field} />} />
            </Field>
          )}

          <YesNoField control={control} name="conocePuntos"
            label="¿Conoce puntos de recolección de medicamentos (punto azul, farmacia)?" />
          {conocePuntos === 'Sí' && (
            <Field label="¿Cuál(es) conoce?">
              <Controller name="cualPunto" control={control}
                render={({ field }) => <input placeholder="Nombre del punto / lugar…" {...field} />} />
            </Field>
          )}
        </div>
      )}

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

// ─── Step 5 — Medicamentos 1:N ────────────────────────────────────────────
// Dynamic list: NM_MED, DCI, CONC_MED, UND_CONC, F_VTO (+ CUM search).

const EMPTY_MED: Medication = { nmMed: '', dci: '', concMed: null, undConc: '', fVto: '' }

// CUM-INVIMA lookup panel. Owns its own query / selection / network state and
// only reports the chosen record to the parent via `onPick`, which prefills the
// manual-entry form. `clearSelectionToken` clears the highlight when bumped
// (the parent does so after a medication is added).
function CumSearchPanel({ onPick, clearSelectionToken }: {
  onPick:              (r: CUMRecord) => void
  clearSelectionToken: number
}) {
  const { results, loading, error: cumError, searched, search } = useCUM()
  const [query, setQuery]     = useState('')
  const [selected, setSelected] = useState<{ token: number; idx: number } | null>(null)

  // Derive the highlighted index from the parent's token instead of an effect:
  // when the parent bumps the token (after an add), the stored selection no
  // longer matches and the highlight clears on the next render.
  const selIdx = selected?.token === clearSelectionToken ? selected.idx : null

  function pick(r: CUMRecord, idx: number) {
    onPick(r)
    setSelected({ token: clearSelectionToken, idx })
  }

  return (
    <Card style={{ marginBottom: 16, background: C.tealLight, border: `1px solid color-mix(in srgb, ${C.teal} 22%, transparent)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: C.teal, marginBottom: 9 }}>
        <i className="ti ti-search" style={{ fontSize: 14 }} aria-hidden /> Buscar en CUM-INVIMA
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), query.trim().length >= 3 && search(query.trim()))}
          placeholder="acetaminofén, ibuprofeno…"
          style={{ flex: 1 }}
        />
        <Button
          type="button" variant="primary"
          disabled={loading || query.trim().length < 3}
          onClick={() => search(query.trim())}
          style={{ flexShrink: 0, paddingLeft: 16, paddingRight: 16 }}
        >
          {loading ? <Spinner size={16} color="#fff" /> : 'Buscar'}
        </Button>
      </div>
      {cumError && (
        <p style={{ fontSize: 12, color: C.amber, margin: 0 }}>
          <i className="ti ti-wifi-off" style={{ marginRight: 4 }} aria-hidden />{cumError}
        </p>
      )}
      {searched && !cumError && results.length === 0 && (
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Sin resultados para "{query}".</p>
      )}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
          {results.map((r, i) => (
            <button
              key={i} type="button"
              onClick={() => pick(r, i)}
              style={{
                padding: '8px 10px', textAlign: 'left',
                border: `1.5px solid ${selIdx === i ? C.teal : C.border}`,
                borderRadius: 8, cursor: 'pointer',
                background: selIdx === i ? C.tealLight : C.surface,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: selIdx === i ? C.teal : C.text }}>
                {r.producto || '—'}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {r.principioactivo} · {r.concentracion}{r.unidadmedida} · {r.formafarmaceutica}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

// Controlled manual-entry form for a single medication, prefilled by the CUM
// search. The draft entry and its validation live in the parent.
function MedicationEntryForm({ entry, setEntry, addErr, onAdd }: {
  entry:    Medication
  setEntry: React.Dispatch<React.SetStateAction<Medication>>
  addErr:   string
  onAdd:    () => void
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Nombre comercial">
          <input
            value={entry.nmMed}
            onChange={e => setEntry(v => ({ ...v, nmMed: e.target.value }))}
            placeholder="Ej: Dolex, Novalgina…"
          />
        </Field>
        <Field label="Principio activo (DCI)">
          <input
            value={entry.dci}
            onChange={e => setEntry(v => ({ ...v, dci: e.target.value }))}
            placeholder="Ej: Acetaminofén…"
          />
        </Field>
        <Field label="Concentración">
          <input
            type="number" min={0} step="any" placeholder="500"
            value={entry.concMed ?? ''}
            onChange={e => setEntry(v => ({ ...v, concMed: e.target.value ? parseFloat(e.target.value) : null }))}
          />
        </Field>
        <Field label="Unidad">
          <ChipGroup
            options={OPT.undConc}
            value={entry.undConc}
            onChange={v => setEntry(e => ({ ...e, undConc: v as UnidadConc }))}
          />
        </Field>
      </div>
      <Field label="Fecha de vencimiento" help={FIELD_HELP.fVto}>
        <input
          type="date"
          value={entry.fVto}
          onChange={e => setEntry(v => ({ ...v, fVto: e.target.value }))}
        />
      </Field>

      {addErr && (
        <p style={{ fontSize: 12, color: C.red, margin: '0 0 8px' }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 4 }} aria-hidden />{addErr}
        </p>
      )}

      <Button type="button" variant="secondary" icon="ti-plus" onClick={onAdd} fullWidth style={{ marginBottom: 16 }}>
        Agregar medicamento a la lista
      </Button>
    </>
  )
}

// Read-only preview of the medications added so far, with derived time metrics.
function MedicationList({ meds, fEta, fDisp, onRemove }: {
  meds:     Medication[]
  fEta:     string
  fDisp:    string
  onRemove: (idx: number) => void
}) {
  if (meds.length === 0) {
    return (
      <p style={{ fontSize: 13, color: C.hint, textAlign: 'center', padding: '12px 0' }}>
        Sin medicamentos registrados. Puede continuar sin agregar.
      </p>
    )
  }
  return (
    <Card style={{ marginBottom: 12 }}>
      <GroupLabel>Medicamentos registrados ({meds.length})</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {meds.map((m, i) => (
          <MedicationListItem
            key={i} med={m}
            metrics={productMetrics(fEta, fDisp, m)}
            onRemove={() => onRemove(i)}
          />
        ))}
      </div>
    </Card>
  )
}

function MedicationListItem({ med: m, metrics, onRemove }: {
  med:      Medication
  metrics:  ReturnType<typeof productMetrics>
  onRemove: () => void
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: metrics.isExpired ? C.amberLight : C.bg,
        borderRadius: 10, border: `1px solid ${metrics.isExpired ? `color-mix(in srgb, ${C.amber} 40%, transparent)` : C.border}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{m.nmMed || '—'}</span>
          {m.dci && <span style={{ fontSize: 12, color: C.muted }}> · {m.dci}</span>}
          {m.concMed != null && m.undConc && (
            <span style={{ fontSize: 12, color: C.hint }}> · {m.concMed} {m.undConc}</span>
          )}
        </div>
        <button
          type="button"
          aria-label={`Eliminar medicamento ${m.nmMed || ''}`}
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 12, padding: 0, flexShrink: 0 }}
        >
          <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden />
        </button>
      </div>

      {/* Time metrics preview */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {m.fVto && (
          <span style={{ fontSize: 11, color: metrics.isExpired ? C.amber : C.muted }}>
            <i className="ti ti-calendar-x" style={{ marginRight: 3, fontSize: 11 }} aria-hidden />
            Vence: {fmtDate(m.fVto)}
            {metrics.isExpired && metrics.tVto !== null && (
              <strong style={{ marginLeft: 4 }}>({metrics.tVto} d vencido)</strong>
            )}
          </span>
        )}
        {metrics.tDisp !== null && (
          <span style={{ fontSize: 11, color: C.muted }}>
            En bodega: {metrics.tDisp} d
          </span>
        )}
        {metrics.vUtil !== null && (
          <span style={{ fontSize: 11, color: C.muted }}>
            Vida útil: {metrics.vUtil} d
          </span>
        )}
      </div>
    </div>
  )
}

export function Step5({ draft, onNext, onBack }: StepProps) {
  const [meds, setMeds]     = useState<Medication[]>(draft.medications ?? [])
  const [entry, setEntry]   = useState<Medication>({ ...EMPTY_MED })
  const [addErr, setAddErr] = useState('')
  // Bumped on add so the CUM panel clears its highlighted selection.
  const [clearToken, setClearToken] = useState(0)

  function applyResult(r: CUMRecord) {
    setEntry(e => ({
      ...e,
      nmMed:   r.producto ?? '',
      dci:     r.principioactivo ?? '',
      concMed: r.concentracion ? parseFloat(r.concentracion) : null,
      undConc: (r.unidadmedida ?? '') as UnidadConc,
    }))
  }

  function addMedication() {
    if (!entry.nmMed.trim() && !entry.dci.trim()) {
      setAddErr('Ingrese al menos el nombre comercial o el principio activo.')
      return
    }
    setMeds(prev => [...prev, { ...entry }])
    setEntry({ ...EMPTY_MED })
    setAddErr('')
    setClearToken(t => t + 1)
  }

  function removeMed(idx: number) {
    setMeds(prev => prev.filter((_, i) => i !== idx))
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    onNext({ medications: meds })
  }

  return (
    <form onSubmit={handleNext} noValidate>
      <SectionHead icon="ti-pill" label="Medicamentos almacenados" />
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
        Registre cada producto almacenado sin consumir. Busque en el CUM-INVIMA para evitar errores de tipeo.
      </p>

      <CumSearchPanel onPick={applyResult} clearSelectionToken={clearToken} />

      <Divider label="Complete / ingrese manualmente y agregue" />

      <MedicationEntryForm entry={entry} setEntry={setEntry} addErr={addErr} onAdd={addMedication} />

      <MedicationList meds={meds} fEta={draft.fEta} fDisp={draft.fDisp} onRemove={removeMed} />

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

// ─── Step 6 — Confirmar ───────────────────────────────────────────────────

// Read-only summary row. Declared at module scope (not inside Step6's render)
// so it keeps a stable identity across renders — see react-hooks/static-components.
function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '6px 0', borderBottom: `0.5px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 12, color: C.muted, flex: '0 0 55%' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, textAlign: 'right', flex: '0 0 43%' }}>
        {value != null && value !== '' ? value : <span style={{ color: C.hint }}>—</span>}
      </span>
    </div>
  )
}

// Read-only summary cards for the Confirmar step. Each renders one section of the
// draft; split out so the Step6 body reads as a list of sections instead of one
// long block. They depend only on `draft`, so they're trivially reusable.
function IdentificacionCard({ draft }: { draft: SurveyDraft }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <GroupLabel>Identificación</GroupLabel>
      <Row label="Fecha de la entrevista"   value={fmtDate(draft.fEta)} />
      <Row label="N° de encuesta"           value={draft.nui} />
      <Row label="ID del encuestador"       value={draft.nuiEtr} />
    </Card>
  )
}

function DemografiaCard({ draft, edad }: { draft: SurveyDraft; edad: number | null }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <GroupLabel>Demografía</GroupLabel>
      <Row label="Fecha de nacimiento"      value={fmtDate(draft.fNac)} />
      {edad !== null && <Row label="Edad"   value={`${edad} años`} />}
      <Row label="Ciudad"                   value={draft.ciudad} />
      {draft.departamento && <Row label="Departamento" value={draft.departamento} />}
      {draft.dir && <Row label="Dirección"  value={draft.dir} />}
      {draft.estrato && <Row label="Estrato" value={draft.estrato} />}
      <Row label="Pertenencia étnica"       value={draft.etnia} />
      <Row label="Régimen de salud"         value={draft.asSalud} />
      <Row label="Ocupación"                value={draft.estLab} />
      <Row label="Ingresos mensuales"       value={draft.ingreso} />
      <Row label="Nivel educativo"          value={draft.nvEstu} />
      {draft.nvPosg && <Row label="Nivel de posgrado" value={draft.nvPosg} />}
    </Card>
  )
}

function SaludCard({ draft }: { draft: SurveyDraft }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <GroupLabel>Salud</GroupLabel>
      <Row label="Percepción de salud"      value={draft.perSalud} />
      <Row label="Enfermedad reciente"      value={draft.estSalud} />
      {draft.estSalud === 'Sí' && <>
        {draft.prbSalud && <Row label="Problema de salud"  value={draft.prbSalud} />}
        <Row label="Consume medicamentos"   value={draft.conMed} />
        {draft.conMed === 'Sí' && <>
          <Row label="Con prescripción"     value={draft.medPrc} />
          {draft.medPrc === 'Sí' && <>
            {draft.fPrc  && <Row label="Fecha de prescripción"  value={fmtDate(draft.fPrc)} />}
            {draft.fDisp && <Row label="Fecha de dispensación"  value={fmtDate(draft.fDisp)} />}
            <Row label="Sigue indicaciones" value={draft.indMed} />
          </>}
        </>}
      </>}
    </Card>
  )
}

function AlmacenamientoCard({ draft }: { draft: SurveyDraft }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <GroupLabel>Almacenamiento y disposición</GroupLabel>
      <Row label="Med. sin consumir"        value={draft.medSob} />
      {draft.medSob === 'Sí' && <>
        <Row label="Sabe qué hacer con vencidos"  value={draft.dispMedVc} />
        {draft.dispMedVc === 'Sí' && draft.ctoDispVc &&
          <Row label="Práctica de disposición"    value={draft.ctoDispVc} />
        }
        <Row label="Vencidos observados"    value={draft.vtoMedNc} />
        <Row label="Cantidad sin consumir"  value={draft.cantMed} />
        <Row label="Cantidad vencidos"      value={draft.cantMedVto} />
        {draft.pesoMedNc != null && <Row label="Peso (g)" value={draft.pesoMedNc} />}
        {draft.motNoConsumo.length > 0 && <Row label="Motivo de no consumo" value={draft.motNoConsumo.join(', ')} />}
        {draft.motNoConsumoOtro && <Row label="— Otro" value={draft.motNoConsumoOtro} />}
        {draft.motVencimiento.length > 0 && <Row label="Razón de acumulación/vto." value={draft.motVencimiento.join(', ')} />}
        {draft.motVencimientoOtro && <Row label="— Otro" value={draft.motVencimientoOtro} />}
        {draft.dispFinal.length > 0 && <Row label="Conducta de disposición" value={draft.dispFinal.join(', ')} />}
        {draft.dispFinalOtro && <Row label="— Otro" value={draft.dispFinalOtro} />}
        {draft.conocePuntos && <Row label="Conoce puntos de recolección" value={draft.conocePuntos} />}
        {draft.cualPunto && <Row label="¿Cuál?" value={draft.cualPunto} />}
      </>}
    </Card>
  )
}

function MedicacionesCard({ draft }: { draft: SurveyDraft }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <GroupLabel>Medicamentos almacenados — {draft.medications.length} producto(s)</GroupLabel>
      {draft.medications.map((m, i) => (
        <MedSummaryItem key={i} med={m} metrics={productMetrics(draft.fEta, draft.fDisp, m)} />
      ))}
    </Card>
  )
}

function MedSummaryItem({ med: m, metrics: mx }: {
  med:     Medication
  metrics: ReturnType<typeof productMetrics>
}) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `0.5px solid ${C.border}` }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>{m.nmMed || '—'}</span>
        {m.dci && <span style={{ fontSize: 12, color: C.muted }}>{m.dci}</span>}
        {m.concMed != null && m.undConc && (
          <Badge label={`${m.concMed} ${m.undConc}`} variant="gray" />
        )}
        {m.fVto && (
          <Badge
            label={`Vence: ${fmtDate(m.fVto)}`}
            variant={mx.isExpired ? 'amber' : 'teal'}
          />
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {mx.tVto !== null && (
          <span style={{ fontSize: 11, color: mx.isExpired ? C.amber : C.muted }}>
            Días vencido: <strong>{mx.tVto} d</strong>
          </span>
        )}
        {mx.tDisp !== null && (
          <span style={{ fontSize: 11, color: C.muted }}>
            En bodega: <strong>{mx.tDisp} d</strong>
          </span>
        )}
        {mx.vUtil !== null && (
          <span style={{ fontSize: 11, color: C.muted }}>
            Vida útil: <strong>{mx.vUtil} d</strong>
          </span>
        )}
      </div>
    </div>
  )
}

export function Step6({ draft, onNext, onBack }: StepProps) {
  const { control, handleSubmit } = useForm({ defaultValues: { obs: draft.obs } })
  const { surveys, wizard, pushToast } = useStore()

  const edad = calcEdad(draft.fEta, draft.fNac)
  const report = validateDraft(draft, surveys, wizard?.editingId)

  function handleSave(obs: string) {
    if (report.errors.length > 0) {
      pushToast('Corrige los errores antes de guardar.', 'error')
      return
    }
    onNext({ obs })
  }

  return (
    <form onSubmit={handleSubmit(({ obs }) => handleSave(obs))} noValidate>
      <SectionHead icon="ti-check" label="Revisar y confirmar" />
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.muted }}>
        Verifique los datos antes de guardar definitivamente.
      </p>

      <QualityCard report={report} />

      <IdentificacionCard draft={draft} />
      <DemografiaCard draft={draft} edad={edad} />
      <SaludCard draft={draft} />
      <AlmacenamientoCard draft={draft} />
      {draft.medications.length > 0 && <MedicacionesCard draft={draft} />}

      {/* OBS */}
      <Field label="Observaciones — opcional">
        <Controller name="obs" control={control}
          render={({ field }) => (
            <textarea
              placeholder="Comentarios o notas adicionales…"
              rows={3} {...field}
            />
          )} />
      </Field>

      <WizardNavBar onBack={onBack} isSave />
    </form>
  )
}

// Data-quality summary shown on the Confirmar step: completeness, hard errors
// (block save), soft plausibility warnings and a likely-duplicate notice.
function QualityCard({ report }: { report: ReturnType<typeof validateDraft> }) {
  const { errors, warnings, completeness, duplicate } = report
  const clean = errors.length === 0 && warnings.length === 0 && !duplicate
  const barColor = completeness >= 80 ? C.green : completeness >= 50 ? C.amber : C.red
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <GroupLabel>Validación y completitud</GroupLabel>
        <span className="fd tnum" style={{ fontSize: 16, fontWeight: 600, color: barColor, lineHeight: 1 }}>{completeness}%</span>
      </div>
      <div style={{ height: 8, background: C.surface2, borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          width: `${completeness}%`, height: '100%', borderRadius: 999,
          background: `linear-gradient(90deg, color-mix(in srgb, ${barColor} 72%, #fff), ${barColor})`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {errors.map((e, i) => (
        <QualityLine key={`e${i}`} icon="ti-alert-circle" color={C.red} text={e} />
      ))}
      {duplicate && (
        <QualityLine
          icon="ti-copy" color={C.amber}
          text={`Posible duplicado: ya existe la encuesta #${String(duplicate.nui).padStart(3, '0')} con la misma fecha, ciudad y nacimiento.`}
        />
      )}
      {warnings.map((w, i) => (
        <QualityLine key={`w${i}`} icon="ti-alert-triangle" color={C.amber} text={w} />
      ))}

      {clean && (
        <QualityLine icon="ti-circle-check" color={C.green} text="Sin inconsistencias detectadas." />
      )}
      {errors.length > 0 && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: C.red }}>
          Hay errores que impiden guardar. Vuelve atrás para corregirlos.
        </p>
      )}
    </Card>
  )
}

function QualityLine({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', padding: '3px 0' }}>
      <i className={`ti ${icon}`} style={{ fontSize: 15, color, flexShrink: 0, marginTop: 1 }} aria-hidden />
      <span style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 3, height: 13, borderRadius: 2, background: C.teal, flexShrink: 0 }} aria-hidden />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>
        {children}
      </span>
    </div>
  )
}
