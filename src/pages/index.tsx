import React, { useState, useMemo } from 'react'
import { TopBar, StepBar } from '../components/layout'
import {
  Card, Button, Badge, EmptyState, Divider,
  Dialog, IconChip, IconButton, C,
} from '../components/ui'
import { Step1, Step2, Step3, Step4, Step5, Step6 } from '../components/survey/Steps'
import {
  ProjectConfigSection, SurveyorProfileSection, AppearanceSection,
  AccountSection, AppInfoSection,
} from '../components/settings'
import { useStore } from '../lib/store'
import { useCUM } from '../hooks/useCUM'
import {
  calcEdad, fmtDate, fmtTimestamp, compareSortable,
  toCSV, toCodebookCSV, downloadBlob, dateTag, productMetrics,
} from '../lib/utils'
import { TOTAL_STEPS, FIELD_GUIDE } from '../lib/constants'
import { isProfileComplete, surveyMissingProfile } from '../lib/validators'
import { declaresExpiredWithoutDetail } from '../lib/quality'
import type { SurveyDraft, Survey, Settings } from '../types'

// DashboardPage lives in its own lazily-loaded chunk (pages/Dashboard.tsx) to
// keep Recharts out of the initial bundle; App.tsx imports it via React.lazy.

// ─── WIZARD PAGE ──────────────────────────────────────────────────────────

export function WizardPage() {
  const { wizard, setWizardStep, updateDraft, closeWizard, addSurvey, updateSurvey, surveys } = useStore()
  const [guideOpen, setGuideOpen] = useState(false)
  if (!wizard) return null
  const { step, draft, editingId, backcheckOf } = wizard
  const originalNui = backcheckOf ? surveys.find(s => s.id === backcheckOf)?.nui : undefined

  function handleNext(patch: Partial<SurveyDraft>) {
    updateDraft(patch)
    if (step < TOTAL_STEPS) setWizardStep(step + 1)
    else {
      const finalDraft = { ...draft, ...patch }
      if (editingId) updateSurvey(editingId, finalDraft)
      else addSurvey(finalDraft)
    }
  }

  function handleBack() {
    if (step > 1) setWizardStep(step - 1)
    else closeWizard()
  }

  const stepProps = { draft, onNext: handleNext, onBack: handleBack, isFirst: step === 1, isLast: step === TOTAL_STEPS }

  return (
    <div>
      <TopBar
        title={backcheckOf ? 'Back-check (control)' : editingId ? 'Editar encuesta' : 'Nueva encuesta'}
        actions={
          <>
            <IconButton icon="ti-help" label="Guía de campo" onClick={() => setGuideOpen(true)} />
            <IconButton icon="ti-x" label="Cancelar" onClick={closeWizard} />
          </>
        }
      />
      {guideOpen && <FieldGuideDialog onClose={() => setGuideOpen(false)} />}
      {backcheckOf && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: C.tealLight, color: C.teal, fontSize: 12.5, fontWeight: 500,
          padding: '8px 16px', borderBottom: `0.5px solid ${C.teal}40`, lineHeight: 1.4,
        }}>
          <i className="ti ti-clipboard-check" style={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
          Re-entrevista de control{originalNui != null ? ` de la encuesta #${String(originalNui).padStart(3, '0')}` : ''} — captura sin mirar el original.
        </div>
      )}
      <StepBar currentStep={step} />
      <div className="page-content narrow" style={{ paddingBottom: 24 }}>
        {step === 1 && <Step1 {...stepProps} />}
        {step === 2 && <Step2 {...stepProps} />}
        {step === 3 && <Step3 {...stepProps} />}
        {step === 4 && <Step4 {...stepProps} />}
        {step === 5 && <Step5 {...stepProps} />}
        {step === 6 && <Step6 {...stepProps} />}
      </div>
    </div>
  )
}

