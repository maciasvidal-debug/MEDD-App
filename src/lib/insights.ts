import { wilsonCI } from './stats'
import { pct } from './utils'

// ─── Auto-generated plain-language read-out ("Lectura rápida") ──────────────
// Translates the dashboard's key statistics into short, plain-Spanish takeaways
// so the investigator gets a first interpretation at a glance. Purely rule-based
// (offline) and explicitly framed as exploratory — the dashboard cards carry the
// full numbers and confirmatory modelling belongs in SPSS/Stata/R.
//
// The input is described structurally (only the fields each insight reads) so
// this module stays decoupled from the dashboard's richer result interfaces; the
// caller passes those objects directly (structural typing keeps it type-safe).

export type InsightTone = 'good' | 'warn' | 'info'
export interface Insight { id: string; tone: InsightTone; text: string }

export interface InsightInput {
  n: number
  nSob: number; nVenc: number; nDisp: number
  unidTotal: number; vencTotal: number
  assoc: { chi: { df: number; p: number; minExpected: number }; trend: { p: number; direction: string } | null } | null
  surveyorEffect: { chi: { df: number; p: number } | null; trend: { p: number } | null; icc: { icc: number } | null } | null
  adjusted: { mh: { rr: number; lo: number; hi: number }; pctChange: number; crude: { rr: number } } | null
  backcheck: { kappaBin: { kappa: number } | null; nPairs: number } | null
  retention: { median: number; max: number } | null
  medStats: { topExpiredDci: { name: string; value: number }[] } | null
  integrityCount: number
  tests: { key: string; label: string; p: number }[]
  holm: { key: string; reject: boolean }[]
}

// Spanish p-value formatting, mirrored from the dashboard so the wording matches.
const fmtP = (p: number) => (p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ','))
// Landis–Koch κ band label (the dashboard colours it; here we only need the word).
const kappaLabel = (k: number) =>
  k < 0.2 ? 'pobre' : k < 0.4 ? 'débil' : k < 0.6 ? 'moderada' : k < 0.8 ? 'buena' : 'muy buena'

