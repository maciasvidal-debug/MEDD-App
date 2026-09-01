import { useState } from 'react'
import { Card, C, CHART } from '../../components/ui'
import { SectionLabel } from './Navigation'
import { INSIGHT_TONE } from './constants'
import { STAT_GLOSSARY } from '../../data/statGlossary'
import { DistBar } from './Charts'
import { type TextAnalysisResult } from '../../lib/text-analysis'
import { type Insight } from '../../lib/insights'
import type { Survey } from '../../types'

// ─── Shared insight band (qualitative sections) ──────────────────────────────
// Same visual contract as QuickReadCard but embeddable inside other cards.

export function InsightBand({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      {insights.map(i => {
        const t = INSIGHT_TONE[i.tone]
        return (
          <div key={i.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 15, color: t.color, marginTop: 1, flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>{i.text}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Observations field panel ─────────────────────────────────────────────────
// Shows all non-empty obs with metadata and a live keyword search.

export function ObsFieldCard({ result, surveys }: { result: TextAnalysisResult; surveys: Survey[] }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)

  const withObs = surveys.filter(s => s.obs?.trim())
  const q = search.trim().toLowerCase()
  const filtered = q ? withObs.filter(s => s.obs.toLowerCase().includes(q)) : withObs
  const PREVIEW = 5
  const shown = expanded ? filtered : filtered.slice(0, PREVIEW)

  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.obsField}>Observaciones de campo — corpus</SectionLabel>
      <InsightBand insights={result.obsInsights} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          flex: 1, background: C.bg, borderRadius: 8, padding: '8px 12px',
          fontSize: 13, color: C.text, border: `1px solid ${C.border}`,
        }}>
          <strong className="tnum" style={{ color: C.teal }}>{result.nWithObs}</strong>
          <span style={{ color: C.muted }}> / {result.n} encuestas con observación</span>
          <span style={{ color: C.hint, marginLeft: 8 }}>
            ({result.n > 0 ? (result.nWithObs / result.n * 100).toFixed(1).replace('.', ',') : '0,0'}%)
          </span>
        </div>
      </div>

      {result.nWithObs > 0 && (
        <>
          <input
            type="search"
            placeholder="Buscar en observaciones..."
            value={search}
            onChange={e => { setSearch(e.target.value); setExpanded(false) }}
            aria-label="Buscar en observaciones"
            style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
          />

          {filtered.length === 0 ? (
            <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '12px 0' }}>
              Sin observaciones que coincidan con "{search}".
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: '10px 12px', borderRadius: 8, background: C.bg,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: C.hint, marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{s.fEta}</span>
                    {s.nuiEtr && <span>· NUI {s.nuiEtr}</span>}
                    {s.ciudad && <span>· {s.ciudad}</span>}
                    {s.estrato && <span>· E{s.estrato}</span>}
                    <span className="tnum" style={{ marginLeft: 'auto', color: C.hint }}>#{String(s.nui).padStart(3, '0')}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {q
                      ? s.obs.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, idx) =>
                          part.toLowerCase() === q
                            ? <mark key={idx} style={{ background: `${C.teal}30`, color: C.teal, borderRadius: 2, padding: '0 1px' }}>{part}</mark>
                            : part
                        )
                      : s.obs}
                  </p>
                </div>
              ))}

              {filtered.length > PREVIEW && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  style={{
                    background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: C.muted,
                    fontWeight: 600,
                  }}
                >
                  {expanded ? 'Ver menos' : `Ver ${filtered.length - PREVIEW} más…`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ─── Word cloud (tag-cloud) ───────────────────────────────────────────────────
// Font size scales linearly with frequency. No SVG layout algorithm needed —
// CSS flex-wrap produces a readable cloud without external dependencies.

export function WordCloud({ terms }: { terms: { term: string; count: number }[] }) {
  if (terms.length === 0) return null
  const maxCount = terms[0].count
  const colors = [CHART.teal, CHART.navy, CHART.purple, CHART.amber, CHART.gray]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px', padding: '4px 0 12px' }}>
      {terms.map((t, idx) => {
        const ratio = maxCount > 0 ? t.count / maxCount : 0
        const fontSize = Math.round(11 + ratio * 17)
        const color = colors[Math.floor(idx / Math.ceil(terms.length / colors.length)) % colors.length]
        const opacity = 0.45 + ratio * 0.55
        return (
          <span
            key={t.term}
            title={`${t.term}: ${t.count} ${t.count === 1 ? 'vez' : 'veces'}`}
            style={{
              fontSize, fontWeight: ratio > 0.5 ? 700 : ratio > 0.25 ? 600 : 400,
              color, opacity, cursor: 'default', lineHeight: 1.2,
            }}
          >
            {t.term}
          </span>
        )
      })}
    </div>
  )
}

// ─── Discourse analysis card ──────────────────────────────────────────────────

export function DiscourseCard({ result }: { result: TextAnalysisResult }) {
  const { topTerms, bigrams, discourseInsights } = result
  const [tab, setTab] = useState<'cloud' | 'bars' | 'bigrams'>('cloud')

  const barData = topTerms.slice(0, 15).map(t => ({ name: t.term, n: t.count }))

  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.discourse}>Análisis discursivo</SectionLabel>
      <InsightBand insights={discourseInsights} />

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['cloud', 'Nube de términos'], ['bars', 'Frecuencias'], ['bigrams', 'Bigramas']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '5px 12px', borderRadius: 7, border: `1px solid ${tab === key ? C.teal : C.border}`,
              background: tab === key ? C.tealLight : C.bg, color: tab === key ? C.teal : C.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cloud' && (
        topTerms.length > 0
          ? <WordCloud terms={topTerms} />
          : <p style={{ fontSize: 12, color: C.hint }}>Sin términos suficientes.</p>
      )}

      {tab === 'bars' && (
        barData.length > 0
          ? <DistBar data={barData} color={CHART.teal} yWidth={90} barName="Ocurrencias" />
          : <p style={{ fontSize: 12, color: C.hint }}>Sin datos.</p>
      )}

      {tab === 'bigrams' && (
        bigrams.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bigrams.map((bg, i) => (
              <div key={bg.term} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: C.hint, minWidth: 18, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ flex: 1, background: C.bg, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(bg.count / (bigrams[0]?.count || 1)) * 100}%`,
                    background: `${CHART.navy}30`, height: 28,
                    display: 'flex', alignItems: 'center', padding: '0 10px',
                    minWidth: 'max-content',
                  }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{bg.term}</span>
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 13, color: C.navy, fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{bg.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: C.hint }}>
            Sin bigramas con frecuencia ≥ 2. El corpus es pequeño o las observaciones son muy heterogéneas.
          </p>
        )
      )}

      <p style={{ margin: '12px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Términos tras eliminar palabras vacías (artículos, preposiciones, verbos auxiliares).
        Base: {result.nWithObs} observaciones · {topTerms.reduce((a, t) => a + t.count, 0)} ocurrencias totales.
        El análisis discursivo es exploratorio — para análisis de contenido riguroso usa un software especializado (Atlas.ti, MAXQDA, NVivo).
      </p>
    </Card>
  )
}

// ─── Hermeneutic analysis card ────────────────────────────────────────────────

export function HermeneuticCard({ result }: { result: TextAnalysisResult }) {
  const { themes, cooccurrence, hermeneuticInsights } = result
  const [showMatrix, setShowMatrix] = useState(false)

  const maxSurveys = themes[0]?.surveys ?? 1

  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.hermeneutic}>Análisis hermenéutico — categorías temáticas</SectionLabel>
      <InsightBand insights={hermeneuticInsights} />

      {themes.length === 0 ? (
        <p style={{ fontSize: 12, color: C.hint }}>
          Sin categorías detectadas. Amplía el diccionario temático o revisa la cobertura de observaciones.
        </p>
      ) : (
        <>
          {/* Theme distribution bars */}
          <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Número de encuestas que activan cada categoría temática (una encuesta puede activar varias).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {themes.map(t => {
              const THEME_COLORS: Record<string, string> = {
                'Acceso y dispensación':       CHART.teal,
                'Conocimiento del paciente':   CHART.navy,
                'Conducta de almacenamiento':  CHART.purple,
                'Calidad del dato':            CHART.amber,
                'Entorno social':              CHART.gray,
                'Señal de alarma':             CHART.red,
              }
              const color = THEME_COLORS[t.theme] ?? CHART.teal
              const barW = maxSurveys > 0 ? (t.surveys / maxSurveys) * 100 : 0
              return (
                <div key={t.theme}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{t.theme}</span>
                    <span style={{ fontSize: 12, color, fontWeight: 700 }} className="tnum">
                      {t.surveys} ({(t.pct * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.8 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Co-occurrence matrix (collapsible) */}
          {cooccurrence.labels.length >= 2 && (
            <>
              <button
                onClick={() => setShowMatrix(m => !m)}
                style={{
                  background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '7px 12px', cursor: 'pointer', fontSize: 12, color: C.muted,
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className={`ti ${showMatrix ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 14 }} aria-hidden />
                {showMatrix ? 'Ocultar' : 'Ver'} matriz de co-ocurrencia temática
              </button>

              {showMatrix && (
                <div style={{ marginTop: 12, overflowX: 'auto' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
                    Número de encuestas en que dos temas aparecen simultáneamente. La intensidad del color es proporcional a la co-ocurrencia.
                    Celdas vacías (·) = sin co-ocurrencia.
                  </p>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '4px 6px', color: C.hint, fontWeight: 400, textAlign: 'left', minWidth: 140 }}></th>
                        {cooccurrence.labels.map(label => (
                          <th
                            key={label}
                            title={label}
                            style={{ padding: '4px 6px', color: C.muted, fontWeight: 600, textAlign: 'center', minWidth: 48, maxWidth: 56, fontSize: 10 }}
                          >
                            {label.slice(0, 6)}…
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cooccurrence.labels.map((rowLabel, i) => {
                        const maxCooc = Math.max(...cooccurrence.matrix.flat())
                        return (
                          <tr key={rowLabel}>
                            <td style={{ padding: '4px 6px', color: C.text, fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>
                              {rowLabel}
                            </td>
                            {cooccurrence.labels.map((_, j) => {
                              const val = cooccurrence.matrix[i]?.[j] ?? 0
                              const share = maxCooc > 0 ? val / maxCooc : 0
                              return (
                                <td
                                  key={j}
                                  title={val > 0 ? `${rowLabel} + ${cooccurrence.labels[j]}: ${val} encuesta(s)` : undefined}
                                  className="tnum"
                                  style={{
                                    padding: '4px 6px', textAlign: 'center',
                                    background: i === j
                                      ? C.bg
                                      : val > 0
                                        ? `color-mix(in srgb, ${CHART.teal} ${Math.round(share * 65)}%, transparent)`
                                        : 'transparent',
                                    color: val > 0 && i !== j ? C.text : C.hint,
                                    fontWeight: val > 0 ? 600 : 400,
                                    borderTop: `0.5px solid ${C.border}`,
                                    borderLeft: `0.5px solid ${C.border}`,
                                  }}
                                >
                                  {i === j ? '·' : val > 0 ? val : '·'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      <p style={{ margin: '14px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.55 }}>
        Categorización automática por diccionario de palabras clave.
        Una observación puede activar varias categorías simultáneamente.
        Valida con lectura directa del corpus antes de reportar conclusiones hermenéuticas.
      </p>
    </Card>
  )
}
