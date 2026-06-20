import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
} from 'recharts'
import { TopBar } from '../components/layout'
import { StatCard, Card, Button, EmptyState, Chip, C, CHART } from '../components/ui'
import { useStore } from '../lib/store'
import { useShallow } from 'zustand/react/shallow'
import { pct, wilsonCI, prevalenceRatio, chiSquareTest, cochranArmitage, mantelHaenszelRR, iccBinary, breslowDay, quantile, productMetrics, toCSV, downloadBlob, dateTag, holmAdjust, terminalDigitTest, cohenKappa, type Proportion, type RiskRatio, type ChiSquare, type TrendTest, type MHResult, type ICCResult, type Stratum2x2, type HolmResult, type DigitTest, type KappaResult } from '../lib/utils'
import { OPT } from '../lib/constants'
import { declaresExpiredWithoutDetail } from '../lib/quality'
import { therapeuticGroup, therapeuticSubgroup, SIN_CLASIFICAR } from '../lib/atc'
import type { Survey } from '../types'

// ─── DASHBOARD ────────────────────────────────────────────────────────────
// Split into its own lazily-loaded chunk: Recharts is heavy and only this view
// uses it, so it must not weigh down the initial bundle (see App.tsx Suspense).

// Chart helpers declared at module scope (not inside DashboardPage's render)
// so they keep a stable identity across renders — see react-hooks/static-components.
const tipStyle = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 9, padding: '7px 11px', fontSize: 12,
  boxShadow: '0 8px 24px -8px rgba(14, 23, 38, 0.22)',
}

const CustomTip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { name: string } }> }) =>
  active && payload?.length
    ? <div style={tipStyle}><strong>{payload[0].payload.name}</strong>: {payload[0].value}</div>
    : null

