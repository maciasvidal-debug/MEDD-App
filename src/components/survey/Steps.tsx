import React, { useState, useRef, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Field, YesNo, ChipGroup, SectionHead, Divider,
  Card, Button, Spinner, C, Badge,
} from '../ui'
import { useCUM } from '../../hooks/useCUM'
import { useMunicipios } from '../../hooks/useMunicipios'
import { OPT } from '../../lib/constants'
import { calcEdad, fmtDate, productMetrics } from '../../lib/utils'
import {
  step1Schema, step2Schema, step3Schema, step4Schema,
  type Step1Data, type Step2Data, type Step3Data, type Step4Data,
} from '../../lib/validators'
import type { SurveyDraft, Medication, UnidadConc } from '../../types'

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
}

function MunicipioCombobox({ value, onChange }: MunicipioComboboxProps) {
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

  function handleSelect(municipio: string) {
    const name = toTitleCase(municipio)
    skipSearch.current = true
    setText(name)
    onChange(name)
    setOpen(false)
    clear()
  }

  function handleClear() {
    setText('')
    onChange('')
    setOpen(false)
    clear()
  }

  const showDropdown = open && (results.length > 0 || (error !== '' && text.trim().length >= 2) || loading)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={text}
          onChange={handleChange}
          onFocus={() => { if (text.trim().length >= 2 && results.length > 0) setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
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
              onMouseDown={e => { e.preventDefault(); handleSelect(r.municipio) }}
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
      background: C.surface, borderTop: `0.5px solid ${C.border}`,
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

      <Field label="Fecha de la entrevista" required error={errors.fEta?.message}>
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

export function Step2({ draft, onNext, onBack }: StepProps) {
  const { control, register, handleSubmit, watch, formState: { errors } } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      fNac:    draft.fNac,
      ciudad:  draft.ciudad,
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

  const fNac  = watch('fNac')
  const edad  = calcEdad(draft.fEta, fNac)

  return (
    <form onSubmit={handleSubmit(data => onNext(data as Partial<SurveyDraft>))} noValidate>
      <SectionHead icon="ti-users" label="Datos sociodemográficos" />

      <Field label="Fecha de nacimiento" required error={errors.fNac?.message}>
        <input type="date" max={draft.fEta || undefined} {...register('fNac')} />
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

      <Field label="Ciudad / Municipio" error={errors.ciudad?.message}>
        <Controller name="ciudad" control={control}
          render={({ field }) => (
            <MunicipioCombobox value={field.value ?? ''} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Dirección de residencia" error={errors.dir?.message}>
        <input placeholder="Calle, carrera, barrio…" {...register('dir')} />
      </Field>

      <Field label="Estrato socioeconómico" error={errors.estrato?.message}>
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

      <Field label="Pertenencia étnica" required error={errors.etnia?.message}>
        <Controller name="etnia" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.etnia} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Régimen de salud" required error={errors.asSalud?.message}>
        <Controller name="asSalud" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.asSalud} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Ocupación actual" required error={errors.estLab?.message}>
        <Controller name="estLab" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.estLab} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Ingresos mensuales del hogar" required error={errors.ingreso?.message}>
        <Controller name="ingreso" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.ingreso} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Nivel educativo" required error={errors.nvEstu?.message}>
        <Controller name="nvEstu" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.nvEstu} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Nivel de formación posgrado" error={errors.nvPosg?.message}>
        <Controller name="nvPosg" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.nvPosg} value={field.value ?? ''} onChange={field.onChange} />
          )} />
      </Field>

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

      <Field label="Percepción general de salud" required error={errors.perSalud?.message}>
        <Controller name="perSalud" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.perSalud} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Divider />

      <Field
        label="¿En las últimas 4 semanas ha padecido alguna enfermedad o problema de salud?"
        required error={errors.estSalud?.message}
      >
        <Controller name="estSalud" control={control}
          render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
      </Field>

      {estSalud === 'Sí' && (
        <div className="fade-in">
          <Field label="¿Cuál es su principal problema de salud?">
            <Controller name="prbSalud" control={control}
              render={({ field }) => (
                <input placeholder="Describa brevemente…" {...field} />
              )} />
          </Field>

          <Field label="¿Consume medicamentos para este problema?">
            <Controller name="conMed" control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
          </Field>

          {conMed === 'Sí' && (
            <div className="fade-in">
              <Field label="¿Los medicamentos fueron prescritos por un profesional de salud?">
                <Controller name="medPrc" control={control}
                  render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
              </Field>

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

                  <Field label="Fecha de entrega en farmacia">
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

                  <Field label="¿Sigue las indicaciones del profesional de salud?">
                    <Controller name="indMed" control={control}
                      render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
                  </Field>
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
    },
  })

  const medSob    = watch('medSob')
  const dispMedVc = watch('dispMedVc')
  const cantMed   = watch('cantMed')

  function handleNext(data: Step4Data) {
    const patch: Partial<SurveyDraft> = { ...data } as Partial<SurveyDraft>
    if (data.dispMedVc !== 'Sí') patch.ctoDispVc = ''
    onNext(patch)
  }

  return (
    <form onSubmit={handleSubmit(handleNext)} noValidate>
      <SectionHead icon="ti-package" label="Medicamentos sin consumir y disposición" />

      <Field label="¿Tiene medicamentos guardados sin consumir?" required error={errors.medSob?.message}>
        <Controller name="medSob" control={control}
          render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
      </Field>

      {medSob === 'Sí' && (
        <div className="fade-in">
          <Divider label="Conocimiento del entrevistado" />

          <Field label="¿Sabe qué hacer con los medicamentos vencidos?">
            <Controller name="dispMedVc" control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
          </Field>

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

          <Field label="¿Hay unidades vencidas entre los almacenados?">
            <Controller name="vtoMedNc" control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Cant. sin consumir" error={errors.cantMed?.message}>
              <input
                type="number" inputMode="numeric" min={0} placeholder="0"
                {...register('cantMed', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Cant. vencidos" error={errors.cantMedVto?.message}>
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
        </div>
      )}

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

// ─── Step 5 — Medicamentos 1:N ────────────────────────────────────────────
// Dynamic list: NM_MED, DCI, CONC_MED, UND_CONC, F_VTO (+ CUM search).

const EMPTY_MED: Medication = { nmMed: '', dci: '', concMed: null, undConc: '', fVto: '' }

export function Step5({ draft, onNext, onBack }: StepProps) {
  const [meds, setMeds]     = useState<Medication[]>(draft.medications ?? [])
  const [entry, setEntry]   = useState<Medication>({ ...EMPTY_MED })
  const [addErr, setAddErr] = useState('')

  const { results, loading, error: cumError, searched, search } = useCUM()
  const [query, setQuery]   = useState('')
  const [selIdx, setSelIdx] = useState<number | null>(null)

  function applyResult(r: typeof results[0], idx: number) {
    setEntry(e => ({
      ...e,
      nmMed:   r.producto ?? '',
      dci:     r.principioactivo ?? '',
      concMed: r.concentracion ? parseFloat(r.concentracion) : null,
      undConc: (r.unidadmedida ?? '') as UnidadConc,
    }))
    setSelIdx(idx)
  }

  function addMedication() {
    if (!entry.nmMed.trim() && !entry.dci.trim()) {
      setAddErr('Ingrese al menos el nombre comercial o el principio activo.')
      return
    }
    setMeds(prev => [...prev, { ...entry }])
    setEntry({ ...EMPTY_MED })
    setSelIdx(null)
    setAddErr('')
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

      {/* CUM Search */}
      <Card style={{ marginBottom: 16, background: C.tealLight, border: `0.5px solid ${C.teal}30` }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
          Buscar en CUM-INVIMA
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
                onClick={() => applyResult(r, i)}
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

      <Divider label="Complete / ingrese manualmente y agregue" />

      {/* Manual entry form */}
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
      <Field label="Fecha de vencimiento">
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

      <Button type="button" variant="secondary" icon="ti-plus" onClick={addMedication} fullWidth style={{ marginBottom: 16 }}>
        Agregar medicamento a la lista
      </Button>

      {/* Current list */}
      {meds.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Medicamentos registrados ({meds.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meds.map((m, i) => {
              const metrics = productMetrics(draft.fEta, draft.fDisp, m)
              return (
                <div
                  key={i}
                  style={{
                    padding: '8px 10px',
                    background: metrics.isExpired ? '#FEF3C7' : C.bg,
                    borderRadius: 8, border: `0.5px solid ${metrics.isExpired ? C.amber : C.border}`,
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
                      onClick={() => removeMed(i)}
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
            })}
          </div>
        </Card>
      )}

      {meds.length === 0 && (
        <p style={{ fontSize: 13, color: C.hint, textAlign: 'center', padding: '12px 0' }}>
          Sin medicamentos registrados. Puede continuar sin agregar.
        </p>
      )}

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

export function Step6({ draft, onNext, onBack }: StepProps) {
  const { control, handleSubmit } = useForm({ defaultValues: { obs: draft.obs } })

  const edad = calcEdad(draft.fEta, draft.fNac)

  return (
    <form onSubmit={handleSubmit(({ obs }) => onNext({ obs }))} noValidate>
      <SectionHead icon="ti-check" label="Revisar y confirmar" />
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.muted }}>
        Verifique los datos antes de guardar definitivamente.
      </p>

      {/* Identificación */}
      <Card style={{ marginBottom: 10 }}>
        <GroupLabel>Identificación</GroupLabel>
        <Row label="Fecha de la entrevista"   value={fmtDate(draft.fEta)} />
        <Row label="N° de encuesta"           value={draft.nui} />
        <Row label="ID del encuestador"       value={draft.nuiEtr} />
      </Card>

      {/* Demografía */}
      <Card style={{ marginBottom: 10 }}>
        <GroupLabel>Demografía</GroupLabel>
        <Row label="Fecha de nacimiento"      value={fmtDate(draft.fNac)} />
        {edad !== null && <Row label="Edad"   value={`${edad} años`} />}
        <Row label="Ciudad"                   value={draft.ciudad} />
        {draft.dir && <Row label="Dirección"  value={draft.dir} />}
        {draft.estrato && <Row label="Estrato" value={draft.estrato} />}
        <Row label="Pertenencia étnica"       value={draft.etnia} />
        <Row label="Régimen de salud"         value={draft.asSalud} />
        <Row label="Ocupación"                value={draft.estLab} />
        <Row label="Ingresos mensuales"       value={draft.ingreso} />
        <Row label="Nivel educativo"          value={draft.nvEstu} />
        {draft.nvPosg && <Row label="Formación posgrado" value={draft.nvPosg} />}
      </Card>

      {/* Salud */}
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

      {/* Almacenamiento */}
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
        </>}
      </Card>

      {/* Medicamentos 1:N con métricas */}
      {draft.medications.length > 0 && (
        <Card style={{ marginBottom: 10 }}>
          <GroupLabel>Medicamentos almacenados — {draft.medications.length} producto(s)</GroupLabel>
          {draft.medications.map((m, i) => {
            const mx = productMetrics(draft.fEta, draft.fDisp, m)
            return (
              <div key={i} style={{
                padding: '8px 0', borderBottom: `0.5px solid ${C.border}`,
              }}>
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
          })}
        </Card>
      )}

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

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 500, color: C.muted,
      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
    }}>
      {children}
    </div>
  )
}
