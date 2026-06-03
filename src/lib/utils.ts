import type { Survey, Medication, ProductMetrics } from '../types'

// ─── Date helpers ─────────────────────────────────────────────────────────

/**
 * Calcula edad en años completos entre fNac y fEta (F_ETA − F_NAC).
 * Coincide con la lógica Excel del codebook.
 */
export function calcEdad(fEta: string, fNac: string): number | null {
  if (!fEta || !fNac) return null
  const eta = new Date(fEta + 'T00:00:00')
  const nac = new Date(fNac + 'T00:00:00')
  if (isNaN(eta.getTime()) || isNaN(nac.getTime())) return null
  if (nac >= eta) return null
  let age = eta.getFullYear() - nac.getFullYear()
  const m = eta.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && eta.getDate() < nac.getDate())) age--
  return age < 0 || age > 130 ? null : age
}

/** Diferencia en días enteros (a − b). Espejo de la resta de fechas Excel. */
export function dayDiff(a: string, b: string): number | null {
  if (!a || !b) return null
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null
  return Math.round((da.getTime() - db.getTime()) / 86_400_000)
}

/**
 * Métricas de tiempo por producto (lógica Excel del codebook).
 * T_VTO  = F_ETA − F_VTO   (días vencido acumulado en hogar)
 * T_DISP = F_ETA − F_DISP  (ciclo total entrega → encuesta)
 * V_UTIL = F_VTO − F_DISP  (vida útil remanente al entregar)
 */
export function productMetrics(fEta: string, fDisp: string, med: Medication): ProductMetrics {
  const tVto  = dayDiff(fEta,  med.fVto)
  const tDisp = dayDiff(fEta,  fDisp)
  const vUtil = dayDiff(med.fVto, fDisp)
  return {
    tVto,
    tDisp,
    vUtil,
    isExpired: tVto !== null && tVto > 0,
  }
}

/** Formatea YYYY-MM-DD a DD/MM/YYYY para visualización. */
export function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Retorna hoy como YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Formatea ISO timestamp a fecha/hora local legible. */
export function fmtTimestamp(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── UUID ─────────────────────────────────────────────────────────────────

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    let r: number
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(1)
      crypto.getRandomValues(array)
      r = array[0] % 16
    } else {
      r = (Math.random() * 16) | 0
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ─── Numbers ──────────────────────────────────────────────────────────────

export const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0

export const safeNum = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0

/**
 * Comparator for sortable table cells. Empty values (null/undefined/'') always
 * sort last regardless of direction; numbers compare numerically and strings use
 * a locale-aware, numeric-aware collation (so "10" sorts after "2").
 */
export function compareSortable(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es', { numeric: true })
}

// ─── Inferential statistics ─────────────────────────────────────────────────

export interface Proportion {
  n:     number  // successes
  total: number  // base (denominator)
  p:     number  // point estimate, 0..1
  lo:    number  // 95% CI lower bound, 0..1
  hi:    number  // 95% CI upper bound, 0..1
}

/**
 * Wilson score confidence interval for a binomial proportion (default 95%).
 * Preferred over the naive Wald interval because it stays inside [0,1] and
 * remains reliable for small samples and proportions near 0 or 1 — the typical
 * case for per-city / per-stratum cells in this survey. Returns a zero-width
 * interval when there is no base to avoid division by zero.
 */
export function wilsonCI(successes: number, total: number, z = 1.96): Proportion {
  if (total <= 0) return { n: successes, total: 0, p: 0, lo: 0, hi: 0 }
  const p      = successes / total
  const z2     = z * z
  const denom  = 1 + z2 / total
  const centre = p + z2 / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)
  return {
    n: successes,
    total,
    p,
    lo: Math.max(0, (centre - margin) / denom),
    hi: Math.min(1, (centre + margin) / denom),
  }
}