const MiniDonut = ({ val, outOf, label, color }: { val: number; outOf: number; label: string; color: string }) => {
  const data = [{ v: val }, { v: Math.max(0, outOf - val) }]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <PieChart width={72} height={72}>
        <Pie data={data} cx={36} cy={36} innerRadius={22} outerRadius={34} dataKey="v" stroke="none" cornerRadius={4} paddingAngle={data[0].v > 0 && data[1].v > 0 ? 2 : 0}>
          <Cell fill={color} />
          <Cell fill={CHART.track} />
        </Pie>
      </PieChart>
      <span className="fd tnum" style={{ fontSize: 18, fontWeight: 600, color }}>{pct(val, outOf)}%</span>
      <span style={{ fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
      <span style={{ fontSize: 11, color: C.hint }}>{val}/{outOf}</span>
    </div>
  )
}

// Horizontal distribution bars — one component for the six near-identical
// category charts. Premium touches applied once: gradient bar fill, rounded
// caps, clean axes (no spines/ticks), capped bar thickness.
function DistBar({ data, dataKey = 'n', color, yWidth = 80, barName }: {
  data: Array<Record<string, string | number>>
  dataKey?: string
  color: string
  yWidth?: number
  barName?: string
}) {
  const gid = `bar-${color.replace('#', '')}`
  return (
    <div style={{ height: Math.max(80, data.length * 30) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <XAxis type="number" tick={{ fontSize: 11, fill: CHART.axis }} allowDecimals={false} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} width={yWidth} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTip />} cursor={{ fill: CHART.track }} />
          <Bar dataKey={dataKey} fill={`url(#${gid})`} radius={[0, 5, 5, 0]} maxBarSize={26} name={barName} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DashboardPage() {
  // ⚡ Bolt: subscribe only to the slices this view needs (via useShallow) instead
  // of the whole store. The Dashboard is the heaviest view to render (≈6 Recharts
  // ResponsiveContainers + 3 PieCharts), and a bare `useStore()` re-rendered all of
  // them on *any* state change — notably every transient toast push/auto-remove
  // (e.g. the "Sincronizado…" toast after a background sync) and every `syncing`
  // toggle, none of which affect the charts. Selecting only these fields lets the
  // whole chart tree bail out of those unrelated re-renders (actions are stable
  // refs; data fields compared shallowly).
  const { surveys, openWizard, userRole, setView, pendingDraft, resumeDraft } = useStore(
    useShallow(s => ({
      surveys: s.surveys,
      openWizard: s.openWizard,
      userRole: s.userRole,
      setView: s.setView,
      pendingDraft: s.pendingDraft,
      resumeDraft: s.resumeDraft,
    })),
  )
  const isInvestigador = userRole === 'investigador'

  // Investigator cockpit filters (encuestadores see only their own data, unfiltered)
  const [fCiudad, setFCiudad]   = useState('')
  const [fSalud, setFSalud]     = useState('')
  const [fEstrato, setFEstrato] = useState<number | null>(null)
  const [fProg, setFProg]       = useState('')
  const [fTipo, setFTipo]       = useState('')
  const filtersActive = isInvestigador && (!!fCiudad || !!fSalud || fEstrato !== null || !!fProg || !!fTipo)
  const clearFilters = () => { setFCiudad(''); setFSalud(''); setFEstrato(null); setFProg(''); setFTipo('') }

  // Cities present in the data, for the filter dropdown.
  const ciudadOptions = useMemo(
    () => Array.from(new Set(surveys.map(s => s.ciudad).filter(Boolean))).sort() as string[],
    [surveys],
  )
  // Surveyor academic programs present in the data.
  const progOptions = useMemo(
    () => Array.from(new Set(surveys.map(s => s.etrPrograma).filter(Boolean))).sort() as string[],
    [surveys],
  )

  const data = useMemo(() => {
    if (!isInvestigador) return surveys
    return surveys.filter(s =>
      (!fCiudad || s.ciudad === fCiudad) &&
      (!fSalud || s.asSalud === fSalud) &&
      (fEstrato === null || s.estrato === fEstrato) &&
      (!fProg || s.etrPrograma === fProg) &&
      (!fTipo || s.etrTipoInst === fTipo)
    )
  }, [surveys, isInvestigador, fCiudad, fSalud, fEstrato, fProg, fTipo])

  const n = data.length

  const {
    nSob, nVenc, nDisp, pesoTotal, unidTotal, vencTotal, totalMeds,
    barAsSalud, barNvEstu, barNvPosg, barEtnia, barEstrato, ciudadVenc
  } = useMemo(() => {
    let nSob = 0, nVenc = 0, nDisp = 0
    let pesoTotal = 0, unidTotal = 0, vencTotal = 0, totalMeds = 0

    const asSaludCounts: Record<string, number> = {}
    const nvEstuCounts: Record<string, number> = {}
    const nvPosgCounts: Record<string, number> = {}
    const etniaCounts: Record<string, number> = {}
    const estratoCounts: Record<number, number> = {}
    const ciudadVencMap = new Map<string, number>()

    // ⚡ Bolt: Single pass for scalar KPIs and distributions (reduces 21+ array passes to 1)
    for (let i = 0; i < data.length; i++) {
      const s = data[i]
      if (s.medSob === 'Sí') nSob++
      if (s.vtoMedNc === 'Sí') nVenc++
      if (s.dispMedVc === 'Sí') nDisp++
      pesoTotal += s.pesoMedNc ?? 0
      unidTotal += s.cantMed ?? 0
      vencTotal += s.cantMedVto ?? 0
      totalMeds += s.medications?.length ?? 0

      if (s.asSalud) asSaludCounts[s.asSalud] = (asSaludCounts[s.asSalud] || 0) + 1
      if (s.nvEstu) nvEstuCounts[s.nvEstu] = (nvEstuCounts[s.nvEstu] || 0) + 1
      if (s.nvPosg) nvPosgCounts[s.nvPosg] = (nvPosgCounts[s.nvPosg] || 0) + 1
      if (s.etnia) etniaCounts[s.etnia] = (etniaCounts[s.etnia] || 0) + 1
      if (s.estrato !== null && s.estrato !== undefined) estratoCounts[s.estrato] = (estratoCounts[s.estrato] || 0) + 1

      const ciudadKey = String(s.ciudad ?? 'Sin dato') || 'Sin dato'
      ciudadVencMap.set(ciudadKey, (ciudadVencMap.get(ciudadKey) ?? 0) + (s.cantMedVto ?? 0))
    }

    const barAsSalud = OPT.asSalud.map(v => ({ name: v, n: asSaludCounts[v] || 0 })).filter(d => d.n > 0)
    const barNvEstu  = OPT.nvEstu.map(v => ({ name: v, n: nvEstuCounts[v] || 0 })).filter(d => d.n > 0)
    const barNvPosg  = OPT.nvPosg.map(v => ({ name: v, n: nvPosgCounts[v] || 0 })).filter(d => d.n > 0)
    const barEtnia   = OPT.etnia.map(v => ({ name: v, n: etniaCounts[v] || 0 })).filter(d => d.n > 0)
    const barEstrato = OPT.estrato.map(e => ({ name: `Estrato ${e}`, n: estratoCounts[e] || 0 })).filter(d => d.n > 0)

    const ciudadVenc = Array.from(ciudadVencMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .filter(d => d.name && d.name !== 'Sin dato')
      .slice(0, 8)

    return {
      nSob, nVenc, nDisp, pesoTotal, unidTotal, vencTotal, totalMeds,
      barAsSalud, barNvEstu, barNvPosg, barEtnia, barEstrato, ciudadVenc
    }
  }, [data])

  const assoc = useMemo(() => buildEstratoAssociation(data), [data])
  const retention = useMemo(() => buildRetention(data), [data])
  const surveyorEffect = useMemo(() => buildSurveyorEffect(data), [data])
  const surveyorQC = useMemo(() => buildSurveyorQC(data), [data])
  // Product-level (medications[]) aggregation — the analytics that were missing.
  const medStats = useMemo(() => buildMedicationStats(data), [data])
  // Motives battery (instrument v2) — denominator scoped to records that were
  // actually asked, keeping "not asked" (v1) out of the percentages.
  const motiveStats = useMemo(() => buildMotiveStats(data), [data])
  // Records that declare expired meds in the home but carry no expired-product
  // detail — the integrity gap surfaced for follow-up / back-check.
  const integrityIssues = useMemo(() => data.filter(declaresExpiredWithoutDetail), [data])
  const backcheck = useMemo(() => buildBackcheckAgreement(data), [data])
  const adjusted = useMemo(() => buildEstratoAdjusted(data), [data])

  // Family of inferential contrasts shown on this panel, for a family-wise
  // (Holm–Bonferroni) view that surfaces which survive multiple-comparison
  // control. Breslow–Day and the expected-cell check are diagnostics, not part
  // of the hypothesis family, so they're excluded here.
  const inferentialTests = useMemo(() => {
    const t: { key: string; label: string; p: number }[] = []
    if (assoc) {
      if (assoc.chi.df > 0) t.push({ key: 'estrato-chi', label: 'Estrato × vencidos (χ²)', p: assoc.chi.p })
      if (assoc.trend)      t.push({ key: 'estrato-trend', label: 'Gradiente por estrato (Cochran–Armitage)', p: assoc.trend.p })
    }
    if (surveyorEffect) {
      if (surveyorEffect.chi && surveyorEffect.chi.df > 0) t.push({ key: 'prog-chi', label: 'Programa del encuestador × vencidos (χ²)', p: surveyorEffect.chi.p })
      if (surveyorEffect.trend) t.push({ key: 'sem-trend', label: 'Gradiente por semestre (Cochran–Armitage)', p: surveyorEffect.trend.p })
    }
    if (adjusted) t.push({ key: 'cmh', label: 'Asociación ajustada estrato→vencidos (CMH)', p: adjusted.mh.p })
    return t
  }, [assoc, surveyorEffect, adjusted])
  const holm = useMemo(() => holmAdjust(inferentialTests), [inferentialTests])

  // No data at all (vs. "filters returned nothing", handled further down)
  if (surveys.length === 0) {
    return (
      <div>
        <TopBar title="Panel analítico" icon="ti-layout-dashboard" accent={C.navy} />
        <div className="page-content">
          <EmptyState
            icon="ti-clipboard-data"
            title={isInvestigador ? 'Aún no hay datos' : 'Sin encuestas aún'}
            description={isInvestigador
              ? 'Cuando los encuestadores registren encuestas, aquí verás el análisis agregado.'
              : 'Registra tu primera encuesta para empezar a ver indicadores.'}
            action={isInvestigador ? undefined : (
              <Button onClick={() => openWizard(0)} icon="ti-plus">
                Registrar primera encuesta
              </Button>
            )}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title={isInvestigador ? 'Panel analítico' : 'Mi panel'}
        subtitle={isInvestigador ? `${n} encuesta${n !== 1 ? 's' : ''} en análisis` : undefined}
        icon="ti-layout-dashboard"
        accent={C.navy}
      />
      <div className="page-content">

        {/* Role-adaptive hero */}
        {isInvestigador
          ? <InvestigadorHero n={n} nVenc={nVenc} vencTotal={vencTotal} filtersActive={filtersActive} totalSurveys={surveys.length} />
          : <EncuestadorHero
              n={n} pendingDraft={!!pendingDraft}
              onNew={() => openWizard(surveys.length)}
              onResume={resumeDraft}
              onView={() => setView('encuestas')}
            />}

        {/* Investigator cockpit filters */}
        {isInvestigador && (
          <FilterBar
            ciudadOptions={ciudadOptions}
            progOptions={progOptions}
            fCiudad={fCiudad} setFCiudad={setFCiudad}
            fSalud={fSalud}   setFSalud={setFSalud}
            fEstrato={fEstrato} setFEstrato={setFEstrato}
            fProg={fProg}     setFProg={setFProg}
            fTipo={fTipo}     setFTipo={setFTipo}
            filtersActive={filtersActive} onClear={clearFilters}
            exportCount={n}
            onExport={() => downloadBlob(
              toCSV(data),
              `MEDD_${filtersActive ? 'filtrado_' : ''}${dateTag()}.csv`,
              'text/csv;charset=utf-8',
            )}
          />
        )}

        {/* Filtered-empty state (data exists but filters exclude everything) */}
        {n === 0 ? (
          <Card style={{ textAlign: 'center', padding: '32px 20px' }}>
            <i className="ti ti-filter-off" style={{ fontSize: 28, color: C.muted, display: 'block', marginBottom: 8 }} aria-hidden />
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>Ningún registro coincide con los filtros.</p>
            <Button variant="secondary" size="sm" icon="ti-x" onClick={clearFilters}>Limpiar filtros</Button>
          </Card>
        ) : (
        <>
        {/* KPIs */}
        <p style={{ fontSize: 11, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Indicadores clave · {n} encuesta{n !== 1 ? 's' : ''}
        </p>
        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <StatCard icon="ti-users"          label="Total encuestados"    value={n}                                  color={C.navy} />
          <StatCard icon="ti-pill"           label="Productos registrados" value={totalMeds}                          color={C.teal} />
          <StatCard icon="ti-package"        label="Unidades sin consumir" value={unidTotal}                          color={C.teal} />
          <StatCard icon="ti-alert-triangle" label="Unidades vencidas"    value={vencTotal}  sub={`${pct(vencTotal,unidTotal)}%`} color={C.amber} />
          <StatCard icon="ti-scale"          label="Peso total (g)"       value={pesoTotal.toFixed(1)}               color={C.gray} />
          <StatCard icon="ti-map-pin"        label="Con vencidos conf."   value={nVenc}      sub={`${pct(nVenc,n)}%`}             color={C.red} />
        </div>

        {/* Donuts */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel>Variables clave de resultado</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <MiniDonut val={nSob}  outOf={n}    label="Med. sin consumir"   color={CHART.navy} />
            <MiniDonut val={nVenc} outOf={n}    label="Vencidos conf."      color={CHART.amber} />
            <MiniDonut val={nDisp} outOf={nSob} label="Conoce disposición*" color={CHART.teal} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, textAlign: 'center', lineHeight: 1.5 }}>
            «Med. sin consumir» y «Vencidos conf.» sobre el total ({n} hogares).
            <br />*«Conoce disposición» se calcula solo sobre los {nSob} hogares que almacenan medicamentos.
          </p>
        </Card>

        {/* Analítica a nivel de medicamento (producto) */}
        {medStats && <MedicationStatsCard s={medStats} />}

        {/* Motivos de no consumo / acumulación y disposición (instrumento v2) */}
        {motiveStats && <MotivesCard s={motiveStats} />}

        {/* Prevalencias con incertidumbre */}
        <PrevalenceCard
          rows={[
            { label: 'Almacena medicamentos sin consumir', ci: wilsonCI(nSob, n) },
            { label: 'Tiene vencidos confirmados en casa', ci: wilsonCI(nVenc, n) },
            { label: 'Conoce disposición (entre quienes almacenan)', ci: wilsonCI(nDisp, nSob) },
          ]}
        />

        {/* Asociación exposición–desenlace */}
        {assoc && <AssociationCard assoc={assoc} />}

        {/* Control de calidad: efecto del encuestador */}
        {surveyorEffect && <SurveyorEffectCard s={surveyorEffect} />}

        {/* Control de calidad operativo por encuestador (para-data / antifraude) */}
        {isInvestigador && surveyorQC && <SurveyorQCCard qc={surveyorQC} />}

        {/* Integridad: vencidos declarados sin detalle de producto vencido */}
        {isInvestigador && integrityIssues.length > 0 && <IntegrityCard issues={integrityIssues} />}

        {/* Concordancia de back-check (fiabilidad inter-observador) */}
        {isInvestigador && backcheck && <BackcheckAgreementCard a={backcheck} />}

        {/* Asociación ajustada por confusión (Mantel–Haenszel) */}
        {adjusted && <AdjustedAssociationCard a={adjusted} />}

        {/* Tiempo de retención de vencidos */}
        {retention && <RetentionCard s={retention} />}

        {/* Notas estadísticas: naturaleza exploratoria + control de multiplicidad */}
        <StatNotesCard tests={inferentialTests} holm={holm} />

        {/* Distribuciones — 2 columnas en pantallas anchas para aprovechar el espacio */}
        <div className="chart-grid">
        {/* Hotspots geográficos: CIUDAD x CANT_MED_VTO */}
        {ciudadVenc.length > 0 && (
          <Card>
            <SectionLabel>Hotspots geográficos — Unidades vencidas por ciudad</SectionLabel>
            <DistBar data={ciudadVenc} dataKey="value" color={CHART.amber} yWidth={85} barName="Unidades vencidas" />
          </Card>
        )}

        {/* ESTRATO distribution */}
        {barEstrato.length > 0 && (
          <Card>
            <SectionLabel>Distribución por estrato socioeconómico</SectionLabel>
            <DistBar data={barEstrato} color={CHART.navy} yWidth={75} />
          </Card>
        )}

        {/* AS_SALUD */}
        {barAsSalud.length > 0 && (
          <Card>
            <SectionLabel>Distribución por régimen de salud</SectionLabel>
            <DistBar data={barAsSalud} color={CHART.teal} yWidth={90} />
          </Card>
        )}

        {/* NV_ESTU */}
        {barNvEstu.length > 0 && (
          <Card>
            <SectionLabel>Distribución por nivel educativo</SectionLabel>
            <DistBar data={barNvEstu} color={CHART.purple} yWidth={75} />
          </Card>
        )}

        {/* NV_POSG */}
        {barNvPosg.length > 0 && (
          <Card>
            <SectionLabel>Distribución por nivel de posgrado</SectionLabel>
            <DistBar data={barNvPosg} color={CHART.violet} yWidth={95} />
          </Card>
        )}

        {/* Etnia */}
        {barEtnia.length > 0 && (
          <Card>
            <SectionLabel>Distribución por pertenencia étnica</SectionLabel>
            <DistBar data={barEtnia} color={CHART.gray} yWidth={120} />
          </Card>
        )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

// ─── Role-adaptive hero bands ───────────────────────────────────────────────

// Investigator: a brand-gradient summary band framing the dataset at a glance.
function InvestigadorHero({ n, nVenc, vencTotal, filtersActive, totalSurveys }: {
  n: number; nVenc: number; vencTotal: number; filtersActive: boolean; totalSurveys: number
}) {
  return (
    <div style={{
      background: C.gradBrand, color: '#fff', borderRadius: 16,
      padding: '18px 20px', marginBottom: 16, boxShadow: C.shadowBrand,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.92 }}>
        <i className="ti ti-shield-check" style={{ fontSize: 16 }} aria-hidden />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.3px' }}>
          Vista de investigador · datos agregados
          {filtersActive && ` · ${n} de ${totalSurveys} (filtrado)`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <HeroStat value={n} label="Encuestas" />
        <HeroStat value={nVenc} label="Hogares con vencidos" />
        <HeroStat value={vencTotal} label="Unidades vencidas" />
      </div>
    </div>
  )
}

// Encuestador: a "field mode" band — the primary action front and centre.
function EncuestadorHero({ n, pendingDraft, onNew, onResume, onView }: {
  n: number; pendingDraft: boolean; onNew: () => void; onResume: () => void; onView: () => void
}) {
  return (
    <div style={{
      background: C.gradBrand, color: '#fff', borderRadius: 16,
      padding: '20px', marginBottom: 16, boxShadow: C.shadowBrand,
    }}>
      <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 2 }}>Trabajo de campo</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span className="fd tnum" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{n}</span>
        <span style={{ fontSize: 14, opacity: 0.9 }}>encuesta{n !== 1 ? 's' : ''} registrada{n !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={pendingDraft ? onResume : onNew}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: '#fff', color: C.primary, border: 'none', borderRadius: 10,
            padding: '11px 18px', fontSize: 15, fontWeight: 700,
          }}
        >
          <i className={`ti ${pendingDraft ? 'ti-player-play' : 'ti-plus'}`} style={{ fontSize: 19 }} aria-hidden />
          {pendingDraft ? 'Continuar encuesta' : 'Nueva encuesta'}
        </button>
        <button
          onClick={onView}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,0.16)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10,
            padding: '11px 16px', fontSize: 14, fontWeight: 600,
          }}
        >
          <i className="ti ti-list" style={{ fontSize: 18 }} aria-hidden />
          Ver registros
        </button>
      </div>
    </div>
  )
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="fd tnum" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>{label}</div>
    </div>
  )
}

// ─── Cockpit filter bar (investigator) ──────────────────────────────────────

function FilterBar({
  ciudadOptions, progOptions, fCiudad, setFCiudad, fSalud, setFSalud, fEstrato, setFEstrato,
  fProg, setFProg, fTipo, setFTipo, filtersActive, onClear, exportCount, onExport,
}: {
  ciudadOptions: string[]
  progOptions: string[]
  fCiudad: string; setFCiudad: (v: string) => void
  fSalud: string; setFSalud: (v: string) => void
  fEstrato: number | null; setFEstrato: (v: number | null) => void
  fProg: string; setFProg: (v: string) => void
  fTipo: string; setFTipo: (v: string) => void
  filtersActive: boolean; onClear: () => void
  exportCount: number; onExport: () => void
}) {
  return (
    <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <i className="ti ti-adjustments-horizontal" style={{ fontSize: 15 }} aria-hidden /> Filtros
        </span>
        {filtersActive && (
          <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.teal, fontSize: 12, fontWeight: 600 }}>
            Limpiar
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {ciudadOptions.length > 0 && (
          <select value={fCiudad} onChange={e => setFCiudad(e.target.value)} aria-label="Filtrar por ciudad">
            <option value="">Todas las ciudades</option>
            {ciudadOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div>
          <div style={{ fontSize: 11, color: C.hint, marginBottom: 6 }}>Régimen de salud</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OPT.asSalud.map(o => (
              <Chip key={o} label={o} active={fSalud === o} onClick={() => setFSalud(fSalud === o ? '' : o)} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.hint, marginBottom: 6 }}>Estrato</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OPT.estrato.map(e => (
              <Chip key={e} label={String(e)} active={fEstrato === e} onClick={() => setFEstrato(fEstrato === e ? null : e)} />
            ))}
          </div>
        </div>

        {/* Surveyor profile — only shown once such data exists */}
        {progOptions.length > 0 && (
          <select value={fProg} onChange={e => setFProg(e.target.value)} aria-label="Filtrar por programa del encuestador">
            <option value="">Todos los programas (encuestador)</option>
            {progOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <div>
          <div style={{ fontSize: 11, color: C.hint, marginBottom: 6 }}>Institución del encuestador</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OPT.etrTipoInst.map(t => (
              <Chip key={t} label={t} active={fTipo === t} onClick={() => setFTipo(fTipo === t ? '' : t)} />
            ))}
          </div>
        </div>
      </div>

      {/* Export the current (filtered) subset straight from the cockpit */}
      <button
        onClick={onExport}
        disabled={exportCount === 0}
        style={{
          marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, cursor: exportCount === 0 ? 'not-allowed' : 'pointer',
          border: `1px solid ${C.border}`, background: C.surface2, color: C.text,
          fontSize: 13, fontWeight: 600, opacity: exportCount === 0 ? 0.5 : 1,
        }}
      >
        <i className="ti ti-file-download" style={{ fontSize: 17 }} aria-hidden />
        Exportar {filtersActive ? 'selección' : 'todo'} (CSV · {exportCount})
      </button>
    </Card>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, background: C.teal, flexShrink: 0 }} aria-hidden />
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>
        {children}
      </span>
    </div>
  )
}

// Point prevalence with its Wilson 95% CI, drawn as a value + interval bar so a
// wide band (small base) is visually obvious and not mistaken for a hard number.
function PrevalenceCard({ rows }: { rows: { label: string; ci: Proportion }[] }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Prevalencias estimadas · IC 95% (Wilson)</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(({ label, ci }) => <PrevalenceRow key={label} label={label} ci={ci} />)}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        El intervalo refleja la incertidumbre por tamaño muestral: a menor base, más ancho.
      </p>
    </Card>
  )
}

// ─── Retention time of expired medications (days-overdue distribution) ──────

interface DaysSummary { n: number; median: number; q1: number; q3: number; p90: number; max: number }

// Distribution of how many days each expired product has been past its expiry
// at the time of the interview (t_vto = f_eta − f_vto, only when > 0). This
// quantifies the risk window during which expired meds linger in the home.
function buildRetention(surveys: Survey[]): DaysSummary | null {
  const days: number[] = []
  for (const s of surveys) {
    for (const m of s.medications ?? []) {
      const mx = productMetrics(s.fEta, s.fDisp, m)
      if (mx.isExpired && mx.tVto != null && mx.tVto > 0) days.push(mx.tVto)
    }
  }
  if (days.length === 0) return null

  // ⚡ Bolt: Sort once to avoid redundant O(N log N) operations and memory allocations
  // in 4 consecutive `quantile` calls.
  days.sort((a, b) => a - b)

  return {
    n:      days.length,
    median: quantile(days, 0.5, true),
    q1:     quantile(days, 0.25, true),
    q3:     quantile(days, 0.75, true),
    p90:    quantile(days, 0.9, true),
    // ⚡ Bolt: Get max directly from sorted array instead of Math.max(...days)
    // which avoids another O(N) pass and potential Maximum Call Stack Size Exceeded error
    max:    days[days.length - 1],
  }
}

function RetentionCard({ s }: { s: DaysSummary }) {
  const scale = s.max > 0 ? s.max : 1
  const x = (v: number) => `${Math.min(100, (v / scale) * 100)}%`
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Tiempo de retención de medicamentos vencidos</SectionLabel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.muted }}>Mediana de días vencido</span>
        <span className="fd tnum" style={{ fontSize: 24, fontWeight: 600, color: C.amber }}>{Math.round(s.median)} d</span>
      </div>
      {/* IQR box (Q1–Q3) with the median marker, scaled 0..max */}
      <div style={{ position: 'relative', height: 10, background: C.bg, borderRadius: 5, margin: '6px 0' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: x(s.q1), width: `calc(${x(s.q3)} - ${x(s.q1)})`,
          background: `${C.amber}40`, borderRadius: 5,
        }} />
        <div style={{
          position: 'absolute', top: -2, bottom: -2,
          left: `calc(${x(s.median)} - 1px)`, width: 2, background: C.amber,
        }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
        <DaysStat label="RIC (Q1–Q3)" value={`${Math.round(s.q1)}–${Math.round(s.q3)} d`} />
        <DaysStat label="Percentil 90" value={`${Math.round(s.p90)} d`} />
        <DaysStat label="Máximo" value={`${Math.round(s.max)} d`} />
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Sobre {s.n} producto(s) vencido(s). Mide cuánto tiempo permanecen los medicamentos vencidos en el hogar — la ventana de riesgo sanitario y ambiental.
      </p>
    </Card>
  )
}

function DaysStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: C.bg }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Exposure → outcome association (estrato gradient) ──────────────────────

interface AssocGroup { label: string; total: number; cases: number; prev: Proportion; rr: RiskRatio }
interface Association { groups: AssocGroup[]; chi: ChiSquare; trend: TrendTest | null; ref: string }

// Tests whether harbouring confirmed expired meds (vtoMedNc='Sí') is associated
// with socioeconomic stratum. Estrato is collapsed to Bajo/Medio/Alto so cells
// stay large enough for the chi-square; the lowest present group is the PR
// reference. Outcome base = all households in the group (a non-storing home has
// zero expired stored meds by definition, so the denominator is valid).
// Single socioeconomic banding reused by every estrato analysis so the cut is
// consistent across cards (the gradient card uses the three bands; the adjusted
// MH analysis uses the derived binary contrast below).
const ESTRATO_BANDS = [
  { label: 'bajo (1–2)',  min: 1, max: 2 },
  { label: 'medio (3–4)', min: 3, max: 4 },
  { label: 'alto (5–6)',  min: 5, max: 6 },
] as const
// Binary exposure derived from the same bands: "no bajo" (medio–alto, ≥3) vs
// "bajo" (1–2). Aligning the dichotomy to the bottom band boundary keeps it
// consistent with the gradient card and tends to keep the exposed cells larger.
const isEstratoHigh = (e: number) => e >= 3

function buildEstratoAssociation(surveys: Survey[]): Association | null {
  const acc = ESTRATO_BANDS.map(d => ({ ...d, total: 0, cases: 0 }))
  for (const s of surveys) {
    const e = s.estrato
    if (e == null) continue
    const g = acc.find(d => e >= d.min && e <= d.max)
    if (!g) continue
    g.total++
    if (s.vtoMedNc === 'Sí') g.cases++
  }

  const present = acc.filter(g => g.total > 0)
  if (present.length < 2) return null

  const ref = present[0] // lowest present stratum
  const groups: AssocGroup[] = present.map(g => ({
    label: g.label,
    total: g.total,
    cases: g.cases,
    prev: wilsonCI(g.cases, g.total),
    rr: g === ref
      ? { rr: 1, lo: 1, hi: 1, ref: true }
      : prevalenceRatio(g.cases, g.total, ref.cases, ref.total),
  }))
  const chi = chiSquareTest(present.map(g => [g.cases, g.total - g.cases]))
  // Ordered exposure → also test for a monotone gradient (scores 1..k by rank).
  const trend = cochranArmitage(present.map((g, i) => ({ score: i + 1, n: g.total, cases: g.cases })))
  return { groups, chi, trend, ref: ref.label }
}

const fmtP = (p: number) => (p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ','))

function AssociationCard({ assoc }: { assoc: Association }) {
  const { groups, chi, trend, ref } = assoc
  const sig = chi.df > 0 && chi.p < 0.05
  const trendSig = trend !== null && trend.p < 0.05
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Asociación: vencidos en casa según estrato</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {groups.map(g => <AssocRow key={g.label} g={g} />)}
      </div>
      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        <strong style={{ color: sig ? C.amber : C.text }}>
          χ² = {chi.chi2.toFixed(2)} (gl {chi.df}), p = {fmtP(chi.p)}
        </strong>
        {' — '}
        {sig ? 'diferencia entre estratos significativa' : 'sin evidencia de diferencia'} (α = 0,05).
        {trend && (
          <div style={{ marginTop: 4 }}>
            <strong style={{ color: trendSig ? C.amber : C.text }}>
              Tendencia (Cochran–Armitage): χ² = {trend.chi2.toFixed(2)} (gl 1), p = {fmtP(trend.p)}
            </strong>
            {' — '}
            {trendSig
              ? `gradiente ${trend.direction} con el estrato`
              : 'sin gradiente monótono'}.
          </div>
        )}
        {chi.minExpected < 5 && (
          <div style={{ color: C.amber, marginTop: 4 }}>
            ⚠ Celda esperada &lt; 5: interpretar con cautela (preferir test exacto).
          </div>
        )}
        <div style={{ marginTop: 4, color: C.hint }}>
          Referencia: estrato {ref}. RP = razón de prevalencia vs. referencia (IC 95%).
        </div>
      </div>
    </Card>
  )
}

