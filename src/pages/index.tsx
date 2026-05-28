import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
} from 'recharts'
import { TopBar, StepBar } from '../components/layout'
import {
  StatCard, Card, Button, Badge, EmptyState, Divider,
  Field, SectionHead, C, Chip, ChipGroup,
} from '../components/ui'
import { Step1, Step2, Step3, Step4, Step5, Step6 } from '../components/survey/Steps'
import { useStore } from '../lib/store'
import { useCUM } from '../hooks/useCUM'
import { freqTable, pct, calcEdad, fmtDate, fmtTimestamp, toCSV, downloadBlob, dateTag } from '../lib/utils'
import { OPT, TOTAL_STEPS } from '../lib/constants'
import type { SurveyDraft } from '../types'

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { surveys, openWizard } = useStore()
  const n = surveys.length

  const nSob  = surveys.filter(s => s.medSob   === 'Sí').length
  const nVenc = surveys.filter(s => s.hayVenc   === 'Sí').length
  const nDisp = surveys.filter(s => s.dispVenc  === 'Sí').length
  const peso  = surveys.reduce((a, s) => a + (s.pesoMed ?? 0), 0)

  const barEps  = freqTable(surveys, 'eps',   OPT.eps).filter(d => d.n > 0)
  const barEduc = freqTable(surveys, 'educ',  OPT.educ).filter(d => d.n > 0)
  const barEtnia= freqTable(surveys, 'etnia', OPT.etnia).filter(d => d.n > 0)

  const tipStyle = {
    background: C.surface, border: `0.5px solid ${C.border}`,
    borderRadius: 6, padding: '5px 9px', fontSize: 12,
  }
  const CustomTip = ({ active, payload }: any) =>
    active && payload?.length
      ? <div style={tipStyle}><strong>{payload[0].payload.name}</strong>: {payload[0].value}</div>
      : null

  const MiniDonut = ({
    val, outOf, label, color,
  }: { val: number; outOf: number; label: string; color: string }) => {
    const data = [{ v: val }, { v: Math.max(0, outOf - val) }]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <PieChart width={72} height={72}>
          <Pie data={data} cx={36} cy={36} innerRadius={22} outerRadius={34} dataKey="v" stroke="none">
            <Cell fill={color} />
            <Cell fill="#E2E8F0" />
          </Pie>
        </PieChart>
        <span style={{ fontSize: 16, fontWeight: 500, color }}>{pct(val, outOf)}%</span>
        <span style={{ fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
        <span style={{ fontSize: 10, color: C.hint }}>{val}/{outOf}</span>
      </div>
    )
  }

  if (n === 0) {
    return (
      <div>
        <TopBar title="MEDD · Panel analítico" />
        <div className="page-content">
          <EmptyState
            icon="ti-clipboard-data"
            title="Sin encuestas aún"
            description="Comience registrando la primera encuesta con el botón + de la barra inferior."
            action={
              <Button onClick={() => openWizard(0)} icon="ti-plus">
                Registrar primera encuesta
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="MEDD · Panel analítico" />
      <div className="page-content">

        {/* KPIs */}
        <p style={{ fontSize: 11, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Indicadores clave · {n} encuesta{n !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <StatCard icon="ti-users"           label="Total encuestados"      value={n}                           color={C.navy} />
          <StatCard icon="ti-pill"            label="Med. sin consumir"       value={nSob}  sub={`${pct(nSob,n)}%`}  color={C.teal} />
          <StatCard icon="ti-alert-triangle"  label="Vencidos confirmados"    value={nVenc} sub={`${pct(nVenc,n)}%`} color={C.amber} />
          <StatCard icon="ti-scale"           label="Peso total (g)"          value={peso.toFixed(1)}             color={C.gray} />
        </div>

        {/* Donuts */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Variables clave de resultado
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <MiniDonut val={nDisp} outOf={n} label="Conoce disposición" color={C.teal} />
            <MiniDonut val={nSob}  outOf={n} label="Med. sin consumir"  color={C.navy} />
            <MiniDonut val={nVenc} outOf={n} label="Vencidos conf."     color={C.amber} />
          </div>
        </Card>

        {/* EPS chart */}
        {barEps.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Distribución por régimen EPS
            </div>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barEps} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill={C.teal} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Educación chart */}
        {barEduc.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Distribución por nivel de estudios
            </div>
            <div style={{ height: 155 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barEduc} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={105} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill={C.navy} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Etnia chart */}
        {barEtnia.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Distribución por etnia
            </div>
            <div style={{ height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barEtnia} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill="#7030A0" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── WIZARD PAGE ──────────────────────────────────────────────────────────────

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

  const stepProps = {
    draft,
    onNext: handleNext,
    onBack: handleBack,
    isFirst: step === 1,
    isLast: step === TOTAL_STEPS,
  }

  return (
    <div>
      <TopBar
        title={editingId ? 'Editar encuesta' : 'Nueva encuesta'}
        actions={
          <button
            aria-label="Cancelar"
            onClick={closeWizard}
            style={{ width: 34, height: 34, borderRadius: 8, border: `0.5px solid ${C.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}
          >
            <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden />
          </button>
        }
      />
      <StepBar currentStep={step} />
      <div className="page-content" style={{ paddingBottom: 24 }}>
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

// ─── ENCUESTAS PAGE ───────────────────────────────────────────────────────────

export function EncuestasPage() {
  const { surveys, removeSurvey, openEditWizard, openWizard } = useStore()
  const [filter, setFilter] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!filter.trim()) return surveys
    const q = filter.toLowerCase()
    return surveys.filter(s =>
      s.nui.includes(q) ||
      s.nmMed?.toLowerCase().includes(q) ||
      s.dci?.toLowerCase().includes(q) ||
      s.eps?.toLowerCase().includes(q)
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
              placeholder="Buscar por N°, medicamento, DCI, EPS…"
            />
          </div>
        )}

        {surveys.length === 0 ? (
          <EmptyState
            icon="ti-clipboard-list"
            title="Sin registros"
            description="Cuando registres encuestas aparecerán aquí."
            action={
              <Button onClick={() => openWizard(0)} icon="ti-plus">
                Primera encuesta
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
            Sin resultados para "{filter}".
          </p>
        ) : (
          filtered.map(sv => {
            const edad = calcEdad(sv.fechaNac)
            return (
              <Card key={sv.id} style={{ marginBottom: 10 }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.teal }}>#{sv.nui}</span>
                    <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{fmtDate(sv.fechaEncuesta)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {sv.medSob  === 'Sí' && <Badge label="Med. almac." variant="teal" />}
                    {sv.hayVenc === 'Sí' && <Badge label="Vencidos"    variant="amber" />}
                  </div>
                </div>

                {/* Data grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', fontSize: 12, marginBottom: 8 }}>
                  {edad !== null && <span style={{ color: C.muted }}>Edad: <strong>{edad} años</strong></span>}
                  {sv.eps     && <span style={{ color: C.muted }}>EPS: <strong>{sv.eps}</strong></span>}
                  {sv.medSob === 'Sí' && (
                    <>
                      <span style={{ color: C.muted }}>Cant: <strong>{sv.cantMed ?? '—'}</strong></span>
                      {sv.pesoMed != null && <span style={{ color: C.muted }}>Peso: <strong>{sv.pesoMed}g</strong></span>}
                    </>
                  )}
                </div>

                {/* Medication pill */}
                {(sv.nmMed || sv.dci) && (
                  <div style={{ padding: '6px 8px', background: C.bg, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
                    <i className="ti ti-pill" style={{ fontSize: 12, marginRight: 5, color: C.teal }} aria-hidden />
                    {sv.nmMed && <strong>{sv.nmMed}</strong>}
                    {sv.nmMed && sv.dci && ' · '}
                    {sv.dci && <span style={{ color: C.muted }}>{sv.dci}</span>}
                    {sv.concMed != null && sv.undConc && <span style={{ color: C.hint }}> · {sv.concMed} {sv.undConc}</span>}
                  </div>
                )}

                {/* Actions */}
                {confirmId === sv.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>¿Eliminar esta encuesta?</span>
                    <Button size="sm" variant="danger" onClick={() => { removeSurvey(sv.id); setConfirmId(null) }}>
                      Sí, eliminar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button size="sm" variant="ghost" icon="ti-edit" onClick={() => openEditWizard(sv)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" icon="ti-trash"
                      style={{ color: C.red, borderColor: `${C.red}50` }}
                      onClick={() => setConfirmId(sv.id)}>
                      Eliminar
                    </Button>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── BUSCAR PAGE ──────────────────────────────────────────────────────────────

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
      <div className="page-content">
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
                { key: `${i}-nm`,   val: r.producto,         label: 'Copiar nombre → col Y' },
                { key: `${i}-dci`,  val: r.principioactivo,  label: 'Copiar DCI → col Z' },
                { key: `${i}-conc`, val: r.concentracion,    label: 'Copiar conc. → col AA' },
                { key: `${i}-unit`, val: r.unidadmedida,     label: 'Copiar unidad → col AB' },
              ].map(({ key, val, label }) => (
                <button
                  key={key}
                  onClick={() => val && copy(val, key)}
                  disabled={!val}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: val ? 'pointer' : 'not-allowed',
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

// ─── EXPORT PAGE ──────────────────────────────────────────────────────────────

export function ExportarPage() {
  const { surveys } = useStore()
  const n = surveys.length
  const disabled = n === 0

  return (
    <div>
      <TopBar title="Exportar datos" />
      <div className="page-content">
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
              <div style={{ fontSize: 12, color: C.muted }}>Compatible con Excel, SPSS, R, Stata · UTF-8 BOM</div>
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
              <div style={{ fontSize: 12, color: C.muted }}>Estructura completa · Para procesamiento programático</div>
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

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────

export function AjustesPage() {
  const { settings, persistSettings, surveys } = useStore()
  const [form, setForm] = useState(settings)
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <TopBar title="Ajustes" />
      <div className="page-content">
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

        <Field label="N° de identificación del encuestador (predeterminado)">
          <input
            value={form.nuiEncuestador}
            onChange={e => set('nuiEncuestador')(e.target.value)}
            placeholder="Se prellena en cada nueva encuesta"
          />
        </Field>

        <Button fullWidth onClick={() => persistSettings(form)} icon="ti-device-floppy">
          Guardar ajustes
        </Button>

        <Divider label="información" />

        <Card style={{ background: C.bg }}>
          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Encuestas almacenadas</span>
              <strong>{surveys.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Almacenamiento</span>
              <span>IndexedDB (local)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Versión</span>
              <span>1.0.0</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
