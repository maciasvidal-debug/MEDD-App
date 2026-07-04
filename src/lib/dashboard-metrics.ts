import {
  wilsonCI, prevalenceRatio, chiSquareTest, cochranArmitage, mantelHaenszelRR,
  iccBinary, breslowDay, quantile, terminalDigitTest, cohenKappa,
  type Proportion, type RiskRatio, type ChiSquare, type TrendTest,
  type MHResult, type ICCResult, type Stratum2x2, type DigitTest, type KappaResult,
} from './stats'
import { productMetrics } from './date'
import { pct } from './utils'
import { therapeuticGroup, therapeuticSubgroup, SIN_CLASIFICAR } from './atc'
import { disposalCategories } from './disposal'
import { OPT } from './constants'
import type { Survey } from '../types'

// Pure data-derivation layer for the analytics dashboard. Each build* function
// maps the survey dataset to a summary object consumed by a card in
// pages/Dashboard.tsx. Extracted from that component so this — the app's
// epidemiological core — is unit-testable and covered by the coverage gate,
// which scopes to src/lib/**. The presentational cards stay in Dashboard.tsx.

// ─── Retention time of expired medications (days-overdue distribution) ──────

export interface DaysSummary { n: number; median: number; q1: number; q3: number; p90: number; max: number }