// ─── Surveyor (interviewer) effect — data-quality stratification ────────────

interface SurveyorEffect {
  programs: AssocGroup[] | null   // outcome prevalence by surveyor program
  chi: ChiSquare | null
  ref: string
  trend: TrendTest | null         // outcome trend across academic semester (ordinal)
  nSemester: number               // surveys carrying a semester value
  icc: ICCResult | null           // clustering of the outcome by surveyor (nuiEtr)
}

// Quantifies whether the confirmed-expired outcome (vtoMedNc='Sí') varies by the
// SURVEYOR's profile rather than the household. A real epidemiological signal
// shouldn't depend on who collected the data, so a significant difference here is
// read as a measurement / inter-observer quality flag, not a true effect. Program
// is categorical (chi-square + PR vs the most-sampled program); academic semester
// is ordinal, so it also gets a Cochran–Armitage trend test.
function buildSurveyorEffect(surveys: Survey[]): SurveyorEffect | null {
  const isCase = (s: Survey) => s.vtoMedNc === 'Sí'

  // By program
  const progMap = new Map<string, { total: number; cases: number }>()
  for (const s of surveys) {
    if (!s.etrPrograma) continue
    const g = progMap.get(s.etrPrograma) ?? { total: 0, cases: 0 }
    g.total++
    if (isCase(s)) g.cases++
    progMap.set(s.etrPrograma, g)
  }
  const progEntries = Array.from(progMap.entries()).filter(([, g]) => g.total > 0)

  let programs: AssocGroup[] | null = null
  let chi: ChiSquare | null = null
  let ref = ''
  if (progEntries.length >= 2) {
    // Reference = most-sampled program (most stable baseline).
    const refEntry = progEntries.reduce((a, b) => (b[1].total > a[1].total ? b : a))
    ref = refEntry[0]
    programs = progEntries.map(([label, g]) => ({
      label, total: g.total, cases: g.cases,
      prev: wilsonCI(g.cases, g.total),
      rr: label === ref
        ? { rr: 1, lo: 1, hi: 1, ref: true }
        : prevalenceRatio(g.cases, g.total, refEntry[1].cases, refEntry[1].total),
    }))
    chi = chiSquareTest(progEntries.map(([, g]) => [g.cases, g.total - g.cases]))
  }

  // By academic semester (ordinal trend)
  const semMap = new Map<number, { total: number; cases: number }>()
  for (const s of surveys) {
    if (s.etrSemestre == null) continue
    const g = semMap.get(s.etrSemestre) ?? { total: 0, cases: 0 }
    g.total++
    if (isCase(s)) g.cases++
    semMap.set(s.etrSemestre, g)
  }
  const nSemester = Array.from(semMap.values()).reduce((sum, g) => sum + g.total, 0)
  const trend = semMap.size >= 2
    ? cochranArmitage(
        Array.from(semMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([score, g]) => ({ score, n: g.total, cases: g.cases })),
      )
    : null

  // Outcome clustering by surveyor (nuiEtr) → intraclass correlation
  const survMap = new Map<number, { n: number; cases: number }>()
  for (const s of surveys) {
    if (s.nuiEtr == null) continue
    const g = survMap.get(s.nuiEtr) ?? { n: 0, cases: 0 }
    g.n++
    if (isCase(s)) g.cases++
    survMap.set(s.nuiEtr, g)
  }
  const icc = iccBinary(Array.from(survMap.values()))

  if (!programs && !trend && !icc) return null
  return { programs, chi, ref, trend, nSemester, icc }
}

