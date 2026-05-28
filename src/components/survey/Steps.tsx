import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Field, YesNo, ChipGroup, SectionHead, Divider,
  Card, Button, Spinner, C,
} from '../ui'
import { useCUM } from '../../hooks/useCUM'
import { OPT } from '../../lib/constants'
import { calcEdad, fmtDate } from '../../lib/utils'
import {
  step1Schema, step2Schema, step3Schema, step4Schema, step5Schema,
  type Step1Data, type Step2Data, type Step3Data, type Step4Data, type Step5Data,
} from '../../lib/validators'
import type { SurveyDraft } from '../../types'

// ─── Shared types ─────────────────────────────────────────────────────────────

interface StepProps {
  draft: SurveyDraft
  onNext: (patch: Partial<SurveyDraft>) => void
  onBack: () => void
  isFirst?: boolean
  isLast?: boolean
}

// ─── Step 1 — Identificación ─────────────────────────────────────────────────

export function Step1({ draft, onNext, onBack, isFirst }: StepProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fechaEncuesta: draft.fechaEncuesta,
      nuiEncuestador: draft.nuiEncuestador,
      nui: draft.nui,
    },
  })
  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <SectionHead icon="ti-id-badge" label="Datos de identificación" />

      <Field label="Fecha de la encuesta" required error={errors.fechaEncuesta?.message}>
        <input type="date" {...register('fechaEncuesta')} />
      </Field>

      <Field label="N° de identificación — encuestador" required error={errors.nuiEncuestador?.message}>
        <input
          type="text" inputMode="numeric" maxLength={20}
          placeholder="Ej: 1012345678"
          {...register('nuiEncuestador')}
        />
      </Field>

      <Field label="N° de registro del entrevistado" hint="Asignado automáticamente">
        <input type="text" value={draft.nui} readOnly {...register('nui')} />
      </Field>

      <WizardNavBar onBack={onBack} showBack={!isFirst} />
    </form>
  )
}

// ─── Step 2 — Demografía ─────────────────────────────────────────────────────

export function Step2({ draft, onNext, onBack }: StepProps) {
  const { control, register, handleSubmit, watch, formState: { errors } } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      fechaNac: draft.fechaNac,
      etnia: draft.etnia,
      eps: draft.eps,
      labor: draft.labor,
      ingreso: draft.ingreso,
      educ: draft.educ,
    },
  })
  const fechaNac = watch('fechaNac')
  const edad = calcEdad(fechaNac)

  return (
    <form onSubmit={handleSubmit(onNext as any)} noValidate>
      <SectionHead icon="ti-users" label="Datos sociodemográficos" />

      <Field label="Fecha de nacimiento" required error={errors.fechaNac?.message}>
        <input type="date" {...register('fechaNac')} />
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

      <Field label="Etnia" required error={errors.etnia?.message}>
        <Controller name="etnia" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.etnia} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Régimen de salud (EPS)" required error={errors.eps?.message}>
        <Controller name="eps" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.eps} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Estado laboral" required error={errors.labor?.message}>
        <Controller name="labor" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.labor} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Ingreso mensual" required error={errors.ingreso?.message}>
        <Controller name="ingreso" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.ingreso} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Field label="Último nivel de estudios aprobado" required error={errors.educ?.message}>
        <Controller name="educ" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.educ} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

// ─── Step 3 — Salud ───────────────────────────────────────────────────────────

export function Step3({ draft, onNext, onBack }: StepProps) {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      perSalud: draft.perSalud, estSalud: draft.estSalud,
      prbSalud: draft.prbSalud, conMed: draft.conMed,
      medPrc: draft.medPrc, indMed: draft.indMed,
    },
  })
  const estSalud = watch('estSalud')
  const conMed   = watch('conMed')

  return (
    <form onSubmit={handleSubmit(onNext as any)} noValidate>
      <SectionHead icon="ti-heart-rate-monitor" label="Estado de salud" />

      <Field label="Percepción general de salud" required error={errors.perSalud?.message}>
        <Controller name="perSalud" control={control}
          render={({ field }) => (
            <ChipGroup options={OPT.salud} value={field.value} onChange={field.onChange} />
          )} />
      </Field>

      <Divider />

      <Field label="¿En las últimas 4 semanas ha padecido alguna enfermedad o problema de salud?" required error={errors.estSalud?.message}>
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

          <Field label="¿Consume medicamentos para este problema?" error={errors.conMed?.message}>
            <Controller name="conMed" control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
          </Field>

          {conMed === 'Sí' && (
            <div className="fade-in">
              <Field label="¿Los medicamentos fueron prescritos por un médico u odontólogo?">
                <Controller name="medPrc" control={control}
                  render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field label="¿Sigue las indicaciones del profesional de salud?">
                <Controller name="indMed" control={control}
                  render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
              </Field>
            </div>
          )}
        </div>
      )}

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

