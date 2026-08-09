import React from 'react'
import { Card, C, CHART, HelpTip } from '../../components/ui'
import { DistBar, MiniDonut } from './Charts'
import { SectionLabel } from './Navigation'
import { pct } from '../../lib/utils'
import {
  type MedStats, type MotiveStats, type DisposalStats, type ClassMotiveCross
} from '../../lib/dashboard-metrics'

// ─── Product-level analytics (medications[]) ────────────────────────────────

export function MedicationStatsCard({ s }: { s: MedStats }) {
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

export function MedKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: C.bg }}>
      <div className="fd tnum" style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      {sub && <div className="tnum" style={{ fontSize: 10.5, color: C.hint, marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{label}</div>
    </div>
  )
}

export function SubLabel({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
      <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>{children}</span>
      {help && <HelpTip text={help} label={typeof children === 'string' ? children : undefined} />}
    </div>
  )
}

// ─── Motives battery analytics (instrument v2, version-aware denominators) ───

export function MotivesCard({ s }: { s: MotiveStats }) {
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

      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Respuestas de selección múltiple: los porcentajes por opción pueden sumar más de 100%.
        La conducta de disposición se analiza aparte (v1 + v2 unificados).
      </p>
    </Card>
  )
}

// ─── Disposal behaviour, unified across instrument versions ─────────────────

export function DisposalCard({ d }: { d: DisposalStats }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Conducta de disposición (v1 + v2 unificada)</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Qué hacen los hogares con los medicamentos que ya no usan, combinando el dato estructurado
        (v2) con el texto libre histórico (v1) reclasificado por palabras clave. Base: <strong>{d.base}</strong> hogar(es)
        con información de disposición.
      </p>
      {d.byCategory.length > 0 && (
        <DistBar data={d.byCategory} color={CHART.teal} yWidth={170} barName="Hogares" />
      )}
      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Fuente: {d.fromStructured} estructurado(s) (v2) · {d.fromText} de texto libre (v1)
        {d.unclassifiedText > 0 && <>, de los cuales {d.unclassifiedText} no pudo clasificarse</>}.
        Selección múltiple: las barras pueden sumar más que la base.
      </p>
    </Card>
  )
}

// ─── Therapeutic class × non-consumption motive (contingency) ───────────────

export function ClassMotiveCard({ c }: { c: ClassMotiveCross }) {
  const { motives, rows, nBase } = c
  const th: React.CSSProperties = { padding: '6px 8px', fontSize: 11, color: C.muted, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'bottom' }
  const td: React.CSSProperties = { padding: '5px 8px', fontSize: 12, textAlign: 'right', borderTop: `0.5px solid ${C.border}` }
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Clase terapéutica × motivo de no consumo</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Hogares (instrumento v2 con medicamentos) que <strong>almacenan</strong> cada grupo terapéutico,
        según el <strong>motivo de no consumo</strong> declarado. Base: {nBase} hogar(es). Un hogar
        cuenta en cada grupo que guarda; el sombreado es la proporción sobre la base del grupo (fila).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Grupo</th>
              <th style={th}>n</th>
              {motives.map(mo => <th key={mo} style={th}>{mo}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const max = Math.max(...r.counts, 0)
              return (
                <tr key={r.group}>
                  <td style={{ ...td, textAlign: 'left', color: C.text, fontWeight: 600 }}>{r.group}</td>
                  <td style={{ ...td, color: C.muted }} className="tnum">{r.base}</td>
                  {r.counts.map((n, i) => {
                    const share = r.base > 0 ? n / r.base : 0
                    return (
                      <td
                        key={i}
                        className="tnum"
                        title={`${pct(n, r.base)}% de ${r.group} (n=${r.base})`}
                        style={{
                          ...td,
                          background: n > 0 ? `color-mix(in srgb, ${C.teal} ${Math.round(share * 70)}%, transparent)` : 'transparent',
                          color: n === 0 ? C.hint : C.text,
                          fontWeight: n > 0 && n === max ? 700 : 400,
                        }}
                      >
                        {n || '·'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Exploratorio y de selección múltiple (las filas pueden sumar más del 100%). Celdas pequeñas:
        interpretar con cautela. Pasa el cursor sobre una celda para ver el % sobre la base del grupo.
      </p>
    </Card>
  )
}