function SurveyorEffectCard({ s }: { s: SurveyorEffect }) {
  const { programs, chi, ref, trend, nSemester, icc } = s
  const progSig = chi !== null && chi.df > 0 && chi.p < 0.05
  const trendSig = trend !== null && trend.p < 0.05
  const iccHigh = icc !== null && icc.icc >= 0.05
  const flagged = progSig || trendSig || iccHigh
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Control de calidad — efecto del encuestador</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Prevalencia de <strong>vencidos confirmados en casa</strong> según el perfil de quien
        recolectó. El desenlace no debería depender del encuestador: una diferencia marcada es
        señal de <strong>variabilidad de medición entre observadores</strong> (revisar criterios /
        capacitación), no de un efecto epidemiológico real.
      </p>

      {programs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {programs.map(g => <AssocRow key={g.label} g={g} />)}
        </div>
      )}

      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        {chi && (
          <div>
            <strong style={{ color: progSig ? C.amber : C.text }}>
              Por programa · χ² = {chi.chi2.toFixed(2)} (gl {chi.df}), p = {fmtP(chi.p)}
            </strong>
            {' — '}
            {progSig
              ? 'difiere según el programa del encuestador (posible efecto del observador)'
              : 'sin evidencia de diferencia entre programas'} (α = 0,05).
            {chi.minExpected < 5 && (
              <span style={{ color: C.amber }}> ⚠ Celda esperada &lt; 5: interpretar con cautela.</span>
            )}
          </div>
        )}
        {trend && (
          <div style={{ marginTop: chi ? 6 : 0 }}>
            <strong style={{ color: trendSig ? C.amber : C.text }}>
              Por semestre (Cochran–Armitage) · χ² = {trend.chi2.toFixed(2)} (gl 1), p = {fmtP(trend.p)}
            </strong>
            {' — '}
            {trendSig
              ? `gradiente ${trend.direction} con el semestre académico (n = ${nSemester})`
              : `sin gradiente con el semestre (n = ${nSemester})`}.
          </div>
        )}
        {icc && (
          <div style={{ marginTop: (chi || trend) ? 6 : 0 }}>
            <strong style={{ color: iccHigh ? C.amber : C.text }}>
              ICC por encuestador = {icc.icc.toFixed(3)} (deff {icc.designEffect.toFixed(2)}, {icc.clusters} encuestadores)
            </strong>
            {' — '}
            {iccHigh
              ? 'parte de la variación del desenlace se explica por el encuestador (efecto de conglomerado relevante)'
              : 'variación entre encuestadores despreciable'}.
          </div>
        )}
        {programs && (
          <div style={{ marginTop: 4, color: C.hint }}>
            Referencia: {ref} (programa con más registros). RP = razón de prevalencia vs. referencia (IC 95%).
          </div>
        )}
        <div style={{ marginTop: 6, color: C.hint, fontSize: 11.5, lineHeight: 1.5 }}>
          ⚠ Los contrastes por programa y por semestre no ajustan por el agrupamiento
          de encuestas dentro de un mismo encuestador (que el ICC cuantifica): sus
          valores p pueden ser <strong>anticonservadores</strong>. Además, las diferencias
          entre encuestadores pueden reflejar que cada uno cubre <strong>zonas/poblaciones
          distintas</strong> (case-mix), no necesariamente sesgo del observador, salvo
          asignación aleatoria de encuestadores a zonas.
        </div>
        {!flagged && (
          <div style={{ marginTop: 4, color: C.green }}>
            ✓ Sin señal de efecto del encuestador con los datos actuales.
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Per-surveyor operational QC (para-data / fraud monitoring) ─────────────

// Always-applicable fields (not behind skip logic) used for a fill-rate proxy.
const QC_KEY_FIELDS: (keyof Survey)[] = [
  'fEta', 'fNac', 'ciudad', 'estrato', 'etnia', 'asSalud', 'estLab',
  'ingreso', 'nvEstu', 'perSalud', 'estSalud', 'medSob',
]
const QC_SINO_FIELDS: (keyof Survey)[] = [
  'estSalud', 'conMed', 'medPrc', 'indMed', 'medSob', 'dispMedVc', 'vtoMedNc',
]
const FAST_SECONDS = 120 // a full 6-step interview under 2 min is implausibly fast

const qcFilled = (v: unknown) => v !== '' && v !== null && v !== undefined

// Heuristic straightlining: all answered Sí/No items share the same value.
function isStraightlined(s: Survey): boolean {
  const ans = QC_SINO_FIELDS.map(f => s[f]).filter(v => v === 'Sí' || v === 'No') as string[]
  return ans.length >= 3 && ans.every(v => v === ans[0])
}

function durationSec(s: Survey): number | null {
  if (!s.startedAt || !s.createdAt) return null
  const d = (new Date(s.createdAt).getTime() - new Date(s.startedAt).getTime()) / 1000
  return Number.isFinite(d) && d > 0 ? d : null
}

interface SurveyorQCRow {
  nuiEtr: number; n: number; completeness: number; straightPct: number
  vencPct: number; medianDurSec: number | null; fastCount: number
}
interface SurveyorQC { rows: SurveyorQCRow[]; poolVencPct: number; digit: DigitTest | null }

// Per-surveyor data-quality signals to prioritise back-checks: completeness,
// straightlining, interview speed and outcome rate vs the pool, plus a pooled
// terminal-digit test on the measured weight (digit preference → fabrication).
function buildSurveyorQC(surveys: Survey[]): SurveyorQC | null {
  const byId = new Map<number, Survey[]>()
  for (const s of surveys) {
    if (s.nuiEtr == null) continue
    const arr = byId.get(s.nuiEtr) ?? []
    arr.push(s); byId.set(s.nuiEtr, arr)
  }
  if (byId.size === 0) return null

  const rows: SurveyorQCRow[] = Array.from(byId.entries()).map(([nuiEtr, list]) => {
    const n = list.length
    const completeness = list.reduce((acc, s) =>
      acc + QC_KEY_FIELDS.filter(f => qcFilled(s[f])).length / QC_KEY_FIELDS.length, 0) / n
    const straightPct = list.filter(isStraightlined).length / n
    const vencPct = list.filter(s => s.vtoMedNc === 'Sí').length / n
    const durs = list.map(durationSec).filter((d): d is number => d != null).sort((a, b) => a - b)
    const medianDurSec = durs.length ? quantile(durs, 0.5, true) : null
    const fastCount = durs.filter(d => d < FAST_SECONDS).length
    return { nuiEtr, n, completeness, straightPct, vencPct, medianDurSec, fastCount }
  }).sort((a, b) => b.n - a.n)

  const poolVencPct = surveys.length
    ? surveys.filter(s => s.vtoMedNc === 'Sí').length / surveys.length
    : 0
  const digit = terminalDigitTest(
    surveys.map(s => s.pesoMedNc).filter((v): v is number => v != null),
  )
  return { rows, poolVencPct, digit }
}

function SurveyorQCCard({ qc }: { qc: SurveyorQC }) {
  const { rows, poolVencPct, digit } = qc
  const digitFlag = digit !== null && digit.p < 0.05
  const fmtPctN = (x: number) => `${(x * 100).toFixed(0)}%`
  const fmtDur = (d: number | null) =>
    d == null ? '—' : d >= 60 ? `${Math.floor(d / 60)}m ${Math.round(d % 60)}s` : `${Math.round(d)}s`
  const th: React.CSSProperties = { padding: '4px 6px' }
  const td: React.CSSProperties = { padding: '5px 6px' }
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Control de calidad por encuestador (para-data / antifraude)</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Señales operativas por encuestador para priorizar <strong>back-checks</strong>: completitud
        baja, exceso de respuestas planas (straightlining), entrevistas demasiado rápidas o
        prevalencias atípicas pueden indicar errores de captura o fabricación.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.muted, textAlign: 'right' }}>
              <th style={{ ...th, textAlign: 'left' }}>Encuestador</th>
              <th style={th}>n</th>
              <th style={th}>Compl.</th>
              <th style={th}>Plana</th>
              <th style={th}>%Venc</th>
              <th style={th}>Mediana</th>
              <th style={th}>Rápidas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const flag = r.straightPct >= 0.5 || r.fastCount > 0 || r.completeness < 0.7
              return (
                <tr key={r.nuiEtr} style={{ textAlign: 'right', color: flag ? C.amber : C.text, borderTop: `0.5px solid ${C.border}` }}>
                  <td style={{ ...td, textAlign: 'left' }}>#{r.nuiEtr}{flag ? ' ⚠' : ''}</td>
                  <td style={td} className="tnum">{r.n}</td>
                  <td style={td} className="tnum">{fmtPctN(r.completeness)}</td>
                  <td style={td} className="tnum">{fmtPctN(r.straightPct)}</td>
                  <td style={td} className="tnum">{fmtPctN(r.vencPct)}</td>
                  <td style={td} className="tnum">{fmtDur(r.medianDurSec)}</td>
                  <td style={td} className="tnum">{r.fastCount || '·'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
        Prevalencia de vencidos en el pool: <strong>{fmtPctN(poolVencPct)}</strong> (referencia para «%Venc»).
        {digit
          ? <> · Dígito terminal del peso (n = {digit.n}): χ² = {digit.chi2.toFixed(1)} (gl 9), p = {fmtP(digit.p)} — {digitFlag ? '⚠ posible redondeo/fabricación' : 'sin preferencia de dígito'}.</>
          : <> · Dígito terminal: datos insuficientes (n &lt; 20).</>}
        <div style={{ marginTop: 4, color: C.hint }}>
          «Plana» = % de encuestas con todas las respuestas Sí/No idénticas (≥3 ítems).
          «Rápidas» = entrevistas &lt; {FAST_SECONDS}s (heurístico); la duración solo está disponible
          desde esta versión. Estas señales orientan auditoría, no son prueba por sí solas.
        </div>
      </div>
    </Card>
  )
}

// ─── Product-level analytics (medications[]) ────────────────────────────────

interface MedStats {
  totalProducts:   number
  expiredProducts: number
  distinctDci:     number
  withVto:         number                          // products carrying an expiry date
  classifiedPct:   number                          // % of products mapped to a therapeutic group
  topDci:          Array<{ name: string; n: number }>
  topExpiredDci:   Array<{ name: string; value: number }>
  topProducts:     Array<{ name: string; n: number }>
  byGroup:         Array<{ name: string; n: number }>
  byGroupExpired:  Array<{ name: string; value: number }>
  bySubgroup:      Array<{ name: string; n: number }>
  bySubgroupExpired: Array<{ name: string; value: number }>
}

// Single pass over every stored product across all surveys, aggregating the
// medication detail the household-level KPIs ignored: most frequent active
// ingredients (DCI) and commercial products, and which active ingredients
// accumulate the most expired units. `isExpired` reuses the same product metric
// as the rest of the app (F_VTO < F_ETA).
function buildMedicationStats(surveys: Survey[]): MedStats | null {
  const dciMap   = new Map<string, { n: number; expired: number }>()
  const prodMap  = new Map<string, number>()
  const groupMap = new Map<string, { n: number; expired: number }>()
  const subgroupMap = new Map<string, { n: number; expired: number }>()
  let totalProducts = 0, expiredProducts = 0, withVto = 0, classified = 0

  for (const s of surveys) {
    for (const m of s.medications ?? []) {
      totalProducts++
      const expired = productMetrics(s.fEta, s.fDisp, m).isExpired
      if (expired) expiredProducts++
      if (m.fVto) withVto++

      const dci = (m.dci || '').trim()
      if (dci) {
        const g = dciMap.get(dci) ?? { n: 0, expired: 0 }
        g.n++; if (expired) g.expired++
        dciMap.set(dci, g)
      }
      const nm = (m.nmMed || '').trim()
      if (nm) prodMap.set(nm, (prodMap.get(nm) ?? 0) + 1)

      // Therapeutic class (ATC) derived from the active ingredient.
      const group = therapeuticGroup(m.dci || '')
      if (group !== SIN_CLASIFICAR) classified++
      const gg = groupMap.get(group) ?? { n: 0, expired: 0 }
      gg.n++; if (expired) gg.expired++
      groupMap.set(group, gg)

      const sub = therapeuticSubgroup(m.dci || '')
      const sg = subgroupMap.get(sub) ?? { n: 0, expired: 0 }
      sg.n++; if (expired) sg.expired++
      subgroupMap.set(sub, sg)
    }
  }
  if (totalProducts === 0) return null

  const topDci = Array.from(dciMap.entries())
    .map(([name, g]) => ({ name, n: g.n }))
    .sort((a, b) => b.n - a.n).slice(0, 8)
  const topExpiredDci = Array.from(dciMap.entries())
    .filter(([, g]) => g.expired > 0)
    .map(([name, g]) => ({ name, value: g.expired }))
    .sort((a, b) => b.value - a.value).slice(0, 8)
  const topProducts = Array.from(prodMap.entries())
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n).slice(0, 8)

  // Therapeutic-group distributions exclude the "Sin clasificar" bucket from the
  // bars (it's summarised separately as the classified-coverage %).
  const byGroup = Array.from(groupMap.entries())
    .filter(([name, g]) => name !== SIN_CLASIFICAR && g.n > 0)
    .map(([name, g]) => ({ name, n: g.n }))
    .sort((a, b) => b.n - a.n)
  const byGroupExpired = Array.from(groupMap.entries())
    .filter(([name, g]) => name !== SIN_CLASIFICAR && g.expired > 0)
    .map(([name, g]) => ({ name, value: g.expired }))
    .sort((a, b) => b.value - a.value)
  const bySubgroup = Array.from(subgroupMap.entries())
    .filter(([name, g]) => name !== SIN_CLASIFICAR && g.n > 0)
    .map(([name, g]) => ({ name, n: g.n }))
    .sort((a, b) => b.n - a.n).slice(0, 12)
  const bySubgroupExpired = Array.from(subgroupMap.entries())
    .filter(([name, g]) => name !== SIN_CLASIFICAR && g.expired > 0)
    .map(([name, g]) => ({ name, value: g.expired }))
    .sort((a, b) => b.value - a.value).slice(0, 12)
  const classifiedPct = pct(classified, totalProducts)

  return {
    totalProducts, expiredProducts, distinctDci: dciMap.size, withVto, classifiedPct,
    topDci, topExpiredDci, topProducts, byGroup, byGroupExpired, bySubgroup, bySubgroupExpired,
  }
}