// Field guide: codebook definitions so every surveyor reads each field the same
// way (standardisation → less inter-observer variability).
function FieldGuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Guía de campo — definiciones" onClose={onClose}>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Usa siempre estas definiciones para registrar de forma consistente entre encuestadores.
      </p>
      {FIELD_GUIDE.map(g => (
        <div key={g.key} style={{ padding: '8px 0', borderBottom: `0.5px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{g.term}</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{g.def}</div>
        </div>
      ))}
    </Dialog>
  )
}

// ─── ENCUESTAS PAGE ───────────────────────────────────────────────────────

type RecordsView = 'cards' | 'table'

// Compact label/value pair for the survey card metadata grid.
function Meta({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: C.hint }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 600, color: accent ?? C.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  )
}

// Single survey card, extracted and memoized so that frequent EncuestasPage
// re-renders (e.g. every keystroke in the filter field) don't re-render every
// row. Each row does string date parsing (calcEdad) and array filtering
// (productMetrics), which is wasteful at scale. All callback props are stable
// (zustand actions / useState setters) and `confirming` is a per-row boolean,
// so React.memo lets unaffected rows bail out of re-rendering.
interface SurveyCardItemProps {
  survey:         Survey
  isInvestigador: boolean
  confirming:     boolean
  onConfirm:      (id: string | null) => void
  onRemove:       (id: string) => void
  onEdit:         (s: Survey) => void
  onDetail:       (s: Survey) => void
  onBackcheck:    (s: Survey) => void
}

const SurveyCardItem = React.memo(function SurveyCardItem({
  survey: sv, isInvestigador, confirming, onConfirm, onRemove, onEdit, onDetail, onBackcheck,
}: SurveyCardItemProps) {
  const edad = calcEdad(sv.fEta, sv.fNac)
  const expiredMeds = sv.medications?.filter(m => productMetrics(sv.fEta, sv.fDisp, m).isExpired).length ?? 0

  return (
    <Card className="lift" style={{ display: 'flex', flexDirection: 'column', cursor: 'default' }}>
      {/* Header: big display record number + date, status pills to the right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: C.text, lineHeight: 1 }}>
            #{String(sv.nui).padStart(3, '0')}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {sv.ciudad ? `${sv.ciudad} · ` : ''}{fmtDate(sv.fEta)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {sv.backcheckOf && <Badge label="Back-check" variant="gray" />}
          {sv.medSob   === 'Sí' && <Badge label="Almacena"  variant="teal" />}
          {sv.vtoMedNc === 'Sí' && <Badge label="Vencidos"  variant="amber" />}
        </div>
      </div>

      {/* Metadata: sentence-case labels, ink values — quiet, legible hierarchy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 16px', fontSize: 12.5, marginBottom: 12 }}>
        {edad !== null && <Meta label="Edad" value={`${edad} años`} />}
        {sv.estrato   && <Meta label="Estrato" value={String(sv.estrato)} />}
        {sv.asSalud   && <Meta label="Régimen" value={sv.asSalud} />}
        {sv.cantMed != null && sv.medSob === 'Sí' && <Meta label="Sin consumir" value={String(sv.cantMed)} />}
        {sv.cantMedVto != null && sv.cantMedVto > 0 && <Meta label="Vencidos" value={String(sv.cantMedVto)} accent={C.amber} />}
        {sv.pesoMedNc != null && <Meta label="Peso" value={`${sv.pesoMedNc} g`} />}
      </div>

      {sv.medications?.length > 0 && (
        <button
          type="button"
          onClick={() => onDetail(sv)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 12px', marginBottom: 12, cursor: 'pointer', textAlign: 'left',
            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
            color: C.text, fontSize: 12.5,
          }}
        >
          <i className="ti ti-pill" style={{ fontSize: 16, color: C.teal }} aria-hidden />
          <span><strong className="fd">{sv.medications.length}</strong> producto(s)</span>
          {expiredMeds > 0 && (
            <span style={{ color: C.amber, fontWeight: 500 }}>· {expiredMeds} vencido(s)</span>
          )}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2, color: C.teal, fontWeight: 600 }}>
            Detalle <i className="ti ti-chevron-right" style={{ fontSize: 15 }} aria-hidden />
          </span>
        </button>
      )}

      {/* Investigador (supervisor): start a blind QC re-interview of this record */}
      {isInvestigador && !sv.backcheckOf && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 2 }}>
          <Button size="sm" variant="ghost" icon="ti-clipboard-check" onClick={() => onBackcheck(sv)}>
            Back-check
          </Button>
        </div>
      )}

      {/* Edit/delete only for the owner (encuestadores with their own surveys) */}
      {!isInvestigador && (
        confirming ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'auto', paddingTop: 2 }}>
            <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>¿Eliminar esta encuesta?</span>
            <Button size="sm" variant="danger" onClick={() => { onRemove(sv.id); onConfirm(null) }}>
              Sí, eliminar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onConfirm(null)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 2 }}>
            <Button size="sm" variant="ghost" icon="ti-edit" onClick={() => onEdit(sv)}>
              Editar
            </Button>
            <Button
              size="sm" variant="ghost" icon="ti-trash"
              style={{ color: C.red, borderColor: `${C.red}50` }}
              onClick={() => onConfirm(sv.id)}
            >
              Eliminar
            </Button>
          </div>
        )
      )}
    </Card>
  )
})

export function EncuestasPage() {
  const { surveys, removeSurvey, openEditWizard, openWizard, openBackcheckWizard, userRole } = useStore()
  const isInvestigador = userRole === 'investigador'
  const [filter, setFilter]     = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [detail, setDetail]     = useState<Survey | null>(null)
  // Investigators analyse many rows → default to the dense table; encuestadores
  // edit their own entries → default to cards.
  const [view, setView] = useState<RecordsView>(isInvestigador ? 'table' : 'cards')

  const filtered = useMemo(() => {
    if (!filter.trim()) return surveys
    const q = filter.toLowerCase()
    return surveys.filter(s =>
      String(s.nui).includes(q) ||
      s.ciudad?.toLowerCase().includes(q) ||
      s.asSalud?.toLowerCase().includes(q) ||
      s.medications?.some(m =>
        m.nmMed?.toLowerCase().includes(q) || m.dci?.toLowerCase().includes(q)
      )
    )
  }, [surveys, filter])

  return (
    <div>
      <TopBar
        title="Registros"
        subtitle={`${surveys.length} encuesta${surveys.length !== 1 ? 's' : ''}`}
        icon="ti-clipboard-list"
        accent={C.teal}
      />
      <div className="page-content">
        {surveys.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar por N°, ciudad, medicamento, DCI…"
              style={{ flex: 1 }}
            />
            <ViewToggle view={view} onChange={setView} />
          </div>
        )}

        {surveys.length === 0 && (
          <EmptyState
            icon="ti-clipboard-list"
            title="Sin registros"
            description={isInvestigador
              ? 'Aún no hay encuestas registradas por los encuestadores.'
              : 'Cuando registres encuestas aparecerán aquí.'}
            action={isInvestigador ? undefined : (
              <Button onClick={() => openWizard(0)} icon="ti-plus">Primera encuesta</Button>
            )}
          />
        )}
        {surveys.length > 0 && filtered.length === 0 && (
          <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
            Sin resultados para "{filter}".
          </p>
        )}
        {surveys.length > 0 && filtered.length > 0 && view === 'table' && (
          <RecordsTable surveys={filtered} onDetail={setDetail} />
        )}

        {surveys.length > 0 && filtered.length > 0 && view === 'cards' && (
          <div className="records-grid">
          {filtered.map(sv => (
            <SurveyCardItem
              key={sv.id}
              survey={sv}
              isInvestigador={isInvestigador}
              confirming={confirmId === sv.id}
              onConfirm={setConfirmId}
              onRemove={removeSurvey}
              onEdit={openEditWizard}
              onDetail={setDetail}
              onBackcheck={openBackcheckWizard}
            />
          ))}
          </div>
        )}
      </div>

      {/* Full survey inspector modal */}
      {detail && (
        <SurveyDetailModal survey={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

// Compact segmented control to switch between card and table views.
function ViewToggle({ view, onChange }: { view: RecordsView; onChange: (v: RecordsView) => void }) {
  const opts = [
    { id: 'table' as const, icon: 'ti-table', label: 'Tabla' },
    { id: 'cards' as const, icon: 'ti-layout-grid', label: 'Tarjetas' },
  ]
  return (
    <div role="group" aria-label="Vista de registros" style={{
      display: 'flex', flexShrink: 0, border: `1px solid ${C.border}`,
      borderRadius: 8, overflow: 'hidden', background: C.surface,
    }}>
      {opts.map(o => {
        const active = view === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.id)}
            style={{
              width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer',
              background: active ? C.tealLight : 'transparent',
              color: active ? C.teal : C.muted,
            }}
          >
            <i className={`ti ${o.icon}`} style={{ fontSize: 18 }} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

// ─── Dense, sortable records table (investigator analysis view) ─────────────

type SortKey = 'nui' | 'fEta' | 'ciudad' | 'edad' | 'estrato' | 'asSalud' | 'meds' | 'venc'

const TABLE_COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'nui',     label: 'N°',       numeric: true },
  { key: 'fEta',    label: 'Fecha' },
  { key: 'ciudad',  label: 'Ciudad' },
  { key: 'edad',    label: 'Edad',     numeric: true },
  { key: 'estrato', label: 'Estrato',  numeric: true },
  { key: 'asSalud', label: 'Régimen' },
  { key: 'meds',    label: 'Prod.',    numeric: true },
  { key: 'venc',    label: 'Venc.',    numeric: true },
]

function sortValue(s: Survey, key: SortKey): string | number | null {
  switch (key) {
    case 'nui':     return s.nui
    case 'fEta':    return s.fEta
    case 'ciudad':  return s.ciudad
    case 'edad':    return calcEdad(s.fEta, s.fNac)
    case 'estrato': return s.estrato
    case 'asSalud': return s.asSalud
    case 'meds':    return s.medications?.length ?? 0
    case 'venc':    return s.cantMedVto
  }
}

// Memoized so unrelated EncuestasPage re-renders (opening the detail modal,
// toggling delete-confirm) don't re-sort/re-render the whole table: `filtered`
// keeps its reference and `onDetail` is a stable setter, so React.memo bails.
const RecordsTable = React.memo(function RecordsTable({ surveys, onDetail }: { surveys: Survey[]; onDetail: (s: Survey) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('nui')
  const [asc, setAsc] = useState(true)

  const rows = useMemo(() => {
    const copy = [...surveys]
    copy.sort((a, b) => {
      const r = compareSortable(sortValue(a, sortKey), sortValue(b, sortKey))
      return asc ? r : -r
    })
    return copy
  }, [surveys, sortKey, asc])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc(a => !a)
    else { setSortKey(key); setAsc(true) }
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {TABLE_COLS.map(col => {
                const activeSort = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    aria-sort={activeSort ? (asc ? 'ascending' : 'descending') : 'none'}
                    onClick={() => toggleSort(col.key)}
                    style={{
                      position: 'sticky', top: 0, zIndex: 1,
                      textAlign: col.numeric ? 'right' : 'left',
                      padding: '10px 12px', whiteSpace: 'nowrap', cursor: 'pointer',
                      background: C.surface2, color: C.muted,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                      borderBottom: `1px solid ${C.border}`, userSelect: 'none',
                    }}
                  >
                    {col.label}
                    <i
                      className={`ti ${activeSort ? (asc ? 'ti-caret-up-filled' : 'ti-caret-down-filled') : 'ti-arrows-sort'}`}
                      style={{ fontSize: 13, marginLeft: 4, color: activeSort ? C.teal : C.hint, verticalAlign: 'middle' }}
                      aria-hidden
                    />
                  </th>
                )
              })}
              <th style={{ position: 'sticky', top: 0, background: C.surface2, borderBottom: `1px solid ${C.border}` }} aria-label="Detalle" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <RecordRow key={s.id} survey={s} zebra={i % 2 === 1} onDetail={onDetail} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
})

// Single table row, memoized so that filter keystrokes / parent re-renders only
// re-render rows whose data (survey reference) or zebra position actually change,
// skipping the per-row calcEdad otherwise. onDetail is a stable setter.
interface RecordRowProps { survey: Survey; zebra: boolean; onDetail: (s: Survey) => void }
const RecordRow = React.memo(function RecordRow({ survey: s, zebra, onDetail }: RecordRowProps) {
  const edad = calcEdad(s.fEta, s.fNac)
  const meds = s.medications?.length ?? 0
  const venc = s.cantMedVto ?? 0
  return (
    <tr
      onClick={() => onDetail(s)}
      style={{ cursor: 'pointer', background: zebra ? C.surface2 : C.surface }}
    >
      <Td numeric><strong style={{ color: C.teal }}>#{String(s.nui).padStart(3, '0')}</strong></Td>
      <Td>{s.fEta ? fmtDate(s.fEta) : '—'}</Td>
      <Td>{s.ciudad || '—'}</Td>
      <Td numeric>{edad != null ? edad : '—'}</Td>
      <Td numeric>{s.estrato ?? '—'}</Td>
      <Td>{s.asSalud || '—'}</Td>
      <Td numeric>{meds}</Td>
      <Td numeric>
        {venc > 0
          ? <span style={{ color: C.amber, fontWeight: 600 }}>{venc}</span>
          : <span style={{ color: C.hint }}>0</span>}
      </Td>
      <Td>
        <i className="ti ti-chevron-right" style={{ fontSize: 16, color: C.hint, display: 'block' }} aria-hidden />
      </Td>
    </tr>
  )
})

function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <td
      className={numeric ? 'tnum' : undefined}
      style={{
        padding: '9px 12px', whiteSpace: 'nowrap',
        textAlign: numeric ? 'right' : 'left',
        borderBottom: `1px solid ${C.border}`, color: C.text,
      }}
    >
      {children}
    </td>
  )
}

// Full read-only survey inspector — every captured field, grouped by section,
// plus per-product metrics and para-data. Lets an investigator do QC in-app
// without exporting to an external tool. Empty fields are hidden to keep the
// record scannable; always-relevant identifiers are shown even when blank.
function SurveyDetailModal({ survey: s, onClose }: { survey: Survey; onClose: () => void }) {
  const edad = calcEdad(s.fEta, s.fNac)
  const inconsistent = declaresExpiredWithoutDetail(s)
  const durSec = s.startedAt && s.createdAt
    ? Math.round((new Date(s.createdAt).getTime() - new Date(s.startedAt).getTime()) / 1000)
    : null
  const fmtDur = (d: number | null) =>
    d == null ? '—' : d >= 60 ? `${Math.floor(d / 60)}m ${d % 60}s` : `${d}s`

  return (
    <Dialog title={`Encuesta #${String(s.nui).padStart(3, '0')}`} onClose={onClose}>
      {inconsistent && (
        <div role="alert" style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          background: C.amberLight, border: `1px solid ${C.amber}40`,
          borderRadius: 10, padding: '9px 11px', marginBottom: 14,
          fontSize: 12, color: C.amber, lineHeight: 1.45,
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>Marca medicamentos vencidos en el hogar pero ningún producto tiene fecha de vencimiento pasada. Revisar / back-check.</span>
        </div>
      )}

      <DetailSection icon="ti-id-badge-2" title="Identificación">
        <DetailRow label="N° registro" value={`#${String(s.nui).padStart(3, '0')}`} />
        <DetailRow label="Fecha entrevista" value={fmtDate(s.fEta)} />
        {s.nuiEtr != null && <DetailRow label="Encuestador (NUI)" value={`#${s.nuiEtr}`} />}
        {s.etrPrograma && <DetailRow label="Programa" value={s.etrPrograma} />}
        {s.etrInstitucion && <DetailRow label="Institución" value={s.etrInstitucion} />}
        {s.etrTipoInst && <DetailRow label="Tipo institución" value={s.etrTipoInst} />}
        {s.etrSemestre != null && <DetailRow label="Semestre" value={String(s.etrSemestre)} />}
      </DetailSection>

      <DetailSection icon="ti-user" title="Sociodemografía">
        {edad != null && <DetailRow label="Edad" value={`${edad} años`} />}
        {s.fNac && <DetailRow label="Fecha nacimiento" value={fmtDate(s.fNac)} />}
        {s.ciudad && <DetailRow label="Ciudad" value={s.ciudad} />}
        {s.dir && <DetailRow label="Dirección" value={s.dir} />}
        {s.estrato != null && <DetailRow label="Estrato" value={String(s.estrato)} />}
        {s.etnia && <DetailRow label="Etnia" value={s.etnia} />}
        {s.asSalud && <DetailRow label="Régimen de salud" value={s.asSalud} />}
        {s.estLab && <DetailRow label="Estado laboral" value={s.estLab} />}
        {s.ingreso && <DetailRow label="Ingreso" value={s.ingreso} />}
        {s.nvEstu && <DetailRow label="Nivel educativo" value={s.nvEstu} />}
        {s.nvPosg && <DetailRow label="Posgrado" value={s.nvPosg} />}
      </DetailSection>

      <DetailSection icon="ti-stethoscope" title="Estado de salud">
        {s.perSalud && <DetailRow label="Percepción de salud" value={s.perSalud} />}
        {s.estSalud && <DetailRow label="Enfermo últimas 4 sem." value={s.estSalud} />}
        {s.prbSalud && <DetailRow label="Problema de salud" value={s.prbSalud} />}
        {s.conMed && <DetailRow label="Consultó por el problema" value={s.conMed} />}
        {s.medPrc && <DetailRow label="Medicamentos prescritos" value={s.medPrc} />}
        {s.fPrc && <DetailRow label="Fecha prescripción" value={fmtDate(s.fPrc)} />}
        {s.fDisp && <DetailRow label="Fecha dispensación" value={fmtDate(s.fDisp)} />}
        {s.indMed && <DetailRow label="Sigue indicaciones" value={s.indMed} />}
      </DetailSection>

      <DetailSection icon="ti-package" title="Almacenamiento y disposición">
        {s.medSob && <DetailRow label="Almacena sin consumir" value={s.medSob} />}
        {s.dispMedVc && <DetailRow label="Sabe qué hacer con vencidos" value={s.dispMedVc} />}
        {s.ctoDispVc && <DetailRow label="Conducta de disposición" value={s.ctoDispVc} />}
        {s.vtoMedNc && <DetailRow label="Vencidos observados" value={s.vtoMedNc} accent={s.vtoMedNc === 'Sí' ? C.amber : undefined} />}
        {s.cantMed != null && <DetailRow label="Unidades sin consumir" value={String(s.cantMed)} />}
        {s.cantMedVto != null && <DetailRow label="Unidades vencidas" value={String(s.cantMedVto)} accent={s.cantMedVto > 0 ? C.amber : undefined} />}
        {s.pesoMedNc != null && <DetailRow label="Peso total (g)" value={String(s.pesoMedNc)} />}
      </DetailSection>

      {(s.motNoConsumo?.length > 0 || s.motVencimiento?.length > 0 || s.dispFinal?.length > 0 || !!s.conocePuntos) && (
        <DetailSection icon="ti-help-circle" title="Motivos y disposición">
          {s.motNoConsumo?.length > 0 && <DetailRow label="Motivo de no consumo" value={s.motNoConsumo.join(', ')} />}
          {s.motNoConsumoOtro && <DetailRow label="— Otro" value={s.motNoConsumoOtro} />}
          {s.motVencimiento?.length > 0 && <DetailRow label="Razón de acumulación/vto." value={s.motVencimiento.join(', ')} />}
          {s.motVencimientoOtro && <DetailRow label="— Otro" value={s.motVencimientoOtro} />}
          {s.dispFinal?.length > 0 && <DetailRow label="Conducta de disposición" value={s.dispFinal.join(', ')} />}
          {s.dispFinalOtro && <DetailRow label="— Otro" value={s.dispFinalOtro} />}
          {s.conocePuntos && <DetailRow label="Conoce puntos de recolección" value={s.conocePuntos} />}
          {s.cualPunto && <DetailRow label="¿Cuál?" value={s.cualPunto} />}
        </DetailSection>
      )}

      <DetailSection icon="ti-pill" title={`Medicamentos — ${s.medications.length} producto(s)`}>
        {s.medications.length === 0 ? (
          <p style={{ color: C.hint, fontSize: 13, margin: '2px 0' }}>Sin productos registrados.</p>
        ) : (
          s.medications.map((m, i) => {
            const mx = productMetrics(s.fEta, s.fDisp, m)
            return (
              <Card key={i} style={{ marginBottom: 10, background: mx.isExpired ? C.amberLight : C.bg }}>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
                  {m.nmMed || '—'}
                </div>
                {m.dci && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Princ. activo: {m.dci}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {m.concMed != null && m.undConc && (
                    <Badge label={`${m.concMed} ${m.undConc}`} variant="gray" />
                  )}
                  {m.fVto && (
                    <Badge label={`Vence: ${fmtDate(m.fVto)}`} variant={mx.isExpired ? 'amber' : 'teal'} />
                  )}
                </div>
                {/* Time metrics (Excel logic) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
                  <MetricCell label="Días vencido" value={mx.tVto} unit="d" highlight={mx.isExpired} />
                  <MetricCell label="En bodega" value={mx.tDisp} unit="d" />
                  <MetricCell label="Vida útil" value={mx.vUtil} unit="d" />
                </div>
              </Card>
            )
          })
        )}
      </DetailSection>

      {s.obs && (
        <DetailSection icon="ti-note" title="Observaciones">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5, margin: '2px 0', whiteSpace: 'pre-wrap' }}>{s.obs}</p>
        </DetailSection>
      )}

      <DetailSection icon="ti-clipboard-data" title="Para-data / control de calidad">
        {s.backcheckOf && <DetailRow label="Back-check" value="Re-entrevista de control" accent={C.teal} />}
        {s.startedAt && <DetailRow label="Inicio de captura" value={fmtTimestamp(s.startedAt)} />}
        {s.createdAt && <DetailRow label="Guardada" value={fmtTimestamp(s.createdAt)} />}
        {durSec != null && <DetailRow label="Duración" value={fmtDur(durSec)} accent={durSec < 120 ? C.amber : undefined} />}
        {s.updatedAt && s.updatedAt !== s.createdAt && <DetailRow label="Última edición" value={fmtTimestamp(s.updatedAt)} />}
        {s.dataEnv && <DetailRow label="Ambiente" value={s.dataEnv === 'prod' ? 'Producción' : 'Piloto'} />}
        {s.syncStatus && <DetailRow label="Sincronización" value={s.syncStatus} />}
      </DetailSection>
    </Dialog>
  )
}

// Label/value row for the survey inspector — quiet label, ink value.
function DetailRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12,
      padding: '5px 0', borderBottom: `0.5px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: accent ?? C.text, fontWeight: 500, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}

// Titled group of rows in the survey inspector.
function DetailSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 15, color: C.teal }} aria-hidden />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function MetricCell({ label, value, unit, highlight }: {
  label: string; value: number | null; unit: string; highlight?: boolean
}) {
  return (
    <div style={{
      textAlign: 'center', padding: '6px 4px', borderRadius: 6,
      background: highlight ? C.amberLight : C.surface,
      border: `0.5px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: highlight ? C.amber : C.text }}>
        {value != null ? `${value} ${unit}` : '—'}
      </div>
    </div>
  )
}

// ─── BUSCAR PAGE ──────────────────────────────────────────────────────────

export function BuscarPage() {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const { results, loading, error, searched, search } = useCUM()

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text || '').catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div>
      <TopBar title="Buscador CUM-INVIMA" subtitle="Catálogo de medicamentos" icon="ti-search" accent={C.navy} />
      <div className="page-content narrow">
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && query.trim().length >= 3 && search(query)}
            placeholder="Nombre comercial o principio activo…"
          />
          <Button
            disabled={loading || query.trim().length < 3}
            onClick={() => search(query)}
            icon={loading ? 'ti-loader-2' : 'ti-search'}
            style={{ flexShrink: 0, paddingLeft: 14, paddingRight: 14 }}
          >
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
        <p style={{ fontSize: 12, color: C.hint, marginBottom: 14 }}>
          Solo medicamentos con registro <strong>Vigente</strong> en INVIMA. Requiere internet.
        </p>

        {error && (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ textAlign: 'center', padding: '16px 0', color: C.amber }}>
              <i className="ti ti-wifi-off" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} aria-hidden />
              <span style={{ fontSize: 13 }}>{error}</span>
            </div>
          </Card>
        )}

        {searched && !error && results.length === 0 && (
          <p style={{ color: C.muted, fontSize: 13 }}>Sin resultados para "{query}".</p>
        )}

        {results.map((r, i) => (
          <Card key={i} className="lift" style={{ marginBottom: 10 }}>
            <div className="fd" style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4, letterSpacing: '-0.01em' }}>{r.producto || '—'}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
              DCI: {r.principioactivo || '—'} · {r.concentracion || ''}{r.unidadmedida || ''} · {r.formafarmaceutica || '—'}
              {r.viaadministracion && ` · ${r.viaadministracion}`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { key: `${i}-nm`,   val: r.producto,        label: 'Nombre' },
                { key: `${i}-dci`,  val: r.principioactivo, label: 'DCI' },
                { key: `${i}-conc`, val: r.concentracion,   label: 'Concentración' },
                { key: `${i}-unit`, val: r.unidadmedida,    label: 'Unidad' },
              ].map(({ key, val, label }) => (
                <button
                  key={key}
                  onClick={() => val && copy(val, key)}
                  disabled={!val}
                  style={{
                    fontSize: 11, minHeight: 36, padding: '8px 12px', borderRadius: 20, cursor: val ? 'pointer' : 'not-allowed',
                    border: `0.5px solid ${copied === key ? '#BBF7D0' : C.border}`,
                    background: copied === key ? '#DCFCE7' : C.bg,
                    color: copied === key ? C.green : C.muted,
                    opacity: val ? 1 : 0.4,
                  }}
                >
                  <i className={`ti ${copied === key ? 'ti-check' : 'ti-copy'}`} style={{ fontSize: 12, marginRight: 4 }} aria-hidden />
                  {copied === key ? 'Copiado' : label}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── EXPORT PAGE ──────────────────────────────────────────────────────────

export function ExportarPage() {
  const { surveys } = useStore()
  const n = surveys.length
  const disabled = n === 0

  return (
    <div>
      <TopBar title="Exportar datos" subtitle="CSV · JSON · codebook" icon="ti-download" accent={C.green} />
      <div className="page-content narrow">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
          {n} registro{n !== 1 ? 's' : ''} en sesión actual.
          Los datos persisten en IndexedDB del navegador y sobreviven cierres de pestaña.
        </p>

        <Card className="lift" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <IconChip icon="ti-file-spreadsheet" accent={C.green} />
            <div>
              <div className="fd" style={{ fontWeight: 600, fontSize: 14.5 }}>Exportar CSV</div>
              <div style={{ fontSize: 12, color: C.muted }}>Columnas del codebook · Compatible con Excel, SPSS, R, Stata · UTF-8 BOM</div>
            </div>
          </div>
          <Button
            fullWidth disabled={disabled}
            style={{ background: disabled ? C.bg : '#3B6D11', color: disabled ? C.hint : '#fff', border: 'none' }}
            icon="ti-download"
            onClick={() => downloadBlob(toCSV(surveys), `MEDD_${dateTag()}.csv`, 'text/csv;charset=utf-8')}
          >
            Descargar .csv
          </Button>
          <Button
            fullWidth variant="ghost"
            style={{ marginTop: 8 }}
            icon="ti-book-2"
            onClick={() => downloadBlob(toCodebookCSV(), `MEDD_codebook_${dateTag()}.csv`, 'text/csv;charset=utf-8')}
          >
            Descargar diccionario (codebook)
          </Button>
        </Card>

        <Card className="lift">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <IconChip icon="ti-braces" accent={C.navy} />
            <div>
              <div className="fd" style={{ fontWeight: 600, fontSize: 14.5 }}>Exportar JSON</div>
              <div style={{ fontSize: 12, color: C.muted }}>Estructura completa con array de medicamentos · Para procesamiento programático</div>
            </div>
          </div>
          <Button
            fullWidth disabled={disabled}
            style={{ background: disabled ? C.bg : '#1D4ED8', color: disabled ? C.hint : '#fff', border: 'none' }}
            icon="ti-download"
            onClick={() => downloadBlob(JSON.stringify(surveys, null, 2), `MEDD_${dateTag()}.json`, 'application/json')}
          >
            Descargar .json
          </Button>
        </Card>
      </div>
    </div>
  )
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────

export function AjustesPage() {
  const { settings, persistSettings, surveys, user, userRole, signOut, syncing, triggerSync, backfillProfile, openWelcome, theme, toggleTheme, density, setDensity } = useStore()
  const [form, setForm] = useState(settings)
  const set = (k: keyof Settings) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const isInvestigador = userRole === 'investigador'
  const pendingCount   = surveys.filter(s => s.syncStatus !== 'synced').length
  // Surveys captured before the profile was complete that can be backfilled.
  // Only meaningful for encuestadores with a now-complete profile.
  const backfillCount  = (!isInvestigador && isProfileComplete(settings))
    ? surveys.filter(surveyMissingProfile).length
    : 0

  return (
    <div>
      <TopBar
        title="Ajustes"
        subtitle={isInvestigador ? 'Apariencia y cuenta' : 'Proyecto y perfil'}
        icon="ti-settings" accent={C.gray}
      />
      <div className="page-content narrow">
        {/* Project config and the surveyor profile only apply to encuestadores:
            the profile is stamped onto captured surveys and the surveyor id is
            prefilled into new ones. An investigador is a read-only analyst who
            never captures, so prompting them for a surveyor profile is wrong. */}
        {!isInvestigador && (
          <>
            <ProjectConfigSection form={form} set={set} />

            <SurveyorProfileSection
              form={form}
              set={set}
              onSave={() => persistSettings(form)}
              backfillCount={backfillCount}
              onBackfill={() => backfillProfile()}
            />

            <Divider label="apariencia" />
          </>
        )}
        <AppearanceSection
          theme={theme}
          toggleTheme={toggleTheme}
          density={density}
          setDensity={setDensity}
          onShowWelcome={() => openWelcome()}
        />

        <Divider label="cuenta" />
        <AccountSection
          userEmail={user?.email ?? '—'}
          isInvestigador={isInvestigador}
          pendingCount={pendingCount}
          syncing={syncing}
          onSync={() => triggerSync()}
          onSignOut={() => signOut()}
        />

        <Divider label="información" />
        <AppInfoSection surveyCount={surveys.length} />
      </div>
    </div>
  )
}