/**
 * Sample quantile with linear interpolation (R type-7 / NumPy default). Returns
 * NaN for an empty input. Sorts a copy, so the caller's array is untouched,
 * unless isSorted is true, in which case it uses the array directly.
 */
export function quantile(values: number[], q: number, isSorted = false): number {
  if (values.length === 0) return NaN
  const sorted = isSorted ? values : [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const lo  = Math.floor(pos)
  const hi  = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo])
}

export interface RiskRatio {
  rr:  number   // prevalence/risk ratio vs reference
  lo:  number   // 95% CI lower
  hi:  number   // 95% CI upper
  ref: boolean  // true for the reference group itself
}

/**
 * Prevalence ratio (a/n1 ÷ c/n0) of an outcome in an exposed group vs a
 * reference group, with a 95% CI from the log-ratio (Katz) method. When any
 * cell is empty the Haldane–Anscombe 0.5 correction keeps the estimate finite.
 * A CI that excludes 1 indicates a statistically significant association.
 */
export function prevalenceRatio(a: number, n1: number, c: number, n0: number): RiskRatio {
  if (n1 <= 0 || n0 <= 0) return { rr: NaN, lo: NaN, hi: NaN, ref: false }
  let A = a, C = c, N1 = n1, N0 = n0
  const b = n1 - a, d = n0 - c
  if (a === 0 || c === 0 || b === 0 || d === 0) {
    A = a + 0.5; C = c + 0.5; N1 = n1 + 1; N0 = n0 + 1
  }
  const rr = (A / N1) / (C / N0)
  const se = Math.sqrt(1 / A + 1 / C - 1 / N1 - 1 / N0)
  return { rr, lo: rr * Math.exp(-1.96 * se), hi: rr * Math.exp(1.96 * se), ref: false }
}

export interface ChiSquare {
  chi2:        number  // Pearson statistic
  df:          number  // degrees of freedom
  p:           number  // upper-tail p-value
  minExpected: number  // smallest expected cell (chi² unreliable if < 5)
}

/** Pearson chi-square test of independence for an R×C contingency table. */
export function chiSquareTest(table: number[][]): ChiSquare {
  const rows = table.length
  const cols = rows ? table[0].length : 0
  const rowSums = table.map(r => r.reduce((s, v) => s + v, 0))
  const colSums = Array.from({ length: cols }, (_, j) => table.reduce((s, r) => s + r[j], 0))
  const total = rowSums.reduce((s, v) => s + v, 0)
  if (total === 0 || rows < 2 || cols < 2) return { chi2: 0, df: 0, p: 1, minExpected: 0 }

  let chi2 = 0
  let minExpected = Infinity
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowSums[i] * colSums[j]) / total
      minExpected = Math.min(minExpected, expected)
      if (expected > 0) chi2 += (table[i][j] - expected) ** 2 / expected
    }
  }
  const df = (rows - 1) * (cols - 1)
  return { chi2, df, p: chiSquareP(chi2, df), minExpected }
}

export interface TrendTest {
  z:         number  // standardized trend statistic
  chi2:      number  // z² ~ chi-square with 1 df
  p:         number  // two-sided p-value
  direction: 'creciente' | 'decreciente' | 'plano'
}

/**
 * Cochran–Armitage test for trend in a binomial proportion across an ORDERED
 * exposure. Unlike a plain chi-square (which treats the groups as unordered and
 * loses power), this tests for a monotone dose-response with the exposure score,
 * the relevant question for a socioeconomic gradient. Each group carries a score
 * (e.g. 1,2,3 for low/mid/high), its size n and its case count. Two-sided
 * p-value via z² ~ χ²₁. Returns null when there is no informative table.
 */