function MedicationStatsCard({ s }: { s: MedStats }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Analítica de medicamentos (por producto)</SectionLabel>

      {/* Compact product-level KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <MedKpi label="Productos" value={String(s.totalProducts)} color={C.teal} />
        <MedKpi label="Princ. activos" value={String(s.distinctDci)} color={C.navy} />
        <MedKpi label="Vencidos" value={`${s.expiredProducts}`} sub={`${pct(s.expiredProducts, s.totalProducts)}%`} color={C.amber} />
        <MedKpi label="Con fecha vto." value={`${pct(s.withVto, s.totalProducts)}%`} sub={`${s.withVto}/${s.totalProducts}`} color={C.gray} />
      </div>

      {s.byGroup.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubLabel>Grupo terapéutico (ATC nivel 1) · {s.classifiedPct}% clasificado</SubLabel>
          <DistBar data={s.byGroup} color={CHART.navy} yWidth={150} barName="Productos" />
        </div>
      )}

      {s.byGroupExpired.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubLabel>Vencidos por grupo terapéutico</SubLabel>
          <DistBar data={s.byGroupExpired} dataKey="value" color={CHART.amber} yWidth={150} barName="Vencidos" />
        </div>
      )}

      {s.bySubgroup.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubLabel>Subgrupo terapéutico (ATC nivel 2)</SubLabel>
          <DistBar data={s.bySubgroup} color={CHART.purple} yWidth={185} barName="Productos" />
        </div>
      )}

      {s.bySubgroupExpired.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubLabel>Vencidos por subgrupo (ATC nivel 2)</SubLabel>
          <DistBar data={s.bySubgroupExpired} dataKey="value" color={CHART.amber} yWidth={185} barName="Vencidos" />
        </div>
      )}

      {s.topDci.length > 0 && (
        <div style={{ marginBottom: s.topExpiredDci.length > 0 ? 14 : 0 }}>
          <SubLabel>Principios activos (DCI) más frecuentes</SubLabel>
          <DistBar data={s.topDci} color={CHART.teal} yWidth={120} barName="Productos" />
        </div>
      )}

      {s.topExpiredDci.length > 0 && (
        <div style={{ marginBottom: s.topProducts.length > 0 ? 14 : 0 }}>
          <SubLabel>Principios activos con más productos vencidos</SubLabel>
          <DistBar data={s.topExpiredDci} dataKey="value" color={CHART.amber} yWidth={120} barName="Vencidos" />
        </div>
      )}

      {s.topProducts.length > 0 && (
        <div>
          <SubLabel>Productos (nombre comercial) más frecuentes</SubLabel>
          <DistBar data={s.topProducts} color={CHART.navy} yWidth={120} barName="Productos" />
        </div>
      )}

      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Agregado sobre los {s.totalProducts} producto(s) almacenado(s). «Vencidos» se calcula por
        producto (F_VTO &lt; F_ETA); «con fecha vto.» indica la cobertura del dato de vencimiento.
        El grupo terapéutico se deriva del principio activo (ATC nivel 1); {s.classifiedPct}% de los
        productos quedó clasificado (el resto, «Sin clasificar», se excluye de esas barras).
      </p>
    </Card>
  )
}

function MedKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: C.bg }}>
      <div className="fd tnum" style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      {sub && <div className="tnum" style={{ fontSize: 10.5, color: C.hint, marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{children}</div>
  )
}

// ─── Motives battery analytics (instrument v2, version-aware denominators) ───

interface MotiveStats {
  nAsked:        number   // v2 surveys that store meds → shown the battery
  nNotAsked:     number   // v1 surveys → battery not in the instrument
  nExpiredAsked: number   // subset also asked the expiry-reason block
  noConsumo:     Array<{ name: string; n: number }>
  vencimiento:   Array<{ name: string; n: number }>
  dispFinal:     Array<{ name: string; n: number }>
  conoceSi:      number
  conoceBase:    number
}

// Aggregates the multi-select motive answers. Crucially, the denominator is the
// set of records that were actually ASKED — instrument v2 with stored meds — so
// percentages aren't diluted by older "not asked" records (those are reported
// separately as nNotAsked). A record is v1 when instrumentVersion is absent/<2.
function buildMotiveStats(surveys: Survey[]): MotiveStats | null {
  const asked = surveys.filter(s => (s.instrumentVersion ?? 1) >= 2 && s.medSob === 'Sí')
  const nNotAsked = surveys.filter(s => (s.instrumentVersion ?? 1) < 2).length
  if (asked.length === 0) return null

  const count = (rows: Survey[], pick: (s: Survey) => string[], opts: readonly string[]) =>
    opts.map(o => ({ name: o, n: rows.filter(s => (pick(s) ?? []).includes(o)).length }))
      .filter(d => d.n > 0)
      .sort((a, b) => b.n - a.n)

  const expiredAsked = asked.filter(s => s.vtoMedNc === 'Sí' || (s.cantMedVto ?? 0) > 0)

  return {
    nAsked: asked.length,
    nNotAsked,
    nExpiredAsked: expiredAsked.length,
    noConsumo:   count(asked, s => s.motNoConsumo, OPT.motNoConsumo),
    vencimiento: count(expiredAsked, s => s.motVencimiento, OPT.motVencimiento),
    dispFinal:   count(asked, s => s.dispFinal, OPT.dispFinal),
    conoceSi:    asked.filter(s => s.conocePuntos === 'Sí').length,
    conoceBase:  asked.filter(s => s.conocePuntos === 'Sí' || s.conocePuntos === 'No').length,
  }
}

function MotivesCard({ s }: { s: MotiveStats }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Motivos de acumulación y disposición</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Base: <strong>{s.nAsked}</strong> encuesta(s) del instrumento v2 con medicamentos almacenados
        (preguntadas).{s.nNotAsked > 0 && <> {s.nNotAsked} registro(s) previo(s) no incluyen estas preguntas (no preguntado).</>}
      </p>

      {s.conoceBase > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 12 }}>
          <MiniDonut val={s.conoceSi} outOf={s.conoceBase} label="Conoce puntos de recolección" color={CHART.teal} />
        </div>
      )}

      {s.noConsumo.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubLabel>Motivos de no consumo</SubLabel>
          <DistBar data={s.noConsumo} color={CHART.navy} yWidth={150} barName="Hogares" />
        </div>
      )}

      {s.vencimiento.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubLabel>Razones de acumulación / vencimiento (base: {s.nExpiredAsked} con vencidos)</SubLabel>
          <DistBar data={s.vencimiento} color={CHART.amber} yWidth={150} barName="Hogares" />
        </div>
      )}

      {s.dispFinal.length > 0 && (
        <div>
          <SubLabel>Conducta real de disposición</SubLabel>
          <DistBar data={s.dispFinal} color={CHART.teal} yWidth={150} barName="Hogares" />
        </div>
      )}

      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Respuestas de selección múltiple: los porcentajes por opción pueden sumar más de 100%.
      </p>
    </Card>
  )
}

// ─── Data integrity: declared expired meds without expired-product detail ───

// Surfaces records flagged "has expired meds in the home" (vtoMedNc='Sí' or a
// positive expired-unit count) that carry no medication entry with a past
// expiry date. These can't be analysed at the product level and should be
// re-captured or back-checked. Investigator-only, read-only.
function IntegrityCard({ issues }: { issues: Survey[] }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Integridad — vencidos declarados sin detalle</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        <strong style={{ color: C.amber }}>{issues.length}</strong> encuesta(s) marcan medicamentos
        vencidos en el hogar pero <strong>ningún producto</strong> tiene fecha de vencimiento pasada.
        No pueden analizarse a nivel de producto: priorizar corrección o back-check.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {issues.slice(0, 40).map(s => (
          <span
            key={s.id}
            title={`${s.ciudad || 'Sin ciudad'} · ${s.cantMedVto ?? 0} unidad(es) vencida(s) declarada(s)`}
            style={{
              fontSize: 12, fontWeight: 600, color: C.amber,
              background: C.amberLight, border: `1px solid ${C.amber}40`,
              borderRadius: 7, padding: '3px 8px',
            }}
          >
            #{String(s.nui).padStart(3, '0')}
          </span>
        ))}
        {issues.length > 40 && (
          <span style={{ fontSize: 12, color: C.hint, alignSelf: 'center' }}>
            +{issues.length - 40} más
          </span>
        )}
      </div>
    </Card>
  )
}

// ─── Back-check agreement (re-interview reliability / fraud check) ──────────

const BACKCHECK_BIN: (keyof Survey)[] = [
  'estSalud', 'conMed', 'medPrc', 'indMed', 'medSob', 'dispMedVc', 'vtoMedNc',
]
const BACKCHECK_CAT: (keyof Survey)[] = [
  'etnia', 'asSalud', 'estLab', 'ingreso', 'nvEstu', 'perSalud',
]

interface BackcheckAgreement {
  nPairs: number
  kappaBin: KappaResult | null  // Cohen's κ over the pooled Sí/No items
  catAgreement: number | null   // raw % agreement over all categorical items
  pesoMAD: number | null        // mean absolute difference in measured weight (g)
}

// Pairs each back-check with its original survey and measures inter-observer
// agreement: Cohen's κ over the Sí/No items, raw agreement over all categorical
// items, and the mean absolute weight difference. Low agreement flags either
// interpretation variability (training) or fabrication.
function buildBackcheckAgreement(surveys: Survey[]): BackcheckAgreement | null {
  const byId = new Map(surveys.map(s => [s.id, s]))
  const pairs: [Survey, Survey][] = []
  for (const s of surveys) {
    if (!s.backcheckOf) continue
    const orig = byId.get(s.backcheckOf)
    if (orig) pairs.push([orig, s])
  }
  if (pairs.length === 0) return null

  const binPairs: [string, string][] = []
  let catMatch = 0, catTotal = 0
  const pesoDiffs: number[] = []
  for (const [o, b] of pairs) {
    for (const f of BACKCHECK_BIN) {
      const ov = o[f], bv = b[f]
      if ((ov === 'Sí' || ov === 'No') && (bv === 'Sí' || bv === 'No')) {
        binPairs.push([ov as string, bv as string])
      }
    }
    for (const f of [...BACKCHECK_BIN, ...BACKCHECK_CAT]) {
      const ov = String(o[f] ?? ''), bv = String(b[f] ?? '')
      if (ov !== '' && bv !== '') { catTotal++; if (ov === bv) catMatch++ }
    }
    if (o.estrato != null && b.estrato != null) { catTotal++; if (o.estrato === b.estrato) catMatch++ }
    if (o.pesoMedNc != null && b.pesoMedNc != null) pesoDiffs.push(Math.abs(o.pesoMedNc - b.pesoMedNc))
  }
  return {
    nPairs: pairs.length,
    kappaBin: cohenKappa(binPairs),
    catAgreement: catTotal > 0 ? catMatch / catTotal : null,
    pesoMAD: pesoDiffs.length ? pesoDiffs.reduce((a, c) => a + c, 0) / pesoDiffs.length : null,
  }
}

// Landis–Koch bands for κ.
function kappaBand(k: number): { label: string; color: string } {
  if (k < 0.2) return { label: 'pobre', color: C.red }
  if (k < 0.4) return { label: 'débil', color: C.amber }
  if (k < 0.6) return { label: 'moderada', color: C.amber }
  if (k < 0.8) return { label: 'buena', color: C.teal }
  return { label: 'muy buena', color: C.green }
}

function BackcheckAgreementCard({ a }: { a: BackcheckAgreement }) {
  const { nPairs, kappaBin, catAgreement, pesoMAD } = a
  const band = kappaBin ? kappaBand(kappaBin.kappa) : null
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Concordancia de back-check (fiabilidad inter-observador)</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Compara las re-entrevistas de control con su encuesta original sobre{' '}
        <strong>{nPairs}</strong> par(es). Baja concordancia indica variabilidad de
        interpretación (capacitación) o, en casos extremos, fabricación.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: C.bg, border: `1px solid ${band ? band.color : C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>κ ítems Sí/No</div>
          <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, color: band ? band.color : C.text, lineHeight: 1 }}>
            {kappaBin ? kappaBin.kappa.toFixed(2) : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>{band ? band.label : 'sin datos'}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Acuerdo categórico</div>
          <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1 }}>
            {catAgreement != null ? `${(catAgreement * 100).toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>ítems coincidentes</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Δ peso (MAD)</div>
          <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1 }}>
            {pesoMAD != null ? `${pesoMAD.toFixed(1)} g` : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>dif. media abs.</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        κ corregido por azar (bandas de Landis–Koch). Inicia un back-check desde
        «Registros» (vista de tarjetas) con el botón de control. Con pocos pares, interpretar como orientativo.
      </div>
    </Card>
  )
}

// ─── Confounding-adjusted association (Mantel–Haenszel) ─────────────────────

interface AdjustedAssoc {
  crude: RiskRatio
  mh: MHResult
  bd: { chi2: number; df: number; p: number } | null  // Breslow–Day OR homogeneity
  exposedTotal: number
  unexposedTotal: number
  pctChange: number   // % change crude → adjusted (confounding rule of thumb: >10%)
}

// Estimates the estrato→"vencidos en casa" association adjusted for the surveyor's
// academic program (the just-added potential confounder). Exposure is estrato
// dichotomised high (4–6) vs low (1–3); the confounder strata are the programs.
// Comparing the crude vs the MH-adjusted PR shows whether who collected the data
// distorts the socioeconomic association. Needs ≥2 program strata to be meaningful.
function buildEstratoAdjusted(surveys: Survey[]): AdjustedAssoc | null {
  const strataMap = new Map<string, Stratum2x2>()
  let aT = 0, bT = 0, cT = 0, dT = 0
  for (const s of surveys) {
    if (s.estrato == null || !s.etrPrograma) continue
    const high = isEstratoHigh(s.estrato)
    const isCase = s.vtoMedNc === 'Sí'
    const st = strataMap.get(s.etrPrograma) ?? { a: 0, b: 0, c: 0, d: 0 }
    if (high && isCase)       { st.a++; aT++ }
    else if (high && !isCase) { st.b++; bT++ }
    else if (!high && isCase) { st.c++; cT++ }
    else                      { st.d++; dT++ }
    strataMap.set(s.etrPrograma, st)
  }

  const mh = mantelHaenszelRR(Array.from(strataMap.values()))
  if (!mh || mh.strata < 2) return null

  const crude = prevalenceRatio(aT, aT + bT, cT, cT + dT)
  if (!Number.isFinite(crude.rr)) return null

  const bd = breslowDay(Array.from(strataMap.values()))
  const pctChange = mh.rr > 0 ? Math.abs(crude.rr - mh.rr) / mh.rr * 100 : 0
  return { crude, mh, bd, exposedTotal: aT + bT, unexposedTotal: cT + dT, pctChange }
}

function AdjustedAssociationCard({ a }: { a: AdjustedAssoc }) {
  const { crude, mh, bd, exposedTotal, unexposedTotal, pctChange } = a
  const confounded = pctChange >= 10
  const adjSig = mh.lo > 1 || mh.hi < 1
  const heterog = bd !== null && bd.p < 0.05
  const fmt = (x: number) => x.toFixed(2)
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Asociación ajustada por confusión (Mantel–Haenszel)</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Exposición: <strong>estrato medio–alto (3–6)</strong> vs bajo (1–2). Desenlace:
        <strong> vencidos confirmados en casa</strong>. Ajustada por el <strong>programa del
        encuestador</strong> ({mh.strata} estratos).
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <RRBox label="RP cruda" rr={crude.rr} lo={crude.lo} hi={crude.hi} fmt={fmt} />
        <RRBox label="RP ajustada (MH)" rr={mh.rr} lo={mh.lo} hi={mh.hi} fmt={fmt} highlight />
      </div>

      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        <strong style={{ color: adjSig ? C.amber : C.text }}>
          CMH χ² = {mh.chi2.toFixed(2)} (gl 1), p = {fmtP(mh.p)}
        </strong>
        {' — '}
        {adjSig ? 'asociación significativa tras ajustar' : 'sin asociación tras ajustar'} (α = 0,05).
        <div style={{ marginTop: 4, color: confounded ? C.amber : C.green }}>
          {confounded
            ? `⚠ La estimación cambia ${pctChange.toFixed(0)}% al ajustar → el programa del encuestador confunde la asociación.`
            : `✓ El ajuste apenas cambia la estimación (${pctChange.toFixed(0)}%) → sin confusión apreciable por el encuestador.`}
        </div>
        {bd && (
          <div style={{ marginTop: 4, color: heterog ? C.amber : C.green }}>
            Homogeneidad (Breslow–Day) · χ² = {bd.chi2.toFixed(2)} (gl {bd.df}), p = {fmtP(bd.p)} —{' '}
            {heterog
              ? '⚠ el efecto del estrato varía entre programas (modificación de efecto): la RP combinada puede no ser apropiada.'
              : 'la asociación es homogénea entre estratos → la estimación combinada es válida.'}
          </div>
        )}
        <div style={{ marginTop: 4, color: C.hint }}>
          n: {exposedTotal} expuestos (alto) · {unexposedTotal} no expuestos (bajo).
          Estrato dicotomizado; con celdas pequeñas, interpretar con cautela.
        </div>
      </div>
    </Card>
  )
}

// Exploratory-analysis disclaimer + family-wise (Holm) control over the panel's
// inferential contrasts, so multiple unadjusted p-values aren't over-read.
function StatNotesCard({ tests, holm }: {
  tests: { key: string; label: string; p: number }[]
  holm: HolmResult[]
}) {
  if (tests.length === 0) return null
  const labelOf = new Map(tests.map(t => [t.key, t.label]))
  const anySurvive = holm.some(h => h.reject)
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Notas estadísticas — análisis exploratorio</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Este panel es <strong>exploratorio / generador de hipótesis</strong>: con tamaños de
        muestra de campo y múltiples contrastes, los valores p sin ajustar inflan el error
        tipo I. La tabla aplica la corrección de <strong>Holm–Bonferroni</strong> (control del
        error por familia, α = 0,05) sobre los {tests.length} contraste(s) mostrados.
      </p>
      {tests.length >= 2 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {holm.map(h => (
            <div key={h.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
              <span style={{ color: C.text, flex: 1, minWidth: 0 }}>{labelOf.get(h.key) ?? h.key}</span>
              <span className="tnum" style={{ color: C.hint, flexShrink: 0 }}>p = {fmtP(h.p)}</span>
              <span className="tnum" style={{ color: h.reject ? C.amber : C.muted, fontWeight: 600, minWidth: 110, textAlign: 'right', flexShrink: 0 }}>
                Holm {fmtP(h.pAdj)} {h.reject ? '✓' : '·'}
              </span>
            </div>
          ))}
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
            «✓» = sobrevive a la corrección por multiplicidad. Algunos contrastes son vistas
            alternativas de la misma hipótesis (p. ej. χ² y tendencia de estrato), por lo que
            Holm aquí es conservador.
            {!anySurvive && ' Con los datos actuales, ningún contraste sobrevive a la corrección.'}
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: C.hint }}>
          Un solo contraste disponible: sin ajuste por multiplicidad necesario.
        </p>
      )}
    </Card>
  )
}

function RRBox({ label, rr, lo, hi, fmt, highlight }: {
  label: string; rr: number; lo: number; hi: number; fmt: (x: number) => string; highlight?: boolean
}) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 10,
      background: highlight ? C.tealLight : C.bg,
      border: `1px solid ${highlight ? C.teal : C.border}`,
    }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div className="fd tnum" style={{ fontSize: 24, fontWeight: 600, color: highlight ? C.teal : C.text, lineHeight: 1 }}>
        {fmt(rr)}
      </div>
      <div className="tnum" style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>
        IC95% {fmt(lo)}–{fmt(hi)}
      </div>
    </div>
  )
}

function AssocRow({ g }: { g: AssocGroup }) {
  const fmt = (x: number) => (x * 100).toFixed(1)
  const sig = !g.rr.ref && (g.rr.lo > 1 || g.rr.hi < 1)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 13, color: C.text }}>
        Estrato {g.label} <span style={{ fontSize: 11, color: C.hint }}>(n = {g.total})</span>
      </span>
      <span style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>{fmt(g.prev.p)}%</span>
        <span style={{ fontSize: 11, color: sig ? C.amber : C.muted, minWidth: 118, textAlign: 'right' }}>
          {g.rr.ref ? 'referencia' : `RP ${g.rr.rr.toFixed(2)} [${g.rr.lo.toFixed(2)}–${g.rr.hi.toFixed(2)}]`}
        </span>
      </span>
    </div>
  )
}

function PrevalenceRow({ label, ci }: { label: string; ci: Proportion }) {
  const lowBase = ci.total > 0 && ci.total < 30
  const fmt = (x: number) => (x * 100).toFixed(1)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
        <span style={{ fontSize: 13, color: C.text }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.teal, flexShrink: 0 }}>
          {ci.total > 0 ? `${fmt(ci.p)}%` : '—'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, background: C.bg, borderRadius: 3 }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${ci.lo * 100}%`, width: `${Math.max(0, (ci.hi - ci.lo) * 100)}%`,
          background: `${C.teal}40`, borderRadius: 3,
        }} />
        <div style={{
          position: 'absolute', top: -1, bottom: -1,
          left: `calc(${ci.p * 100}% - 1px)`, width: 2, background: C.teal,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: C.muted }}>
          IC 95%: {ci.total > 0 ? `${fmt(ci.lo)}–${fmt(ci.hi)}%` : 'sin base'}
        </span>
        <span style={{ fontSize: 11, color: lowBase ? C.amber : C.hint }}>
          {ci.n}/{ci.total}{lowBase ? ' · base pequeña' : ''}
        </span>
      </div>
    </div>
  )
}