// Distribution of how many days each expired product has been past its expiry
// at the time of the interview (t_vto = f_eta − f_vto, only when > 0). This
// quantifies the risk window during which expired meds linger in the home.
export function buildRetention(surveys: Survey[]): DaysSummary | null {
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

// ─── Exposure → outcome association (estrato gradient) ──────────────────────

export interface AssocGroup { label: string; total: number; cases: number; prev: Proportion; rr: RiskRatio }
export interface Association { groups: AssocGroup[]; chi: ChiSquare; trend: TrendTest | null; ref: string }

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

// Tests whether harbouring confirmed expired meds (vtoMedNc='Sí') is associated
// with socioeconomic stratum. Estrato is collapsed to Bajo/Medio/Alto so cells
// stay large enough for the chi-square; the lowest present group is the PR
// reference. Outcome base = all households in the group (a non-storing home has
// zero expired stored meds by definition, so the denominator is valid).
export function buildEstratoAssociation(surveys: Survey[]): Association | null {
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

// ─── Surveyor (interviewer) effect — data-quality stratification ────────────

export interface SurveyorEffect {
  programs: AssocGroup[] | null   // outcome prevalence by surveyor program
  chi: ChiSquare | null
  ref: string
  trend: TrendTest | null         // outcome trend across academic semester (ordinal)
  nSemester: number               // surveys carrying a semester value
  icc: ICCResult | null           // clustering of the outcome by surveyor (nuiEtr)
}

// Tally {total, cases} per group key, skipping rows whose key is null/empty.
// Shared by the program / semester / surveyor breakdowns below.
function groupCases<K>(
  surveys: Survey[],
  keyOf: (s: Survey) => K | null | undefined,
  isCase: (s: Survey) => boolean,
): Map<K, { total: number; cases: number }> {
  const m = new Map<K, { total: number; cases: number }>()
  for (const s of surveys) {
    const k = keyOf(s)
    if (k == null || (k as unknown) === '') continue
    const g = m.get(k) ?? { total: 0, cases: 0 }
    g.total++
    if (isCase(s)) g.cases++
    m.set(k, g)
  }
  return m
}

// Quantifies whether the confirmed-expired outcome (vtoMedNc='Sí') varies by the
// SURVEYOR's profile rather than the household. A real epidemiological signal
// shouldn't depend on who collected the data, so a significant difference here is
// read as a measurement / inter-observer quality flag, not a true effect. Program
// is categorical (chi-square + PR vs the most-sampled program); academic semester
// is ordinal, so it also gets a Cochran–Armitage trend test.
export function buildSurveyorEffect(surveys: Survey[]): SurveyorEffect | null {
  const isCase = (s: Survey) => s.vtoMedNc === 'Sí'

  // By program
  const progEntries = Array.from(groupCases(surveys, s => s.etrPrograma, isCase).entries())

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
  const semMap = groupCases(surveys, s => s.etrSemestre, isCase)
  const nSemester = Array.from(semMap.values()).reduce((sum, g) => sum + g.total, 0)
  const trend = semMap.size >= 2
    ? cochranArmitage(
        Array.from(semMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([score, g]) => ({ score, n: g.total, cases: g.cases })),
      )
    : null

  // Outcome clustering by surveyor (nuiEtr) → intraclass correlation
  const icc = iccBinary(
    Array.from(groupCases(surveys, s => s.nuiEtr, isCase).values())
      .map(g => ({ n: g.total, cases: g.cases })),
  )

  if (!programs && !trend && !icc) return null
  return { programs, chi, ref, trend, nSemester, icc }
}

// ─── Per-surveyor operational QC (para-data / fraud monitoring) ─────────────

export interface SurveyorQCRow {
  nuiEtr: number; n: number; completeness: number; straightPct: number
  vencPct: number; medianDurSec: number | null; fastCount: number
}
export interface SurveyorQC { rows: SurveyorQCRow[]; poolVencPct: number; digit: DigitTest | null }

// Always-applicable fields (not behind skip logic) used for a fill-rate proxy.
const QC_KEY_FIELDS: (keyof Survey)[] = [
  'fEta', 'fNac', 'ciudad', 'estrato', 'etnia', 'asSalud', 'estLab',
  'ingreso', 'nvEstu', 'perSalud', 'estSalud', 'medSob',
]
const QC_SINO_FIELDS: (keyof Survey)[] = [
  'estSalud', 'conMed', 'medPrc', 'indMed', 'medSob', 'dispMedVc', 'vtoMedNc',
]
export const FAST_SECONDS = 120 // a full 6-step interview under 2 min is implausibly fast

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

// Per-surveyor data-quality signals to prioritise back-checks: completeness,
// straightlining, interview speed and outcome rate vs the pool, plus a pooled
// terminal-digit test on the measured weight (digit preference → fabrication).
export function buildSurveyorQC(surveys: Survey[]): SurveyorQC | null {
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

// ─── Product-level analytics (medications[]) ────────────────────────────────

export interface MedStats {
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
export function buildMedicationStats(surveys: Survey[]): MedStats | null {
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

// ─── Motives battery analytics (instrument v2, version-aware denominators) ───

export interface MotiveStats {
  nAsked:        number   // v2 surveys that store meds → shown the battery
  nNotAsked:     number   // v1 surveys → battery not in the instrument
  nExpiredAsked: number   // subset also asked the expiry-reason block
  noConsumo:     Array<{ name: string; n: number }>
  vencimiento:   Array<{ name: string; n: number }>
  conoceSi:      number
  conoceBase:    number
}

// Aggregates the multi-select motive answers. Crucially, the denominator is the
// set of records that were actually ASKED — instrument v2 with stored meds — so
// percentages aren't diluted by older "not asked" records (those are reported
// separately as nNotAsked). A record is v1 when instrumentVersion is absent/<2.
export function buildMotiveStats(surveys: Survey[]): MotiveStats | null {
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
    conoceSi:    asked.filter(s => s.conocePuntos === 'Sí').length,
    conoceBase:  asked.filter(s => s.conocePuntos === 'Sí' || s.conocePuntos === 'No').length,
  }
}

// ─── Disposal behaviour, unified across instrument versions ─────────────────

export interface DisposalStats {
  base:             number   // homes (medSob=Sí) with disposal info (structured or text)
  fromStructured:   number   // contributed via dispFinal[] (v2)
  fromText:         number   // contributed via legacy free-text ctoDispVc (v1)
  unclassifiedText: number   // had legacy text but no category could be derived
  byCategory:       Array<{ name: string; n: number }>
}

// Unifies disposal practice across instrument versions: v2 records use the
// structured dispFinal[]; v1 records derive categories from the legacy free-text
// ctoDispVc via disposalCategories(). Nothing is mutated — the derivation is at
// read time. Base = homes that store meds and carry any disposal info; coverage
// is reported so the unclassified legacy tail is visible.
export function buildDisposalStats(surveys: Survey[]): DisposalStats | null {
  const catCount = new Map<string, number>()
  let base = 0, fromStructured = 0, fromText = 0, unclassifiedText = 0

  for (const s of surveys) {
    if (s.medSob !== 'Sí') continue
    let cats: string[]
    if (s.dispFinal?.length) {
      cats = s.dispFinal
      fromStructured++
    } else if (s.ctoDispVc?.trim()) {
      cats = disposalCategories(s.ctoDispVc)
      fromText++
      if (cats.length === 0) unclassifiedText++
    } else {
      continue // no disposal information at all
    }
    base++
    for (const c of cats) catCount.set(c, (catCount.get(c) ?? 0) + 1)
  }

  if (base === 0) return null
  const byCategory = OPT.dispFinal
    .map(c => ({ name: c, n: catCount.get(c) ?? 0 }))
    .filter(d => d.n > 0)
    .sort((a, b) => b.n - a.n)

  return { base, fromStructured, fromText, unclassifiedText, byCategory }
}

// ─── Therapeutic class × non-consumption motive (contingency) ───────────────

export interface ClassMotiveCross {
  motives: string[]                                              // motive columns present
  rows: Array<{ group: string; base: number; counts: number[] }> // aligned to `motives`
  nBase: number                                                  // households contributing
}

// Cross-tabulates, at the HOUSEHOLD level, the therapeutic groups a home stores
// against the non-consumption motives it reported. Scoped to instrument v2 with
// stored meds (the battery was asked) and to households with ≥1 classified
// product. A household counts once per group it holds and once per motive it
// selected, so a row's motive counts are over that group's household base —
// e.g. "of homes keeping antibiotics, how many said 'symptoms improved'".
export function buildClassMotiveCross(surveys: Survey[]): ClassMotiveCross | null {
  const asked = surveys.filter(s => (s.instrumentVersion ?? 1) >= 2 && s.medSob === 'Sí')
  if (asked.length === 0) return null

  const motiveTotals = new Map<string, number>()
  const groupAgg = new Map<string, { base: number; counts: Map<string, number> }>()
  let nBase = 0

  for (const s of asked) {
    const groups = new Set<string>()
    for (const m of s.medications ?? []) {
      const g = therapeuticGroup(m.dci || '')
      if (g !== SIN_CLASIFICAR) groups.add(g)
    }
    if (groups.size === 0) continue
    const motives = (s.motNoConsumo ?? []).filter(Boolean)
    nBase++
    for (const mo of motives) motiveTotals.set(mo, (motiveTotals.get(mo) ?? 0) + 1)
    for (const g of groups) {
      const agg = groupAgg.get(g) ?? { base: 0, counts: new Map<string, number>() }
      agg.base++
      for (const mo of motives) agg.counts.set(mo, (agg.counts.get(mo) ?? 0) + 1)
      groupAgg.set(g, agg)
    }
  }

  // Keep motive columns in codebook order, only those actually used.
  const motives = OPT.motNoConsumo.filter(mo => (motiveTotals.get(mo) ?? 0) > 0)
  if (nBase === 0 || motives.length === 0) return null

  const rows = Array.from(groupAgg.entries())
    .map(([group, agg]) => ({ group, base: agg.base, counts: motives.map(mo => agg.counts.get(mo) ?? 0) }))
    .sort((a, b) => b.base - a.base)
    .slice(0, 8)

  return { motives, rows, nBase }
}

// ─── Back-check agreement (re-interview reliability / fraud check) ──────────

const BACKCHECK_BIN: (keyof Survey)[] = [
  'estSalud', 'conMed', 'medPrc', 'indMed', 'medSob', 'dispMedVc', 'vtoMedNc',
]
const BACKCHECK_CAT: (keyof Survey)[] = [
  'etnia', 'asSalud', 'estLab', 'ingreso', 'nvEstu', 'perSalud',
]

export interface BackcheckAgreement {
  nPairs: number
  kappaBin: KappaResult | null  // Cohen's κ over the pooled Sí/No items
  catAgreement: number | null   // raw % agreement over all categorical items
  pesoMAD: number | null        // mean absolute difference in measured weight (g)
}

// Pairs each back-check with its original survey and measures inter-observer
// agreement: Cohen's κ over the Sí/No items, raw agreement over all categorical
// items, and the mean absolute weight difference. Low agreement flags either
// interpretation variability (training) or fabrication.
export function buildBackcheckAgreement(surveys: Survey[]): BackcheckAgreement | null {
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

// ─── Confounding-adjusted association (Mantel–Haenszel) ─────────────────────

export interface AdjustedAssoc {
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
export function buildEstratoAdjusted(surveys: Survey[]): AdjustedAssoc | null {
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
