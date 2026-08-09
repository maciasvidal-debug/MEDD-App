import { type Proportion } from '../../lib/stats'
import { Card, C } from '../../components/ui'
import { pct } from '../../lib/utils'
import { INSIGHT_TONE, STAT_GLOSSARY } from './constants'
import { SectionLabel } from './Navigation'
import { type Insight } from '../../lib/insights'

export function QuickReadCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.lecturaRapida}>Lectura rápida — primeros insights</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Síntesis automática, en lenguaje sencillo, de lo que muestran los indicadores y las pruebas de abajo.
        Es una <strong>lectura exploratoria</strong> para orientar la mirada, no un resultado confirmatorio.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map(i => {
          const t = INSIGHT_TONE[i.tone]
          return (
            <div key={i.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 16, color: t.color, marginTop: 1, flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{i.text}</span>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 12, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 11, color: C.hint, lineHeight: 1.55 }}>
        <strong style={{ color: C.muted }}>Próximos pasos (análisis fino):</strong> confirma estas señales en SPSS, Stata o R —
        p. ej. regresión log-binomial o de Poisson para razones de prevalencia ajustadas, modelos multinivel (mixtos)
        para el agrupamiento por encuestador, y pruebas exactas cuando haya celdas pequeñas. Exporta el CSV desde los filtros.
      </div>
    </Card>
  )
}


export function PrevalenceRow({ label, ci }: { label: string; ci: Proportion }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{label}</span>
        <span className="tnum" style={{ fontSize: 12, color: C.navy, fontWeight: 600 }}>
          {pct(ci.p, 1)}%
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${ci.lo * 100}%`, right: `${(1 - ci.hi) * 100}%`,
            background: C.navy, borderRadius: 3, opacity: 0.2
          }} />
          <div style={{
            position: 'absolute', top: -2, bottom: -2, width: 2,
            left: `calc(${ci.p * 100}% - 1px)`, background: C.navy, borderRadius: 1
          }} />
        </div>
        <span className="tnum" style={{ fontSize: 10, color: C.hint, minWidth: 65, textAlign: 'right' }}>
          IC: {pct(ci.lo, 1)}–{pct(ci.hi, 1)}%
        </span>
      </div>
    </div>
  )
}

export function PrevalenceCard({ rows }: { rows: Array<{ label: string; ci: Proportion }> }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.prevalencia}>Prevalencias estimadas</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(r => <PrevalenceRow key={r.label} label={r.label} ci={r.ci} />)}
      </div>
    </Card>
  )
}