// ─── Step 4 — Medicamentos almacenados ───────────────────────────────────────

export function Step4({ draft, onNext, onBack }: StepProps) {
  const { control, register, handleSubmit, watch, formState: { errors } } = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      medSob: draft.medSob, dispVenc: draft.dispVenc,
      ctoDisp: draft.ctoDisp, hayVenc: draft.hayVenc,
      cantMed: draft.cantMed, cantVenc: draft.cantVenc, pesoMed: draft.pesoMed,
    },
  })
  const medSob  = watch('medSob')
  const dispVenc = watch('dispVenc')

  return (
    <form onSubmit={handleSubmit(onNext as any)} noValidate>
      <SectionHead icon="ti-pill" label="Medicamentos almacenados" />

      <Field label="¿Tiene medicamentos sin consumir (parcial o totalmente)?" required error={errors.medSob?.message}>
        <Controller name="medSob" control={control}
          render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
      </Field>

      {medSob === 'Sí' && (
        <div className="fade-in">
          <Divider label="Conocimiento del entrevistado" />

          <Field label="¿Sabe qué debe hacer con los medicamentos vencidos?">
            <Controller name="dispVenc" control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
          </Field>

          {dispVenc === 'Sí' && (
            <div className="fade-in"><Field label="¿Qué hace usted con los medicamentos vencidos?">
              <Controller name="ctoDisp" control={control}
                render={({ field }) => (
                  <textarea placeholder="Describa la práctica actual…" rows={3} {...field} />
                )} />
            </Field></div>
          )}

          <Divider label="Observación directa — encuestador" />

          <Field label="¿Hay medicamentos vencidos entre los almacenados?" error={errors.hayVenc?.message}>
            <Controller name="hayVenc" control={control}
              render={({ field }) => <YesNo value={field.value} onChange={field.onChange} />} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Cant. unidades no consumidas" error={errors.cantMed?.message}>
              <input
                type="number" inputMode="numeric" min={0} placeholder="0"
                {...register('cantMed', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Cant. unidades vencidas" error={errors.cantVenc?.message}>
              <input
                type="number" inputMode="numeric" min={0} placeholder="0"
                {...register('cantVenc', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <Field
            label="Peso total almacenado (gramos)"
            hint="Medir en balanza. Solo el número."
            error={errors.pesoMed?.message}
          >
            <input
              type="number" inputMode="decimal" min={0} step="0.1" placeholder="0.0"
              {...register('pesoMed', { valueAsNumber: true })}
            />
          </Field>
        </div>
      )}

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

// ─── Step 5 — Medicamento registrado ─────────────────────────────────────────

export function Step5({ draft, onNext, onBack }: StepProps) {
  const { control, register, handleSubmit, setValue, formState: { errors } } = useForm<Step5Data>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      nmMed: draft.nmMed, dci: draft.dci,
      concMed: draft.concMed, undConc: draft.undConc,
    },
  })

  const { results, loading, error, searched, search } = useCUM()
  const [query, setQuery] = React.useState('')
  const [selIdx, setSelIdx] = React.useState<number | null>(null)

  function applyResult(r: typeof results[0], idx: number) {
    setValue('nmMed',   r.producto ?? '')
    setValue('dci',     r.principioactivo ?? '')
    setValue('concMed', r.concentracion ? parseFloat(r.concentracion) : null)
    setValue('undConc', (r.unidadmedida ?? '') as any)
    setSelIdx(idx)
  }

  function handleSearch() {
    if (query.trim().length >= 3) search(query.trim())
  }

  return (
    <form onSubmit={handleSubmit(onNext as any)} noValidate>
      <SectionHead icon="ti-database-search" label="Registro de medicamento" />
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
        Busque el medicamento en el CUM-INVIMA para evitar errores de tipeo.
        Requiere conexión a internet.
      </p>

      {/* CUM Search */}
      <Card style={{ marginBottom: 16, background: C.tealLight, border: `0.5px solid ${C.teal}30` }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: C.teal,
          textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8,
        }}>
          Buscar en CUM-INVIMA (medicamentos vigentes)
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
            placeholder="acetaminofén, ibuprofeno, metformina…"
            style={{ flex: 1 }}
          />
          <Button
            type="button" variant="primary"
            disabled={loading || query.trim().length < 3}
            onClick={handleSearch}
            style={{ flexShrink: 0, paddingLeft: 16, paddingRight: 16 }}
          >
            {loading ? <Spinner size={16} color="#fff" /> : 'Buscar'}
          </Button>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: C.amber, margin: 0 }}>
            <i className="ti ti-wifi-off" style={{ marginRight: 4 }} aria-hidden />
            {error}
          </p>
        )}
        {searched && !error && results.length === 0 && (
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
            Sin resultados para "{query}".
          </p>
        )}

        {results.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            maxHeight: 220, overflowY: 'auto', marginTop: 4,
          }}>
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

      <Divider label="o ingrese manualmente" />

      <Field label="Nombre comercial" error={errors.nmMed?.message}>
        <input placeholder="Ej: Dolex, Novalgina…" {...register('nmMed')} />
      </Field>

      <Field label="DCI / Principio activo (genérico)" error={errors.dci?.message}>
        <input placeholder="Ej: Acetaminofén, Ibuprofeno…" {...register('dci')} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Concentración" error={errors.concMed?.message}>
          <input
            type="number" inputMode="decimal" min={0} step="any" placeholder="500"
            {...register('concMed', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Unidad" error={errors.undConc?.message}>
          <Controller name="undConc" control={control}
            render={({ field }) => (
              <ChipGroup options={OPT.unidad} value={field.value} onChange={field.onChange} />
            )} />
        </Field>
      </div>

      <WizardNavBar onBack={onBack} />
    </form>
  )
}