export function buildInsights(d: InsightInput): Insight[] {
  const out: Insight[] = []
  const p1 = (x: number) => (x * 100).toFixed(1).replace('.', ',')
  const p0 = (x: number) => Math.round(x * 100)
  const add = (id: string, tone: InsightTone, text: string) => { out.push({ id, tone, text }) }

  // Representativeness / base size up front so every estimate is read with it.
  add('base', d.n < 30 ? 'warn' : 'info',
    `Lectura sobre ${d.n} hogar${d.n !== 1 ? 'es' : ''}.` +
    (d.n < 30 ? ' Base pequeña: las estimaciones tienen incertidumbre amplia — guíate por los intervalos de confianza, no por el punto.' : ''))

  // Headline outcome: confirmed expired meds at home, with its Wilson CI.
  if (d.n > 0) {
    const vc = wilsonCI(d.nVenc, d.n)
    add('venc', 'info',
      `${p1(vc.p)}% de los hogares tienen vencidos confirmados en casa (${d.nVenc}/${d.n}; IC95% ${p0(vc.lo)}–${p0(vc.hi)}%).`)
  }

  if (d.unidTotal > 0) {
    add('carga', 'info',
      `${d.vencTotal} de ${d.unidTotal} unidades almacenadas están vencidas (${pct(d.vencTotal, d.unidTotal)}%).`)
  }

  if (d.n > 0) {
    const knows = d.nSob > 0 ? pct(d.nDisp, d.nSob) : null
    add('almac', knows !== null && knows < 50 ? 'warn' : 'info',
      `${pct(d.nSob, d.n)}% almacena medicamentos sin consumir` +
      (knows !== null ? `; de ellos, ${knows}% sabe cómo desecharlos.` : '.'))
  }

  // Socioeconomic gradient.
  if (d.assoc) {
    const { chi, trend } = d.assoc
    const sig = chi.df > 0 && chi.p < 0.05
    const trendSig = trend !== null && trend.p < 0.05
    add('assoc', 'info', (sig || trendSig)
      ? `La prevalencia de vencidos difiere por estrato (χ² p = ${fmtP(chi.p)})` +
        (trendSig ? `, con gradiente ${trend!.direction} a lo largo del estrato` : '') +
        ' — posible patrón socioeconómico a explorar.'
      : `Sin evidencia de asociación entre estrato y vencidos (χ² p = ${fmtP(chi.p)}).`)
    if (chi.minExpected < 5) {
      add('assoc-cell', 'warn',
        'Algunas celdas esperadas son <5: el χ² es poco fiable aquí; usa una prueba exacta (Fisher) en tu software estadístico.')
    }
  }

  // Confounding by surveyor program (crude vs MH-adjusted).
  if (d.adjusted) {
    const { mh, pctChange, crude } = d.adjusted
    const adjSig = mh.lo > 1 || mh.hi < 1
    add('mh', pctChange >= 10 ? 'warn' : 'info', pctChange >= 10
      ? `El programa del encuestador confunde la asociación estrato→vencidos: la RP pasa de ${crude.rr.toFixed(2)} (cruda) a ${mh.rr.toFixed(2)} (ajustada, ${pctChange.toFixed(0)}% de cambio). Reporta la ajustada.`
      : `La asociación estrato→vencidos ${adjSig ? 'se mantiene' : 'no es'} significativa tras ajustar por el encuestador (RP ajustada ${mh.rr.toFixed(2)}, IC95% ${mh.lo.toFixed(2)}–${mh.hi.toFixed(2)}).`)
  }

  // Surveyor (inter-observer) effect — a data-quality flag, not a real effect.
  if (d.surveyorEffect) {
    const { chi, trend, icc } = d.surveyorEffect
    const flagged =
      (chi !== null && chi.df > 0 && chi.p < 0.05) ||
      (trend !== null && trend.p < 0.05) ||
      (icc !== null && icc.icc >= 0.05)
    add('surv', flagged ? 'warn' : 'good', flagged
      ? 'Hay señal de variabilidad entre encuestadores en el desenlace — revisa criterios/capacitación (y el agrupamiento) antes de leerlo como efecto real.'
      : 'Sin señal de efecto del encuestador: el desenlace no depende de quién recolectó.')
  }

  // Back-check reliability.
  if (d.backcheck?.kappaBin) {
    const k = d.backcheck.kappaBin.kappa
    add('bc', k < 0.6 ? 'warn' : 'good',
      `Concordancia inter-observador ${kappaLabel(k)} (κ = ${k.toFixed(2)}) sobre ${d.backcheck.nPairs} par${d.backcheck.nPairs !== 1 ? 'es' : ''} de back-check` +
      (k < 0.6 ? ' — revisa fiabilidad/capacitación.' : '.'))
  }

  if (d.integrityCount > 0) {
    add('integ', 'warn',
      `${d.integrityCount} encuesta${d.integrityCount !== 1 ? 's' : ''} declara${d.integrityCount !== 1 ? 'n' : ''} vencidos sin detalle de producto: corrígelas o haz back-check (no entran al análisis por producto).`)
  }

  if (d.retention) {
    add('ret', 'info',
      `Los medicamentos vencidos permanecen una mediana de ${Math.round(d.retention.median)} días en el hogar (hasta ${Math.round(d.retention.max)}) — la ventana de riesgo sanitario y ambiental.`)
  }

  if (d.medStats && d.medStats.topExpiredDci.length > 0) {
    const top = d.medStats.topExpiredDci[0]
    add('med', 'info', `El principio activo con más productos vencidos es ${top.name} (${top.value}).`)
  }

  // Multiplicity control over the inferential family.
  if (d.tests.length >= 2) {
    const labelOf = new Map(d.tests.map(t => [t.key, t.label]))
    const survivors = d.holm.filter(h => h.reject).map(h => labelOf.get(h.key) ?? h.key)
    add('holm', survivors.length > 0 ? 'info' : 'warn', survivors.length > 0
      ? `Tras corregir por comparaciones múltiples (Holm), sobrevive${survivors.length !== 1 ? 'n' : ''}: ${survivors.join('; ')}.`
      : 'Ningún contraste sobrevive a la corrección por comparaciones múltiples: trata los hallazgos como generadores de hipótesis, no como confirmados.')
  }

  return out
}