export function cochranArmitage(groups: { score: number; n: number; cases: number }[]): TrendTest | null {
  const N = groups.reduce((s, g) => s + g.n, 0)
  const R = groups.reduce((s, g) => s + g.cases, 0)
  if (groups.length < 2 || N === 0 || R === 0 || R === N) return null

  const pBar  = R / N
  const u     = groups.reduce((s, g) => s + g.score * (g.cases - g.n * pBar), 0)
  const sumNS  = groups.reduce((s, g) => s + g.n * g.score, 0)
  const sumNS2 = groups.reduce((s, g) => s + g.n * g.score * g.score, 0)
  const v = pBar * (1 - pBar) * (sumNS2 - (sumNS * sumNS) / N)
  if (v <= 0) return null

  const z = u / Math.sqrt(v)
  return {
    z,
    chi2: z * z,
    p: chiSquareP(z * z, 1),
    direction: z > 0 ? 'creciente' : z < 0 ? 'decreciente' : 'plano',
  }
}

// Upper-tail p-value of the chi-square distribution: P(X > chi2) with df.
function chiSquareP(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1
  return 1 - regLowerGamma(df / 2, chi2 / 2)
}

// Lanczos approximation of ln Γ(x).
function lnGamma(x: number): number {
  /* eslint-disable no-loss-of-precision -- canonical full-precision Lanczos coefficients */
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  /* eslint-enable no-loss-of-precision */
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y++; ser += g[j] / y }
  return -tmp + Math.log(Math.sqrt(2 * Math.PI) * ser / x)
}

// Regularized lower incomplete gamma P(a,x) (series + continued fraction).
function regLowerGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN
  if (x === 0) return 0
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum
    for (let n = 0; n < 300; n++) {
      ap++; del *= x / ap; sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-13) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  }
  const FPMIN = 1e-300
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c; h *= del
    if (Math.abs(del - 1) < 1e-13) break
  }
  const q = Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
  return 1 - q
}

// ─── Frequency table ──────────────────────────────────────────────────────

export function freqTable<T extends string>(
  surveys: Survey[],
  key: keyof Survey,
  options: readonly T[],
): { name: T; n: number }[] {
  return options.map(v => ({
    name: v,
    n: surveys.filter(s => s[key] === v).length,
  }))
}

/** Groups surveys by a string key and sums a numeric field. */
export function groupSum(
  surveys: Survey[],
  groupKey: keyof Survey,
  sumKey: keyof Survey,
): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const s of surveys) {
    const k = String(s[groupKey] ?? 'Sin dato') || 'Sin dato'
    map.set(k, (map.get(k) ?? 0) + ((s[sumKey] as number | null) ?? 0))
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

// ─── CSV export (codebook column order) ───────────────────────────────────

const CSV_COLUMNS: (keyof Survey)[] = [
  'id', 'fEta', 'nui', 'nuiEtr', 'fNac',
  'ciudad', 'dir', 'estrato',
  'etnia', 'asSalud', 'estLab', 'ingreso', 'nvEstu', 'nvPosg',
  'perSalud', 'estSalud', 'prbSalud', 'conMed', 'medPrc',
  'fPrc', 'fDisp', 'indMed',
  'medSob', 'dispMedVc', 'ctoDispVc', 'vtoMedNc',
  'cantMed', 'cantMedVto', 'pesoMedNc',
  'obs', 'createdAt', 'updatedAt',
]

function escapeCSV(value: unknown): string {
  const str = String(value ?? '')
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

export function toCSV(surveys: Survey[]): string {
  const medHeader = 'nmMed,dci,concMed,undConc,fVto'
  const header = [...CSV_COLUMNS, medHeader].join(',')
  const rows = surveys.map(s => {
    const base = CSV_COLUMNS.map(col => escapeCSV(s[col])).join(',')
    const meds = s.medications?.length
      ? s.medications.map(m =>
          [m.nmMed, m.dci, m.concMed, m.undConc, m.fVto].map(escapeCSV).join(';'),
        ).join('|')
      : ''
    return `${base},${escapeCSV(meds)}`
  })
  return '﻿' + [header, ...rows].join('\n')
}

// ─── Download ─────────────────────────────────────────────────────────────

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function dateTag(): string {
  return new Date().toISOString().slice(0, 10)
}
