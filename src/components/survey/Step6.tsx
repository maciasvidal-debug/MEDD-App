import { useForm, Controller } from 'react-hook-form'
import { Field, SectionHead, Card, Badge, C } from '../ui'
import { calcEdad, fmtDate, productMetrics } from '../../lib/date'
import { validateDraft } from '../../lib/quality'
import { useStore } from '../../lib/store'
import type { SurveyDraft, Medication } from '../../types'
import { WizardNavBar, GroupLabel, type StepProps } from './_shared'

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
      // The save button sits at the bottom of a long summary; bring the quality
      // report (which lists the blocking errors) into view so the toast isn't the
      // only signal and the surveyor sees exactly what to fix.
      try {
        document.getElementById('wizard-quality')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch { /* jsdom */ }
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

      <div id="wizard-quality"><QualityCard report={report} /></div>

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

