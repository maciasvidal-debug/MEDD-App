import React, { useState, useRef, useEffect } from 'react'
import { useForm, Controller, type Control, type FieldErrors, type UseFormSetValue, type UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, SectionHead, C, RevealNote } from '../ui'
import { useFocusOnReveal } from '../ui/useFocusOnReveal'
import { ChipField } from '../form'
import { useMunicipios } from '../../hooks/useMunicipios'
import { normalizeCiudad } from '../../lib/ciudad'
import { DEPARTAMENTOS, lookupDepartamento } from '../../lib/divipola'
import { OPT, FIELD_HELP } from '../../lib/constants'
import { calcEdad } from '../../lib/date'
import { step2Schema, type Step2Data } from '../../lib/validators'
import type { SurveyDraft } from '../../types'
import { WizardNavBar, scrollToFirstError, type StepProps } from './_shared'

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
  departamento: string   // chosen department; '' disables the field
}

// Municipio picker, scoped to the department chosen first in the cascade. With a
// department set, focusing lists its whole municipality set (browsable) and
// typing narrows it — so a homonym from another department can't be picked.
function MunicipioCombobox({ value, onChange, departamento }: MunicipioComboboxProps) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const { results, search, clear } = useMunicipios()
  const skipSearch = useRef(false)
  const disabled = !departamento

  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return }
    setText(value)
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setText(v)
    onChange(v)
    setOpen(true)
    search(v, departamento)
  }

  function handleSelect(r: { municipio: string }) {
    const name = toTitleCase(r.municipio)
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

  function handleFocus() {
    if (disabled) return
    search(text, departamento) // empty text → lists the whole department
    setOpen(true)
  }

  // Title-case free text on blur so a value typed without picking from the list
  // is still stored cleanly. The department is fixed by the cascade, so we leave
  // it alone here.
  function handleBlur() {
    setTimeout(() => setOpen(false), 160)
    const muni = normalizeCiudad(text).municipio
    if (muni && muni !== text) {
      skipSearch.current = true
      setText(muni)
      onChange(muni)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={text}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={disabled ? 'Elige primero el departamento' : 'Escriba o elija el municipio…'}
          autoComplete="off"
          style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        />
        {text && !disabled && (
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleClear() }}
              aria-label="Limpiar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.hint, fontSize: 18, lineHeight: 1, padding: 0 }}
            >×</button>
          </div>
        )}
      </div>

      {open && !disabled && (results.length > 0 || text.trim().length >= 1) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 30,
          background: C.surface, border: `0.5px solid ${C.border}`,
          borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
          maxHeight: 220, overflowY: 'auto',
        }}>
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
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                {toTitleCase(r.municipio)}
              </span>
            </button>
          ))}
          {results.length === 0 && text.trim().length >= 1 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: C.muted }}>
              Sin coincidencias en {departamento}
            </div>
          )}
        </div>
      )}
    </div>
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
                  width: 44, height: 44, borderRadius: 8, fontWeight: 500, fontSize: 14,
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
  const posgRef = useFocusOnReveal<HTMLDivElement>(nvEstu === 'Posgrado')
  return (
    <>
      <ChipField
        control={control} name="nvEstu" label="Nivel educativo" required
        options={OPT.nvEstu} error={errors.nvEstu?.message}
        onAfterChange={val => { if (val !== 'Posgrado') setValue('nvPosg', '') }}
      />
      {nvEstu === 'Posgrado' && (
        <div className="fade-in" ref={posgRef}>
          <RevealNote>Indicó <strong>posgrado</strong>: seleccione el nivel alcanzado.</RevealNote>
          <ChipField
            control={control} name="nvPosg" label="Nivel de posgrado" required
            options={OPT.nvPosg} error={errors.nvPosg?.message}
          />
        </div>
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
      // Backfill the department for legacy/edited records that only carry ciudad,
      // so a clean existing municipality isn't blocked by the new required field.
      departamento: draft.departamento || lookupDepartamento(draft.ciudad),
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
    <form onSubmit={handleSubmit(data => onNext(data as Partial<SurveyDraft>), scrollToFirstError)} noValidate>
      <SectionHead icon="ti-users" label="Datos sociodemográficos" />

      <BirthDateField
        register={register('fNac')}
        max={draft.fEta || undefined}
        edad={edad}
        error={errors.fNac?.message}
      />

      {/* Cascade: department first, then its municipalities — guarantees a
          municipality can't be recorded under the wrong department. */}
      <Field label="Departamento" required error={errors.departamento?.message}>
        <Controller name="departamento" control={control}
          render={({ field }) => (
            <select
              value={field.value ?? ''}
              onChange={e => { field.onChange(e.target.value); setValue('ciudad', '') }}
              aria-label="Departamento"
            >
              <option value="">Selecciona un departamento…</option>
              {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )} />
      </Field>

      <Field label="Municipio" required error={errors.ciudad?.message}>
        <Controller name="ciudad" control={control}
          render={({ field }) => (
            <MunicipioCombobox
              value={field.value ?? ''}
              onChange={field.onChange}
              departamento={watch('departamento') ?? ''}
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

