import React, { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
} from 'recharts'
import { TopBar } from '../components/layout'
import { StatCard, Card, Button, EmptyState, C } from '../components/ui'
import { useStore } from '../lib/store'
import { pct, wilsonCI, prevalenceRatio, chiSquareTest, cochranArmitage, quantile, productMetrics, type Proportion, type RiskRatio, type ChiSquare, type TrendTest } from '../lib/utils'
import { OPT } from '../lib/constants'
import type { Survey } from '../types'

// ─── DASHBOARD ────────────────────────────────────────────────────────────
// Split into its own lazily-loaded chunk: Recharts is heavy and only this view
// uses it, so it must not weigh down the initial bundle (see App.tsx Suspense).

// Chart helpers declared at module scope (not inside DashboardPage's render)
// so they keep a stable identity across renders — see react-hooks/static-components.
const tipStyle = {
  background: C.surface, border: `0.5px solid ${C.border}`,
  borderRadius: 6, padding: '5px 9px', fontSize: 12,
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
        <Pie data={data} cx={36} cy={36} innerRadius={22} outerRadius={34} dataKey="v" stroke="none">
          <Cell fill={color} />
          <Cell fill="#E2E8F0" />
        </Pie>
      </PieChart>
      <span style={{ fontSize: 16, fontWeight: 500, color }}>{pct(val, outOf)}%</span>
      <span style={{ fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
      <span style={{ fontSize: 11, color: C.hint }}>{val}/{outOf}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { surveys, openWizard, userRole } = useStore()
  const isInvestigador = userRole === 'investigador'
  const n = surveys.length

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
    for (let i = 0; i < surveys.length; i++) {
      const s = surveys[i]
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
  }, [surveys])

  const assoc = useMemo(() => buildEstratoAssociation(surveys), [surveys])
  const retention = useMemo(() => buildRetention(surveys), [surveys])

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

        {/* Role badge */}
        {isInvestigador && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#EFF6FF', border: '0.5px solid #BFDBFE',
            borderRadius: 8, padding: '7px 10px', marginBottom: 12,
          }}>
            <i className="ti ti-shield-check" style={{ color: '#1D4ED8', fontSize: 14 }} />
            <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 500 }}>
              Vista de investigador — datos agregados de todos los encuestadores
            </span>
          </div>
        )}

        {/* KPIs */}
        <p style={{ fontSize: 11, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Indicadores clave · {n} encuesta{n !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
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
            <MiniDonut val={nSob}  outOf={n}    label="Med. sin consumir"   color={C.navy} />
            <MiniDonut val={nVenc} outOf={n}    label="Vencidos conf."      color={C.amber} />
            <MiniDonut val={nDisp} outOf={nSob} label="Conoce disposición*" color={C.teal} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, textAlign: 'center', lineHeight: 1.5 }}>
            «Med. sin consumir» y «Vencidos conf.» sobre el total ({n} hogares).
            <br />*«Conoce disposición» se calcula solo sobre los {nSob} hogares que almacenan medicamentos.
          </p>
        </Card>

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

        {/* Tiempo de retención de vencidos */}
        {retention && <RetentionCard s={retention} />}

        {/* Hotspots geográficos: CIUDAD x CANT_MED_VTO */}
        {ciudadVenc.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Hotspots geográficos — Unidades vencidas por ciudad</SectionLabel>
            <div style={{ height: Math.max(80, ciudadVenc.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ciudadVenc} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="value" fill={C.amber} radius={[0, 3, 3, 0]} name="Unidades vencidas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* ESTRATO distribution */}
        {barEstrato.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Distribución por estrato socioeconómico</SectionLabel>
            <div style={{ height: Math.max(80, barEstrato.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barEstrato} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill={C.navy} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* AS_SALUD */}
        {barAsSalud.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Distribución por régimen de salud</SectionLabel>
            <div style={{ height: Math.max(80, barAsSalud.length * 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barAsSalud} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill={C.teal} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* NV_ESTU */}
        {barNvEstu.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Distribución por nivel educativo</SectionLabel>
            <div style={{ height: Math.max(80, barNvEstu.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barNvEstu} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill="#7030A0" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* NV_POSG */}
        {barNvPosg.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Distribución por formación posgrado</SectionLabel>
            <div style={{ height: Math.max(80, barNvPosg.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barNvPosg} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill="#9B59B6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Etnia */}
        {barEtnia.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Distribución por pertenencia étnica</SectionLabel>
            <div style={{ height: Math.max(80, barEtnia.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barEtnia} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="n" fill={C.gray} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
      {children}
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
        <span style={{ fontSize: 22, fontWeight: 600, color: C.amber }}>{Math.round(s.median)} d</span>
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
function buildEstratoAssociation(surveys: Survey[]): Association | null {
  const defs = [
    { label: 'bajo (1–2)',  min: 1, max: 2 },
    { label: 'medio (3–4)', min: 3, max: 4 },
    { label: 'alto (5–6)',  min: 5, max: 6 },
  ]
  const acc = defs.map(d => ({ ...d, total: 0, cases: 0 }))
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