// ─── Step 6 — Confirmar ───────────────────────────────────────────────────────

export function Step6({ draft, onNext, onBack }: StepProps) {
  const { control, handleSubmit } = useForm({ defaultValues: { obs: draft.obs } })

  const edad = calcEdad(draft.fechaNac)
  const Row = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '6px 0', borderBottom: `0.5px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 13, color: C.muted, flex: '0 0 48%' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', flex: '0 0 48%' }}>
        {value ?? <span style={{ color: C.hint }}>—</span>}
      </span>
    </div>
  )

  return (
    <form onSubmit={handleSubmit(({ obs }) => onNext({ obs }))} noValidate>
      <SectionHead icon="ti-check" label="Revisar y confirmar" />
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>
        Verifique los datos antes de guardar definitivamente.
      </p>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Identificación
        </div>
        <Row label="Fecha encuesta"   value={fmtDate(draft.fechaEncuesta)} />
        <Row label="N° entrevistado"  value={draft.nui} />
        <Row label="N° encuestador"   value={draft.nuiEncuestador} />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Demografía
        </div>
        {edad !== null && <Row label="Edad" value={`${edad} años`} />}
        <Row label="Etnia"    value={draft.etnia} />
        <Row label="EPS"      value={draft.eps} />
        <Row label="Laboral"  value={draft.labor} />
        <Row label="Ingreso"  value={draft.ingreso} />
        <Row label="Educación" value={draft.educ} />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Salud y medicamentos
        </div>
        <Row label="Percepción salud"  value={draft.perSalud} />
        <Row label="Padeció enfermedad" value={draft.estSalud} />
        {draft.conMed && <Row label="Consume med." value={draft.conMed} />}
        <Row label="Med. sin consumir" value={draft.medSob} />
        {draft.medSob === 'Sí' && <>
          <Row label="Sabe disposición" value={draft.dispVenc} />
          <Row label="Hay vencidos"     value={draft.hayVenc} />
          <Row label="Cant. no cons."   value={draft.cantMed ?? undefined} />
          <Row label="Cant. vencidos"   value={draft.cantVenc ?? undefined} />
          <Row label="Peso total (g)"   value={draft.pesoMed ?? undefined} />
        </>}
      </Card>

      {(draft.nmMed || draft.dci) && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Medicamento registrado
          </div>
          <Row label="Nombre comercial" value={draft.nmMed} />
          <Row label="DCI / Genérico"   value={draft.dci} />
          <Row label="Concentración"    value={draft.concMed && draft.undConc ? `${draft.concMed} ${draft.undConc}` : (draft.concMed?.toString())} />
        </Card>
      )}

      <Field label="Observaciones (opcional)">
        <Controller name="obs" control={control}
          render={({ field }) => (
            <textarea
              placeholder="Comentarios o notas adicionales sobre la encuesta…"
              rows={3}
              {...field}
            />
          )} />
      </Field>

      <WizardNavBar onBack={onBack} isSave />
    </form>
  )
}

// ─── Shared wizard navigation bar ─────────────────────────────────────────────

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
        type="submit"
        variant="primary"
        fullWidth
        style={{ background: isSave ? C.green : C.teal }}
        icon={isSave ? 'ti-device-floppy' : undefined}
        iconRight={isSave ? undefined : 'ti-arrow-right'}
      >
        {isSave ? 'Guardar encuesta' : 'Siguiente'}
      </Button>
    </div>
  )
}
