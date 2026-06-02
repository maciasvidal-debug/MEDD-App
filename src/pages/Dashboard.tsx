import React, { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
} from 'recharts'
import { TopBar } from '../components/layout'
import { StatCard, Card, Button, EmptyState, C } from '../components/ui'
import { useStore } from '../lib/store'
import { pct } from '../lib/utils'
import { OPT } from '../lib/constants'

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
    barAsSalud, barNvEstu, barEtnia, barEstrato, ciudadVenc
  } = useMemo(() => {
    let nSob = 0, nVenc = 0, nDisp = 0
    let pesoTotal = 0, unidTotal = 0, vencTotal = 0, totalMeds = 0

    const asSaludCounts: Record<string, number> = {}
    const nvEstuCounts: Record<string, number> = {}
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
      if (s.etnia) etniaCounts[s.etnia] = (etniaCounts[s.etnia] || 0) + 1
      if (s.estrato !== null && s.estrato !== undefined) estratoCounts[s.estrato] = (estratoCounts[s.estrato] || 0) + 1

      const ciudadKey = String(s.ciudad ?? 'Sin dato') || 'Sin dato'
      ciudadVencMap.set(ciudadKey, (ciudadVencMap.get(ciudadKey) ?? 0) + (s.cantMedVto ?? 0))
    }

    const barAsSalud = OPT.asSalud.map(v => ({ name: v, n: asSaludCounts[v] || 0 })).filter(d => d.n > 0)
    const barNvEstu  = OPT.nvEstu.map(v => ({ name: v, n: nvEstuCounts[v] || 0 })).filter(d => d.n > 0)
    const barEtnia   = OPT.etnia.map(v => ({ name: v, n: etniaCounts[v] || 0 })).filter(d => d.n > 0)
    const barEstrato = OPT.estrato.map(e => ({ name: `Estrato ${e}`, n: estratoCounts[e] || 0 })).filter(d => d.n > 0)

    const ciudadVenc = Array.from(ciudadVencMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .filter(d => d.name && d.name !== 'Sin dato')
      .slice(0, 8)

    return {
      nSob, nVenc, nDisp, pesoTotal, unidTotal, vencTotal, totalMeds,
      barAsSalud, barNvEstu, barEtnia, barEstrato, ciudadVenc
    }
  }, [surveys])

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
            <MiniDonut val={nDisp} outOf={n} label="Conoce disposición" color={C.teal} />
            <MiniDonut val={nSob}  outOf={n} label="Med. sin consumir"  color={C.navy} />
            <MiniDonut val={nVenc} outOf={n} label="Vencidos conf."     color={C.amber} />
          </div>
        </Card>

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
