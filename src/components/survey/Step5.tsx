import React, { useState } from 'react'
import { Field, SectionHead, Divider, Card, Button, Spinner, C, ChipGroup } from '../ui'
import { useCUM } from '../../hooks/useCUM'
import { OPT, FIELD_HELP } from '../../lib/constants'
import { fmtDate, productMetrics } from '../../lib/date'
import type { Medication, UnidadConc, CUMRecord } from '../../types'
import { WizardNavBar, GroupLabel, type StepProps } from './_shared'

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

