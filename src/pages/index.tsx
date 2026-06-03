import React, { useState, useMemo } from 'react'
import { TopBar, StepBar } from '../components/layout'
import {
  Card, Button, Badge, EmptyState, Divider,
  Field, SectionHead, Dialog, C,
} from '../components/ui'
import { Step1, Step2, Step3, Step4, Step5, Step6 } from '../components/survey/Steps'
import { useStore } from '../lib/store'
import { useCUM } from '../hooks/useCUM'
import {
  calcEdad, fmtDate,
  toCSV, downloadBlob, dateTag, productMetrics,
} from '../lib/utils'
import { TOTAL_STEPS } from '../lib/constants'
import type { SurveyDraft, Survey } from '../types'

// DashboardPage lives in its own lazily-loaded chunk (pages/Dashboard.tsx) to
// keep Recharts out of the initial bundle; App.tsx imports it via React.lazy.

// ─── WIZARD PAGE ──────────────────────────────────────────────────────────

export function WizardPage() {
  const { wizard, setWizardStep, updateDraft, closeWizard, addSurvey, updateSurvey } = useStore()
  if (!wizard) return null
  const { step, draft, editingId } = wizard

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
        title={editingId ? 'Editar encuesta' : 'Nueva encuesta'}
        actions={
          <button
            aria-label="Cancelar"
            onClick={closeWizard}
            style={{ width: 40, height: 40, borderRadius: 8, border: `0.5px solid ${C.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}
          >
            <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden />
          </button>
        }
      />
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

// ─── ENCUESTAS PAGE ───────────────────────────────────────────────────────

export function EncuestasPage() {
  const { surveys, removeSurvey, openEditWizard, openWizard, userRole } = useStore()
  const isInvestigador = userRole === 'investigador'
  const [filter, setFilter]     = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [detail, setDetail]     = useState<Survey | null>(null)

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
      <TopBar title="Registros" />
      <div className="page-content">
        {surveys.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar por N°, ciudad, medicamento, DCI…"
            />
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
        {surveys.length > 0 && filtered.length > 0 && (
          <div className="records-grid">
          {filtered.map(sv => {
            const edad = calcEdad(sv.fEta, sv.fNac)
            const expiredMeds = sv.medications?.filter(m => {
              const mx = productMetrics(sv.fEta, sv.fDisp, m)
              return mx.isExpired
            }).length ?? 0

            return (
              <Card key={sv.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.teal }}>#{String(sv.nui).padStart(3, '0')}</span>
                    <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{fmtDate(sv.fEta)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {sv.ciudad && <Badge label={sv.ciudad} variant="gray" />}
                    {sv.medSob   === 'Sí' && <Badge label="Med. almac."  variant="teal" />}
                    {sv.vtoMedNc === 'Sí' && <Badge label="Vencidos"     variant="amber" />}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', fontSize: 12, marginBottom: 8 }}>
                  {edad !== null && <span style={{ color: C.muted }}>Edad: <strong>{edad} años</strong></span>}
                  {sv.estrato   && <span style={{ color: C.muted }}>Estrato: <strong>{sv.estrato}</strong></span>}
                  {sv.asSalud   && <span style={{ color: C.muted }}>Salud: <strong>{sv.asSalud}</strong></span>}
                  {sv.cantMed != null && sv.medSob === 'Sí' && (
                    <span style={{ color: C.muted }}>Sin consumir: <strong>{sv.cantMed}</strong></span>
                  )}
                  {sv.cantMedVto != null && sv.cantMedVto > 0 && (
                    <span style={{ color: C.amber }}>Vencidos: <strong>{sv.cantMedVto}</strong></span>
                  )}
                  {sv.pesoMedNc != null && (
                    <span style={{ color: C.muted }}>Peso: <strong>{sv.pesoMedNc}g</strong></span>
                  )}
                </div>

                {sv.medications?.length > 0 && (
                  <div style={{ padding: '6px 8px', background: C.bg, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
                    <i className="ti ti-pill" style={{ fontSize: 12, marginRight: 5, color: C.teal }} aria-hidden />
                    <strong>{sv.medications.length}</strong> producto(s) registrado(s)
                    {expiredMeds > 0 && (
                      <span style={{ marginLeft: 8, color: C.amber }}>· {expiredMeds} vencido(s)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetail(sv)}
                      style={{ marginLeft: 10, background: 'none', border: 'none', color: C.teal, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Ver detalle
                    </button>
                  </div>
                )}

                {/* Edit/delete only for the owner (encuestadores with their own surveys) */}
                {!isInvestigador && (
                  confirmId === sv.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
                      <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>¿Eliminar esta encuesta?</span>
                      <Button size="sm" variant="danger" onClick={() => { removeSurvey(sv.id); setConfirmId(null) }}>
                        Sí, eliminar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 4 }}>
                      <Button size="sm" variant="ghost" icon="ti-edit" onClick={() => openEditWizard(sv)}>
                        Editar
                      </Button>
                      <Button
                        size="sm" variant="ghost" icon="ti-trash"
                        style={{ color: C.red, borderColor: `${C.red}50` }}
                        onClick={() => setConfirmId(sv.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  )
                )}
              </Card>
            )
          })}
          </div>
        )}
      </div>

      {/* Medication detail modal */}
      {detail && (
        <MedDetailModal survey={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function MedDetailModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  return (
    <Dialog
      title={`Encuesta #${String(survey.nui).padStart(3, '0')} — Medicamentos`}
      onClose={onClose}
    >
      {survey.medications.length === 0 ? (
        <p style={{ color: C.hint, fontSize: 13 }}>Sin productos registrados.</p>
      ) : (
        survey.medications.map((m, i) => {
          const mx = productMetrics(survey.fEta, survey.fDisp, m)
          return (
            <Card key={i} style={{ marginBottom: 10, background: mx.isExpired ? '#FEF3C7' : C.bg }}>
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
    </Dialog>
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
      <TopBar title="Buscador CUM-INVIMA" />
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
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{r.producto || '—'}</div>
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
      <TopBar title="Exportar datos" />
      <div className="page-content narrow">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
          {n} registro{n !== 1 ? 's' : ''} en sesión actual.
          Los datos persisten en IndexedDB del navegador y sobreviven cierres de pestaña.
        </p>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-file-spreadsheet" style={{ fontSize: 20, color: '#3B6D11' }} aria-hidden />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Exportar CSV</div>
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
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-braces" style={{ fontSize: 20, color: '#1D4ED8' }} aria-hidden />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Exportar JSON</div>
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
  const { settings, persistSettings, surveys, user, userRole, signOut, syncing, triggerSync, theme, toggleTheme } = useStore()
  const [form, setForm] = useState(settings)
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const isInvestigador = userRole === 'investigador'
  const pendingCount   = surveys.filter(s => s.syncStatus !== 'synced').length

  return (
    <div>
      <TopBar title="Ajustes" />
      <div className="page-content narrow">
        <SectionHead icon="ti-settings" label="Configuración del proyecto" />

        <Field label="Nombre del proyecto">
          <input
            value={form.nombreProyecto}
            onChange={e => set('nombreProyecto')(e.target.value)}
            placeholder="MEDD – Medicamentos No Utilizados"
          />
        </Field>

        <Field label="Institución(es) participantes">
          <input
            value={form.instituciones}
            onChange={e => set('instituciones')(e.target.value)}
            placeholder="Ej: Universidad X — Programa Regencia en Farmacia"
          />
        </Field>

        <Field label="ID del encuestador" hint="Se prellena en cada nueva encuesta">
          <input
            type="number" min={1}
            value={form.nuiEncuestador}
            onChange={e => set('nuiEncuestador')(e.target.value)}
            placeholder="Ej: 1012345678"
          />
        </Field>

        <Button fullWidth onClick={() => persistSettings(form)} icon="ti-device-floppy">
          Guardar ajustes
        </Button>

        <Divider label="apariencia" />

        <Card style={{ background: C.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: C.tealLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`ti ${theme === 'dark' ? 'ti-moon' : 'ti-sun'}`} style={{ fontSize: 19, color: C.teal }} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Tema {theme === 'dark' ? 'oscuro' : 'claro'}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Ajusta la app a tu entorno de trabajo.</div>
            </div>
            <button
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label="Alternar tema oscuro"
              onClick={toggleTheme}
              style={{
                width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: theme === 'dark' ? C.primary : C.border, flexShrink: 0,
                position: 'relative', transition: 'background 0.18s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: theme === 'dark' ? 25 : 3,
                width: 24, height: 24, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.18s',
              }} />
            </button>
          </div>
        </Card>

        <Divider label="cuenta" />

        <Card style={{ background: C.bg }}>
          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
            <InfoRow label="Sesión activa" value={user?.email ?? '—'} />
            <InfoRow
              label="Rol"
              value={
                <span style={{
                  background: isInvestigador ? '#EFF6FF' : '#F0FDF9',
                  color:      isInvestigador ? '#1D4ED8' : '#0F766E',
                  border:     `0.5px solid ${isInvestigador ? '#BFDBFE' : '#99F6E4'}`,
                  borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                }}>
                  {isInvestigador ? 'Investigador' : 'Encuestador'}
                </span>
              }
            />
            <InfoRow
              label="Encuestas pendientes de sync"
              value={pendingCount > 0 ? `${pendingCount} local(es)` : 'Al día'}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button
              onClick={() => triggerSync()}
              icon={syncing ? 'ti-loader-2' : 'ti-cloud-upload'}
              style={{ flex: 1 }}
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
            <Button
              onClick={() => signOut()}
              icon="ti-logout"
              style={{ flex: 1, background: '#FEE2E2', color: '#B91C1C' }}
            >
              Cerrar sesión
            </Button>
          </div>
        </Card>

        <Divider label="información" />

        <Card style={{ background: C.bg }}>
          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
            <InfoRow label="Encuestas almacenadas" value={surveys.length} />
            <InfoRow label="Almacenamiento" value="IndexedDB + Supabase" />
            <InfoRow label="Versión esquema" value="2.0 (codebook-aligned)" />
          </div>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: C.muted }}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
